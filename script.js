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
const guestBtn = document.getElementById('guestLoginBtn'); 
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
let isGuest = false; 
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
// 1. 인증 및 상태 관리 (수정됨)
// ========================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        isGuest = false;
        loginScreen.style.display = 'none';
        
        // [수정] 강제 flex 제거 -> CSS가 알아서 block(모바일)/flex(PC) 결정하게 함
        appContainer.style.removeProperty('display'); 
        
        subscribeMyTracks(user.uid);
    } else {
        if (isGuest) {
            currentUser = null;
            loginScreen.style.display = 'none';
            
            // [수정] 여기도 수정
            appContainer.style.removeProperty('display');
            
            loadGuestTracks(); 
        } else {
            currentUser = null;
            loginScreen.style.display = 'flex';
            appContainer.style.display = 'none'; // 숨길 때는 none 유지
            if (unsubscribe) unsubscribe();
        }
    }
});

loginBtn.addEventListener('click', () => {
    isGuest = false;
    signInWithPopup(auth, provider).catch((error) => alert("로그인 실패: " + error.message));
});

guestBtn.addEventListener('click', () => {
    isGuest = true;
    loginScreen.style.display = 'none';
    
    // [수정] 여기도 수정
    appContainer.style.removeProperty('display');
    
    loadGuestTracks();
});

logoutBtn.addEventListener('click', () => {
    if (isGuest) {
        if(confirm("비회원 모드를 종료하시겠습니까?")) {
            isGuest = false;
            location.reload(); 
        }
    } else {
        if(confirm("로그아웃 하시겠습니까?")) signOut(auth);
    }
});

// ========================
// 2. 데이터 불러오기
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
    const localData = JSON.parse(localStorage.getItem('guestTracks')) || [];
    const items = localData.map(item => ({ docId: item.id, ...item }));
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
    li.querySelector('.btn-delete').onclick = () => deleteTrack(item); 

    trackingList.appendChild(li);
}

// ========================
// 4. 데이터 조작 (CRUD)
// ========================
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
        try {
            await addDoc(collection(db, "users", currentUser.uid, "tracks"), newItem);
            finishAdd();
        } catch (err) {
            console.error(err);
            alert("저장 실패");
        }
    } else {
        const items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        items.push(newItem);
        localStorage.setItem('guestTracks', JSON.stringify(items));
        finishAdd();
        loadGuestTracks(); 
    }
    
    addBtn.disabled = false; addBtn.innerText = "조회 및 추가";
});

async function deleteTrack(item) {
    if(!confirm('삭제하시겠습니까?')) return;
    
    if (currentUser) {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "tracks", item.docId));
        } catch(e) { console.error(e); }
    } else {
        let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        items = items.filter(i => i.id !== item.id);
        localStorage.setItem('guestTracks', JSON.stringify(items));
        loadGuestTracks();
    }
}

async function editMemo(item) {
    const newMemo = prompt('수정할 메모를 입력하세요:', item.memo || '');
    if (newMemo === null) return;
    
    if (currentUser) {
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
                memo: newMemo
            });
        } catch(e) { console.error(e); }
    } else {
        let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
        const target = items.find(i => i.id === item.id);
        if(target) {
            target.memo = newMemo;
            localStorage.setItem('guestTracks', JSON.stringify(items));
            loadGuestTracks();
        }
    }
}

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

            if (item.lastState !== stateText || item.lastDetail !== detail) {
                if (currentUser) {
                    await updateDoc(doc(db, "users", currentUser.uid, "tracks", item.docId), {
                        lastState: stateText,
                        lastDetail: detail,
                        statusRank: rank,
                        lastUpdate: Date.now()
                    });
                } else {
                    let items = JSON.parse(localStorage.getItem('guestTracks')) || [];
                    const target = items.find(i => i.id === item.id);
                    if (target) {
                        target.lastState = stateText;
                        target.lastDetail = detail;
                        target.statusRank = rank;
                        target.lastUpdate = Date.now();
                        localStorage.setItem('guestTracks', JSON.stringify(items));
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
