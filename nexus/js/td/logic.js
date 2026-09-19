// ── TOWER DEFENSE GAME ──
const canvas = document.getElementById('tdCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const CELL = 40;
const COLS = W/CELL, ROWS = H/CELL;

// ── GAME CONFIG ──
const TD_CONFIG = {
  initialGold: 200,
  initialLives: 20,
  maxLogEntries: 40,
  waveSpawnInterval: 45,
  enemyBaseHp: 40,
  enemyHpScaling: 20,
  enemyBaseSpeed: 0.6,
  enemySpeedScaling: 0.05,
  missileAoeRadius: 55,
  slowDuration: 60,
  slowFactor: 0.4,
  waveReward: 50,
  bossWaveInterval: 5,
  bossHpMultiplier: 4,
  bossSpeedMultiplier: 0.5,
  bossInterestThreshold: 50,
  bossInterestRate: 0.1,
  baseEnemyCount: 8,
  enemyCountScaling: 3,
  waveScaling: { multiplier: 1 },

  // ── TOWER EVOLUTION (XP / kill-branching) ──
  xpSwarmKill: 10,
  xpArmoredKill: 20,
  xpBossKill: 60,
  evoXpThresholds: [0, 120, 320], // [base, level2, level3/evolve]

  // ── MOVEABLE TOWERS ──
  moveCostFactor: 0.35,
  moveCooldownTicks: 150,

  // ── DESTRUCTIBLE TERRAIN (digger enemies breach walls) ──
  diggerMinWave: 3,
  digDuration: 180,

  // ── ADAPTIVE ENEMIES (counter tower spam) ──
  adaptMinTowers: 3,
  adaptShareThreshold: 0.5,
  adaptChance: 0.6,
  adaptResistFactor: 0.5,

  // ── BOSS PHASES ──
  bossPhaseThresholds: [0.66, 0.33],
  bossPhaseHealFrac: 0.12,
  bossPhaseMinionCount: 3,
  bossSplitHpFrac: 0.35,
  bossSplitCount: 2,
};

// Map paths (grid coords). A new one is selected for every game.
// `shortcut` describes a rubble wall that seals off a straight-line detour
// around part of the route. A digger enemy that reaches `breachIndex` will
// spend TD_CONFIG.digDuration ticks tunneling through it; once breached,
// the wall cells open into `tunnelWaypoints`, permanently reconnecting the
// route from waypoint[breachIndex] to waypoint[rejoinIndex] and skipping
// everything between.
const TD_MAPS = [
  {
    name: 'Circuit Breaker',
    waypoints: [
      {x:0,y:3},{x:4,y:3},{x:4,y:1},{x:8,y:1},
      {x:8,y:6},{x:12,y:6},{x:12,y:3},{x:16,y:3},
      {x:16,y:10},{x:10,y:10},{x:10,y:8},{x:6,y:8},
      {x:6,y:11},{x:17,y:11}
    ],
    shortcut: {
      breachIndex: 3, rejoinIndex: 6,
      tunnelWaypoints: [{x:10,y:2}],
    },
  },
  {
    name: 'Switchback',
    waypoints: [
      {x:0,y:2},{x:3,y:2},{x:3,y:7},{x:7,y:7},
      {x:7,y:1},{x:11,y:1},{x:11,y:9},{x:15,y:9},
      {x:15,y:4},{x:17,y:4}
    ],
    shortcut: {
      breachIndex: 1, rejoinIndex: 4,
      tunnelWaypoints: [{x:5,y:1}],
    },
  },
  {
    name: 'Data Spiral',
    waypoints: [
      {x:0,y:9},{x:3,y:9},{x:3,y:4},{x:6,y:4},
      {x:6,y:10},{x:10,y:10},{x:10,y:2},{x:14,y:2},
      {x:14,y:7},{x:17,y:7}
    ],
    shortcut: {
      breachIndex: 1, rejoinIndex: 3,
      tunnelWaypoints: [],
    },
  },
];

let activeMap = TD_MAPS[Math.floor(Math.random()*TD_MAPS.length)];
let PATH_WAYPOINTS = activeMap.waypoints;

// Waypoints identify grid cells; units travel between the cells' centers.
function wpPx(wp){ return {x: (wp.x+0.5)*CELL, y: (wp.y+0.5)*CELL}; }

const TOWER_TYPES = {
  gun:     { color:'#00f5ff', range:120, damage:15, rate:30,  cost:50,  bullet:'cyan',   aoe:false },
  laser:   { color:'#ff0088', range:100, damage:8,  rate:15,  cost:80,  bullet:'pink',   aoe:false },
  missile: { color:'#ff8800', range:150, damage:45, rate:90,  cost:120, bullet:'orange', aoe:true  },
  slow:    { color:'#8888ff', range:100, damage:2,  rate:25,  cost:70,  bullet:'blue',   aoe:false },
};

// A level-3 tower branches into one of two evolution paths based on
// whichever kind of kill it has scored more of: 'swarm' (fast, numerous
// grunts) rewards rate of fire; 'armored' (bosses, diggers, shielded
// enemies) rewards raw damage/range.
const TOWER_EVOLUTIONS = {
  gun: {
    swarm:   { name:'Gatling',      mult:{ damage:0.8, range:1.0, rate:0.55 }, tint:'#ffee55' },
    armored: { name:'Sniper',       mult:{ damage:2.4, range:1.5, rate:1.6  }, tint:'#ff5555' },
  },
  laser: {
    swarm:   { name:'Beam Array',   mult:{ damage:0.85, range:1.1, rate:0.6 }, tint:'#ff66cc' },
    armored: { name:'Piercer',      mult:{ damage:2.0,  range:1.3, rate:1.3 }, tint:'#aa00ff' },
  },
  missile: {
    swarm:   { name:'Cluster',        mult:{ damage:0.7, range:1.0, rate:0.75 }, tint:'#ffaa33', aoeMult:1.4 },
    armored: { name:'Bunker Buster',  mult:{ damage:2.2, range:1.2, rate:1.4  }, tint:'#ff3300' },
  },
  slow: {
    swarm:   { name:'Blizzard',     mult:{ damage:1.0, range:1.15, rate:0.7 }, tint:'#66ffff', slowFactorBonus:0.15 },
    armored: { name:'Deep Freeze',  mult:{ damage:1.5, range:1.0,  rate:1.2 }, tint:'#3355ff', slowFactorBonus:0.3 },
  },
};

const TD_DEFAULTS = {
  gold: TD_CONFIG.initialGold, lives: TD_CONFIG.initialLives, score: 0, wave: 0,
  towers: [], enemies: [], bullets: [], particles: [],
  waveActive: false, waveEnemyTimer: 0, waveEnemiesLeft: 0, waveEnemyCount: 0,
  selectedTower: 'gun', speed: 1, speedHistory: [], frame: 0, gameOver: false,
  movingTower: null, shortcutOpen: false, adaptationAnnounced: {},
};

let state = {...TD_DEFAULTS, towers:[], enemies:[], bullets:[], particles:[], adaptationAnnounced:{}};

function initState(){
  state = {...TD_DEFAULTS, towers:[], enemies:[], bullets:[], particles:[], adaptationAnnounced:{}};
  activeMap = TD_MAPS[Math.floor(Math.random()*TD_MAPS.length)];
  PATH_WAYPOINTS = activeMap.waypoints;
  buildPath();
  buildShortcut();
  setLog([]);
}

function addLog(msg, cls=''){
  const box = document.getElementById('logBox');
  const d = document.createElement('div');
  d.className = 'log-entry '+(cls||'');
  d.textContent = msg;
  box.insertBefore(d, box.firstChild);
  if(box.children.length > TD_CONFIG.maxLogEntries) box.removeChild(box.lastChild);
}
function setLog(arr){ document.getElementById('logBox').innerHTML=''; }

function updateHUD(){
  document.getElementById('waveNum').textContent = state.wave;
  document.getElementById('livesNum').textContent = state.lives;
  document.getElementById('goldNum').textContent = state.gold;
  document.getElementById('scoreNum').textContent = state.score;
  document.querySelectorAll('.tower-btn').forEach(btn=>{
    const cost = TOWER_TYPES[btn.dataset.type]?.cost || 0;
    btn.disabled = state.gold < cost;
  });
}

function calculateBossInterest(gold){
  const eligibleGold = Math.floor(gold / TD_CONFIG.bossInterestThreshold) * TD_CONFIG.bossInterestThreshold;
  return Math.floor(eligibleGold * TD_CONFIG.bossInterestRate);
}

function awardBossInterest(){
  const interest = calculateBossInterest(state.gold);
  if(interest <= 0) return;
  state.gold += interest;
  addLog(`Boss interest: +${interest}g (10% per 50g saved)`,'good');
  sfx('rtsGoldIn');
}

// Path cells set
const pathCells = new Set();
// Rasterizes a waypoint chain into the set of grid cells it crosses, walking
// each segment in whichever direction (including diagonal) connects its
// endpoints. Shared by buildPath (whose waypoints are always axis-aligned)
// and buildShortcut (whose tunnel segments may cut diagonally).
function rasterizeSegments(points){
  const cells = new Set();
  for(let i=0;i<points.length-1;i++){
    const ax=Math.round(points[i].x), ay=Math.round(points[i].y);
    const bx=Math.round(points[i+1].x), by=Math.round(points[i+1].y);
    const steps = Math.max(Math.abs(bx-ax), Math.abs(by-ay));
    if(steps===0){ cells.add(`${ax},${ay}`); continue; }
    for(let s=0;s<=steps;s++){
      const cx = Math.round(ax + (bx-ax)*s/steps);
      const cy = Math.round(ay + (by-ay)*s/steps);
      cells.add(`${cx},${cy}`);
    }
  }
  return cells;
}
function buildPath(){
  pathCells.clear();
  for(const c of rasterizeSegments(PATH_WAYPOINTS)) pathCells.add(c);
}
buildPath();

// Destructible terrain: `wallCellsSet` is rubble blocking a shortcut until a
// digger enemy breaches it; `tunnelCellsSet`/`SHORTCUT_WAYPOINTS` are the
// route that opens up once it does. Wall cells are simply the tunnel's
// rasterized footprint minus whatever's already part of the main path (the
// shared breach/rejoin waypoints). See TD_MAPS `shortcut` for the design.
let wallCellsSet = new Set();
let tunnelCellsSet = new Set();
let SHORTCUT_WAYPOINTS = null;
function buildShortcut(){
  wallCellsSet = new Set();
  tunnelCellsSet = new Set();
  SHORTCUT_WAYPOINTS = null;
  const sc = activeMap.shortcut;
  if(!sc) return;
  const tunnelPoints = [PATH_WAYPOINTS[sc.breachIndex], ...sc.tunnelWaypoints, PATH_WAYPOINTS[sc.rejoinIndex]];
  tunnelCellsSet = rasterizeSegments(tunnelPoints);
  for(const c of tunnelCellsSet) if(!pathCells.has(c)) wallCellsSet.add(c);
  SHORTCUT_WAYPOINTS = [
    ...PATH_WAYPOINTS.slice(0, sc.breachIndex+1),
    ...sc.tunnelWaypoints,
    ...PATH_WAYPOINTS.slice(sc.rejoinIndex),
  ];
}
buildShortcut();

function isPathCell(gx,gy){
  return pathCells.has(`${Math.floor(gx)},${Math.floor(gy)}`);
}
function isWallCell(gx,gy){
  return !state.shortcutOpen && wallCellsSet.has(`${Math.floor(gx)},${Math.floor(gy)}`);
}
function isTunnelCell(gx,gy){
  return tunnelCellsSet.has(`${Math.floor(gx)},${Math.floor(gy)}`);
}
function isBlockedCell(gx,gy){
  return isPathCell(gx,gy) || isWallCell(gx,gy) || (state.shortcutOpen && isTunnelCell(gx,gy));
}

function createTower(ttype, gx, gy){
  const base = TOWER_TYPES[ttype];
  return {
    x: gx*CELL+CELL/2, y: gy*CELL+CELL/2,
    type: ttype, cooldown: 0,
    ...base,
    baseDamage: base.damage, baseRange: base.range, baseRate: base.rate,
    level: 1, xp: 0, evoPath: null, evoName: null, evoTint: null,
    kills: 0, killCat: { swarm:0, armored:0 },
    moveCooldown: 0,
  };
}

canvas.addEventListener('click', e=>{
  if(state.gameOver) return;
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width/r.width, scaleY = canvas.height/r.height;
  const mx = (e.clientX-r.left)*scaleX, my = (e.clientY-r.top)*scaleY;
  const gx = Math.floor(mx/CELL), gy = Math.floor(my/CELL);

  // ── Relocating a tower already selected for a move ──
  if(state.movingTower){
    const mt = state.movingTower;
    const fromGx = Math.floor(mt.x/CELL), fromGy = Math.floor(mt.y/CELL);
    if(gx===fromGx && gy===fromGy){ state.movingTower=null; addLog('Move cancelled.','info'); return; }
    if(isBlockedCell(gx,gy)){ addLog('Cannot relocate there!','bad'); return; }
    if(state.towers.some(t=>t!==mt && Math.floor(t.x/CELL)===gx && Math.floor(t.y/CELL)===gy)){
      addLog('Cell occupied!','bad'); return;
    }
    const moveCost = Math.round(mt.cost * TD_CONFIG.moveCostFactor);
    if(state.gold < moveCost){ addLog(`Not enough gold to relocate (-${moveCost}g)!`,'bad'); return; }
    state.gold -= moveCost;
    mt.x = gx*CELL+CELL/2; mt.y = gy*CELL+CELL/2;
    mt.moveCooldown = TD_CONFIG.moveCooldownTicks;
    state.movingTower = null;
    sfx('tdPlace');
    addLog(`Relocated ${(mt.evoName||mt.type).toUpperCase()} tower (-${moveCost}g)`,'info');
    updateHUD();
    return;
  }

  // ── Clicking an existing tower selects it for relocation ──
  const clicked = state.towers.find(t=>Math.floor(t.x/CELL)===gx && Math.floor(t.y/CELL)===gy);
  if(clicked){
    state.movingTower = clicked;
    const moveCost = Math.round(clicked.cost * TD_CONFIG.moveCostFactor);
    addLog(`Selected ${(clicked.evoName||clicked.type).toUpperCase()} tower (Lv${clicked.level}) — click a new cell to relocate (-${moveCost}g), or click it again to cancel.`,'info');
    return;
  }

  if(isBlockedCell(gx,gy)){ addLog('Cannot place on path!','bad'); return; }
  const ttype = state.selectedTower;
  const cost = TOWER_TYPES[ttype].cost;
  if(state.gold < cost){ addLog('Not enough gold!','bad'); return; }
  state.gold -= cost;
  state.towers.push(createTower(ttype, gx, gy));
  sfx('tdPlace');
  addLog(`Placed ${ttype.toUpperCase()} tower (-${cost}g)`,'info');
  updateHUD();
  if(window.posthog) posthog.capture('td_tower_placed', { tower_type: ttype, cost, wave: state.wave, towers_placed: state.towers.length });
});

function selectTower(type, btn){
  state.selectedTower = type;
  document.querySelectorAll('.tower-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

function setSpeed(s, btn){
  state.speed = s;
  state.speedHistory.push(s);
  document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function isBossWave(wave){
  return wave > 0 && wave % TD_CONFIG.bossWaveInterval === 0;
}

function startWave(){
  if(state.waveActive || state.gameOver) return;
  state.wave++;
  const count = TD_CONFIG.baseEnemyCount + state.wave * TD_CONFIG.enemyCountScaling;
  state.waveActive = true;
  state.waveEnemiesLeft = count;
  state.waveEnemyCount = count;
  state.waveEnemyTimer = 0;
  state.waveMultiplier = TD_CONFIG.waveScaling.multiplier;
  document.getElementById('waveBtn').disabled = true;
  sfx('tdWave');
  const bossNotice = isBossWave(state.wave) ? ' + BOSS' : '';
  addLog(`▶ WAVE ${state.wave} INCOMING — ${count} enemies${bossNotice}`,'info');
  updateHUD();
  if(window.posthog) posthog.capture('td_wave_started', { wave: state.wave, map: activeMap.name, enemy_count: count, boss_wave: isBossWave(state.wave), towers: state.towers.length, gold: state.gold, score: state.score });
}

// ── ADAPTIVE ENEMIES: enemies gain resistance to whichever tower type the player is spamming ──
function countTowerTypes(){
  const c = {gun:0, laser:0, missile:0, slow:0};
  for(const t of state.towers) c[t.type] = (c[t.type]||0) + 1;
  return c;
}
function computeAdaptedType(){
  const total = state.towers.length;
  if(total < TD_CONFIG.adaptMinTowers) return null;
  const counts = countTowerTypes();
  let domType=null, domCount=0;
  for(const k in counts){ if(counts[k]>domCount){ domCount=counts[k]; domType=k; } }
  if(!domType || domCount/total < TD_CONFIG.adaptShareThreshold) return null;
  return domType;
}
function applyResist(enemy, dmg, towerType){
  if(enemy.resistType===towerType) return dmg * (1 - (enemy.resistFactor||0));
  return dmg;
}

function spawnEnemy(){
  const hp = TD_CONFIG.enemyBaseHp + state.wave * TD_CONFIG.enemyHpScaling + Math.random()*20;
  const spd = TD_CONFIG.enemyBaseSpeed + state.wave * TD_CONFIG.enemySpeedScaling + Math.random()*0.2;
  // The final enemy in every fifth wave is the boss, guaranteeing one boss per boss wave.
  const isBoss = state.waveEnemiesLeft === 1 && isBossWave(state.wave);
  // A single digger per game targets the map's rubble wall, opening a shortcut once it tunnels through.
  const isDigger = !isBoss && !state.shortcutOpen && !!activeMap.shortcut &&
    state.wave >= TD_CONFIG.diggerMinWave &&
    state.waveEnemiesLeft === Math.ceil(state.waveEnemyCount/2);
  if(isBoss) addLog('⚠ BOSS INCOMING','bad');
  if(isDigger) addLog('⚠ A DIGGER IS HEADING FOR THE WALL','bad');

  const enemy = {
    ...wpPx(PATH_WAYPOINTS[0]),
    wpIdx: 0, progress: 0,
    hp: isBoss ? hp*TD_CONFIG.bossHpMultiplier : (isDigger ? hp*1.6 : hp),
    maxHp: isBoss ? hp*TD_CONFIG.bossHpMultiplier : (isDigger ? hp*1.6 : hp),
    speed: isBoss ? spd*TD_CONFIG.bossSpeedMultiplier : (isDigger ? spd*0.85 : spd),
    slow: 0, boss: isBoss, digger: isDigger,
    reward: isBoss ? 60 : (isDigger ? 16 : 10 + state.wave * 2),
    angle: 0, walkDist: 0,
    route: state.shortcutOpen ? SHORTCUT_WAYPOINTS : PATH_WAYPOINTS,
    evoCategory: (isBoss || isDigger) ? 'armored' : 'swarm',
  };

  if(!isBoss){
    const domType = computeAdaptedType();
    if(domType && Math.random() < TD_CONFIG.adaptChance){
      enemy.resistType = domType;
      enemy.shielded = true;
      enemy.evoCategory = 'armored';
      if(domType==='slow') enemy.slowImmune = true;
      else enemy.resistFactor = TD_CONFIG.adaptResistFactor;
      if(!state.adaptationAnnounced[domType]){
        addLog(`Enemies are adapting to your ${domType.toUpperCase()} spam!`,'bad');
        state.adaptationAnnounced[domType] = true;
      }
    }
  }

  state.enemies.push(enemy);
}

function moveEnemy(e){
  if(e.digging) return false;
  const route = e.route || PATH_WAYPOINTS;
  if(e.wpIdx >= route.length-1){ return true; }
  const target = wpPx(route[e.wpIdx+1]);
  const spd = e.slow > 0 ? e.speed * (e.slowFactor||TD_CONFIG.slowFactor) : e.speed;
  const dx = target.x - e.x, dy = target.y - e.y;
  const dist = Math.hypot(dx,dy);
  e.angle = Math.atan2(dy,dx);
  if(dist < spd+1){ e.x=target.x; e.y=target.y; e.wpIdx++; return false; }
  e.x += (dx/dist)*spd;
  e.y += (dy/dist)*spd;
  e.walkDist = (e.walkDist||0) + spd;
  if(e.slow>0) e.slow--;
  return false;
}

// ── TOWER EVOLUTION: XP from kills, branching at level 3 based on the majority kill category ──
function awardTowerXP(t, enemy){
  if(!t) return;
  const cat = enemy.evoCategory || 'swarm';
  const xpGain = enemy.boss ? TD_CONFIG.xpBossKill : (cat==='armored' ? TD_CONFIG.xpArmoredKill : TD_CONFIG.xpSwarmKill);
  t.xp += xpGain;
  t.kills++;
  t.killCat[cat] = (t.killCat[cat]||0) + 1;
  checkTowerLevelUp(t);
}
function checkTowerLevelUp(t){
  const th = TD_CONFIG.evoXpThresholds;
  if(t.level===1 && t.xp>=th[1]){
    t.level = 2;
    t.damage = t.baseDamage*1.15;
    t.range = t.baseRange*1.1;
    t.rate = Math.max(4, Math.round(t.baseRate*0.95));
    addLog(`${t.type.toUpperCase()} tower reached LV2!`,'good');
  }
  if(t.level===2 && t.xp>=th[2]){
    const dominant = t.killCat.armored >= t.killCat.swarm ? 'armored' : 'swarm';
    const evo = TOWER_EVOLUTIONS[t.type][dominant];
    t.level = 3;
    t.evoPath = dominant;
    t.evoName = evo.name;
    t.evoTint = evo.tint;
    t.damage = t.baseDamage*evo.mult.damage;
    t.range = t.baseRange*evo.mult.range;
    t.rate = Math.max(3, Math.round(t.baseRate*evo.mult.rate));
    if(evo.aoeMult) t.aoeRadiusMult = evo.aoeMult;
    if(evo.slowFactorBonus) t.slowFactorBonus = evo.slowFactorBonus;
    addLog(`${t.type.toUpperCase()} tower evolved into ${evo.name}!`,'good');
    sfx('tdVictory',300);
  }
}

function towerShoot(t){
  if(t.moveCooldown>0){ t.moveCooldown--; return; }
  if(t.cooldown>0){ t.cooldown--; return; }
  let best=null, bd=Infinity;
  for(const e of state.enemies){
    const d=Math.hypot(e.x-t.x,e.y-t.y);
    const route = e.route || PATH_WAYPOINTS;
    if(d<t.range && e.wpIdx<route.length-1 && !e.digging){
      // Prioritize enemies furthest along path, then closest by distance
      if(!best || e.wpIdx>best.wpIdx || (e.wpIdx===best.wpIdx && d<bd)){
        best=e; bd=d;
      }
    }
  }
  if(!best) return;
  t.cooldown = t.rate;
  const bAngle = Math.atan2(best.y - t.y, best.x - t.x);
  // per-type shoot sound (throttled so rapid fire doesn't stack)
  const sndMap={gun:'tdShoot',laser:'tdLaser',missile:'tdMissile',slow:'tdCryo'};
  sfx(sndMap[t.type]||'tdShoot', t.type==='gun'?80: t.type==='laser'?60: t.type==='missile'?200:150);
  state.bullets.push({
    x:t.x, y:t.y, tx:best, spd: t.type==='missile'?4:7,
    dmg:t.damage, color:t.bullet, aoe:t.aoe,
    slow: t.type==='slow',
    towerType: t.type,
    towerRef: t,
    angle: bAngle,
    trailX:[], trailY:[],
    life: 0,
  });
}

function moveBullets(){
  for(let i=state.bullets.length-1;i>=0;i--){
    const b=state.bullets[i];
    b.life++;
    if(!b.tx || b.tx.hp<=0){ state.bullets.splice(i,1); continue; }
    const dx=b.tx.x-b.x, dy=b.tx.y-b.y, d=Math.hypot(dx,dy);
    // update angle to face target
    b.angle = Math.atan2(dy, dx);
    // store trail (max 10 points)
    b.trailX.push(b.x); b.trailY.push(b.y);
    if(b.trailX.length > 12){ b.trailX.shift(); b.trailY.shift(); }
    if(d < b.spd+3){
      // hit
      if(b.aoe){
        const radius = TD_CONFIG.missileAoeRadius * (b.towerRef?.aoeRadiusMult||1);
        for(const e of state.enemies){
          if(Math.hypot(e.x-b.tx.x,e.y-b.tx.y)<radius){
            e.hp -= applyResist(e, b.dmg, b.towerType);
            e.lastHitBy = b.towerRef;
          }
        }
        sfx('tdExplode',200);
        spawnHitParticles(b.tx.x, b.tx.y, 'explosion');
      } else {
        b.tx.hp -= applyResist(b.tx, b.dmg, b.towerType);
        b.tx.lastHitBy = b.towerRef;
        if(b.slow && !b.tx.slowImmune){
          b.tx.slow = TD_CONFIG.slowDuration;
          b.tx.slowFactor = Math.max(0.15, TD_CONFIG.slowFactor - (b.towerRef?.slowFactorBonus||0));
        }
        spawnHitParticles(b.tx.x, b.tx.y, b.towerType);
      }
      state.bullets.splice(i,1);
    } else {
      b.x += (dx/d)*b.spd;
      b.y += (dy/d)*b.spd;
    }
  }
}

const HIT_PARTICLES = {
  gun:       { count:8,  life:12, type:'spark',     color:'#aaeeff', minSpd:2, maxSpd:6, spread:'random' },
  laser:     { count:6,  life:18, type:'energy',    color:'#ff0088', minSpd:2, maxSpd:4, spread:'even',
               ring:{ life:10, color:'#ff0088', radius:2 } },
  explosion: { count:16, life:25, type:'fire',      colors:['#ff4400','#ff8800','#ffcc00','#ffffff'], minSpd:2, maxSpd:7, spread:'random',
               ring:{ life:15, color:'#ff8800', radius:4, type:'shockwave' } },
  slow:      { count:8,  life:20, type:'ice',       color:'#aaddff', minSpd:1, maxSpd:3.5, spread:'random',
               ring:{ life:12, color:'#88ccff', radius:2 } },
  dig:       { count:6,  life:16, type:'spark',     color:'#cc9944', minSpd:1, maxSpd:3, spread:'random' },
};

function spawnHitParticles(x, y, type){
  const cfg = HIT_PARTICLES[type];
  if(!cfg) return;
  for(let i=0;i<cfg.count;i++){
    const a = cfg.spread==='even' ? (i/cfg.count)*Math.PI*2 : Math.random()*Math.PI*2;
    const s = Math.random()*(cfg.maxSpd-cfg.minSpd)+cfg.minSpd;
    const color = cfg.colors ? cfg.colors[Math.floor(Math.random()*cfg.colors.length)] : cfg.color;
    state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:cfg.life,maxLife:cfg.life,type:cfg.type,color});
  }
  if(cfg.ring){
    state.particles.push({x,y,vx:0,vy:0,life:cfg.ring.life,maxLife:cfg.ring.life,type:cfg.ring.type||'ring',color:cfg.ring.color,radius:cfg.ring.radius});
  }
}

// legacy compat
function spawnHitParticle(x,y,color){ spawnHitParticles(x,y,'gun'); }

// ── DESTRUCTIBLE TERRAIN: digger finishes tunneling through the rubble wall ──
function completeDig(e){
  e.digging = false;
  state.shortcutOpen = true;
  e.route = SHORTCUT_WAYPOINTS;
  addLog('⚠ The wall gave way — enemies found a shortcut!','bad');
  sfx('tdExplode',300);
  spawnHitParticles(e.x, e.y, 'explosion');
}

// ── BOSS PHASES: heal + summon minions at HP thresholds; split into smaller bosses on death ──
function checkBossPhase(e){
  const thresholds = TD_CONFIG.bossPhaseThresholds;
  e.phase = e.phase||0;
  if(e.phase>=thresholds.length) return;
  if(e.hp/e.maxHp <= thresholds[e.phase]){
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp*TD_CONFIG.bossPhaseHealFrac);
    for(let i=0;i<TD_CONFIG.bossPhaseMinionCount;i++) spawnMinionAt(e);
    addLog('⚠ The boss regenerates and calls reinforcements!','bad');
    sfx('tdEnemy',300);
    e.phase++;
  }
}
function spawnMinionAt(boss){
  const hp = TD_CONFIG.enemyBaseHp*0.5 + state.wave*TD_CONFIG.enemyHpScaling*0.5;
  state.enemies.push({
    x: boss.x, y: boss.y, wpIdx: boss.wpIdx, route: boss.route,
    hp, maxHp: hp,
    speed: (TD_CONFIG.enemyBaseSpeed + state.wave*TD_CONFIG.enemySpeedScaling) * 1.1,
    slow: 0, boss: false, minion: true, evoCategory: 'swarm',
    reward: 6, angle: boss.angle||0, walkDist: boss.walkDist||0,
  });
}
function spawnBossSplit(e){
  const childHp = e.maxHp * TD_CONFIG.bossSplitHpFrac;
  for(let s=0; s<TD_CONFIG.bossSplitCount; s++){
    state.enemies.push({
      x: e.x + (s===0 ? -8 : 8), y: e.y, wpIdx: e.wpIdx, route: e.route,
      hp: childHp, maxHp: childHp,
      speed: e.speed*1.15,
      slow: 0, boss: true, splitDepth: 1, phase: TD_CONFIG.bossPhaseThresholds.length,
      reward: 25, angle: e.angle, walkDist: e.walkDist||0,
      evoCategory: 'armored',
    });
  }
  addLog('The boss splits into smaller horrors!','bad');
}

const TARGET_MS = 1000/60; // 16.667ms per logic tick
let lastTime=0, raf;
let tdAccum=0; // accumulator for tower defense
function gameLoop(ts){
  if(!Array.isArray(state.towers)) { lastTime=ts; raf=requestAnimationFrame(gameLoop); return; }
  const dt = Math.min(ts - lastTime, 100); // cap at 100ms to avoid spiral after tab switch
  lastTime = ts;
  if(!state.gameOver){
    tdAccum += dt * state.speed;
    while(tdAccum >= TARGET_MS){
      tick();
      tdAccum -= TARGET_MS;
    }
  }
  drawBg(); drawPath(); drawTowers(); drawEnemies(); drawBullets(); drawParticles();
  raf = requestAnimationFrame(gameLoop);
}

function tick(){
  if(!Array.isArray(state.towers)||!Array.isArray(state.enemies)||!Array.isArray(state.bullets)) return;
  state.frame++;
  // spawn enemies
  if(state.waveActive && state.waveEnemiesLeft>0){
    state.waveEnemyTimer++;
    if(state.waveEnemyTimer >= TD_CONFIG.waveSpawnInterval){
      spawnEnemy(); state.waveEnemiesLeft--;
      state.waveEnemyTimer=0;
    }
  }
  // move enemies
  for(let i=state.enemies.length-1;i>=0;i--){
    const e=state.enemies[i];
    if(e.digging){
      e.digTimer--;
      if(state.frame%8===0) spawnHitParticles(e.x, e.y, 'dig');
      if(e.digTimer<=0) completeDig(e);
      continue;
    }
    const reached = moveEnemy(e);
    if(reached){
      state.lives--; state.enemies.splice(i,1);
      sfx('tdEnemy',100);
      addLog('Enemy breached! -1 life','bad');
      updateHUD();
      if(state.lives<=0){ endGame(false); return; }
      continue;
    }
    // digger arrives at the wall: begin tunneling instead of dying/continuing normally
    if(e.digger && !state.shortcutOpen && !e.diggerTriggered && e.wpIdx===activeMap.shortcut?.breachIndex){
      e.digging = true; e.digTimer = TD_CONFIG.digDuration; e.diggerTriggered = true;
      addLog('A digger is tunneling through the wall!','bad');
      continue;
    }
    if(e.boss && e.hp>0) checkBossPhase(e);
    if(e.hp<=0){
      const pts = e.boss ? (e.splitDepth?90:200) : (e.minion?12:20+state.wave*5);
      state.score += pts;
      spawnHitParticle(e.x,e.y,'orange');
      addLog(`+${pts}pts`,'good');
      awardTowerXP(e.lastHitBy, e);
      if(e.boss){
        awardBossInterest();
        if(!e.splitDepth) spawnBossSplit(e);
      }
      state.enemies.splice(i,1);
      updateHUD();
    }
  }
  // towers shoot
  for(const t of state.towers) towerShoot(t);
  moveBullets();
  // wave complete?
  if(state.waveActive && state.waveEnemiesLeft===0 && state.enemies.length===0){
    state.waveActive=false;
    document.getElementById('waveBtn').disabled=false;
    addLog(`✓ Wave ${state.wave} complete! +${TD_CONFIG.waveReward}g`,'good');
    sfx('tdVictory'); sfx('rtsGoldIn');
    state.gold+=TD_CONFIG.waveReward; updateHUD();
  }
}

function endGame(won){
  state.gameOver=true;
  const ov=document.getElementById('overlay');
  const ot=document.getElementById('overlayTitle');
  const os=document.getElementById('overlaySub');
  ov.classList.add('show');
  if(won){ ot.className='overlay-title win'; ot.textContent='VICTORY'; os.textContent=`WAVE ${state.wave} — SCORE: ${state.score}`; sfx('tdVictory'); }
  else    { ot.className='overlay-title lose'; ot.textContent='GAME OVER'; os.textContent=`REACHED WAVE ${state.wave} — SCORE: ${state.score}`; sfx('tdDead'); }
  if(window.posthog) posthog.capture('td_game_ended', { outcome: won ? 'victory' : 'defeat', map: activeMap.name, wave: state.wave, score: state.score, towers_placed: state.towers.length });
}

function resetGame(){
  if(window.posthog) posthog.capture('td_game_restarted', { previous_wave: state.wave, previous_score: state.score });
  cancelAnimationFrame(raf);
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('waveBtn').disabled=false;
  initState();
  updateHUD();
  setLog([]);
  addLog(`Map: ${activeMap.name}. Place towers, click one to relocate it, and watch for wall breaches!`,'info');
  lastTime=performance.now();
  tdAccum=0;
  raf=requestAnimationFrame(gameLoop);
}

// ── GAME LIFECYCLE ──
registerGame('td', {
  init(){
    renderPreviewGun(document.getElementById('prev-gun').getContext('2d'));
    renderPreviewLaser(document.getElementById('prev-laser').getContext('2d'));
    renderPreviewMissile(document.getElementById('prev-missile').getContext('2d'));
    renderPreviewCryo(document.getElementById('prev-slow').getContext('2d'));
    addLog(`Map: ${activeMap.name}. Place towers, click one to relocate it, and watch for wall breaches!`,'info');
    updateHUD();
    lastTime=performance.now();
    tdAccum=0;
    if(!raf) raf=requestAnimationFrame(gameLoop);
  },
  cleanup(){
    cancelAnimationFrame(raf);
    raf=null;
  },
});

//# sourceMappingURL=logic.js.map
