import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBknuhKeqZSGx-3gz5lPRr9eryjyKoC2UY",
  authDomain: "kr-shiptrack.firebaseapp.com",
  projectId: "kr-shiptrack",
  storageBucket: "kr-shiptrack.firebasestorage.app",
  messagingSenderId: "127457701246",
  appId: "1:127457701246:web:c7f7f6d38cf574cb83572f",
  measurementId: "G-5XHX2RG4R0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('googleLoginBtn');
const guestBtn = document.getElementById('guestLoginBtn'); // 비회원 버튼
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
let isGuest = false; // 비회원 모드 여부
let currentFilter = 'all'; 
let currentCarrierId = 'kr.cjlogistics';
let unsubscribe = null;

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
// 1. 인증 및 상태 관리 (하이브리드)
// ========================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // [회원] 로그인 성공
        currentUser = user;
        isGuest = false;
        loginScreen.style.display = 'none';
        appContainer.style.display = 'flex'; // PC에선 flex, 모바일에선 css media query로 제어됨
        subscribeMyTracks(user.uid);
    } else {
        // [비회원 상태]
        if (isGuest) {
            // 비회원으로 입장한 경우
            currentUser = null;
            loginScreen.style.display = 'none';
            appContainer.style.display = 'flex';
            loadGuestTracks(); // 로컬 스토리지 로드
        } else {
            // 아예 초기화면
            currentUser = null;
            loginScreen.style.display = 'flex';
            appContainer.style.display = 'none';
            if (unsubscribe) unsubscribe();
        }
    }
});

loginBtn.addEventListener('click', () => {
    isGuest = false;
    signInWithPopup(auth, provider).catch((error) => alert("로그인 실패: " + error.message));
});

// [추가] 비회원 로그인 버튼
guestBtn.addEventListener('click', () => {
    isGuest = true;
    loginScreen.style.display = 'none';
    appContainer.style.display = 'flex';
    loadGuestTracks();
});

logoutBtn.addEventListener('click', () => {
    if (isGuest) {
        if(confirm("비회원 모드를 종료하시겠습니까?")) {
            isGuest = false;
            location.reload(); // 새로고침해서 초기 화면으로
        }
    } else {
        if(confirm("로그아웃 하시겠습니까?")) signOut(auth);
    }
});

// ========================
// 2. 데이터 불러오기 (DB vs Local)
// ========================
function subscribeMyTracks(uid) {
    const q = query(collection(db, "users", uid, "tracks"), orderBy("id", "desc"));
    unsubscribe = onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
            items.push({ docId: doc.id, ...doc.data() });
        });
        renderList(items);
        items.forEach(item => checkDeliveryStatus(item));
    });
}

function loadGuestTracks() {
    // 로컬 스토리지에서 불러오기
    const localData = JSON.parse(localStorage.getItem('guestTracks')) || [];
    // 로컬 데이터는 docId가 없으므로 id를 docId로 사용
    const items = localData.map(item => ({ docId: item.id, ...item }));
    
    // 최신순 정렬
    items.sort((a, b) => b.id - a.id);
    
    renderList(items);
    items.forEach(item => checkDeliveryStatus(item));
}

// ========================
// 3. UI 렌더링
// ========================
function renderList(items) {
    const sortedItems = items.sort((a, b) => (a.statusRank || 1) - (b.statusRank || 1));
    const filteredItems = sortedItems.filter(item => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'active') return item.statusRank !== 2;
        if (currentFilter === 'completed') return item.statusRank === 2;
        return true;
    });

    trackingList.innerHTML = '';
    if (filteredItems.length === 0) {
        trackingList.innerHTML = '<div class="empty-msg">내역이 없습니다</div>';
        return;
    }
    filteredItems.forEach(item => createDOM(item));
}

function createDOM(item) {
    const info = carrierInfo[item.carrier] || { name: '택배', url: '#' };
    const displayTitle = (item.memo && item.memo.trim()) ? item.memo : item.number;

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
    li.id = `item-${item.docId}`;
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

    li.querySelector('.item-title').onclick = () => editMemo(item);
    li.querySelector('.number').onclick = () => copy(item.number);
    li.querySelector('.btn-track').onclick = () => window.open(info.url + item.number, '_blank');
    li.querySelector('.btn-delete').onclick = () => deleteTrack(item); // item 객체 전체 전달

    trackingList.appendChild(li);
}

// ========================
// 4. 데이터 조작 (CRUD) - 하이브리드 적용
// ========================

// [추가]
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser && !isGuest) return alert("로그인 또는 비회원 시작이 필요합니다.");

    const number = numInput.value;
    const memo = memoInput.value.trim();
    const startDate = dateInput.value;

    if (number.length < 9) return alert('번호를 확인해주세요.');
    addBtn.disabled = true; addBtn.innerText = "저장 중...";

    const newItem = {
        id: Date.now(),
        carrier: currentCarrierId,
        number: number,
        memo: memo,
        startDate: startDate,
        statusRank: 1,
        lastState: '등록됨',
        lastDetail: '',
        lastUpdate: 0
    };

    if (currentUser) {
        // [회원] DB 저장
        try {
            await addDoc(collection(db, "users", currentUser.uid, "tracks"), newItem);
            finishAdd();
        } catch (err) {
            console.error(err);
            alert("저장 실패");
        }
    } else {
        // [비회원] 로컬 저장
        const items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        items.push(newItem);
        localStorage.setItem('guestTracks', JSON.stringify(items));
        finishAdd();
        loadGuestTracks(); // 화면 갱신
    }
    
    addBtn.disabled = false; addBtn.innerText = "조회 및 추가";
});

// [삭제]
async function deleteTrack(item) {
    if(!confirm('삭제하시겠습니까?')) return;
    
    if (currentUser) {
        // [회원] DB 삭제
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "tracks", item.docId));
        } catch(e) { console.error(e); }
    } else {
        // [비회원] 로컬 삭제
        let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        items = items.filter(i => i.id !== item.id);
        localStorage.setItem('guestTracks', JSON.stringify(items));
        loadGuestTracks();
    }
}

// [수정]
async function editMemo(item) {
    const newMemo = prompt('수정할 메모를 입력하세요:', item.memo || '');
    if (newMemo === null) return;
    
    if (currentUser) {
        // [회원] DB 수정
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
                memo: newMemo
            });
        } catch(e) { console.error(e); }
    } else {
        // [비회원] 로컬 수정
        let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        const target = items.find(i => i.id === item.id);
        if(target) {
            target.memo = newMemo;
            localStorage.setItem('guestTracks', JSON.stringify(items));
            loadGuestTracks();
        }
    }
}

// [상태 조회 및 업데이트]
async function checkDeliveryStatus(item) {
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

            // 상태가 변했으면 업데이트
            if (item.lastState !== stateText || item.lastDetail !== detail) {
                if (currentUser) {
                    // [회원] DB 업데이트
                    await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
                        lastState: stateText,
                        lastDetail: detail,
                        statusRank: rank,
                        lastUpdate: Date.now()
                    });
                } else {
                    // [비회원] 로컬 업데이트
                    let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
                    const target = items.find(i => i.id === item.id);
                    if (target) {
                        target.lastState = stateText;
                        target.lastDetail = detail;
                        target.statusRank = rank;
                        target.lastUpdate = Date.now();
                        localStorage.setItem('guestTracks', JSON.stringify(items));
                        // 로컬은 자동갱신 안되므로 화면 강제 리렌더링은 보류 (깜빡임 방지), 
                        // 다음 로드 때 반영되거나 수동 새로고침시 반영됨. 
                        // 즉각 반영 원하면 loadGuestTracks() 호출 가능하나 UX상 놔둠.
                        // (원활한 UX를 위해 여기서 DOM만 살짝 바꿔줌)
                        const el = document.getElementById(`item-${item.id}`);
                        if(el) {
                           el.querySelector('.status-text').innerText = stateText;
                           el.querySelector('.detail-text').innerText = detail;
                           if(rank===2) el.className='status-delivered';
                           if(rank===3) el.className='status-error';
                        }
                    }
                }
            }
        }
    } catch (e) { console.log("조회 패스"); }
}

// ========================
// 5. 유틸리티 & 기타
// ========================

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
    
    if(currentUser) subscribeMyTracks(currentUser.uid);
    else if(isGuest) loadGuestTracks();
}

window.showSelectBox = function() {
    predictionArea.classList.remove('show'); 
    carrierSelect.style.display = 'block';   
    carrierSelect.classList.add('show');
}
carrierSelect.addEventListener('change', (e) => currentCarrierId = e.target.value);

function finishAdd() {
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
