const trackingList = document.getElementById('tracking-list');
const addBtn = document.getElementById('addBtn');
const toast = document.getElementById('toast');
const numInput = document.getElementById('trackingNumber');
const memoInput = document.getElementById('trackingMemo');
const dateInput = document.getElementById('deliveryDate'); // 날짜 입력
const predictionArea = document.getElementById('predictionArea');
const predictionText = document.getElementById('predictionText');
const carrierSelect = document.getElementById('carrierSelect');
const tabGlider = document.getElementById('tab-glider');

let currentFilter = 'all'; 
let currentCarrierId = 'kr.cjlogistics';

// 택배사 키워드 매핑 (스마트 붙여넣기용)
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
    'kr.daesin': { name: '대신택배', url: 'https://www.ds3211.co.kr/freight/internalFreightSearch.do?billno=' },
    'kr.chunilps': { name: '천일택배', url: 'https://www.chunil.co.kr/HTrace/HTrace.jsp?transNo=' },
    'kr.ilyanglogis': { name: '일양로지스', url: 'https://www.ilyanglogis.com/functionality/card_form_waybill.asp?hawb_no=' }
};

document.addEventListener('DOMContentLoaded', refreshAll);

// [핵심 기능 1] 스마트 붙여넣기 & 자동 감지
numInput.addEventListener('input', (e) => {
    // 1. 붙여넣은 텍스트 가져오기
    let val = e.target.value;

    // 2. 택배사 자동 감지 (텍스트에 'CJ', '우체국' 등이 있는지 확인)
    for (const [id, keywords] of Object.entries(carrierKeywords)) {
        if (keywords.some(k => val.toUpperCase().includes(k))) {
            currentCarrierId = id;
            carrierSelect.value = id;
            predictionText.innerText = `감지됨: ${carrierInfo[id].name}`;
            predictionArea.classList.add('show');
            break;
        }
    }

    // 3. 숫자만 남기기 (송장번호 추출)
    const numbers = val.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    
    // 사용자가 방금 붙여넣기 한 거라면 입력창 값을 숫자만으로 교체
    // (직접 타이핑 중일 때는 너무 방해되지 않게 처리)
    if (val.length > 20 || val.includes('운송장') || val.includes('배송')) {
        numInput.value = numbers;
        val = numbers; // 아래 예측 로직을 위해 값 갱신
    } else {
        numInput.value = numbers;
    }

    if(carrierSelect.style.display === 'block') return;

    // 4. 길이로 택배사 예측 (기존 로직)
    if (numbers.length >= 9) {
        if (!predictionArea.classList.contains('show')) { // 이미 키워드로 감지된 게 없으면
            predictCarrier(numbers);
            predictionArea.classList.add('show');
        }
    } else {
        predictionArea.classList.remove('show');
    }
});

function predictCarrier(number) {
    if (/^[A-Z]/.test(number)) currentCarrierId = 'global.aliexpress';
    else if (number.length === 13) currentCarrierId = 'kr.epost';
    else currentCarrierId = 'kr.cjlogistics';
    
    predictionText.innerText = `예상: ${carrierInfo[currentCarrierId].name}`;
    carrierSelect.value = currentCarrierId; 
}

// 탭 애니메이션
function setFilter(event, filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    const buttons = Array.from(document.querySelectorAll('.filter-btn'));
    const index = buttons.indexOf(event.target);
    tabGlider.style.transform = `translateX(${index * 100}%)`;

    const items = JSON.parse(localStorage.getItem('trackingItems')) || [];
    renderSortedList(items);
}

window.showSelectBox = function() {
    predictionArea.classList.remove('show'); 
    carrierSelect.style.display = 'block';   
    carrierSelect.classList.add('show');
}

carrierSelect.addEventListener('change', (e) => {
    currentCarrierId = e.target.value;
});

// 조회 및 추가
async function fetchWithProxy(targetUrl, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const timestamp = Date.now();
    const noCacheUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 't=' + timestamp;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(noCacheUrl);
    
    try {
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = numInput.value;
    const memo = memoInput.value.trim();
    const startDate = dateInput.value; // 날짜 값 가져오기

    if (number.length < 9) return alert('번호를 확인해주세요.');
    addBtn.disabled = true; addBtn.innerText = "확인 중...";

    if (currentCarrierId === 'global.aliexpress') {
        saveItem(currentCarrierId, number, memo, startDate);
        finishAdd();
        return;
    }

    let isValid = false;
    try {
        const res = await fetchWithProxy(`https://apis.tracker.delivery/carriers/${currentCarrierId}/tracks/${number}`);
        if (res.ok) {
            const data = await res.json();
            if (data.state && data.state.id !== 'not_found') isValid = true;
        }
    } catch (err) { console.log("조회 에러"); }

    if (!isValid) {
        const carrierName = carrierInfo[currentCarrierId].name;
        const msg = `[${carrierName}] 조회 데이터가 없습니다.\n\n그래도 등록하시겠습니까?`;
        if (!confirm(msg)) {
            addBtn.disabled = false; addBtn.innerText = "조회 및 추가";
            return;
        }
    }

    saveItem(currentCarrierId, number, memo, startDate);
    finishAdd();
});

function finishAdd() {
    addBtn.disabled = false; addBtn.innerText = "조회 및 추가";
    numInput.value = '';
    memoInput.value = '';
    dateInput.value = ''; // 날짜 초기화
    predictionArea.classList.remove('show');
    carrierSelect.style.display = 'none';
    carrierSelect.classList.remove('show');
}

function saveItem(carrier, number, memo, startDate) {
    const items = JSON.parse(localStorage.getItem('trackingItems')) || [];
    if (items.some(i => i.number === number)) return alert('이미 등록된 번호입니다.');
    
    items.push({ 
        id: Date.now(), 
        carrier, 
        number, 
        memo, 
        startDate, // 날짜 저장
        statusRank: 1, 
        lastUpdate: 0 
    });
    localStorage.setItem('trackingItems', JSON.stringify(items));
    refreshAll(); 
}

async function refreshAll() {
    const items = JSON.parse(localStorage.getItem('trackingItems')) || [];
    if (items.length === 0) {
        trackingList.innerHTML = '<div class="empty-msg">등록된 택배가 없습니다</div>';
        return;
    }
    renderSortedList(items);
    for (const item of items) { await updateItemStatus(item); }
    localStorage.setItem('trackingItems', JSON.stringify(items));
    renderSortedList(items); 
}

function renderSortedList(items) {
    const sortedItems = items.sort((a, b) => (a.statusRank || 1) - (b.statusRank || 1));
    const filteredItems = sortedItems.filter(item => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'active') return item.statusRank !== 2;
        if (currentFilter === 'completed') return item.statusRank === 2;
        return true;
    });

    trackingList.innerHTML = '';
    if (items.length > 0 && filteredItems.length === 0) {
        trackingList.innerHTML = '<div class="empty-msg">해당하는 택배가 없습니다</div>';
        return;
    }
    filteredItems.forEach(item => createDOM(item));
}

async function updateItemStatus(item) {
    const el = document.getElementById(`item-${item.id}`);
    if (item.carrier === 'global.aliexpress') {
        item.lastState = '해외 배송';
        item.lastDetail = '위치 버튼을 눌러 조회하세요';
        item.statusRank = 1; 
        updateDOM(el, item, 'status-global');
        return; 
    }
    try {
        const res = await fetchWithProxy(`https://apis.tracker.delivery/carriers/${item.carrier}/tracks/${item.number}`);
        const data = await res.json();
        const stateText = data.state ? data.state.text : '상태 미등록';
        const location = (data.progresses && data.progresses.length > 0) ? data.progresses[data.progresses.length - 1].location.name : '';
        const time = (data.progresses && data.progresses.length > 0) ? data.progresses[data.progresses.length - 1].time.substring(5, 16).replace('T', ' ') : '';
        item.lastState = stateText;
        item.lastDetail = location ? `${time} | ${location}` : (time || '');

        let rank = 1;
        if (stateText.includes('완료') || stateText.includes('도착')) rank = 2;
        else if (stateText.includes('실패') || stateText.includes('미등록')) rank = 3;
        item.statusRank = rank;
        
        let statusClass = '';
        if (rank === 2) statusClass = 'status-delivered';
        if (rank === 3) statusClass = 'status-error';
        updateDOM(el, item, statusClass);
    } catch (e) {
        item.lastState = '연동 지연';
        item.lastDetail = '잠시 후 시도해주세요';
        item.statusRank = 3;
        updateDOM(el, item, 'status-error');
    }
}

function updateDOM(el, item, statusClass) {
    if (!el) return;
    const statusTextEl = el.querySelector('.status-text');
    const detailTextEl = el.querySelector('.detail-text');
    if(statusTextEl) statusTextEl.innerText = item.lastState;
    if(detailTextEl) detailTextEl.innerText = item.lastDetail;
    el.className = ''; 
    if(statusClass) el.classList.add(statusClass);
}

function createDOM(item) {
    const info = carrierInfo[item.carrier] || { name: '택배' };
    const displayTitle = (item.memo && item.memo.trim()) ? item.memo : item.number;
    
    // [핵심 기능 3] D-Day 계산
    let dDayTag = '';
    if (item.startDate) {
        const start = new Date(item.startDate);
        const now = new Date();
        // 시간차이(ms)를 일(day)로 변환
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        const dayText = diff >= 0 ? `D+${diff}` : `D${diff}`;
        dDayTag = `<span class="d-day-badge">${dayText}</span>`;
    }

    let statusClass = '';
    if (item.carrier === 'global.aliexpress') statusClass = 'status-global';
    else {
        const savedState = item.lastState || '';
        if(savedState.includes('완료') || savedState.includes('도착')) statusClass = 'status-delivered';
        else if(savedState.includes('지연') || savedState.includes('실패')) statusClass = 'status-error';
    }
    const savedState = item.lastState || '확인 중...';
    const savedDetail = item.lastDetail || '';
    
    const li = document.createElement('li');
    li.id = `item-${item.id}`;
    if(statusClass) li.className = statusClass;
    
    // [핵심 기능 2] 제목 클릭 시 editMemo 호출
    li.innerHTML = `
        <div class="info-area">
            <div class="item-header">
                <span class="carrier-badge">${info.name}</span>
                <span class="item-title" onclick="editMemo(${item.id})" title="클릭해서 메모 수정">${displayTitle}</span>
                ${dDayTag}
            </div>
            <div class="meta-row">
                <span class="number" onclick="copy('${item.number}')">${item.number}</span>
                <div class="status-row">
                    <span class="status-text">${savedState}</span>
                    <span class="detail-text">${savedDetail}</span>
                </div>
            </div>
        </div>
        <div class="actions">
            <button class="btn-track" onclick="window.open('${info.url}${item.number}', '_blank')">위치</button>
            <button class="btn-delete" onclick="deleteItem(${item.id})">삭제</button>
        </div>
    `;
    trackingList.appendChild(li);
}

// [핵심 기능 2 구현] 메모 수정 함수
window.editMemo = function(id) {
    const items = JSON.parse(localStorage.getItem('trackingItems'));
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newMemo = prompt('수정할 메모를 입력하세요:', item.memo || '');
    if (newMemo === null) return; // 취소 누름

    item.memo = newMemo;
    localStorage.setItem('trackingItems', JSON.stringify(items));
    
    // 전체 새로고침 대신 화면만 갱신해도 되지만, 필터링 등 고려해서 리스트 다시 그리기
    const currentItems = JSON.parse(localStorage.getItem('trackingItems'));
    renderSortedList(currentItems);
};

function deleteItem(id) {
    if(!confirm('삭제하시겠습니까?')) return;
    const items = JSON.parse(localStorage.getItem('trackingItems')).filter(i => i.id !== id);
    localStorage.setItem('trackingItems', JSON.stringify(items));
    const currentItems = JSON.parse(localStorage.getItem('trackingItems')) || [];
    renderSortedList(currentItems);
}

function copy(text) {
    navigator.clipboard.writeText(text);
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
}
