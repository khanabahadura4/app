// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
    pageData: [],        // rows for the currently loaded page
    displayedData: [],   // what's actually rendered (page data OR search results)
    isSearching: false,
    theme: localStorage.getItem('theme') || 'light',
    currentLot: null,
    refreshInterval: null,
    lastUpdated: null,
    page: 1,
    pageSize: 2000,
    totalPages: 1,
    totalRows: 0
};

const API_URL = 'https://script.google.com/macros/s/AKfycbwqvT-4xpI3P0I4IfRFF_OTFqz6I6XqX-S6aA0CEuAl0vAoelj9EYcowskEwPWGQAcw/exec';
const REFRESH_EVERY_MS = 5000; // 5 seconds — live refresh, page 1 only, never while searching

// ─── DOM REFERENCES ──────────────────────────────────────────────────────────
const el = {
    app:            document.body,
    menuBtn:        document.getElementById('menuBtn'),
    dropdown:       document.getElementById('dropdownMenu'),
    themeToggle:    document.getElementById('themeToggle'),
    aboutBtn:       document.getElementById('aboutBtn'),
    refreshBtn:     document.getElementById('refreshBtn'),
    searchInput:    document.getElementById('searchInput'),
    clearSearch:    document.getElementById('clearSearch'),
    dataStatus:     document.getElementById('dataStatus'),
    resultCount:    document.getElementById('resultCount'),
    refreshStatus:  document.getElementById('refreshStatus'),
    resultsList:    document.getElementById('resultsList'),
    loader:         document.getElementById('loader'),
    errorState:     document.getElementById('errorState'),
    emptyState:     document.getElementById('emptyState'),
    retryBtn:       document.getElementById('retryBtn'),
    detailsModal:   document.getElementById('detailsModal'),
    closeModalBtn:  document.getElementById('closeModalBtn'),
    shareResultBtn: document.getElementById('shareResultBtn'),
    aboutModal:     document.getElementById('aboutModal'),
    closeAboutBtn:  document.getElementById('closeAboutBtn'),

    paginationBar:  document.getElementById('paginationBar'),
    prevPageBtn:    document.getElementById('prevPageBtn'),
    nextPageBtn:    document.getElementById('nextPageBtn'),
    pageIndicator:  document.getElementById('pageIndicator'),

    repBuyer:       document.getElementById('repBuyer'),
    repDate:        document.getElementById('repDate'),
    repOrder:       document.getElementById('repOrder'),
    repReqGsm:      document.getElementById('repReqGsm'),
    repGsmResult:   document.getElementById('repGsmResult'),
    repBatch:       document.getElementById('repBatch'),
    repQty:         document.getElementById('repQty'),
    repReqDia:      document.getElementById('repReqDia'),
    repComposition: document.getElementById('repComposition'),
    repColor:       document.getElementById('repColor'),
    repFabType:     document.getElementById('repFabType'),
    repReport:      document.getElementById('repReport'),

    repLength:      document.getElementById('repLength'),
    repWidth:       document.getElementById('repWidth'),
    repTwisting:    document.getElementById('repTwisting'),
    repRubbingDry:  document.getElementById('repRubbingDry'),
    repRubbingWet:  document.getElementById('repRubbingWet'),
    repCfWashSta:   document.getElementById('repCfWashSta'),
    repCfWashCC:    document.getElementById('repCfWashCC'),
    repCfWashCS:    document.getElementById('repCfWashCS'),
    repPh:          document.getElementById('repPh'),
};

// ─── INIT ────────────────────────────────────────────────────────────────────
function init() {
    applyTheme();
    attachEvents();
    fetchPage(1).then(startAutoRefresh);
}

// ─── AUTO REFRESH (page 1 only, never while searching) ───────────────────────
function startAutoRefresh() {
    stopAutoRefresh();
    if (state.page !== 1 || state.isSearching) return;
    state.refreshInterval = setInterval(() => {
        if (state.page === 1 && !state.isSearching) fetchPage(1, true);
    }, REFRESH_EVERY_MS);
}
function stopAutoRefresh() {
    if (state.refreshInterval) { clearInterval(state.refreshInterval); state.refreshInterval = null; }
}

// ─── EVENTS ──────────────────────────────────────────────────────────────────
function attachEvents() {
    el.menuBtn.addEventListener('click', e => { e.stopPropagation(); el.dropdown.classList.toggle('hidden'); });
    document.addEventListener('click', e => {
        if (!el.menuBtn.contains(e.target) && !el.dropdown.contains(e.target))
            el.dropdown.classList.add('hidden');
    });
    el.themeToggle.addEventListener('click', () => { toggleTheme(); el.dropdown.classList.add('hidden'); });
    el.aboutBtn.addEventListener('click', () => { el.dropdown.classList.add('hidden'); openModal(el.aboutModal); });
    el.refreshBtn.addEventListener('click', () => {
        el.dropdown.classList.add('hidden');
        if (state.isSearching) runSearch(el.searchInput.value.trim());
        else fetchPage(state.page);
    });
    el.searchInput.addEventListener('input', handleSearch);
    el.clearSearch.addEventListener('click', () => { el.searchInput.value = ''; handleSearch({ target: el.searchInput }); });
    el.closeModalBtn.addEventListener('click', () => closeModal(el.detailsModal));
    el.closeAboutBtn.addEventListener('click', () => closeModal(el.aboutModal));
    el.retryBtn.addEventListener('click', () => fetchPage(state.page));
    el.shareResultBtn.addEventListener('click', shareViaWhatsApp);
    window.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target); });

    el.prevPageBtn.addEventListener('click', () => { if (state.page > 1) goToPage(state.page - 1); });
    el.nextPageBtn.addEventListener('click', () => { if (state.page < state.totalPages) goToPage(state.page + 1); });
}

function goToPage(p) {
    stopAutoRefresh();
    fetchPage(p).then(() => { if (state.page === 1) startAutoRefresh(); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── THEME ───────────────────────────────────────────────────────────────────
function applyTheme() {
    const dark = state.theme === 'dark';
    el.app.classList.toggle('dark-mode', dark);
    el.app.classList.toggle('light-mode', !dark);
    el.themeToggle.innerHTML = dark ? '<i class="fas fa-sun"></i> Light Mode' : '<i class="fas fa-moon"></i> Dark Mode';
}
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

// ─── FETCH (paginated list — 2000 lots per page, newest first) ───────────────
async function fetchPage(page = state.page, silent = false) {
    if (!silent) showState('loading');
    try {
        const res  = await fetch(API_URL + '?action=getLots&page=' + page + '&pageSize=' + state.pageSize + '&t=' + Date.now());
        const data = await res.json();
        if (data.status === 'success') {
            state.page       = data.currentPage;
            state.totalPages = data.totalPages;
            state.totalRows  = data.totalRecords;
            state.pageData   = (data.data || []).map((item, idx) => normalizeRow(item, idx));
            state.lastUpdated = new Date();
            updateRefreshStatus();

            if (!state.isSearching) {
                state.displayedData = state.pageData;
                updateStatusBar();
                renderList();
                updatePaginationUI();
            }
        } else throw new Error('bad');
    } catch {
        if (!silent) showState('error');
    }
}

function updateStatusBar() {
    el.dataStatus.textContent = `Page ${state.page} of ${state.totalPages} • ${state.totalRows} total lots`;
}

function updatePaginationUI() {
    el.paginationBar.classList.toggle('hidden', state.isSearching || state.totalPages <= 1);
    el.pageIndicator.textContent = `Page ${state.page} / ${state.totalPages}`;
    el.prevPageBtn.disabled = state.page <= 1;
    el.nextPageBtn.disabled = state.page >= state.totalPages;
}

function updateRefreshStatus() {
    const t = state.lastUpdated;
    if (!t) return;
    const hms = [t.getHours(), t.getMinutes(), t.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    el.refreshStatus.textContent = 'Live • ' + hms;
}

// ─── ROW MAPPING ──────────────────────────────────────────────────────────────
// Converts one raw API row (flat keys from Code.gs's mapRow()) into the field
// names the rest of the app uses.
function normalizeRow(raw, idx) {
    raw = raw || {};
    return {
        _idx:          idx,
        date:          raw.date || '',
        shift:         raw.shift || '',
        reportNumber:  raw.reportNo || '',
        buyerName:     raw.buyer || '',
        orderNo:       raw.orderNo || '',
        batchNo:       raw.batchNo || '',
        roll:          raw.roll || '',
        colour:        raw.colour || '',
        fabType:       raw.fabType || '',
        reqGsm:        raw.rGsm || '',
        gsmResult:     raw.fGsm || '',
        reqDia:        raw.reqDia || '',
        fDia:          raw.fDia || '',
        drying:        raw.drying || '',
        length:        raw.length || '',
        width:         raw.width || '',
        twisting:      raw.twisting || '',
        qty:           raw.qty || '',
        composition:   raw.composition || '',
        others:        raw.others || '',
        info:          raw.info || '',
        ph:            raw.ph || '',
        dryRubbing:    raw.dryRubbing || '',
        wetRubbing:    raw.wetRubbing || '',
        cfWashSta:     raw.cfWashSt || '',
        cfWashCC:      raw.cfWashCc || '',
        cfWashCS:      raw.cs || '',
    };
}

// ─── PERCENTAGE ──────────────────────────────────────────────────────────────
// Applies to Length, Width AND Twisting — if value is a small decimal (< 1)
// convert to %, otherwise show raw (for large entered numbers).
function toPercent(val) {
    if (val === '' || val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str === '') return '';
    const num = parseFloat(str);
    if (isNaN(num)) return str;  // e.g. "480kg" → show as-is
    if (num !== 0 && Math.abs(num) < 1) return (num * 100).toFixed(1) + '%';
    if (num === 0) return '0.0%';
    if (Number.isInteger(num) && Math.abs(num) <= 100) return num.toFixed(1) + '%';
    return str;
}

function hlClass(type, pctStr) {
    const n = parseFloat(pctStr);
    if (isNaN(n)) return '';
    if ((type === 'length' || type === 'width') && (n < -5 || n > 5)) return 'highlight-error';
    if (type === 'twisting' && n > 5) return 'highlight-error';
    return '';
}

// ─── SEARCH ──────────────────────────────────────────────────────────────────
// Searches ALL lots (every date, not just the current page). Auto-refresh is
// stopped the instant a search starts, so it never re-triggers or flickers
// while the user is searching.
let searchDebounceTimer = null;

function handleSearch(e) {
    const q = e.target.value.trim();
    clearTimeout(searchDebounceTimer);
    if (q) {
        state.isSearching = true;
        stopAutoRefresh();
        el.clearSearch.classList.remove('hidden');
        el.paginationBar.classList.add('hidden');
        searchDebounceTimer = setTimeout(() => runSearch(q), 300);
    } else {
        state.isSearching = false;
        el.clearSearch.classList.add('hidden');
        state.displayedData = state.pageData;
        updateStatusBar();
        renderList();
        updatePaginationUI();
        startAutoRefresh();
    }
}

async function runSearch(q) {
    showState('loading');
    try {
        const res  = await fetch(API_URL + '?action=getSearch&q=' + encodeURIComponent(q) + '&t=' + Date.now());
        const data = await res.json();
        if (data.status === 'success' && data.data) {
            state.displayedData = data.data.map((item, idx) => normalizeRow(item, idx));
            el.dataStatus.textContent = `Search: "${q}" • ${state.displayedData.length} found (all lots)`;
            renderList();
        } else throw new Error('bad');
    } catch {
        showState('error');
    }
}

// ─── SMART RENDER — no flicker ────────────────────────────────────────────────
function cardKey(item) {
    return item.batchNo + '|' + item.date;
}

function renderList() {
    el.resultCount.textContent = state.displayedData.length;
    if (!state.displayedData.length) { showState('empty'); return; }

    const existingMap = new Map();
    el.resultsList.querySelectorAll('.result-card[data-key]').forEach(card => {
        existingMap.set(card.dataset.key, card);
    });

    const newKeys = new Set(state.displayedData.map(cardKey));

    existingMap.forEach((card, key) => {
        if (!newKeys.has(key)) card.remove();
    });

    const orderedKeys = state.displayedData.map(cardKey);
    orderedKeys.forEach((key, idx) => {
        if (!existingMap.has(key)) {
            const item = state.displayedData[idx];
            const card = buildCard(item, true);
            card.dataset.key = key;
            const refNode = el.resultsList.children[idx] || null;
            el.resultsList.insertBefore(card, refNode);
            setTimeout(() => card.classList.remove('new-entry'), 600);
        }
    });

    showState('list');
}

function buildCard(item, isNew = false) {
    const card = document.createElement('div');
    card.className = 'result-card' + (isNew ? ' new-entry' : '');

    const lenStr = toPercent(item.length);
    const widStr = toPercent(item.width);
    const twStr  = toPercent(item.twisting);

    const batchTxt = item.batchNo  || '';
    const orderTxt = item.orderNo  || '';
    const titleHtml = `Lot ${batchTxt}${orderTxt ? `<span style="color:var(--text-muted);font-weight:500"> &nbsp;&nbsp; ATL ${orderTxt}</span>` : ''}`;

    card.innerHTML = `
      <div class="card-header">
        <span class="batch-no">${titleHtml}</span>
        <span class="date-badge"><i class="far fa-calendar-alt"></i> ${item.date || ''}</span>
      </div>
      <div class="card-body">
        <div class="data-item">
          <span class="data-label">Buyer</span>
          <span class="data-value">${item.buyerName || '—'}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Length</span>
          <span class="data-value ${hlClass('length', lenStr)}">${lenStr || '—'}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Width</span>
          <span class="data-value ${hlClass('width', widStr)}">${widStr || '—'}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Twisting</span>
          <span class="data-value ${hlClass('twisting', twStr)}">${twStr || '—'}</span>
        </div>
      </div>`;

    card.addEventListener('click', () => openDetails(item));
    return card;
}

// ─── DETAILS MODAL ───────────────────────────────────────────────────────────
async function openDetails(item) {
    state.currentLot = item;

    fillDetailFields(item, true);
    openModal(el.detailsModal);

    try {
        const res  = await fetch(API_URL + '?action=getDetail&batchNo=' + encodeURIComponent(item.batchNo) + '&t=' + Date.now());
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data) && data.data.length) {
            const normalized = data.data.map((e, idx) => normalizeRow(e, idx));
            const match = normalized.find(e => e.date === item.date) || normalized[normalized.length - 1];
            state.currentLot = match;
            fillDetailFields(match, false);
        }
    } catch {
        // keep whatever summary data is already shown; fail silently
    }
}

function fillDetailFields(item, loading) {
    const dash = loading ? '…' : '—';

    // ── Details ────────────────────────────────────────────────────────────
    el.repBuyer.textContent       = item.buyerName || dash;
    el.repDate.textContent        = item.date || dash;
    el.repOrder.textContent       = item.orderNo || dash;
    el.repReqGsm.textContent      = item.reqGsm || dash;
    el.repGsmResult.textContent   = item.gsmResult || dash;
    el.repBatch.textContent       = item.batchNo || dash;
    el.repQty.textContent         = item.qty || dash;
    el.repReqDia.textContent      = item.reqDia || dash;
    el.repComposition.textContent = item.composition || dash;
    el.repColor.textContent       = item.colour || dash;
    el.repFabType.textContent     = item.fabType || dash;
    el.repReport.textContent      = item.reportNumber || dash;

    // ── Result ──────────────────────────────────────────────────────────────
    const lenStr = toPercent(item.length);
    const widStr = toPercent(item.width);
    const twStr  = toPercent(item.twisting);

    el.repLength.textContent   = lenStr || dash;
    el.repWidth.textContent    = widStr || dash;
    el.repTwisting.textContent = twStr  || dash;

    el.repLength.className   = `detail-value highlightable ${hlClass('length',   lenStr)}`;
    el.repWidth.className    = `detail-value highlightable ${hlClass('width',    widStr)}`;
    el.repTwisting.className = `detail-value highlightable ${hlClass('twisting', twStr)}`;

    el.repRubbingDry.textContent = item.dryRubbing || dash;
    el.repRubbingWet.textContent = item.wetRubbing || dash;
    el.repCfWashSta.textContent  = item.cfWashSta || dash;
    el.repCfWashCC.textContent   = item.cfWashCC || dash;
    el.repCfWashCS.textContent   = item.cfWashCS || dash;
    el.repPh.textContent         = item.ph || dash;
}

// ─── WHATSAPP TEXT SHARE ─────────────────────────────────────────────────────
function shareViaWhatsApp() {
    if (!state.currentLot) return;
    const i  = state.currentLot;
    const orderNo = i.orderNo;
    const color   = i.colour;
    const gsm     = i.reqGsm;
    const lenStr  = toPercent(i.length);
    const widStr  = toPercent(i.width);
    const twStr   = toPercent(i.twisting);

    let msg = `*Lab Test Result*\n\n`;
    msg += `*Lot / Batch No:* ${i.batchNo || ''}`;
    if (orderNo) msg += ` | Order: ${orderNo}`;
    if (color)   msg += ` | Color: ${color}`;
    if (gsm)     msg += ` | GSM: ${gsm}`;
    msg += `\n*Buyer:* ${i.buyerName || ''}\n`;
    msg += `*Date:* ${i.date || ''}\n\n`;
    msg += `*Dimensional Stability*\n`;
    msg += `Length: ${lenStr  || 'N/A'}\n`;
    msg += `Width: ${widStr   || 'N/A'}\n`;
    msg += `Twisting: ${twStr || 'N/A'}\n`;
    if (i.ph) msg += `pH: ${i.ph}\n`;
    msg += `\n_Generated by Lab Test App_`;

    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ─── MODAL HELPERS ───────────────────────────────────────────────────────────
function openModal(m) {
    m.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('active')));
    document.body.style.overflow = 'hidden';
}
function closeModal(m) {
    m.classList.remove('active');
    setTimeout(() => { m.classList.add('hidden'); document.body.style.overflow = ''; }, 280);
}

// ─── STATE DISPLAY ───────────────────────────────────────────────────────────
function showState(s) {
    el.loader.classList.add('hidden');
    el.errorState.classList.add('hidden');
    el.emptyState.classList.add('hidden');
    el.resultsList.classList.add('hidden');
    if (s === 'loading') el.loader.classList.remove('hidden');
    if (s === 'error')   el.errorState.classList.remove('hidden');
    if (s === 'empty')   el.emptyState.classList.remove('hidden');
    if (s === 'list')    el.resultsList.classList.remove('hidden');
}

// ─── START ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
