// ════════════════════════════════════════════════════
//  DUNE — GAME LOOP & STATE
// ════════════════════════════════════════════════════
//
// Self-contained Dune II clone — units, pathfinding, combat, harvesting.
// Buildings/economy beyond a configurable Refinery drop-off are out of scope
// here (the buildings hoglet owns that). Once it lands, replace
// `D.dropOff[owner]` with a query against the player's Refinery position.
//
// Public lifecycle:
//   D                     — central state (similar to RTS `S`)
//   resetDuneState()      — restore defaults; called on init/reset
//   startDune()           — begin RAF loop
//   stopDune()            — stop RAF loop (cleanup on tab switch)
//   duneSpawnUnit(...)    — see units.js
//   duneIssueOrder(...)   — see units.js
//
// Game registry: registers under tab id 'dune' (matches #tab-dune in HTML).

const DUNE_CONFIG = {
  tileSize: 24,
  cols: 36,
  rows: 22,
  tickRate: 60,
};

const D = {
  raf: null,
  frame: 0,
  speed: 1,
  paused: false,
  tileSize: DUNE_CONFIG.tileSize,
  terrain: null,
  units: [],
  particles: [],
  selected: [],
  // Refinery drop-off tiles per side. The buildings hoglet will populate this
  // from real Refinery structures; for now we plant fixed positions so harvest
  // works standalone.
  dropOff: { player: null, enemy: null },
  spice:   { player: 0, enemy: 0 },
  // AI cadence (very simple — issue periodic attack-move on player units)
  aiTimer: 0,
};

function resetDuneState(){
  D.raf = null;
  D.frame = 0;
  D.speed = 1;
  D.paused = false;
  D.tileSize = DUNE_CONFIG.tileSize;
  D.terrain = createDuneTerrain(DUNE_CONFIG.cols, DUNE_CONFIG.rows, Math.floor(Math.random() * 1e6));
  D.units = [];
  D.particles = [];
  D.selected = [];
  D.dropOff = {
    player: { x: 2, y: 2 },
    enemy:  { x: DUNE_CONFIG.cols - 3, y: DUNE_CONFIG.rows - 3 },
  };
  // Make sure drop-off tiles are passable (the terrain shim already clears
  // those corners, but we belt-and-braces it in case a future generator
  // doesn't honor the convention).
  D.terrain.setTile(D.dropOff.player.x, D.dropOff.player.y, DUNE_TILE.ROCK);
  D.terrain.setTile(D.dropOff.enemy.x,  D.dropOff.enemy.y,  DUNE_TILE.ROCK);
  D.spice = { player: 0, enemy: 0 };
  D.aiTimer = 0;

  _duneSeedStartingUnits();
}

function _duneSeedStartingUnits(){
  // Player starting force — clustered near drop-off
  const px = D.dropOff.player.x + 2, py = D.dropOff.player.y + 1;
  duneSpawnUnit(D, 'harvester',      'player', px,     py);
  duneSpawnUnit(D, 'light_infantry', 'player', px,     py + 1);
  duneSpawnUnit(D, 'light_infantry', 'player', px + 1, py + 1);
  duneSpawnUnit(D, 'trooper',        'player', px,     py + 2);
  duneSpawnUnit(D, 'trike',          'player', px + 2, py);
  duneSpawnUnit(D, 'combat_tank',    'player', px + 2, py + 1);
  duneSpawnUnit(D, 'quad',           'player', px + 1, py + 2);

  // Enemy mirror
  const ex = D.dropOff.enemy.x - 2, ey = D.dropOff.enemy.y - 1;
  duneSpawnUnit(D, 'harvester',      'enemy', ex,     ey);
  duneSpawnUnit(D, 'light_infantry', 'enemy', ex,     ey - 1);
  duneSpawnUnit(D, 'light_infantry', 'enemy', ex - 1, ey - 1);
  duneSpawnUnit(D, 'trooper',        'enemy', ex,     ey - 2);
  duneSpawnUnit(D, 'trike',          'enemy', ex - 2, ey);
  duneSpawnUnit(D, 'combat_tank',    'enemy', ex - 2, ey - 1);
  duneSpawnUnit(D, 'quad',           'enemy', ex - 1, ey - 2);

  // Auto-task each harvester to start collecting
  for(const u of D.units){
    if(u.type === 'harvester'){
      duneIssueOrder(D, u, { kind: 'harvest' });
    }
  }
}

// ── Main loop ────────────────────────────────────────────────────────
function startDune(){
  const canvas = document.getElementById('duneCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  // Size canvas to match terrain
  canvas.width  = DUNE_CONFIG.cols * DUNE_CONFIG.tileSize;
  canvas.height = DUNE_CONFIG.rows * DUNE_CONFIG.tileSize;

  duneInstallInput(canvas, D);

  const loop = () => {
    for(let i = 0; i < D.speed; i++){
      _duneTick(D);
    }
    drawDune(ctx, D);
    // Refresh external HUD chips ~6x/sec (avoid hammering DOM every frame)
    if(D.frame % 10 === 0) _duneSyncHud();
    D.raf = requestAnimationFrame(loop);
  };
  if(D.raf) cancelAnimationFrame(D.raf);
  D.raf = requestAnimationFrame(loop);
}

function _duneSyncHud(){
  const u = document.getElementById('duneStatUnits');
  const s = document.getElementById('duneStatSpice');
  const e = document.getElementById('duneStatEnemies');
  if(u) u.textContent = D.units.filter(x => x.owner === 'player' && !x.dead).length;
  if(s) s.textContent = D.spice.player | 0;
  if(e) e.textContent = D.units.filter(x => x.owner === 'enemy'  && !x.dead).length;
}

function stopDune(){
  if(D.raf){
    cancelAnimationFrame(D.raf);
    D.raf = null;
  }
}

function _duneTick(state){
  state.frame++;

  duneTickUnits(state);

  // Particle decay
  const surviving = [];
  for(const p of state.particles){
    p.life--;
    if(p.life > 0) surviving.push(p);
  }
  state.particles = surviving;

  duneRemoveDead(state);

  // Trivial AI: every ~5s, pick a hostile target for each idle enemy and order
  // an attack-move. Keeps the world alive without a full economy/AI layer.
  state.aiTimer++;
  if(state.aiTimer > 300){
    state.aiTimer = 0;
    _duneSimpleAI(state);
  }
}

function _duneSimpleAI(state){
  for(const u of state.units){
    if(u.dead) continue;
    if(u.owner !== 'enemy') continue;
    if(DUNE_UNITS[u.type].attack <= 0) continue; // harvesters keep harvesting
    if(u.order.kind === 'attack') continue;
    // Pick a random player unit and attack it
    const players = state.units.filter(x => !x.dead && x.owner === 'player');
    if(players.length === 0) return;
    const target = players[Math.floor(Math.random() * players.length)];
    duneIssueOrder(state, u, { kind: 'attack', targetId: target.id, persistent: true });
  }
}

// ── Registration ─────────────────────────────────────────────────────
registerGame('dune', {
  init(){
    resetDuneState();
    startDune();
  },
  cleanup(){
    stopDune();
  },
});
