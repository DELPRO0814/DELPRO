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

// 현재 페이지 요소 확인
const loginBtn = document.getElementById('googleLoginBtn');
const guestBtn = document.getElementById('guestLoginBtn'); 
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;
let currentFilter = 'all'; 
let currentCarrierId = 'kr.cjlogistics';
let unsubscribe = null;

// [인증 상태 감지 및 라우팅]
onAuthStateChanged(auth, (user) => {
    if (user) {
        // [회원] 로그인 상태
        currentUser = user;
        if (loginBtn) {
            // 로그인 페이지라면 -> 메인 앱(루트)으로 이동
            window.location.replace('/');
        } else {
            // 앱 페이지라면 -> 데이터 구독
            subscribeMyTracks(user.uid);
        }
    } else {
        // [비로그인]
        const isGuest = localStorage.getItem('guestMode') === 'true';

        if (isGuest) {
            // [비회원 모드]
            if (loginBtn) {
                // 로그인 페이지라면 -> 메인 앱(루트)으로 이동
                window.location.replace('/');
            } else {
                loadGuestTracks();
            }
        } else {
            // [완전 비로그인]
            if (!loginBtn) {
                // 앱 페이지라면 -> 로그인 폴더로 쫓아냄
                window.location.replace('/login');
            }
        }
    }
});

// [로그인 페이지 로직]
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        localStorage.removeItem('guestMode');
        signInWithPopup(auth, provider).catch((error) => alert("로그인 실패: " + error.message));
    });

    guestBtn.addEventListener('click', () => {
        localStorage.setItem('guestMode', 'true');
        window.location.replace('/');
    });
}

// [앱 페이지 로직]
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (localStorage.getItem('guestMode') === 'true') {
            if(confirm("비회원 모드를 종료하시겠습니까?")) {
                localStorage.removeItem('guestMode');
                window.location.replace('/login');
            }
        } else {
            if(confirm("로그아웃 하시겠습니까?")) {
                signOut(auth).then(() => {
                    window.location.replace('/login');
                });
            }
        }
    });

    // 앱 페이지 기능들
    const trackingForm = document.getElementById('trackingForm');
    if (trackingForm) {
        trackingForm.addEventListener('submit', handleAddSubmit);
        document.getElementById('trackingNumber').addEventListener('input', handleSmartInput);
        document.getElementById('carrierSelect').addEventListener('change', (e) => currentCarrierId = e.target.value);
        
        document.getElementById('filter-all').onclick = (e) => setFilter(e, 'all');
        document.getElementById('filter-active').onclick = (e) => setFilter(e, 'active');
        document.getElementById('filter-completed').onclick = (e) => setFilter(e, 'completed');
    }
}

// ------------------------------------------------------------
// [기능 함수들]
// ------------------------------------------------------------
const carrierKeywords = { 'kr.cjlogistics': ['CJ', '대한통운'], 'kr.epost': ['우체국', '등기'], 'kr.hanjin': ['한진'], 'kr.lotteglogis': ['롯데'], 'kr.logen': ['로젠'], 'kr.cupost': ['CU', '편의점'], 'kr.cvsnet': ['GS', '반값'], 'kr.kdexp': ['경동'], 'kr.daesin': ['대신'] };
// const carrierInfo = {
//     'kr.cjlogistics': { name: 'CJ대한통운', url: 'https://trace.cjlogistics.com/next/tracking.html?wblNo=' },
//     'kr.epost': { name: '우체국', url: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=' },
//     // 'kr.hanjin': { name: '한진', url: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblNum=' },
//     'kr.hanjin': { name: '한진', url: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnum=' },
//     'kr.lotteglogis': { name: '롯데', url: 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=' },
//     'kr.logen': { name: '로젠', url: 'https://www.ilogen.com/m/personal/trace/' },
//     'global.aliexpress': { name: '알리(직구)', url: 'https://t.17track.net/ko#nums=' },
//     'kr.cupost': { name: 'CU 편의점', url: 'https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=' },
//     'kr.cvsnet': { name: 'GS Postbox', url: 'http://www.cvsnet.co.kr/invoice/tracking.jsp?invoice_no=' },
//     'kr.kdexp': { name: '경동택배', url: 'https://kdexp.com/service/delivery/delivery_view.do?item=' },
//     'kr.daesin': { name: '대신택배', url: 'https://www.ds3211.co.kr/freight/internalFreightSearch.do?billno=' }
// };

const carrierInfo = {
    'kr.cjlogistics': { name: 'CJ대한통운', url: 'https://trace.cjlogistics.com/next/tracking.html?wblNo=' },
    'kr.epost': { name: '우체국', url: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=' },
    // 한진택배: 사용자가 확인한 성공 URL 구조 적용 (wblnum 소문자 및 파라미터 순서 조정)
    'kr.hanjin': { name: '한진', url: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText=&wblnum=' },
    'kr.lotteglogis': { name: '롯데', url: 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=' },
    // 로젠택배: 모바일 페이지에서 번호를 바로 붙여서 호출 가능하도록 최신화
    'kr.logen': { name: '로젠', url: 'https://www.ilogen.com/m/personal/trace/' },
    'global.aliexpress': { name: '알리(직구)', url: 'https://t.17track.net/ko#nums=' },
    'kr.cupost': { name: 'CU 편의점', url: 'https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=' },
    // GS Postbox: HTTP -> HTTPS 보안 연결 및 최신 조회 경로로 변경
    'kr.cvsnet': { name: 'GS Postbox', url: 'https://www.cvsnet.co.kr/reservation-inquiry/delivery/index.do?inv_no=' },
    'kr.kdexp': { name: '경동택배', url: 'https://kdexp.com/service/delivery/delivery_view.do?item=' },
    'kr.daesin': { name: '대신택배', url: 'https://www.ds3211.co.kr/freight/internalFreightSearch.do?billno=' }
};

function subscribeMyTracks(uid) {
    const q = query(collection(db, "users", uid, "tracks"), orderBy("id", "desc"));
    unsubscribe = onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => { items.push({ docId: doc.id, ...doc.data() }); });
        renderList(items);
        items.forEach(item => checkDeliveryStatus(item));
    });
}

function loadGuestTracks() {
    const localData = JSON.parse(localStorage.getItem('guestTracks')) || [];
    const items = localData.map(item => ({ docId: item.id, ...item }));
    items.sort((a, b) => b.id - a.id);
    renderList(items);
    items.forEach(item => checkDeliveryStatus(item));
}

function renderList(items) {
    const sortedItems = items.sort((a, b) => (a.statusRank || 1) - (b.statusRank || 1));
    const filteredItems = sortedItems.filter(item => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'active') return item.statusRank !== 2;
        if (currentFilter === 'completed') return item.statusRank === 2;
        return true;
    });
    const list = document.getElementById('tracking-list');
    if(!list) return;
    list.innerHTML = '';
    if (filteredItems.length === 0) { list.innerHTML = '<div class="empty-msg">내역이 없습니다</div>'; return; }
    filteredItems.forEach(item => createDOM(item));
}

function createDOM(item) {
    const list = document.getElementById('tracking-list');
    if(!list) return;

    const info = carrierInfo[item.carrier] || { name: '택배', url: '#' };
    const displayTitle = (item.memo && item.memo.trim()) ? item.memo : item.number;
    
    let dDayTag = '';
    if (item.startDate) {
        const diff = Math.floor((new Date() - new Date(item.startDate)) / (1000 * 60 * 60 * 24));
        dDayTag = `<span class="d-day-badge">${diff >= 0 ? 'D+' + diff : 'D' + diff}</span>`;
    }

    const li = document.createElement('li');
    li.id = `item-${item.docId}`;
    
    let statusClass = '';
    if (item.carrier === 'global.aliexpress') statusClass = 'status-global';
    else if ((item.lastState||'').includes('완료') || (item.lastState||'').includes('도착')) statusClass = 'status-delivered';
    else if ((item.lastState||'').includes('실패')) statusClass = 'status-error';
    if(statusClass) li.className = statusClass;

    li.innerHTML = `
        <div class="info-area">
            <div class="item-header">
                <span class="carrier-badge">${info.name}</span>
                <span class="item-title">${displayTitle}</span>
                ${dDayTag}
            </div>
            <div class="meta-row">
                <span class="number">${item.number}</span>
                <div class="status-row">
                    <span class="status-text">${item.lastState || '확인 중...'}</span>
                    <span class="detail-text">${item.lastDetail || ''}</span>
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
    li.querySelector('.btn-delete').onclick = () => deleteTrack(item); 
    list.appendChild(li);
}

async function handleAddSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('addBtn');
    const numVal = document.getElementById('trackingNumber').value;
    const memoVal = document.getElementById('trackingMemo').value.trim();
    const dateVal = document.getElementById('deliveryDate').value;
    
    if (numVal.length < 9) return alert('번호를 확인해주세요.');
    btn.disabled = true; btn.innerText = "저장 중...";

    const newItem = {
        id: Date.now(),
        carrier: currentCarrierId,
        number: numVal,
        memo: memoVal,
        startDate: dateVal,
        statusRank: 1,
        lastState: '등록됨',
        lastDetail: '',
        lastUpdate: 0
    };

    if (currentUser) {
        try { await addDoc(collection(db, "users", currentUser.uid, "tracks"), newItem); finishAdd(); } 
        catch (err) { console.error(err); alert("저장 실패"); }
    } else {
        const items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        items.push(newItem);
        localStorage.setItem('guestTracks', JSON.stringify(items));
        finishAdd();
        loadGuestTracks();
    }
    btn.disabled = false; btn.innerText = "조회 및 추가";
}

function handleSmartInput(e) {
    const val = e.target.value;
    const pArea = document.getElementById('predictionArea');
    const pText = document.getElementById('predictionText');
    const cSelect = document.getElementById('carrierSelect');
    
    for (const [id, keywords] of Object.entries(carrierKeywords)) {
        if (keywords.some(k => val.toUpperCase().includes(k))) {
            currentCarrierId = id;
            cSelect.value = id;
            pText.innerText = `감지됨: ${carrierInfo[id].name}`;
            pArea.classList.add('show');
            break;
        }
    }
    const numbers = val.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    e.target.value = numbers;
    
    if(cSelect.style.display === 'block') return;
    if (numbers.length >= 9 && !pArea.classList.contains('show')) {
        if (/^[A-Z]/.test(numbers)) currentCarrierId = 'global.aliexpress';
        else if (numbers.length === 13) currentCarrierId = 'kr.epost';
        else currentCarrierId = 'kr.cjlogistics';
        pText.innerText = `예상: ${carrierInfo[currentCarrierId].name}`;
        cSelect.value = currentCarrierId; 
        pArea.classList.add('show');
    } else if (numbers.length < 9) {
        pArea.classList.remove('show');
    }
}

async function deleteTrack(item) {
    if(!confirm('삭제하시겠습니까?')) return;
    if (currentUser) {
        try { await deleteDoc(doc(db, "users", currentUser.uid, "tracks", item.docId)); } catch(e) {}
    } else {
        let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        items = items.filter(i => i.id !== item.id);
        localStorage.setItem('guestTracks', JSON.stringify(items));
        loadGuestTracks();
    }
}

async function editMemo(item) {
    const newMemo = prompt('수정할 메모:', item.memo || '');
    if (newMemo === null) return;
    if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), { memo: newMemo });
    } else {
        let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        const t = items.find(i => i.id === item.id);
        if(t) { t.memo = newMemo; localStorage.setItem('guestTracks', JSON.stringify(items)); loadGuestTracks(); }
    }
}

async function checkDeliveryStatus(item) {
    if (Date.now() - (item.lastUpdate || 0) < 300000 || item.statusRank === 2) return;
    if (item.carrier === 'global.aliexpress') return;

    try {
        const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(`https://apis.tracker.delivery/carriers/${item.carrier}/tracks/${item.number}`));
        if(res.ok) {
            const data = await res.json();
            const stateText = data.state ? data.state.text : '상태 미등록';
            const location = (data.progresses && data.progresses.length > 0) ? data.progresses[data.progresses.length - 1].location.name : '';
            const time = (data.progresses && data.progresses.length > 0) ? data.progresses[data.progresses.length - 1].time.substring(5, 16).replace('T', ' ') : '';
            const detail = location ? `${time} | ${location}` : (time || '');
            let rank = 1;
            if (stateText.includes('완료') || stateText.includes('도착')) rank = 2;
            else if (stateText.includes('실패')) rank = 3;

            if (item.lastState !== stateText || item.lastDetail !== detail) {
                if (currentUser) {
                    await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
                        lastState: stateText, lastDetail: detail, statusRank: rank, lastUpdate: Date.now()
                    });
                } else {
                    let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
                    const t = items.find(i => i.id === item.id);
                    if(t) {
                        t.lastState = stateText; t.lastDetail = detail; t.statusRank = rank; t.lastUpdate = Date.now();
                        localStorage.setItem('guestTracks', JSON.stringify(items));
                        const el = document.getElementById(`item-${item.docId}`);
                        if(el) {
                            el.querySelector('.status-text').innerText = stateText;
                            el.querySelector('.detail-text').innerText = detail;
                        }
                    }
                }
            }
        }
    } catch (e) {}
}

function setFilter(event, filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    const index = Array.from(document.querySelectorAll('.filter-btn')).indexOf(event.target);
    const glider = document.getElementById('tab-glider');
    if(glider) glider.style.transform = `translateX(${index * 100}%)`;
    
    if(currentUser) subscribeMyTracks(currentUser.uid);
    else loadGuestTracks();
}

function finishAdd() {
    document.getElementById('trackingNumber').value = '';
    document.getElementById('trackingMemo').value = '';
    document.getElementById('deliveryDate').value = ''; 
    document.getElementById('predictionArea').classList.remove('show');
    const s = document.getElementById('carrierSelect');
    s.style.display = 'none'; s.classList.remove('show');
}
window.showSelectBox = function() {
    document.getElementById('predictionArea').classList.remove('show'); 
    const s = document.getElementById('carrierSelect');
    s.style.display = 'block'; s.classList.add('show');
}
function copy(text) {
    navigator.clipboard.writeText(text);
    const t = document.getElementById('toast');
    t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2000);
}


