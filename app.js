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

function setCornerButtonLabel(btn, symbol) {
  if (!btn) return;
  let label = btn.querySelector('.corner-label');
  if (!label) {
    label = document.createElement('span');
    label.className = 'corner-label';
    btn.textContent = '';
    btn.appendChild(label);
  }
  label.textContent = symbol;
}

// App State
const state = {
  data: loadData(),
  route: 'home',
  editing: null, // {id}
  currentTableId: null,
  session: null, // created after start
};

function adjustSessionTableHeight() {
  const wrap = $('#sessionTableWrap');
  const fixed = $('.home-fixed');
  if (!wrap || !fixed) return;
  if (window.innerWidth > 768) {
    wrap.style.maxHeight = '';
    wrap.style.overflowY = '';
    wrap.style.webkitOverflowScrolling = '';
    return;
  }
  const fixedRect = fixed.getBoundingClientRect();
  // 計算可用高度：確保能顯示4行+2行緩衝空間
  const viewportHeight = window.innerHeight;
  const usedHeight = fixedRect.bottom;
  const rowHeight = 56; // 每行約56px
  const minVisibleRows = 4;
  const bufferRows = 2; // 額外2行緩衝空間
  const minHeight = rowHeight * minVisibleRows;
  const bufferHeight = rowHeight * bufferRows;
  // 確保至少有4行顯示 + 2行緩衝，但也要考慮實際可用高度
  const available = Math.max(minHeight + bufferHeight, viewportHeight - usedHeight - 8);
  wrap.style.maxHeight = `${available}px`;
  wrap.style.overflowY = 'auto';
  wrap.style.webkitOverflowScrolling = 'touch';
  wrap.style.touchAction = 'pan-y';
  // 確保可以滾動
  wrap.style.minHeight = '0';
  // 添加padding-bottom確保可以滾動到底部
  wrap.style.paddingBottom = `${bufferHeight}px`;
}

function scrollRowIntoView(row) {
  const wrap = $('#sessionTableWrap');
  if (!wrap || !row) return;
  // 確保wrap是可滾動的
  const overflow = getComputedStyle(wrap).overflowY;
  if (overflow !== 'auto' && overflow !== 'scroll') return;
  
  // 使用setTimeout確保DOM已更新
  setTimeout(() => {
    const header = wrap.querySelector('.grid-header');
    const headerHeight = header ? header.offsetHeight : 0;
    const rowTop = row.offsetTop;
    const rowHeight = row.offsetHeight;
    const wrapHeight = wrap.clientHeight;
    const wrapScrollTop = wrap.scrollTop;
    
    // 計算目標位置：讓row顯示在header下方，並確保可以看到完整的row
    // 目標是讓row的頂部對齊header底部，或者如果row在視窗內就不滾動
    const rowBottom = rowTop + rowHeight;
    const visibleTop = wrapScrollTop + headerHeight;
    const visibleBottom = wrapScrollTop + wrapHeight;
    
    // 如果row完全在可見區域內（考慮header），不需要滾動
    if (rowTop >= visibleTop && rowBottom <= visibleBottom) {
      return;
    }
    
    // 如果row在header下方但不可見，滾動到讓row顯示在header下方
    let targetScrollTop = rowTop - headerHeight;
    
    // 確保不會滾動到負數
    targetScrollTop = Math.max(0, targetScrollTop);
    
    // 如果目標位置與當前位置差異較大，才滾動
    const diff = Math.abs(wrapScrollTop - targetScrollTop);
    if (diff > rowHeight * 0.3) {
      wrap.scrollTo({ 
        top: targetScrollTop,
        behavior: 'smooth' 
      });
    }
  }, 100);
}

window.addEventListener('resize', adjustSessionTableHeight);
window.addEventListener('orientationchange', adjustSessionTableHeight);

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

// 防止雙擊縮放
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// 防止計時器區域的雙擊縮放
const preventDoubleTapZoom = (element) => {
  let lastTap = 0;
  element.addEventListener('touchend', function(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      event.preventDefault();
    }
    lastTap = currentTime;
  });
};

// 在renderHome時應用防止雙擊縮放
const originalRenderHome = renderHome;
renderHome = function() {
  originalRenderHome();
  const timerWrapper = $('.timer-wrapper');
  if (timerWrapper) {
    preventDoubleTapZoom(timerWrapper);
  }
};

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
  const titleEl = $('#editTitle');
  const tableName = table.name || '';
  if (tableName) {
    titleEl.innerHTML = (state.editing.originalId ? 'Edit table <span class="table-name-highlight">' : 'New table <span class="table-name-highlight">') + tableName + '</span>';
  } else {
    titleEl.textContent = (state.editing.originalId ? 'Edit table ' : 'New table ') + tableName;
  }
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
    // 更新按鈕狀態
    const reorderBtn = $('#reorderBtn');
    if (state.editing.reorderMode) {
      reorderBtn.classList.add('active');
    } else {
      reorderBtn.classList.remove('active');
    }
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
  // 清理所有placeholder（防止殘留）
  wrap.querySelectorAll('.row-placeholder').forEach(p => p.remove());
  wrap.innerHTML = '';
  wrap.classList.toggle('reorder-mode', !!reorderMode);
  const beforeRects = getRects(wrap);
  table.cycles.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cycle-row';
    row.dataset.key = c._k;
    row.draggable = false;
    row.style.cursor = 'default';
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
      const handle = $('.handle', row);
      if (handle) {
        let dragStarted = false;
        let touchStartY = 0;
        let touchStartTime = 0;
        
        // 使用 touchstart 和 pointerdown 來處理移動設備
        const startDrag = (e) => {
          // 防止默認行為
          e.preventDefault();
          e.stopPropagation();
          
          // 記錄觸摸起始位置和時間
          if (e.touches) {
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
          }
          
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          dragStarted = true;
          startCustomDrag(c._k, i, clientY, e);
        };
        
        // 防止觸摸滾動
        const preventScroll = (e) => {
          if (dragStarted) {
            e.preventDefault();
            e.stopPropagation();
          }
        };
        
        // 處理觸摸開始 - 使用 capture phase 確保優先處理
        handle.addEventListener('touchstart', startDrag, { passive: false, capture: true });
        handle.addEventListener('pointerdown', startDrag, { capture: true });
        
        // 防止文字選取和上下文菜單 - 使用 capture phase
        const preventSelect = (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
        handle.addEventListener('selectstart', preventSelect, { capture: true });
        handle.addEventListener('contextmenu', preventSelect, { capture: true });
        handle.addEventListener('dragstart', preventSelect, { capture: true });
        handle.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
        
        // 在 row 層級也防止選取
        row.addEventListener('selectstart', preventSelect, { capture: true });
        row.addEventListener('contextmenu', preventSelect, { capture: true });
        row.addEventListener('dragstart', preventSelect, { capture: true });
        
        // 重置標記
        const resetDrag = () => {
          dragStarted = false;
        };
        handle.addEventListener('touchend', resetDrag);
        handle.addEventListener('touchcancel', resetDrag);
      }
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
function startCustomDrag(key, startIndex, startClientY, startEvent) {
  const wrap = $('#cycleList');
  const { table } = state.editing;
  const row = $(`.cycle-row[data-key="${key}"]`, wrap);
  if (!row) return;

  if (startEvent) {
    startEvent.preventDefault();
    startEvent.stopPropagation();
  }

  wrap.style.position = wrap.style.position || 'relative';

  const wrapRect = wrap.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const grabOffset = startClientY - rowRect.top;

  const placeholder = document.createElement('div');
  placeholder.className = 'row-placeholder';
  placeholder.style.height = `${rowRect.height}px`;
  placeholder.style.width = `${rowRect.width}px`;
  wrap.insertBefore(placeholder, row);
  wrap.removeChild(row);

  const ghost = row;
  ghost.classList.add('dragging');
  ghost.style.position = 'fixed';
  ghost.style.left = `${rowRect.left}px`;
  ghost.style.top = `${rowRect.top}px`;
  ghost.style.width = `${rowRect.width}px`;
  ghost.style.pointerEvents = 'none';
  ghost.style.margin = '0';
  document.body.appendChild(ghost);
  document.body.classList.add('dragging-global');

  const getClientY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  function movePlaceholder(centerY) {
    const rows = Array.from(wrap.querySelectorAll('.cycle-row, .row-placeholder')).filter((el) => el !== placeholder && el.classList.contains('cycle-row'));
    for (const target of rows) {
      const targetRect = target.getBoundingClientRect();
      const targetCenter = targetRect.top - wrapRect.top + targetRect.height / 2 + wrap.scrollTop;
      if (centerY < targetCenter) {
        wrap.insertBefore(placeholder, target);
        return;
      }
    }
    wrap.appendChild(placeholder);
  }

  function onMove(e) {
    e.preventDefault();
    const clientY = getClientY(e);
    const targetTop = clientY - grabOffset;
    ghost.style.top = `${targetTop}px`;
    const relativeCenter = clientY - wrapRect.top + wrap.scrollTop;
    movePlaceholder(relativeCenter);
  }

  function cleanup() {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    window.removeEventListener('touchmove', onMove, true);
    window.removeEventListener('touchend', onUp, true);
    window.removeEventListener('touchcancel', onUp, true);
  }

  function onUp(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    cleanup();
    document.body.classList.remove('dragging-global');

    ghost.classList.remove('dragging');
    ghost.style.position = '';
    ghost.style.left = '';
    ghost.style.top = '';
    ghost.style.width = '';
    ghost.style.pointerEvents = '';
    ghost.style.margin = '';

    wrap.insertBefore(ghost, placeholder);
    placeholder.remove();

    const keys = Array.from(wrap.querySelectorAll('.cycle-row')).map((el) => el.dataset.key);
    const map = new Map(table.cycles.map((c) => [c._k, c]));
    table.cycles = keys.map((k) => map.get(k));
    state.editing.dirty = true;
    renderCycleList();
  }

  window.addEventListener('pointermove', onMove, { passive: false, capture: true });
  window.addEventListener('pointerup', onUp, { passive: false, capture: true });
  window.addEventListener('pointercancel', onUp, { passive: false, capture: true });
  window.addEventListener('touchmove', onMove, { passive: false, capture: true });
  window.addEventListener('touchend', onUp, { passive: false, capture: true });
  window.addEventListener('touchcancel', onUp, { passive: false, capture: true });
}

// ---------- Home / Training ----------
function renderHome() {
  view.innerHTML = $('#tpl-home').innerHTML;
  const pickBtn = $('#pickTableBtn');
  if (pickBtn) pickBtn.addEventListener('click', openPicker);
  $('#pauseBtn').addEventListener('click', togglePauseOrStart);
  $('#skipBtn').addEventListener('click', skipPhase);
  $('#plus10Btn').addEventListener('click', () => adjustRemaining(10));
  $('#stopBtn').addEventListener('click', stopSession);
  $('#markDiaphragmBtn').addEventListener('click', markDiaphragm);
  drawRing(0, '#2a2f3b', '#3a4152');
  updateHomeUI();
  adjustSessionTableHeight();
  
}

function togglePauseOrStart() {
  if (!state.session) {
    // 如果沒有session，點擊開始新的session
    startSession();
  } else {
    // 如果有session，切換暫停/繼續
    togglePause();
  }
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
  // 如果正在運行循環，不允許選擇TABLE
  if (state.session) {
    alert('請先停止當前循環');
    return;
  }
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
  const pickTableBtn = $('#pickTableBtn');
  const lung = $('#markDiaphragmBtn');
  const running = !!state.session;
  const pauseBtn = $('#pauseBtn');
  const skipBtn = $('#skipBtn');
  const paused = running && state.session.paused;
  
  // 鎖定選擇TABLE按鈕（如果正在運行）
  if (running) {
    pickTableBtn.classList.add('disabled');
    pickTableBtn.disabled = true;
    pickTableBtn.title = '請先停止當前循環';
  } else {
    pickTableBtn.classList.remove('disabled');
    pickTableBtn.disabled = false;
    pickTableBtn.title = '';
    pickTableBtn.textContent = t ? `${t.name} ▾` : '選擇 Table ▾';
  }
  
  if (!running) {
    lung.classList.add('disabled');
    lung.disabled = true;
    if (skipBtn) {
      skipBtn.disabled = true;
      skipBtn.classList.add('disabled');
    }
    if (pauseBtn) {
      setCornerButtonLabel(pauseBtn, '▶');
      pauseBtn.title = '開始';
      pauseBtn.classList.remove('paused');
    }
  } else {
    // 檢查是否已經按過肺部按鈕
    const alreadyMarked = state.session.phase === 'hold' && state.session.contractions[state.session.index] != null;
    const holdActive = state.session.phase === 'hold' && !paused && !alreadyMarked;
    lung.classList.toggle('disabled', !holdActive);
    lung.disabled = !holdActive;
    // 暫停時不禁用跳過和+10s按鈕，只禁用肺部按鈕
    if (skipBtn) {
      skipBtn.disabled = false;
      skipBtn.classList.remove('disabled');
    }
    if (pauseBtn) {
      setCornerButtonLabel(pauseBtn, state.session.paused ? '▶' : '⏸');
      pauseBtn.title = state.session.paused ? '繼續' : '暫停';
      pauseBtn.classList.toggle('paused', state.session.paused);
    }
  }
  renderSessionTable();
}

function renderSessionTable() {
  const wrap = $('#sessionTableWrap');
  wrap.innerHTML = '';
  const t = state.data.tables.find((x) => x.id === state.currentTableId);
  if (!t) return;
  let activeRowEl = null;
  // header
  const header = document.createElement('div');
  header.className = 'grid-header';
  header.innerHTML = '<div>#</div><div>Hold</div><div>Breath</div><div></div>';
  wrap.appendChild(header);
  t.cycles.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cycle-row';

    const session = state.session;
    const isActiveCycle = session && session.index === i;
    const isHoldPhase = session && session.phase === 'hold' && session.index === i;
    const isBreathPhase = session && session.phase === 'breath' && session.index === i;
    if (isActiveCycle) row.classList.add('active-row');
    if (isActiveCycle) activeRowEl = row;

    const holdAdded = session && session.addedSeconds[i] ? ` + ${session.addedSeconds[i]}` : '';
    const breathAdded = session && session.breathAddedSeconds[i] ? ` + ${session.breathAddedSeconds[i]}` : '';
    const contractionMarker =
      session && session.contractions[i] != null
        ? `<div class="diag"> ${secToMMSS(session.contractions[i])}</div>`
        : '';

    const holdIndicator = isHoldPhase ? '<span class="phase-indicator">▶</span>' : '';
    const breathIndicator = isBreathPhase ? '<span class="phase-indicator">▶</span>' : '';

    row.innerHTML = `
      <div>${i + 1}</div>
      <div class="time-cell ${isHoldPhase ? 'active-phase' : ''}">
        <div class="main">
          ${holdIndicator}
          <span>${secToMMSS(c.hold)}${holdAdded}</span>
        </div>
        ${contractionMarker}
      </div>
      <div class="time-cell ${isBreathPhase ? 'active-phase' : ''}">
        <div class="main">
          ${breathIndicator}
          <span>${i === t.cycles.length - 1 ? '--:--' : secToMMSS(c.breath) + breathAdded}</span>
        </div>
      </div>
      <div></div>
    `;
    wrap.appendChild(row);
  });
  adjustSessionTableHeight();
  // 如果有活動行，自動滾動到該行
  if (activeRowEl) {
    // 使用requestAnimationFrame確保DOM已完全渲染
    requestAnimationFrame(() => {
      scrollRowIntoView(activeRowEl);
    });
  }
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
    addedSeconds: {}, // cycleIndex -> added seconds total (hold)
    breathAddedSeconds: {}, // cycleIndex -> added seconds total (breath)
    contractionTime: null, // timestamp when contraction was marked
    prepareAddedSeconds: 0, // prepare階段添加的秒數
  };
  tick();
  updateHomeUI();
}

function togglePause() {
  if (!state.session) return;
  state.session.paused = !state.session.paused;
  state.session.lastTick = performance.now();
  updateHomeUI();
}
function skipPhase() {
  if (!state.session) return;
  nextPhase();
  // 立即更新計時器顯示（nextPhase已經調用updateHomeUI，會觸發renderSessionTable）
  // tick()會自動繼續運行，不需要手動調用
}
function stopSession() {
  cancelAnimationFrame(rafId);
  state.session = null;
  drawRing(0, '#2a2f3b', '#3a4152');
  $('#timeText').textContent = '00:00';
  $('#phaseText').textContent = 'Prepare';
  updateHomeUI();
}
function adjustRemaining(sec) {
  if (!state.session) return;
  state.session.phaseRemaining += sec;
  if (state.session.phase === 'prepare') {
    state.session.prepareAddedSeconds = (state.session.prepareAddedSeconds || 0) + sec;
  } else if (state.session.phase === 'hold') {
    const i = state.session.index;
    if (i >= 0) {
      state.session.addedSeconds[i] = (state.session.addedSeconds[i] || 0) + sec;
    }
  } else if (state.session.phase === 'breath') {
    const i = state.session.index;
    if (i >= 0) {
      state.session.breathAddedSeconds[i] = (state.session.breathAddedSeconds[i] || 0) + sec;
    }
  }
  // 立即更新計時器顯示和TABLE，讓進度條和TABLE都正確顯示
  state.session.lastTick = performance.now();
  // 更新TABLE顯示
  updateHomeUI();
  // 強制更新一次tick來立即顯示計時器
  tick();
}
function markDiaphragm() {
  if (!state.session || state.session.phase !== 'hold' || state.session.paused) return;
  const i = state.session.index;
  if (state.session.contractions[i] != null) return;
  const added = state.session.addedSeconds[i] || 0;
  const totalPlanned = state.session.holdPlanned + added;
  const elapsed = totalPlanned - state.session.phaseRemaining;
  state.session.contractions[i] = Math.max(0, Math.round(elapsed));
  // 記錄按下時的時間點，用於改變顏色
  state.session.contractionTime = performance.now();
  updateHomeUI();
}

function nextPhase() {
  const t = state.data.tables.find((x) => x.id === state.session.tableId);
  if (!t) return stopSession();
  // 清除contractionTime，因為進入新階段
  state.session.contractionTime = null;
  if (state.session.phase === 'prepare') {
    state.session.index = 0;
    state.session.phase = 'hold';
    state.session.holdPlanned = t.cycles[0].hold;
    state.session.phaseRemaining = t.cycles[0].hold;
    state.session.holdStartSec = t.cycles[0].hold;
    // 清除prepare的添加秒數
    state.session.prepareAddedSeconds = 0;
  } else if (state.session.phase === 'hold') {
    // 如果是最後一個循環，hold結束時直接停止訓練
    if (state.session.index === t.cycles.length - 1) {
      stopSession();
      return;
    }
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
    // 清除新循環的contractionTime，讓肺部按鈕可以再次使用
    state.session.contractionTime = null;
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
      return;
    }
  }
  // draw
  $('#phaseText').textContent =
    s.phase === 'prepare' ? 'Prepare' : s.phase === 'hold' ? 'Hold' : 'Breath';
  $('#timeText').textContent = secToMMSS(s.phaseRemaining);
  const table = state.data.tables.find((x) => x.id === s.tableId);
  const holdAdded = s.phase === 'hold' ? (s.addedSeconds[s.index] || 0) : 0;
  const breathAdded = s.phase === 'breath' ? (s.breathAddedSeconds[s.index] || 0) : 0;
  const prepareAdded = s.phase === 'prepare' ? (s.prepareAddedSeconds || 0) : 0;
  const planned =
    s.phase === 'prepare'
      ? 10 + prepareAdded
      : s.phase === 'hold'
      ? s.holdPlanned + holdAdded
      : table && table.cycles[s.index]
      ? table.cycles[s.index].breath + breathAdded
      : 0;
  // 計算progress：基於當前剩餘時間和總計劃時間（包括添加的秒數）
  let progress = 0;
  if (planned > 0) {
    if (s.phaseRemaining <= planned) {
      // 正常情況：剩餘時間在計劃時間內
      progress = Math.max(0, Math.min(1, 1 - s.phaseRemaining / planned));
    } else {
      // 超過計劃時間：進度條應該顯示為已完成（100%），但繼續倒數
      progress = 1;
    }
  }
  const color =
    s.phase === 'prepare' ? '#3b82f6' : s.phase === 'hold' ? '#ef5350' : '#26a69a';
  let markFraction = null;
  if (s.phase === 'hold' && s.contractionTime != null) {
    // 如果有記錄contraction時間，計算從按下那一刻到現在的進度
    const totalHold = s.holdPlanned + holdAdded;
    if (totalHold > 0) {
      // 計算按下時已經過去的時間比例
      const contraction = s.contractions[s.index];
      if (contraction != null) {
        // 使用記錄的contraction時間來計算比例
        markFraction = Math.max(0, Math.min(1, contraction / totalHold));
      }
    }
  }
  drawRing(progress, color, '#3a4152', markFraction);
  rafId = requestAnimationFrame(tick);
}

function drawRing(progress, color, bg, markFraction = null) {
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
  const tau = Math.PI * 2;
  const start = -Math.PI / 2;
  const end = start + tau * progress;
  const hasMark = typeof markFraction === 'number' && !Number.isNaN(markFraction);
  const clampedMark = hasMark ? Math.max(0, Math.min(1, markFraction)) : null;
  ctx.lineWidth = 18;
  if (progress <= 0) return;
  // 確保progress不超過1（圓圈最多100%）
  const clampedProgress = Math.min(1, progress);
  const actualEnd = start + tau * clampedProgress;
  
  // 如果有標記點，且標記點在進度範圍內，則分段繪製
  if (clampedMark != null && clampedMark > 0 && clampedMark <= clampedProgress) {
    const splitAngle = start + tau * clampedMark;
    // 第一部分：從開始到標記點（原始顏色）
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, splitAngle);
    ctx.stroke();
    // 第二部分：從標記點到當前進度（黃色）
    ctx.strokeStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(cx, cy, r, splitAngle, actualEnd);
    ctx.stroke();
  } else if (clampedMark != null && clampedMark > 0 && clampedMark > clampedProgress) {
    // 標記點在進度之後，只繪製到標記點之前的原始顏色
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, actualEnd);
    ctx.stroke();
  } else {
    // 沒有標記點，只繪製原始顏色
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, actualEnd);
    ctx.stroke();
  }
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


