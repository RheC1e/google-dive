// Utilities
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const storeKey = 'dive-trainer:v1';
const defaultTables = [
  {
    id: cryptoRandomId(),
    name: 'O2-table',
    description: 'Increases our ability to withstand lower levels of O2',
    cycles: [
      { hold: 45, breath: 90 },
      { hold: 60, breath: 90 },
      { hold: 75, breath: 90 },
      { hold: 90, breath: 90 },
    ],
  },
  {
    id: cryptoRandomId(),
    name: 'CO2-table',
    description: 'Increasing the ability to withstand high levels of CO2',
    cycles: [
      { hold: 75, breath: 90 },
      { hold: 75, breath: 75 },
      { hold: 75, breath: 60 },
      { hold: 75, breath: 45 },
    ],
  },
];

function cryptoRandomId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2);
}

function loadData() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return { tables: defaultTables };
    const parsed = JSON.parse(raw);
    if (!parsed.tables || !Array.isArray(parsed.tables) || parsed.tables.length === 0) {
      const fallback = { tables: defaultTables };
      localStorage.setItem(storeKey, JSON.stringify(fallback));
      return fallback;
    }
    return parsed;
  } catch {
    const fallback = { tables: defaultTables };
    localStorage.setItem(storeKey, JSON.stringify(fallback));
    return fallback;
  }
}

function saveData(data) {
  localStorage.setItem(storeKey, JSON.stringify(data));
}

function secToMMSS(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}
function mmssToSec(text) {
  const t = (text || '').trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return parseInt(t, 10); // seconds
  const [m, s] = t.split(':').map((x) => parseInt(x || '0', 10));
  return (m || 0) * 60 + (s || 0);
}

// App State
const state = {
  data: loadData(),
  route: 'home',
  editing: null, // {id}
  currentTableId: null,
  session: null, // created after start
};

// Navigation & Drawer
const view = $('#view');
const drawer = $('#drawer');
$('#menuBtn').addEventListener('click', () => {
  drawer.classList.toggle('open');
});
$$('.drawer-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const r = btn.getAttribute('data-route');
    navigate(r);
    drawer.classList.remove('open');
  });
});

function navigate(route) {
  state.route = route;
  if (route === 'home') renderHome();
  if (route === 'tables') renderTables();
  // 安全保險：若因任何原因事件未綁定，這裡補一層委派
  attachCommonHandlers();
}

// Initial route
navigate('home');

// ---------- Render: Tables List ----------
function renderTables() {
  view.innerHTML = $('#tpl-tables').innerHTML;
  const addBtn = $('#addTableBtn');
  if (addBtn) addBtn.addEventListener('click', () => openEditTable());
  const list = $('#tableList');
  list.innerHTML = '';
  const tables = state.data.tables && state.data.tables.length ? state.data.tables : defaultTables;
  if (!state.data.tables || state.data.tables.length === 0) {
    // 寫回預設，避免空白狀態
    state.data.tables = JSON.parse(JSON.stringify(defaultTables));
    saveData(state.data);
  }
  tables.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'card';
    const total = t.cycles.reduce((sum, c) => sum + c.hold + c.breath, 0);
    card.innerHTML = `
      <div class="row" style="display:flex;gap:10px;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:700;font-size:18px">${t.name}</div>
          <div class="desc">${t.description || ''}</div>
        </div>
        <div class="icon" style="font-size:28px">🫁</div>
      </div>
      <div class="meta">Total time: ${secToMMSS(total)}</div>
    `;
    card.addEventListener('click', () => openEditTable(t.id));
    list.appendChild(card);
  });
}

// ---------- Edit/New Table ----------
function openEditTable(tableId) {
  const editing = tableId
    ? deepClone(state.data.tables.find((x) => x.id === tableId))
    : { id: cryptoRandomId(), name: '', description: '', cycles: [] };
  // 確保每個 cycle 有穩定 key 供動畫用
  editing.cycles.forEach((c) => (c._k = c._k || cryptoRandomId()));
  state.editing = { originalId: tableId || null, table: editing, reorderMode: false, dirty: false, lastRects: null, dragFrom: null };
  renderEditTable();
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function renderEditTable() {
  view.innerHTML = $('#tpl-edit-table').innerHTML;
  const { table, reorderMode } = state.editing;
  $('#editTitle').textContent = (state.editing.originalId ? 'Edit table ' : 'New table ') + (table.name || '');
  const name = $('#tableNameInput');
  const desc = $('#tableDescInput');
  name.value = table.name || '';
  desc.value = table.description || '';
  name.addEventListener('input', () => {
    table.name = name.value;
    state.editing.dirty = true;
  });
  desc.addEventListener('input', () => {
    table.description = desc.value;
    state.editing.dirty = true;
  });

  $('#closeEditBtn').addEventListener('click', () => {
    if (!state.editing.dirty) return navigate('tables');
    confirmSave().then((act) => {
      if (act === 'save') {
        doSaveAndExit();
      } else if (act === 'discard') {
        navigate('tables');
      }
    });
  });
  $('#doneEditBtn').addEventListener('click', () => {
    doSaveAndExit();
  });
  $('#addRowBtn').addEventListener('click', () => {
    table.cycles.push({ _k: cryptoRandomId(), hold: 90, breath: 90 });
    state.editing.dirty = true;
    renderCycleList();
  });
  $('#reorderBtn').addEventListener('click', () => {
    state.editing.reorderMode = !state.editing.reorderMode;
    renderCycleList();
  });
  renderCycleList(reorderMode);
}

function doSaveAndExit() {
  const { table } = state.editing;
  if (!table.name.trim()) {
    alert('請輸入 Table 名稱');
    return;
  }
  const existsIdx = state.data.tables.findIndex((x) => x.id === table.id);
  if (existsIdx >= 0) state.data.tables[existsIdx] = table;
  else {
    if (state.editing.originalId) {
      const idx = state.data.tables.findIndex((x) => x.id === state.editing.originalId);
      if (idx >= 0) state.data.tables[idx] = table;
      else state.data.tables.push(table);
    } else state.data.tables.push(table);
  }
  saveData(state.data);
  navigate('tables');
}

function renderCycleList() {
  const { table, reorderMode } = state.editing;
  const wrap = $('#cycleList');
  wrap.innerHTML = '';
  const beforeRects = getRects(wrap);
  table.cycles.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cycle-row';
    row.dataset.key = c._k;
    row.draggable = !!reorderMode;
    row.style.cursor = reorderMode ? 'grab' : 'default';
    row.innerHTML = `
      <div class="idx">${i + 1}</div>
      <div><button class="btn" data-kind="hold">${secToMMSS(c.hold)}</button></div>
      <div><button class="btn" data-kind="breath">${secToMMSS(c.breath)}</button></div>
      <div class="right">
        ${reorderMode ? '<span class="handle">≡</span>' : '<button class="icon-btn trash" title="刪除">🗑</button>'}
      </div>
    `;
    const btns = $$('button.btn', row);
    btns.forEach((b) => {
      b.addEventListener('click', async () => {
        const kind = b.getAttribute('data-kind');
        const initial = kind === 'hold' ? c.hold : c.breath;
        const picked = await openTimePicker(initial);
        if (picked == null) return;
        if (kind === 'hold') c.hold = picked;
        else c.breath = picked;
        state.editing.dirty = true;
        renderCycleList();
      });
    });
    if (!reorderMode) {
      $('.trash', row).addEventListener('click', () => {
        table.cycles.splice(i, 1);
        state.editing.dirty = true;
        renderCycleList();
      });
    } else {
      // 自訂拖曳：列跟著手指移動，經過時即時交換位置
      row.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startCustomDrag(c._k, i, e.clientY);
      });
    }
    wrap.appendChild(row);
  });
  // 進入頁面或重繪後動畫（從 lastRects 轉場）
  if (state.editing.lastRects) animateReorder(state.editing.lastRects);
  // 記住這次 rects
  const rects = new Map();
  $$('.cycle-row', wrap).forEach((el) => rects.set(el.dataset.key, el.getBoundingClientRect()));
  state.editing.lastRects = rects;
}

function animateReorder(prevRects) {
  const wrap = $('#cycleList');
  $$('.cycle-row', wrap).forEach((el) => {
    const key = el.dataset.key;
    const prev = prevRects.get(key);
    const now = el.getBoundingClientRect();
    if (!prev) return;
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    if (dx || dy) {
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform .16s ease';
        el.style.transform = '';
        el.addEventListener(
          'transitionend',
          () => {
            el.style.transition = '';
          },
          { once: true }
        );
      });
    }
  });
}

function getRects(wrap) {
  const m = new Map();
  $$('.cycle-row', wrap).forEach((el) => m.set(el.dataset.key, el.getBoundingClientRect()));
  return m;
}

// 自訂拖曳：被拖曳列會跟隨手指，滑過其他列時即時重排
function startCustomDrag(key, startIndex, startClientY) {
  const wrap = $('#cycleList');
  const { table } = state.editing;
  let row = $(`.cycle-row[data-key="${key}"]`, wrap);
  if (!row) return;
  const rowHeight = row.offsetHeight;
  const startTop = row.offsetTop;
  const grabOffset = startClientY - row.getBoundingClientRect().top;

  // 佔位元，避免 layout 抽掉高度
  const placeholder = document.createElement('div');
  placeholder.className = 'row-placeholder';
  placeholder.style.height = `${rowHeight}px`;
  wrap.insertBefore(placeholder, row.nextSibling);

  // 讓列跟手移動
  row.classList.add('dragging');
  row.style.position = 'absolute';
  row.style.width = '100%';
  row.style.left = '0';
  row.style.top = `${startTop}px`;
  row.style.zIndex = '5';
  document.body.classList.add('dragging-global');

  function onMove(e) {
    const y = e.clientY - wrap.getBoundingClientRect().top - grabOffset;
    row.style.top = `${y}px`;
    // 計算應插入 index：看滑過的中心
    const siblings = Array.from(wrap.children).filter((el) => el !== row);
    let target = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const el = siblings[i];
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      if (e.clientY < center) { target = i; break; }
    }
    const currentPlaceholderIndex = siblings.indexOf(placeholder);
    if (target !== currentPlaceholderIndex) {
      if (target >= siblings.length) {
        wrap.appendChild(placeholder);
      } else {
        wrap.insertBefore(placeholder, siblings[target]);
      }
    }
  }
  function onUp() {
    // 將 row 放回 placeholder 位置
    wrap.insertBefore(row, placeholder);
    placeholder.remove();
    row.classList.remove('dragging');
    row.style.position = '';
    row.style.left = '';
    row.style.top = '';
    row.style.width = '';
    row.style.zIndex = '';
    document.body.classList.remove('dragging-global');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    // 依據目前 DOM 順序重排資料
    const keys = Array.from(wrap.querySelectorAll('.cycle-row')).map((el) => el.dataset.key);
    const map = new Map(table.cycles.map((c) => [c._k, c]));
    table.cycles = keys.map((k) => map.get(k));
    state.editing.dirty = true;
    renderCycleList();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

// ---------- Home / Training ----------
function renderHome() {
  view.innerHTML = $('#tpl-home').innerHTML;
  const pickBtn = $('#pickTableBtn');
  if (pickBtn) pickBtn.addEventListener('click', openPicker);
  $('#startBtn').addEventListener('click', startSession);
  $('#pauseBtn').addEventListener('click', togglePause);
  $('#skipBtn').addEventListener('click', skipPhase);
  $('#plus10Btn').addEventListener('click', () => adjustRemaining(10));
  $('#stopBtn').addEventListener('click', stopSession);
  $('#markDiaphragmBtn').addEventListener('click', markDiaphragm);
  drawRing(0, '#2a2f3b', '#3a4152');
  updateHomeUI();
}

// 補救性事件委派：避免偶發沒掛到事件時，仍可操作
function attachCommonHandlers() {
  document.removeEventListener('click', delegatedClickHandler);
  document.addEventListener('click', delegatedClickHandler);
}
function delegatedClickHandler(e) {
  const target = e.target;
  if (target.closest && target.closest('#pickTableBtn')) {
    e.preventDefault();
    openPicker();
    return;
  }
  if (target.closest && target.closest('#addTableBtn')) {
    e.preventDefault();
    openEditTable();
    return;
  }
}

function openPicker() {
  // 若已有打開中的彈窗，先清掉避免疊加
  $$('.modal-backdrop').forEach((el) => el.remove());
  const tpl = $('#tpl-picker').content ? $('#tpl-picker').content : null;
  // For broad browser support, clone from innerHTML
  const container = document.createElement('div');
  container.innerHTML = $('#tpl-picker').innerHTML;
  const backdrop = container.firstElementChild;
  document.body.appendChild(backdrop);
  const list = $('#pickerList', backdrop);
  const tables = state.data.tables && state.data.tables.length ? state.data.tables : defaultTables;
  if (!state.data.tables || state.data.tables.length === 0) {
    state.data.tables = JSON.parse(JSON.stringify(defaultTables));
    saveData(state.data);
  }
  tables.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:700">${t.name}</div>
          <div class="desc">${t.description || ''}</div>
        </div>
        <div class="icon" style="font-size:26px">🫁</div>
      </div>
      <div class="meta">Total time: ${secToMMSS(t.cycles.reduce((s,c)=>s+c.hold+c.breath,0))}</div>
    `;
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      state.currentTableId = t.id;
      backdrop.remove();
      updateHomeUI();
    });
    list.appendChild(card);
  });
  const cancelBtn = $('#pickerCancel', backdrop);
  if (cancelBtn) cancelBtn.addEventListener('click', () => backdrop.remove());
  // 點擊背板關閉
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
}

function updateHomeUI() {
  const t = state.data.tables.find((x) => x.id === state.currentTableId);
  $('#pickTableBtn').textContent = t ? `${t.name} ▾` : '選擇 Table ▾';
  const lung = $('#markDiaphragmBtn');
  const running = !!state.session;
  if (!running) {
    $('#runningControls').hidden = true;
    lung.classList.add('disabled');
    lung.disabled = true;
  } else {
    $('#runningControls').hidden = false;
    lung.classList.toggle('disabled', !(state.session.phase === 'hold'));
    lung.disabled = !(state.session.phase === 'hold');
  }
  renderSessionTable();
}

function renderSessionTable() {
  const wrap = $('#sessionTableWrap');
  wrap.innerHTML = '';
  const t = state.data.tables.find((x) => x.id === state.currentTableId);
  if (!t) return;
  // header
  const header = document.createElement('div');
  header.className = 'grid-header';
  header.innerHTML = '<div>#</div><div>Hold</div><div>Breath</div><div></div>';
  wrap.appendChild(header);
  t.cycles.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cycle-row';
    const marker =
      state.session && state.session.contractions[i] != null
        ? `<div style="color:#ff9800;font-size:12px"> ${secToMMSS(state.session.contractions[i])}</div>`
        : '';
    const playing =
      state.session && state.session.index === i && (state.session.phase === 'hold' || state.session.phase === 'breath');
    row.innerHTML = `
      <div>${playing ? '▶' : i + 1}</div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <div>${secToMMSS(c.hold)}${state.session && state.session.addedSeconds[i] ? ` + ${state.session.addedSeconds[i]}` : ''}</div>
        ${marker}
      </div>
      <div>${secToMMSS(c.breath)}</div>
      <div></div>
    `;
    wrap.appendChild(row);
  });
}

// Session handling
let rafId = 0;
function startSession() {
  const t = state.data.tables.find((x) => x.id === state.currentTableId);
  if (!t) {
    alert('請先選擇 Table');
    return;
  }
  state.session = {
    tableId: t.id,
    index: -1,
    phase: 'prepare',
    phaseRemaining: 10, // default prepare 00:10
    paused: false,
    lastTick: performance.now(),
    contractions: {}, // cycleIndex -> seconds from start of hold
    holdStartSec: null,
    addedSeconds: {}, // cycleIndex -> added seconds total
  };
  $('#startBtn').disabled = true;
  tick();
  updateHomeUI();
}

function togglePause() {
  if (!state.session) return;
  state.session.paused = !state.session.paused;
  state.session.lastTick = performance.now();
}
function skipPhase() {
  if (!state.session) return;
  nextPhase();
}
function stopSession() {
  cancelAnimationFrame(rafId);
  state.session = null;
  $('#startBtn').disabled = false;
  drawRing(0, '#2a2f3b', '#3a4152');
  $('#timeText').textContent = '00:00';
  $('#phaseText').textContent = 'Prepare';
  updateHomeUI();
}
function adjustRemaining(sec) {
  if (!state.session) return;
  state.session.phaseRemaining += sec;
  if (state.session.phase === 'hold') {
    const i = state.session.index;
    state.session.addedSeconds[i] = (state.session.addedSeconds[i] || 0) + 10;
  }
  updateHomeUI();
}
function markDiaphragm() {
  if (!state.session || state.session.phase !== 'hold') return;
  const i = state.session.index;
  if (state.session.contractions[i] != null) return;
  const elapsed = state.session.holdPlanned - state.session.phaseRemaining;
  state.session.contractions[i] = Math.max(0, Math.round(elapsed));
  updateHomeUI();
}

function nextPhase() {
  const t = state.data.tables.find((x) => x.id === state.session.tableId);
  if (!t) return stopSession();
  if (state.session.phase === 'prepare') {
    state.session.index = 0;
    state.session.phase = 'hold';
    state.session.holdPlanned = t.cycles[0].hold;
    state.session.phaseRemaining = t.cycles[0].hold;
    state.session.holdStartSec = t.cycles[0].hold;
  } else if (state.session.phase === 'hold') {
    state.session.phase = 'breath';
    state.session.phaseRemaining = t.cycles[state.session.index].breath;
  } else if (state.session.phase === 'breath') {
    const nextIdx = state.session.index + 1;
    if (nextIdx >= t.cycles.length) {
      stopSession();
      return;
    }
    state.session.index = nextIdx;
    state.session.phase = 'hold';
    state.session.holdPlanned = t.cycles[nextIdx].hold;
    state.session.phaseRemaining = t.cycles[nextIdx].hold;
  }
  updateHomeUI();
}

function tick(now = performance.now()) {
  if (!state.session) return;
  const s = state.session;
  const dt = Math.max(0, (now - s.lastTick) / 1000);
  s.lastTick = now;
  if (!s.paused) {
    s.phaseRemaining -= dt;
    if (s.phaseRemaining <= 0) {
      nextPhase();
    }
  }
  // draw
  $('#phaseText').textContent =
    s.phase === 'prepare' ? 'Prepare' : s.phase === 'hold' ? 'Hold' : 'Breath';
  $('#timeText').textContent = secToMMSS(s.phaseRemaining);
  const planned =
    s.phase === 'prepare'
      ? 10
      : s.phase === 'hold'
      ? s.holdPlanned
      : state.data.tables
          .find((x) => x.id === s.tableId)
          .cycles[s.index].breath;
  const progress = Math.max(0, Math.min(1, 1 - s.phaseRemaining / planned));
  const color =
    s.phase === 'prepare' ? '#3b82f6' : s.phase === 'hold' ? '#ef5350' : '#26a69a';
  drawRing(progress, color, '#3a4152');
  rafId = requestAnimationFrame(tick);
}

function drawRing(progress, color, bg) {
  const c = $('#ring');
  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w, h) / 2 - 12;
  const cx = w / 2;
  const cy = h / 2;
  // background ring
  ctx.lineWidth = 18;
  ctx.strokeStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // progress
  ctx.strokeStyle = color;
  ctx.beginPath();
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * progress;
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
}

// ---------- Time Picker ----------
function openTimePicker(initialSec = 0, maxMin = 10) {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.innerHTML = $('#tpl-time-picker').innerHTML;
    const backdrop = container.firstElementChild;
    document.body.appendChild(backdrop);
    const tpMin = $('#tpMin', backdrop);
    const tpSec = $('#tpSec', backdrop);
    for (let m = 0; m <= maxMin; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m.toString();
      tpMin.appendChild(opt);
    }
    for (let s = 0; s < 60; s++) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.toString().padStart(2, '0');
      tpSec.appendChild(opt);
    }
    const initM = Math.floor(initialSec / 60);
    const initS = initialSec % 60;
    tpMin.value = String(Math.min(initM, maxMin));
    tpSec.value = String(initS);
    $('#tpCancel', backdrop).addEventListener('click', () => {
      backdrop.remove();
      resolve(null);
    });
    $('#tpOk', backdrop).addEventListener('click', () => {
      const sec = parseInt(tpMin.value, 10) * 60 + parseInt(tpSec.value, 10);
      backdrop.remove();
      resolve(sec);
    });
  });
}

// ---------- Confirm Save ----------
function confirmSave() {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.innerHTML = $('#tpl-confirm').innerHTML;
    const backdrop = container.firstElementChild;
    document.body.appendChild(backdrop);
    $('#cfCancel', backdrop).addEventListener('click', () => {
      backdrop.remove();
      resolve('cancel');
    });
    $('#cfDiscard', backdrop).addEventListener('click', () => {
      backdrop.remove();
      resolve('discard');
    });
    $('#cfSave', backdrop).addEventListener('click', () => {
      backdrop.remove();
      resolve('save');
    });
  });
}


