// Headless smoke test for Citadel Ops integration.
// Loads every iso/ script in the order they appear in index.html into a
// shared vm sandbox, then drives the game loop to verify the success
// criteria (SC-001..SC-006) end-to-end without a browser.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const REPO = path.resolve(__dirname, '..');
const ISO  = path.join(REPO, 'js', 'iso');

const SCRIPTS = [
  'coords.js',
  'map.js',
  'world.js',
  'camera.js',
  'render.js',
  'factions.js',
  'state.js',
  'entities.js',
  'commands.js',
  'systems.js',
  'spawn.js',
  'input.js',
  'hud.js',
  'ai/ai-opponent.js',
  'game/win-loss.js',
  'fog.js',
  'game.js',
];

// ── Fake browser surface ─────────────────────────────────
function makeStubCtx(){
  const noop = () => {};
  const ctx = {
    canvas: { width: 1200, height: 600 },
    save: noop, restore: noop,
    beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, rect: noop, arc: noop, ellipse: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arcTo: noop,
    roundRect: noop, clip: noop, isPointInPath: () => false,
    setLineDash: noop, getLineDash: () => [], setTransform: noop,
    createPattern: () => null, createImageData: () => null, putImageData: noop,
    getImageData: () => ({ data: new Uint8Array(4) }),
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    fillText: noop, strokeText: noop,
    translate: noop, scale: noop, rotate: noop,
    setTransform: noop, resetTransform: noop,
    drawImage: noop, clearRect: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){},
    set font(v){}, set textAlign(v){}, set textBaseline(v){},
    set globalAlpha(v){}, set globalCompositeOperation(v){},
    set shadowBlur(v){}, set shadowColor(v){}, set lineCap(v){}, set lineJoin(v){},
    measureText: () => ({ width: 0 }),
  };
  return ctx;
}

function makeStubElement(tag, id){
  const listeners = {};
  const classList = new Set();
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: id || '',
    children: [],
    style: { setProperty: () => {}, removeProperty: () => {}, getPropertyValue: () => '' },
    dataset: {},
    width: 1200, height: 600,
    textContent: '',
    innerHTML: '',
    classList: {
      add: c => classList.add(c),
      remove: c => classList.delete(c),
      contains: c => classList.has(c),
      toggle: c => classList.has(c) ? classList.delete(c) : classList.add(c),
    },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: (ev, fn) => {
      const a = listeners[ev]; if (!a) return;
      const i = a.indexOf(fn); if (i >= 0) a.splice(i,1);
    },
    _fire: (ev, e) => { (listeners[ev]||[]).forEach(fn => fn(e)); },
    dispatchEvent: e => { (listeners[e.type]||[]).forEach(fn => fn(e)); },
    appendChild: c => { el.children.push(c); return c; },
    removeChild: c => { const i = el.children.indexOf(c); if (i>=0) el.children.splice(i,1); return c; },
    setAttribute: (k, v) => { el[k] = v; },
    getAttribute: (k) => el[k],
    getBoundingClientRect: () => ({ left:0, top:0, width: el.width || 1200, height: el.height || 600 }),
    focus: () => {},
    blur: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  if (tag === 'canvas') el.getContext = () => makeStubCtx();
  return el;
}

// classList.add() above must allow active class for _isoActive() check
// in input.js. We make tab-iso have .active in our DOM.
const elements = new Map();
function makeEl(id){
  if (elements.has(id)) return elements.get(id);
  const tag = id === 'iso-canvas' ? 'canvas' : 'div';
  const el = makeStubElement(tag, id);
  if (id === 'tab-iso'){ el.classList.add('active'); }
  elements.set(id, el);
  return el;
}

const docBody = makeStubElement('body','');
const document_ = {
  body: docBody,
  documentElement: makeStubElement('html'),
  getElementById: (id) => makeEl(id),
  createElement: (tag) => makeStubElement(tag),
  createElementNS: (ns, tag) => makeStubElement(tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: (sel) => {
    if (sel === '#tab-iso .iso-stage') return makeEl('iso-stage');
    return null;
  },
  querySelectorAll: () => [],
};

let _rafId = 0;
const _rafs = new Map();
function requestAnimationFrame(fn){
  const id = ++_rafId;
  _rafs.set(id, fn);
  return id;
}
function cancelAnimationFrame(id){ _rafs.delete(id); }
function flushFrame(nowMs){
  const pending = Array.from(_rafs.entries());
  _rafs.clear();
  for (const [, fn] of pending){
    try { fn(nowMs); } catch (e){ console.error('RAF error:', e); throw e; }
  }
}

// Game registry — match the public API the iso/ files expect.
const _games = {};
function registerGame(id, def){ _games[id] = def; }

const sandbox = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean,
  Map, Set, WeakMap, WeakSet, Symbol, Promise, Error,
  Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array,
  Float32Array, Float64Array, ArrayBuffer,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame, cancelAnimationFrame,
  performance: { now: () => Date.now() },
  document: document_,
  registerGame,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
vm.createContext(sandbox);

// ── Load scripts ─────────────────────────────────────────
for (const rel of SCRIPTS){
  const file = path.join(ISO, rel);
  const src  = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(src, sandbox, { filename: rel });
  } catch (e){
    console.error(`[load fail] ${rel}: ${e.message}`);
    throw e;
  }
}

// ── Drive the game ───────────────────────────────────────
const t0 = Date.now();
const checks = [];
function check(name, ok, detail){
  checks.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? '  — ' + detail : ''}`);
}

// Monotonic clock for the simulation — Real time isn't useful since vm
// execution is fast. Each tick() advances clockMs and pumps one frame.
let clockMs = 1000;
function tick(steps, stepMs){
  stepMs = stepMs || 16;
  for (let i = 0; i < steps; i++){
    clockMs += stepMs;
    flushFrame(clockMs);
  }
}
sandbox.performance.now = () => clockMs;

// Init iso tab — runs isoStart() through the game registry.
_games['iso'].init();

const ISO_GAME = sandbox.ISO_GAME;
const w = ISO_GAME.world;
const player = ISO_GAME.player;
const ai = ISO_GAME.ai;

// SC-001: map renders (no exception during a frame)
let renderOk = false;
try {
  tick(1);
  renderOk = true;
} catch (e){
  console.error('frame render error:', e);
}
check('SC-001 map+camera frame renders', renderOk);

// SC-001b: tile-grid has 2+ terrain types
const types = new Set(w.map.tiles.map(t => t.terrain));
check('SC-001b 2+ terrain types',
  types.size >= 2,
  `got ${types.size}: ${[...types].join(',')}`);

// SC-001c: camera pans
const camStartX = ISO_GAME.camera.x;
ISO_GAME.camera._keys = { d: true };
ISO_GAME.camera.update(500);  // 0.5s
const camEndX = ISO_GAME.camera.x;
check('SC-001c camera pans on WASD', camEndX > camStartX, `Δx=${(camEndX-camStartX).toFixed(1)}`);
ISO_GAME.camera._keys = {};

// Player + AI have HQ + workers
const playerEnts = w.entities.filter(e => e.side === player);
const aiEnts     = w.entities.filter(e => e.side === ai);
const playerHq   = playerEnts.find(e => e.type === sandbox.ISO_TYPE.HQ);
const aiHq       = aiEnts.find(e => e.type === sandbox.ISO_TYPE.HQ);
check('player has HQ', !!playerHq);
check('ai has HQ', !!aiHq);
const playerWorkers = playerEnts.filter(e => e.type === sandbox.ISO_TYPE.WORKER);
const aiWorkers     = aiEnts.filter(e => e.type === sandbox.ISO_TYPE.WORKER);
check('player starts with workers', playerWorkers.length >= 1, `${playerWorkers.length} workers`);
check('ai starts with workers',     aiWorkers.length >= 1, `${aiWorkers.length} workers`);
const goldNodes = w.entities.filter(e => e.kind === 'resource');
check('SC-001d gold nodes spawned', goldNodes.length >= 2, `${goldNodes.length} nodes`);

// SC-002: select + command dispatch on workers
sandbox.ISO_INPUT.selected = [playerWorkers[0]];
const nearGold = goldNodes
  .map(g => ({ g, d: Math.hypot(g.x - playerWorkers[0].x, g.y - playerWorkers[0].y) }))
  .sort((a,b) => a.d - b.d)[0].g;
const gatherOk = sandbox.isoCmdGather(playerWorkers[0], nearGold);
check('SC-002 isoCmdGather dispatches',
  gatherOk === true && playerWorkers[0].components.order.kind === 'gather',
  `ok=${gatherOk} order.kind=${playerWorkers[0].components.order.kind}`);
// also exercise isoCmdMove / isoCmdAttack / isoCmdStop dispatch
const moveOk = sandbox.isoCmdMove(playerWorkers[1], playerWorkers[1].x + 80, playerWorkers[1].y);
check('SC-002b isoCmdMove dispatches', moveOk === true);
const stopOk = sandbox.isoCmdStop(playerWorkers[2]);
check('SC-002c isoCmdStop dispatches', stopOk === true);
const enemyForAttack = aiEnts.find(e => e.kind === 'unit');
const attackOk = enemyForAttack ? sandbox.isoCmdAttack(playerWorkers[3], enemyForAttack) : false;
check('SC-002d isoCmdAttack dispatches', attackOk === true);

// Simulate ~30s so the worker harvests + deposits at least once and AI runs a tick
const goldStart = player.gold;
tick(60 * 30);
const frames = 60 * 30;
const goldAfter = player.gold;
check('SC-003 worker harvest → HQ deposit increases gold',
  goldAfter > goldStart,
  `gold ${goldStart}→${goldAfter} over ${frames} frames`);

// SC-004: AI behavior loop has run
const aiUnitsNow = w.entities.filter(e => e.side === ai && e.kind === 'unit');
const aiBldgsNow = w.entities.filter(e => e.side === ai && e.kind === 'building');
check('SC-004 AI is running (≥1 unit + ≥1 building)',
  aiUnitsNow.length >= 1 && aiBldgsNow.length >= 1,
  `units=${aiUnitsNow.length} buildings=${aiBldgsNow.length}`);

// SC-005: production system — train a worker from HQ
const beforeTrain = w.entities.filter(e => e.side === player && e.type === sandbox.ISO_TYPE.WORKER).length;
player.gold = 200;
const queueOk = sandbox.isoCmdTrain(playerHq, sandbox.ISO_TYPE.WORKER);
check('SC-005a isoCmdTrain queued', queueOk, `gold left=${player.gold}`);
// Run forward enough ticks (worker train ~3.5s)
tick(60 * 8);
const afterTrain = w.entities.filter(e => e.side === player && e.type === sandbox.ISO_TYPE.WORKER).length;
check('SC-005b unit appears after train timer',
  afterTrain > beforeTrain,
  `workers ${beforeTrain}→${afterTrain}`);

// SC-005c: build a barracks (need worker + gold)
const worker = playerWorkers[0];
player.gold = 200;
const barracksCol = playerHq.col + 3;
const barracksRow = playerHq.row + 1;
const buildOk = sandbox.isoCmdBuild(w, player, worker, sandbox.ISO_TYPE.BARRACKS, barracksCol, barracksRow);
check('SC-005c isoCmdBuild dispatched', buildOk);
// Run forward for build time + a margin
tick(60 * 12);
const barracks = w.entities.find(e => e.side === player && e.type === sandbox.ISO_TYPE.BARRACKS);
check('SC-005d barracks completes',
  !!barracks && barracks.components.building.construction >= 0.99,
  barracks ? `built=${barracks.components.building.construction.toFixed(2)}` : 'no barracks');

// SC-005e: train soldier from barracks
let soldiersBefore = 0, soldiersAfter = 0;
if (barracks){
  soldiersBefore = w.entities.filter(e => e.side === player && e.type === sandbox.ISO_TYPE.SOLDIER).length;
  player.gold = 200; player.supplyMax += 10;
  sandbox.isoCmdTrain(barracks, sandbox.ISO_TYPE.SOLDIER);
  tick(60 * 10);
  soldiersAfter = w.entities.filter(e => e.side === player && e.type === sandbox.ISO_TYPE.SOLDIER).length;
}
check('SC-005e barracks trains soldier', soldiersAfter > soldiersBefore, `soldiers ${soldiersBefore}→${soldiersAfter}`);

// SC-006: fog of war exists, has visible tiles around HQ
const fog = w._fog;
let visibleCount = 0, exploredCount = 0, unexploredCount = 0;
if (fog){
  for (const v of fog.grid){
    if (v === sandbox.FOG.VISIBLE) visibleCount++;
    else if (v === sandbox.FOG.EXPLORED) exploredCount++;
    else unexploredCount++;
  }
}
check('SC-006a fog system installed', !!fog);
check('SC-006b fog has visible tiles around player HQ', visibleCount > 20, `visible=${visibleCount}`);
check('SC-006c fog has unexplored tiles', unexploredCount > 100, `unexplored=${unexploredCount}`);

// SC-006d: enemy entity in unexplored territory is flagged hidden
const farEnemy = aiEnts.find(e => {
  const dCol = Math.floor((e.x / 32) - playerHq.x / 32);
  const dRow = Math.floor((e.y / 16) - playerHq.y / 16);
  return Math.hypot(dCol, dRow) > 30;
}) || aiEnts[0];
check('SC-006d enemy outside vision is hidden',
  farEnemy && farEnemy.components.hidden === true,
  `hidden=${farEnemy && farEnemy.components.hidden}`);

// SC-Win: kill all AI units+buildings → win
for (const e of w.entities.filter(e => e.side === ai)){
  e.hp = 0;
  e.dead = true;
}
// Run a few frames so cleanup + winLoss tick (winLoss is throttled to 160ms).
tick(30, 40);
check('SC-Win player wins after eliminating AI',
  ISO_GAME.winLoss && ISO_GAME.winLoss.ended,
  `ended=${ISO_GAME.winLoss && ISO_GAME.winLoss.ended}`);
const overlay = sandbox.document.getElementById('iso-endgame');
check('SC-Win victory overlay rendered',
  overlay && /VICTORY/.test(overlay.innerHTML),
  overlay ? overlay.innerHTML.replace(/\s+/g,' ').slice(0,80) : 'no overlay');

// Stop + restart for isoStop coverage
_games['iso'].cleanup();
check('cleanup runs without throwing', true);

console.log('');
const fails = checks.filter(c => !c.ok);
console.log(`=== ${checks.length - fails.length}/${checks.length} checks passed in ${Date.now()-t0}ms ===`);
if (fails.length){
  console.log('Failed:');
  for (const f of fails){ console.log(`  · ${f.name}  ${f.detail}`); }
  process.exit(1);
}
