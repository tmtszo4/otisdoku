(function () {
  'use strict';

  const EMPTY = 0, CROSS = 1, DOG = 2;
  const STORAGE_KEY = 'otisdoku-v1';
  const COLORS = [
    '#f4a8a0', '#f7c98b', '#f3e48c', '#b9e2a0', '#9fd8d0',
    '#a9c6f0', '#c9b3ec', '#f0b5d8', '#d9c4a8',
  ];
  const DOG_IMG = 'assets/otis-head.png';
  const DEFAULT_MESSAGE = 'Keresd meg Otist! Minden sorban, oszlopban és színes területen pontosan egy Otis van, és nem érhetnek egymáshoz.';

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const messageEl = $('message');

  let save = loadSave();
  let puzzle, marks, history, cells, solved;
  let hintCells = [];

  function loadSave() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && data.level) return data;
    } catch (e) { /* ignore */ }
    return { level: 1, solved: {}, boards: {}, started: {}, seenHelp: false };
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }

  function maxUnlocked() {
    let max = 1;
    for (const l of Object.keys(save.solved)) max = Math.max(max, Number(l) + 1);
    return max;
  }

  function loadLevel(level) {
    save.level = level;
    puzzle = Puzzle.generate(level);
    const n = puzzle.n;
    const stored = save.boards[level];
    marks = stored && stored.length === n ? stored.map((row) => row.slice()) : emptyMarks(n);
    if (!save.started[level]) save.started[level] = Date.now();
    history = [];
    hintCells = [];
    solved = !!save.solved[level];
    persist();
    buildBoard();
    render();
    setMessage(solved ? 'Ezt a szintet már megoldottad! 🐾' : DEFAULT_MESSAGE, solved ? 'good' : '');
    $('level-label').textContent = level + '. szint · ' + n + '×' + n;
    $('prev').disabled = level <= 1;
    $('next').disabled = level >= maxUnlocked();
  }

  function emptyMarks(n) {
    return Array.from({ length: n }, () => new Array(n).fill(EMPTY));
  }

  function buildBoard() {
    const { n, regions } = puzzle;
    boardEl.style.setProperty('--n', n);
    boardEl.innerHTML = '';
    cells = [];
    const thick = '#3b2a20';
    for (let r = 0; r < n; r++) {
      cells.push([]);
      for (let c = 0; c < n; c++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.r = r;
        el.dataset.c = c;
        el.setAttribute('role', 'gridcell');
        el.style.background = COLORS[regions[r][c] % COLORS.length];
        // Thicker lines where two different regions meet.
        const shadows = [];
        const reg = regions[r][c];
        if (r > 0 && regions[r - 1][c] !== reg) shadows.push(`inset 0 2px 0 ${thick}`);
        if (r < n - 1 && regions[r + 1][c] !== reg) shadows.push(`inset 0 -2px 0 ${thick}`);
        if (c > 0 && regions[r][c - 1] !== reg) shadows.push(`inset 2px 0 0 ${thick}`);
        if (c < n - 1 && regions[r][c + 1] !== reg) shadows.push(`inset -2px 0 0 ${thick}`);
        el.style.boxShadow = shadows.join(', ');
        boardEl.appendChild(el);
        cells[r].push(el);
      }
    }
    boardEl.classList.toggle('solved', solved);
  }

  function conflicts() {
    const { n, regions } = puzzle;
    const bad = new Set();
    const dogs = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (marks[r][c] === DOG) dogs.push([r, c]);
    for (let i = 0; i < dogs.length; i++) {
      for (let j = i + 1; j < dogs.length; j++) {
        const [r1, c1] = dogs[i], [r2, c2] = dogs[j];
        const clash = r1 === r2 || c1 === c2 || regions[r1][c1] === regions[r2][c2] ||
          (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1);
        if (clash) { bad.add(r1 + ',' + c1); bad.add(r2 + ',' + c2); }
      }
    }
    return { bad, dogCount: dogs.length };
  }

  function render() {
    const { n } = puzzle;
    const { bad } = conflicts();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const el = cells[r][c];
        const m = marks[r][c];
        const want = m === DOG ? 'dog' : m === CROSS ? 'cross' : 'empty';
        if (el.dataset.state !== want) {
          el.dataset.state = want;
          el.innerHTML = m === DOG ? `<img class="dog" src="${DOG_IMG}" alt="Otis">` : m === CROSS ? '✕' : '';
          el.setAttribute('aria-label', `${r + 1}. sor, ${c + 1}. oszlop: ${m === DOG ? 'Otis' : m === CROSS ? 'kizárva' : 'üres'}`);
        }
        el.classList.toggle('bad', bad.has(r + ',' + c));
        el.classList.toggle('hint', hintCells.some(([hr, hc]) => hr === r && hc === c));
      }
    }
  }

  function commit() {
    save.boards[save.level] = marks.map((row) => row.slice());
    persist();
    render();
    checkWin();
  }

  function pushHistory() {
    history.push(marks.map((row) => row.slice()));
    if (history.length > 200) history.shift();
    if (hintCells.length) {
      hintCells = [];
      setMessage(DEFAULT_MESSAGE);
    }
  }

  function setMessage(text, kind) {
    messageEl.textContent = text;
    messageEl.className = 'message' + (kind ? ' ' + kind : '');
  }

  function checkWin() {
    const { bad, dogCount } = conflicts();
    if (solved || dogCount !== puzzle.n || bad.size) return;
    solved = true;
    save.solved[save.level] = true;
    const seconds = Math.round((Date.now() - (save.started[save.level] || Date.now())) / 1000);
    persist();
    boardEl.classList.add('solved');
    $('next').disabled = false;
    setMessage('Megtaláltad Otist! 🐾', 'good');
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    $('win-text').textContent = `${save.level}. szint teljesítve${seconds < 3600 ? ' ' + formatTime(seconds) + ' alatt' : ''}.`;
    setTimeout(() => $('win').showModal(), 650);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    return m ? `${m} perc ${s % 60} mp` : `${s} mp`;
  }

  // ---- Input: tap cycles empty → ✕ → Otis → empty; dragging paints ✕ ----

  let pointer = null;

  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest('.cell');
    if (!cell || !boardEl.contains(cell)) return null;
    return [Number(cell.dataset.r), Number(cell.dataset.c)];
  }

  boardEl.addEventListener('pointerdown', (e) => {
    if (solved || pointer) return;
    const pos = cellFromPoint(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    boardEl.setPointerCapture(e.pointerId);
    const startState = marks[pos[0]][pos[1]];
    pointer = { id: e.pointerId, start: pos, last: pos.join(), dragging: false, erase: startState === CROSS };
  });

  boardEl.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const pos = cellFromPoint(e.clientX, e.clientY);
    if (!pos || pos.join() === pointer.last) return;
    pointer.last = pos.join();
    if (!pointer.dragging) {
      pointer.dragging = true;
      pushHistory();
      paint(pointer.start);
    }
    paint(pos);
    render();
  });

  function paint([r, c]) {
    if (pointer.erase) {
      if (marks[r][c] === CROSS) marks[r][c] = EMPTY;
    } else if (marks[r][c] === EMPTY) {
      marks[r][c] = CROSS;
    }
  }

  function endPointer(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const p = pointer;
    pointer = null;
    if (e.type === 'pointercancel') {
      if (p.dragging) commit();
      return;
    }
    if (!p.dragging) {
      const [r, c] = p.start;
      pushHistory();
      marks[r][c] = (marks[r][c] + 1) % 3;
      if (marks[r][c] === DOG && navigator.vibrate) navigator.vibrate(10);
    }
    commit();
  }

  boardEl.addEventListener('pointerup', endPointer);
  boardEl.addEventListener('pointercancel', endPointer);
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- Hints ----

  function attacked(r, c) {
    const { n, regions } = puzzle;
    for (let rr = 0; rr < n; rr++) {
      for (let cc = 0; cc < n; cc++) {
        if (marks[rr][cc] !== DOG || (rr === r && cc === c)) continue;
        if (rr === r || cc === c || regions[rr][cc] === regions[r][c] ||
          (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1)) return true;
      }
    }
    return false;
  }

  function groups() {
    const { n, regions } = puzzle;
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({ name: `${i + 1}. sorban`, cells: [...Array(n).keys()].map((c) => [i, c]) });
      list.push({ name: `${i + 1}. oszlopban`, cells: [...Array(n).keys()].map((r) => [r, i]) });
      const reg = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === i) reg.push([r, c]);
      list.push({ name: 'ezen a színes területen', cells: reg, region: true });
    }
    return list;
  }

  function findHint() {
    const { n, solution } = puzzle;
    const isSol = (r, c) => solution[r] === c;

    const wrongDogs = [];
    const wrongCrosses = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (marks[r][c] === DOG && !isSol(r, c)) wrongDogs.push([r, c]);
        if (marks[r][c] === CROSS && isSol(r, c)) wrongCrosses.push([r, c]);
      }
    }
    if (wrongDogs.length) return { cells: wrongDogs, text: 'Ez az Otis rossz helyen van. Vedd ki!', kind: 'warn' };
    if (wrongCrosses.length) return { cells: wrongCrosses, text: 'Ide tévesen tettél ✕-et, itt lehet Otis.', kind: 'warn' };

    // Cells already ruled out by a placed dog.
    const ruledOut = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (marks[r][c] === EMPTY && attacked(r, c)) ruledOut.push([r, c]);
    }
    if (ruledOut.length) return { cells: ruledOut, text: 'Ezek a mezők egy már lerakott Otis miatt kizárhatók (✕).' };

    // A row, column or region with exactly one possible cell left.
    const all = groups();
    for (const g of all) {
      if (g.cells.some(([r, c]) => marks[r][c] === DOG)) continue;
      const open = g.cells.filter(([r, c]) => marks[r][c] === EMPTY);
      if (open.length === 1) return { cells: open, text: `Csak egy szabad hely maradt ${g.name} – oda kell Otis!` };
    }

    // A region that fits in one row/column rules out the rest of that line.
    for (const g of all.filter((x) => x.region)) {
      if (g.cells.some(([r, c]) => marks[r][c] === DOG)) continue;
      const open = g.cells.filter(([r, c]) => marks[r][c] === EMPTY);
      if (!open.length) continue;
      const inRegion = (r, c) => g.cells.some(([gr, gc]) => gr === r && gc === c);
      const rows = new Set(open.map(([r]) => r));
      const cols = new Set(open.map(([, c]) => c));
      if (rows.size === 1) {
        const r = open[0][0];
        const extra = [...Array(n).keys()].filter((c) => marks[r][c] === EMPTY && !inRegion(r, c)).map((c) => [r, c]);
        if (extra.length) return { cells: extra, text: `Egy színes terület csak a ${r + 1}. sorban lehet, így a sor többi mezője kizárható.` };
      }
      if (cols.size === 1) {
        const c = open[0][1];
        const extra = [...Array(n).keys()].filter((r) => marks[r][c] === EMPTY && !inRegion(r, c)).map((r) => [r, c]);
        if (extra.length) return { cells: extra, text: `Egy színes terület csak a ${c + 1}. oszlopban lehet, így az oszlop többi mezője kizárható.` };
      }
    }

    // Fallback: reveal one correct spot.
    for (let r = 0; r < n; r++) {
      if (marks[r][solution[r]] !== DOG) return { cells: [[r, solution[r]]], text: 'Itt biztosan Otis van. 🐶' };
    }
    return null;
  }

  $('hint').addEventListener('click', () => {
    if (solved) return;
    const hint = findHint();
    if (!hint) return;
    hintCells = hint.cells;
    setMessage('💡 ' + hint.text, hint.kind);
    render();
  });

  // ---- Buttons ----

  $('undo').addEventListener('click', () => {
    if (solved || !history.length) return;
    marks = history.pop();
    hintCells = [];
    setMessage(DEFAULT_MESSAGE);
    commit();
  });

  $('clear').addEventListener('click', () => {
    if (solved) {
      // Allow replaying a solved level.
      delete save.solved[save.level];
      save.started[save.level] = Date.now();
      solved = false;
      boardEl.classList.remove('solved');
    } else {
      pushHistory();
    }
    marks = emptyMarks(puzzle.n);
    hintCells = [];
    setMessage(DEFAULT_MESSAGE);
    commit();
    $('next').disabled = save.level >= maxUnlocked();
  });

  $('prev').addEventListener('click', () => save.level > 1 && loadLevel(save.level - 1));
  $('next').addEventListener('click', () => save.level < maxUnlocked() && loadLevel(save.level + 1));

  $('help-btn').addEventListener('click', () => $('help').showModal());
  $('help-close').addEventListener('click', () => $('help').close());
  $('win-close').addEventListener('click', () => $('win').close());
  $('win-next').addEventListener('click', () => {
    $('win').close();
    loadLevel(save.level + 1);
  });
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  loadLevel(Math.min(save.level, maxUnlocked()));
  if (!save.seenHelp) {
    save.seenHelp = true;
    persist();
    $('help').showModal();
  }
})();
