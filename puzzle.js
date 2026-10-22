// Puzzle generation and solving for Otisdoku.
// Rules: one dog per row, per column and per colored region; dogs may not touch (not even diagonally).
(function (root) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function sizeForLevel(level) {
    if (level <= 10) return 5;
    if (level <= 30) return 6;
    if (level <= 60) return 7;
    if (level <= 100) return 8;
    return 9;
  }

  // Random column per row such that neighbouring rows never touch.
  function randomSolution(n, rng) {
    const cols = [];
    const used = new Array(n).fill(false);
    function place(r) {
      if (r === n) return true;
      const order = shuffle([...Array(n).keys()], rng);
      for (const c of order) {
        if (used[c]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        used[c] = true;
        cols[r] = c;
        if (place(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    place(0);
    return cols;
  }

  // Grow one region from every dog of the solution by random flood fill.
  function growRegions(n, solution, rng) {
    const regions = Array.from({ length: n }, () => new Array(n).fill(-1));
    const frontier = [];
    const pushNeighbours = (r, c, id) => {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === -1) frontier.push([nr, nc, id]);
      }
    };
    solution.forEach((c, r) => {
      regions[r][c] = r;
      pushNeighbours(r, c, r);
    });
    while (frontier.length) {
      const i = Math.floor(rng() * frontier.length);
      const [r, c, id] = frontier[i];
      frontier[i] = frontier[frontier.length - 1];
      frontier.pop();
      if (regions[r][c] !== -1) continue;
      regions[r][c] = id;
      pushNeighbours(r, c, id);
    }
    return regions;
  }

  // Returns up to `limit` solutions (each an array of columns indexed by row).
  function solve(regions, limit = 2) {
    const n = regions.length;
    const usedCol = new Array(n).fill(false);
    const usedReg = new Array(n).fill(false);
    const cols = [];
    const found = [];
    function place(r) {
      if (found.length >= limit) return;
      if (r === n) {
        found.push(cols.slice());
        return;
      }
      for (let c = 0; c < n; c++) {
        const reg = regions[r][c];
        if (usedCol[c] || usedReg[reg]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        usedCol[c] = usedReg[reg] = true;
        cols[r] = c;
        place(r + 1);
        usedCol[c] = usedReg[reg] = false;
      }
    }
    place(0);
    return found;
  }

  function isConnected(regions, id) {
    const n = regions.length;
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === id) cells.push([r, c]);
    if (!cells.length) return false;
    const seen = new Set([cells[0].join()]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc, key = nr + ',' + nc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === id && !seen.has(key)) {
          seen.add(key);
          stack.push([nr, nc]);
        }
      }
    }
    return seen.size === cells.length;
  }

  // Break an alternative solution by moving one of its cells into a neighbouring region.
  function repair(regions, solution, alt, rng) {
    const n = regions.length;
    const rows = shuffle([...Array(n).keys()].filter((r) => alt[r] !== solution[r]), rng);
    for (const r of rows) {
      const c = alt[r];
      const from = regions[r][c];
      const targets = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] !== from) targets.push(regions[nr][nc]);
      }
      for (const to of shuffle(targets, rng)) {
        regions[r][c] = to;
        if (isConnected(regions, from)) return true;
        regions[r][c] = from;
      }
    }
    return false;
  }

  function generate(level) {
    const n = sizeForLevel(level);
    const rng = mulberry32(level * 7919 + 12345);
    for (let attempt = 0; attempt < 5000; attempt++) {
      const solution = randomSolution(n, rng);
      const regions = growRegions(n, solution, rng);
      for (let step = 0; step < 60; step++) {
        const sols = solve(regions, 2);
        if (sols.length === 1) return { level, n, regions, solution: sols[0] };
        const alt = sols.find((s) => s.some((c, r) => c !== solution[r]));
        if (!repair(regions, solution, alt, rng)) break;
      }
    }
    throw new Error('Could not generate level ' + level);
  }

  const api = { generate, solve, sizeForLevel, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Puzzle = api;
})(this);
