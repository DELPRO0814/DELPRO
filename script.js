// [Firebase 라이브러리 가져오기]
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ▼▼▼ [적용 완료] 사용자님의 프로젝트 설정 ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyBknuhKeqZSGx-3gz5lPRr9eryjyKoC2UY",
  authDomain: "kr-shiptrack.firebaseapp.com",
  projectId: "kr-shiptrack",
  storageBucket: "kr-shiptrack.firebasestorage.app",
  messagingSenderId: "127457701246",
  appId: "1:127457701246:web:c7f7f6d38cf574cb83572f",
  measurementId: "G-5XHX2RG4R0" // measurement -> measurementId로 표준 이름 사용 (상관은 없음)
};
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM 요소
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const trackingList = document.getElementById('tracking-list');
const addBtn = document.getElementById('addBtn');
const toast = document.getElementById('toast');
const numInput = document.getElementById('trackingNumber');
const memoInput = document.getElementById('trackingMemo');
const dateInput = document.getElementById('deliveryDate');
const predictionArea = document.getElementById('predictionArea');
const predictionText = document.getElementById('predictionText');
const carrierSelect = document.getElementById('carrierSelect');
const tabGlider = document.getElementById('tab-glider');

let currentUser = null;
let currentFilter = 'all'; 
let currentCarrierId = 'kr.cjlogistics';
let unsubscribe = null; // 실시간 리스너 해제용

// [택배사 정보 및 매핑]
const carrierKeywords = {
    'kr.cjlogistics': ['CJ', '대한통운', '씨제이'],
    'kr.epost': ['우체국', '등기', 'EMS', 'POST'],
    'kr.hanjin': ['한진'],
    'kr.lotteglogis': ['롯데', 'LOTTE'],
    'kr.logen': ['로젠', 'LOGEN'],
    'kr.cupost': ['CU', '편의점'],
    'kr.cvsnet': ['GS', '반값', 'POSTBOX'],
    'kr.kdexp': ['경동'],
    'kr.daesin': ['대신']
};

const carrierInfo = {
    'kr.cjlogistics': { name: 'CJ대한통운', url: 'https://trace.cjlogistics.com/next/tracking.html?wblNo=' },
    'kr.epost': { name: '우체국', url: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=' },
    'kr.hanjin': { name: '한진', url: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblNum=' },
    'kr.lotteglogis': { name: '롯데', url: 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=' },
    'kr.logen': { name: '로젠', url: 'https://www.ilogen.com/m/personal/trace/' },
    'global.aliexpress': { name: '알리(직구)', url: 'https://t.17track.net/ko#nums=' },
    'kr.cupost': { name: 'CU 편의점', url: 'https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=' },
    'kr.cvsnet': { name: 'GS Postbox', url: 'http://www.cvsnet.co.kr/invoice/tracking.jsp?invoice_no=' },
    'kr.kdexp': { name: '경동택배', url: 'https://kdexp.com/service/delivery/delivery_view.do?item=' },
    'kr.daesin': { name: '대신택배', url: 'https://www.ds3211.co.kr/freight/internalFreightSearch.do?billno=' }
};

// ========================
// 1. 인증 로직 (로그인/로그아웃)
// ========================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 성공
        currentUser = user;
        loginScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        // 내 데이터 실시간 구독 시작
        subscribeMyTracks(user.uid);
    } else {
        // 로그아웃 상태
        currentUser = null;
        loginScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        if (unsubscribe) unsubscribe(); // 리스너 해제
    }
});

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => alert("로그인 실패: " + error.message));
});

logoutBtn.addEventListener('click', () => {
    if(confirm("로그아웃 하시겠습니까?")) signOut(auth);
});

// ========================
// 2. DB 실시간 연동 (Firestore)
// ========================
function subscribeMyTracks(uid) {
    // users/{uid}/tracks 컬렉션을 구독 (최신순 정렬)
    const q = query(collection(db, "users", uid, "tracks"), orderBy("id", "desc"));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
            items.push({ docId: doc.id, ...doc.data() });
        });
        
        // 데이터가 변경될 때마다 화면 갱신
        renderList(items);
        
        // 상태 업데이트 (백그라운드 조회) - 너무 잦은 호출 방지 필요하지만 일단 단순하게
        items.forEach(item => checkDeliveryStatus(item));
    });
}

// ========================
// 3. UI 렌더링
// ========================
function renderList(items) {
    // 정렬: 배송중(1) -> 완료(2) -> 에러(3)
    // (이미 DB에서 최신순으로 가져왔지만, 상태별로 다시 정렬하고 싶다면 아래 코드 사용)
    const sortedItems = items.sort((a, b) => (a.statusRank || 1) - (b.statusRank || 1));
    
    // 필터링
    const filteredItems = sortedItems.filter(item => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'active') return item.statusRank !== 2; // 완료 아님
        if (currentFilter === 'completed') return item.statusRank === 2; // 완료
        return true;
    });

    trackingList.innerHTML = '';
    if (filteredItems.length === 0) {
        trackingList.innerHTML = '<div class="empty-msg">내역이 없습니다</div>';
        return;
    }

    filteredItems.forEach(item => {
        createDOM(item);
    });
}

function createDOM(item) {
    const info = carrierInfo[item.carrier] || { name: '택배', url: '#' };
    const displayTitle = (item.memo && item.memo.trim()) ? item.memo : item.number;

    // D-Day
    let dDayTag = '';
    if (item.startDate) {
        const start = new Date(item.startDate);
        const now = new Date();
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        const dayText = diff >= 0 ? `D+${diff}` : `D${diff}`;
        dDayTag = `<span class="d-day-badge">${dayText}</span>`;
    }

    let statusClass = '';
    if (item.carrier === 'global.aliexpress') statusClass = 'status-global';
    else {
        const s = item.lastState || '';
        if(s.includes('완료') || s.includes('도착')) statusClass = 'status-delivered';
        else if(s.includes('지연') || s.includes('실패')) statusClass = 'status-error';
    }

    const savedState = item.lastState || '확인 중...';
    const savedDetail = item.lastDetail || '';

    const li = document.createElement('li');
    li.id = `item-${item.docId}`; // Firestore 문서 ID 사용
    if(statusClass) li.className = statusClass;

    li.innerHTML = `
        <div class="info-area">
            <div class="item-header">
                <span class="carrier-badge">${info.name}</span>
                <span class="item-title" id="title-${item.docId}">${displayTitle}</span>
                ${dDayTag}
            </div>
            <div class="meta-row">
                <span class="number">${item.number}</span>
                <div class="status-row">
                    <span class="status-text">${savedState}</span>
                    <span class="detail-text">${savedDetail}</span>
                </div>
            </div>
        </div>
        <div class="actions">
            <button class="btn-track">위치</button>
            <button class="btn-delete">삭제</button>
        </div>
    `;

    // 이벤트 리스너 연결
    li.querySelector('.item-title').onclick = () => editMemo(item);
    li.querySelector('.number').onclick = () => copy(item.number);
    li.querySelector('.btn-track').onclick = () => window.open(info.url + item.number, '_blank');
    li.querySelector('.btn-delete').onclick = () => deleteTrack(item.docId);

    trackingList.appendChild(li);
}

// ========================
// 4. 데이터 조작 (CRUD)
// ========================

// [추가]
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("로그인이 필요합니다.");

    const number = numInput.value;
    const memo = memoInput.value.trim();
    const startDate = dateInput.value;

    if (number.length < 9) return alert('번호를 확인해주세요.');
    addBtn.disabled = true; addBtn.innerText = "저장 중...";

    // DB 저장
    try {
        await addDoc(collection(db, "users", currentUser.uid, "tracks"), {
            id: Date.now(), // 정렬용 타임스탬프
            carrier: currentCarrierId,
            number: number,
            memo: memo,
            startDate: startDate,
            statusRank: 1,
            lastState: '등록됨',
            lastDetail: '',
            lastUpdate: 0
        });
        finishAdd();
    } catch (err) {
        console.error(err);
        alert("저장 실패 (Firestore 규칙을 확인하세요)");
        addBtn.disabled = false;
    }
});

// [삭제]
async function deleteTrack(docId) {
    if(!confirm('삭제하시겠습니까?')) return;
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "tracks", docId));
    } catch(e) { console.error(e); }
}

// [수정]
async function editMemo(item) {
    const newMemo = prompt('수정할 메모를 입력하세요:', item.memo || '');
    if (newMemo === null) return;
    try {
        await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
            memo: newMemo
        });
    } catch(e) { console.error(e); }
}

// [API 조회] - 조회 결과 DB 업데이트
async function checkDeliveryStatus(item) {
    // 5분(300000ms) 이내에 조회했거나, 이미 배송완료(rank 2)면 조회 스킵
    if (Date.now() - (item.lastUpdate || 0) < 300000 || item.statusRank === 2) return;
    if (item.carrier === 'global.aliexpress') return;

    try {
        const res = await fetchWithProxy(`https://apis.tracker.delivery/carriers/${item.carrier}/tracks/${item.number}`);
        if(res.ok) {
            const data = await res.json();
            const stateText = data.state ? data.state.text : '상태 미등록';
            const location = (data.progresses && data.progresses.length > 0) ? data.progresses[data.progresses.length - 1].location.name : '';
            const time = (data.progresses && data.progresses.length > 0) ? data.progresses[data.progresses.length - 1].time.substring(5, 16).replace('T', ' ') : '';
            
            const detail = location ? `${time} | ${location}` : (time || '');
            let rank = 1;
            if (stateText.includes('완료') || stateText.includes('도착')) rank = 2;
            else if (stateText.includes('실패')) rank = 3;

            // 값이 다를 때만 DB 업데이트
            if (item.lastState !== stateText || item.lastDetail !== detail) {
                await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
                    lastState: stateText,
                    lastDetail: detail,
                    statusRank: rank,
                    lastUpdate: Date.now()
                });
            }
        }
    } catch (e) { console.log("조회 패스"); }
}

// ========================
// 5. 유틸리티 & 기타
// ========================

// 스마트 붙여넣기
numInput.addEventListener('input', (e) => {
    let val = e.target.value;
    for (const [id, keywords] of Object.entries(carrierKeywords)) {
        if (keywords.some(k => val.toUpperCase().includes(k))) {
            currentCarrierId = id;
            carrierSelect.value = id;
            predictionText.innerText = `감지됨: ${carrierInfo[id].name}`;
            predictionArea.classList.add('show');
            break;
        }
    }
    const numbers = val.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    if (val.length > 20 || val.includes('운송장') || val.includes('배송')) {
        numInput.value = numbers;
    } else {
        numInput.value = numbers;
    }
    if(carrierSelect.style.display === 'block') return;
    if (numbers.length >= 9 && !predictionArea.classList.contains('show')) {
        if (/^[A-Z]/.test(numbers)) currentCarrierId = 'global.aliexpress';
        else if (numbers.length === 13) currentCarrierId = 'kr.epost';
        else currentCarrierId = 'kr.cjlogistics';
        predictionText.innerText = `예상: ${carrierInfo[currentCarrierId].name}`;
        carrierSelect.value = currentCarrierId; 
        predictionArea.classList.add('show');
    } else if (numbers.length < 9) {
        predictionArea.classList.remove('show');
    }
});

// 탭 필터
document.getElementById('filter-all').onclick = (e) => setFilter(e, 'all');
document.getElementById('filter-active').onclick = (e) => setFilter(e, 'active');
document.getElementById('filter-completed').onclick = (e) => setFilter(e, 'completed');

function setFilter(event, filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    const buttons = Array.from(document.querySelectorAll('.filter-btn'));
    const index = buttons.indexOf(event.target);
    tabGlider.style.transform = `translateX(${index * 100}%)`;
    
    // 필터 변경 시 다시 구독 로직 호출 (화면 갱신)
    if(currentUser) subscribeMyTracks(currentUser.uid);
}

// 기타 UI 함수
window.showSelectBox = function() {
    predictionArea.classList.remove('show'); 
    carrierSelect.style.display = 'block';   
    carrierSelect.classList.add('show');
}
carrierSelect.addEventListener('change', (e) => currentCarrierId = e.target.value);

function finishAdd() {
    addBtn.disabled = false; addBtn.innerText = "조회 및 추가";
    numInput.value = '';
    memoInput.value = '';
    dateInput.value = ''; 
    predictionArea.classList.remove('show');
    carrierSelect.style.display = 'none';
    carrierSelect.classList.remove('show');
}

async function fetchWithProxy(targetUrl) {
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
    return await fetch(proxyUrl);
}

function copy(text) {
    navigator.clipboard.writeText(text);
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
}