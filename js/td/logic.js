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
  baseEnemyCount: 8,
  enemyCountScaling: 3,
  waveScaling: { multiplier: 1 },
};

// Path waypoints (grid coords)
const PATH_WAYPOINTS = [
  {x:0,y:3},{x:4,y:3},{x:4,y:1},{x:8,y:1},
  {x:8,y:6},{x:12,y:6},{x:12,y:3},{x:16,y:3},
  {x:16,y:10},{x:10,y:10},{x:10,y:8},{x:6,y:8},
  {x:6,y:11},{x:17.5,y:11}
];

function wpPx(wp){ return {x: wp.x*CELL, y: wp.y*CELL + CELL/2}; }

const TOWER_TYPES = {
  gun:     { color:'#00f5ff', range:120, damage:15, rate:30,  cost:50,  bullet:'cyan',   aoe:false },
  laser:   { color:'#ff0088', range:100, damage:8,  rate:15,  cost:80,  bullet:'pink',   aoe:false },
  missile: { color:'#ff8800', range:150, damage:45, rate:90,  cost:120, bullet:'orange', aoe:true  },
  slow:    { color:'#8888ff', range:100, damage:2,  rate:25,  cost:70,  bullet:'blue',   aoe:false },
};

const TD_DEFAULTS = {
  gold: TD_CONFIG.initialGold, lives: TD_CONFIG.initialLives, score: 0, wave: 0,
  towers: [], enemies: [], bullets: [], particles: [],
  waveActive: false, waveEnemyTimer: 0, waveEnemiesLeft: 0,
  selectedTower: 'gun', speed: 1, frame: 0, gameOver: false,
};

let state = {...TD_DEFAULTS, towers:[], enemies:[], bullets:[], particles:[]};

function initState(){
  state = {...TD_DEFAULTS, towers:[], enemies:[], bullets:[], particles:[]};
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
}

// Path cells set
const pathCells = new Set();
function buildPath(){
  pathCells.clear();
  for(let i=0;i<PATH_WAYPOINTS.length-1;i++){
    const a=PATH_WAYPOINTS[i], b=PATH_WAYPOINTS[i+1];
    const dx=Math.sign(b.x-a.x), dy=Math.sign(b.y-a.y);
    let cx=Math.round(a.x), cy=Math.round(a.y);
    while(cx!==Math.round(b.x)||cy!==Math.round(b.y)){
      pathCells.add(`${cx},${cy}`);
      if(dx!==0) cx+=dx; else cy+=dy;
    }
    pathCells.add(`${Math.round(b.x)},${Math.round(b.y)}`);
  }
}
buildPath();

function isPathCell(gx,gy){
  return pathCells.has(`${Math.floor(gx)},${Math.floor(gy)}`);
}

canvas.addEventListener('click', e=>{
  if(state.gameOver) return;
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width/r.width, scaleY = canvas.height/r.height;
  const mx = (e.clientX-r.left)*scaleX, my = (e.clientY-r.top)*scaleY;
  const gx = Math.floor(mx/CELL), gy = Math.floor(my/CELL);
  if(isPathCell(gx,gy)){ addLog('Cannot place on path!','bad'); return; }
  const ttype = state.selectedTower;
  const cost = TOWER_TYPES[ttype].cost;
  if(state.gold < cost){ addLog('Not enough gold!','bad'); return; }
  // no overlap
  if(state.towers.some(t=>Math.floor(t.x/CELL)===gx && Math.floor(t.y/CELL)===gy)){
    addLog('Cell occupied!','bad'); return;
  }
  state.gold -= cost;
  state.towers.push({
    x: gx*CELL+CELL/2, y: gy*CELL+CELL/2,
    type: ttype, cooldown: 0,
    ...TOWER_TYPES[ttype]
  });
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
  document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function startWave(){
  if(state.waveActive || state.gameOver) return;
  state.wave++;
  const count = TD_CONFIG.baseEnemyCount + state.wave * TD_CONFIG.enemyCountScaling;
  state.waveActive = true;
  state.waveEnemiesLeft = count;
  state.waveEnemyTimer = 0;
  state.waveMultiplier = TD_CONFIG.waveScaling.multiplier;
  document.getElementById('waveBtn').disabled = true;
  sfx('tdWave');
  addLog(`▶ WAVE ${state.wave} INCOMING — ${count} enemies`,'info');
  updateHUD();
  if(window.posthog) posthog.capture('td_wave_started', { wave: state.wave, enemy_count: count, towers: state.towers.length, gold: state.gold, score: state.score });
}

function spawnEnemy(){
  const hp = TD_CONFIG.enemyBaseHp + state.wave * TD_CONFIG.enemyHpScaling + Math.random()*20;
  const spd = TD_CONFIG.enemyBaseSpeed + state.wave * TD_CONFIG.enemySpeedScaling + Math.random()*0.2;
  const isBoss = state.waveEnemiesLeft === 1 && state.wave % TD_CONFIG.bossWaveInterval === 0;
  state.enemies.push({
    x: PATH_WAYPOINTS[0].x*CELL,
    y: PATH_WAYPOINTS[0].y*CELL + CELL/2,
    wpIdx: 0, progress: 0,
    hp: isBoss ? hp*TD_CONFIG.bossHpMultiplier : hp,
    maxHp: isBoss ? hp*TD_CONFIG.bossHpMultiplier : hp,
    speed: isBoss ? spd*TD_CONFIG.bossSpeedMultiplier : spd,
    slow: 0, boss: isBoss,
    reward: isBoss ? 60 : 10 + state.wave * 2,
  });
}

function moveEnemy(e){
  if(e.wpIdx >= PATH_WAYPOINTS.length-1){ return true; }
  const target = wpPx(PATH_WAYPOINTS[e.wpIdx+1]);
  const spd = e.slow > 0 ? e.speed * TD_CONFIG.slowFactor : e.speed;
  const dx = target.x - e.x, dy = target.y - e.y;
  const dist = Math.hypot(dx,dy);
  if(dist < spd+1){ e.x=target.x; e.y=target.y; e.wpIdx++; return false; }
  e.x += (dx/dist)*spd;
  e.y += (dy/dist)*spd;
  if(e.slow>0) e.slow--;
  return false;
}

function towerShoot(t){
  if(t.cooldown>0){ t.cooldown--; return; }
  let best=null, bd=Infinity;
  for(const e of state.enemies){
    const d=Math.hypot(e.x-t.x,e.y-t.y);
    if(d<t.range && e.wpIdx<PATH_WAYPOINTS.length-1){
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
        for(const e of state.enemies){
          if(Math.hypot(e.x-b.tx.x,e.y-b.tx.y)<TD_CONFIG.missileAoeRadius){ e.hp-=b.dmg; }
        }
        sfx('tdExplode',200);
        spawnHitParticles(b.tx.x, b.tx.y, 'explosion');
      } else {
        b.tx.hp -= b.dmg;
        if(b.slow) b.tx.slow = TD_CONFIG.slowDuration;
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
    const reached = moveEnemy(e);
    if(reached){
      state.lives--; state.enemies.splice(i,1);
      sfx('tdEnemy',100);
      addLog('Enemy breached! -1 life','bad');
      updateHUD();
      if(state.lives<=0){ endGame(false); return; }
    } else if(e.hp<=0){
      state.score += e.boss?200:20+state.wave*5;
      spawnHitParticle(e.x,e.y,'orange');
      addLog(`+${e.boss?200:20+state.wave*5}pts`,'good');
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
  if(window.posthog) posthog.capture('td_game_ended', { outcome: won ? 'victory' : 'defeat', wave: state.wave, score: state.score, towers_placed: state.towers.length });
}

function resetGame(){
  if(window.posthog) posthog.capture('td_game_restarted', { previous_wave: state.wave, previous_score: state.score });
  cancelAnimationFrame(raf);
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('waveBtn').disabled=false;
  initState();
  updateHUD();
  setLog([]);
  addLog('Game initialized. Place towers and send waves!','info');
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
    addLog('Game initialized. Place towers and send waves!','info');
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
