// ── SPACE INVADERS ──
// Built on top of the scaffold game loop (fixed 60 Hz, decoupled render).
// Gameplay layer: Player, InvaderGrid, Bullets, CollisionSystem.

const siCanvas = document.getElementById('siCanvas');
const siCtx = siCanvas.getContext('2d');
const SI_W = siCanvas.width, SI_H = siCanvas.height;

const SI_CONFIG = {
  targetHz: 60,
  targetMs: 1000 / 60,
  maxFrameMs: 100,

  // Player
  playerW: 44,
  playerH: 18,
  playerY: SI_H - 50,
  playerSpeedPxSec: 320,
  shootCooldownMs: 320,

  // Grid
  rows: 5,
  cols: 11,
  cellW: 44,
  cellH: 36,
  invaderW: 32,
  invaderH: 22,
  gridTopY: 80,
  gridStartX: 80,

  // March
  marchStepPx: 10,
  marchDescendPx: 22,
  marchStartIntervalSec: 0.7,
  marchMinIntervalSec: 0.06,

  // Bullets
  bulletW: 4,
  bulletH: 14,
  playerBulletSpeedPxSec: 540,
  invaderBulletSpeedPxSec: 240,
  invaderFireBaseChancePerSec: 0.55, // total across the entire bottom row
  maxInvaderBullets: 5,

  bestKey: 'nexus_invaders_best_wave',
};

// ── PIXEL SPRITES — 10×8 cells each, 2 march frames per type ──
const INVADER_SPRITES = {
  // Top row — small "squid"
  a: [
    [
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,0,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,0,1,1,0,0,1,1,0,0],
      [0,1,1,0,1,1,0,1,1,0],
      [1,1,0,0,0,0,0,0,1,1],
    ],
    [
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,0,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,0,0,1,1,1,0],
      [1,1,0,0,1,1,0,0,1,1],
      [0,0,1,1,0,0,1,1,0,0],
    ],
  ],
  // Middle rows — "crab"
  b: [
    [
      [0,0,1,0,0,0,0,1,0,0],
      [0,0,0,1,0,0,1,0,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,0,1,1,0,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,0,1],
      [1,0,1,0,0,0,0,1,0,1],
      [0,0,0,1,1,0,1,1,0,0],
    ],
    [
      [0,0,1,0,0,0,0,1,0,0],
      [1,0,0,1,0,0,1,0,0,1],
      [1,0,1,1,1,1,1,1,0,1],
      [1,1,1,0,1,1,0,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,0,0,0,0,1,0,0],
      [0,1,0,0,0,0,0,0,1,0],
    ],
  ],
  // Bottom rows — "octopus"
  c: [
    [
      [0,0,0,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,0,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,0,1,1,0,0,1,1,0,0],
      [0,1,1,0,1,1,0,1,1,0],
      [1,1,0,0,0,0,0,0,1,1],
    ],
    [
      [0,0,0,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,0,0,1,1,0,0,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,1,1,0,1,1,0,1,1,0],
      [1,0,0,1,0,0,1,0,0,1],
      [0,1,1,0,0,0,0,1,1,0],
    ],
  ],
};

const INVADER_ROW_TYPES  = ['a', 'b', 'b', 'c', 'c'];
const INVADER_ROW_COLORS = ['#ff4488', '#00f5ff', '#00f5ff', '#00ff88', '#00ff88'];
const INVADER_ROW_SCORE  = [30, 20, 20, 10, 10];

// ── GAME STATE ──
// Shape mirrors the scaffold's Game object; grid/march live as plain fields.
const Game = {
  state: 'running',   // 'running' | 'gameover' | 'win'
  ticks: 0,
  time: 0,
  player: null,
  invaders: [],
  bullets: [],         // unified list; b.owner = 'player' | 'invader'
  particles: [],
  score: 0,
  lives: 1,
  wave: 1,
  gridDir: 1,
  gridFrame: 0,
  marchTimerSec: 0,
  lastShotAt: 0,
  starfield: [],
};

// Input — code-based so it's layout-independent.
const keys = Object.create(null);

function siOnKeyDown(e){
  keys[e.code] = true;
  if(e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space'){
    e.preventDefault();
  }
  if(Game.state !== 'running' && (e.code === 'Space' || e.code === 'Enter')){
    siResetGame();
    e.preventDefault();
  }
}
function siOnKeyUp(e){
  keys[e.code] = false;
}

// ── BEST WAVE ──
function siBest(){
  try { return parseInt(localStorage.getItem(SI_CONFIG.bestKey) || '0', 10) || 0; }
  catch(e){ return 0; }
}
function siSaveBest(v){
  try { localStorage.setItem(SI_CONFIG.bestKey, String(v)); } catch(e){}
}

// ── PLAYER ──
function makePlayer(){
  const C = SI_CONFIG;
  return {
    x: SI_W / 2 - C.playerW / 2,
    y: C.playerY,
    w: C.playerW,
    h: C.playerH,
    alive: true,
  };
}

function updatePlayer(dt){
  const p = Game.player;
  if(!p || !p.alive) return;
  const step = SI_CONFIG.playerSpeedPxSec * dt;
  if(keys['ArrowLeft'])  p.x -= step;
  if(keys['ArrowRight']) p.x += step;
  if(p.x < 12) p.x = 12;
  if(p.x + p.w > SI_W - 12) p.x = SI_W - 12 - p.w;
}

function tryPlayerShoot(){
  if(Game.state !== 'running') return;
  const p = Game.player;
  if(!p || !p.alive) return;
  const now = performance.now();
  if(now - Game.lastShotAt < SI_CONFIG.shootCooldownMs) return;
  Game.bullets.push(makeBullet(
    p.x + p.w / 2 - SI_CONFIG.bulletW / 2,
    p.y - SI_CONFIG.bulletH,
    -SI_CONFIG.playerBulletSpeedPxSec,
    'player'
  ));
  Game.lastShotAt = now;
  sfx('siShoot');
}

function drawPlayer(ctx){
  const p = Game.player;
  if(!p || !p.alive) return;
  ctx.save();
  ctx.fillStyle = '#00ff88';
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 12;
  // Base
  ctx.fillRect(p.x, p.y + 10, p.w, 8);
  // Wings
  ctx.fillRect(p.x + 6, p.y + 5, p.w - 12, 5);
  // Turret
  ctx.fillRect(p.x + p.w / 2 - 3, p.y - 4, 6, 12);
  ctx.fillRect(p.x + p.w / 2 - 1, p.y - 9, 2, 5);
  ctx.restore();
}

// ── BULLET ──
function makeBullet(x, y, vyPxSec, owner){
  return {
    x, y,
    w: SI_CONFIG.bulletW,
    h: SI_CONFIG.bulletH,
    vy: vyPxSec,
    owner,
    dead: false,
  };
}

function updateBullets(dt){
  for(const b of Game.bullets){
    b.y += b.vy * dt;
    if(b.y + b.h < 0 || b.y > SI_H) b.dead = true;
  }
  Game.bullets = Game.bullets.filter(b => !b.dead);
}

function drawBullets(ctx){
  for(const b of Game.bullets){
    ctx.save();
    if(b.owner === 'player'){
      ctx.fillStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
    } else {
      ctx.fillStyle = '#ff0088';
      ctx.shadowColor = '#ff0088';
    }
    ctx.shadowBlur = 10;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }
}

// ── INVADER GRID ──
function buildInvaderGrid(){
  const C = SI_CONFIG;
  const list = [];
  for(let r = 0; r < C.rows; r++){
    for(let c = 0; c < C.cols; c++){
      list.push({
        col: c,
        row: r,
        type: INVADER_ROW_TYPES[r],
        color: INVADER_ROW_COLORS[r],
        score: INVADER_ROW_SCORE[r],
        x: C.gridStartX + c * C.cellW,
        y: C.gridTopY + r * C.cellH,
        alive: true,
      });
    }
  }
  return list;
}

function aliveInvaders(){
  let n = 0;
  for(const inv of Game.invaders) if(inv.alive) n++;
  return n;
}

function marchIntervalSec(){
  const total = SI_CONFIG.rows * SI_CONFIG.cols;
  const alive = aliveInvaders();
  if(alive <= 0) return SI_CONFIG.marchStartIntervalSec;
  const ratio = alive / total;
  const eased = Math.pow(ratio, 0.85);
  const C = SI_CONFIG;
  return C.marchMinIntervalSec + (C.marchStartIntervalSec - C.marchMinIntervalSec) * eased;
}

function gridBounds(){
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  const w = SI_CONFIG.invaderW;
  const h = SI_CONFIG.invaderH;
  for(const inv of Game.invaders){
    if(!inv.alive) continue;
    if(inv.x < minX) minX = inv.x;
    if(inv.x + w > maxX) maxX = inv.x + w;
    if(inv.y + h > maxY) maxY = inv.y + h;
  }
  return { minX, maxX, maxY };
}

function marchStep(){
  const C = SI_CONFIG;
  const b = gridBounds();
  if(b.minX === Infinity) return;

  const stepDx = Game.gridDir * C.marchStepPx;
  const nextMinX = b.minX + stepDx;
  const nextMaxX = b.maxX + stepDx;

  if(nextMaxX > SI_W - 12 || nextMinX < 12){
    Game.gridDir *= -1;
    for(const inv of Game.invaders){
      if(inv.alive) inv.y += C.marchDescendPx;
    }
  } else {
    for(const inv of Game.invaders){
      if(inv.alive) inv.x += stepDx;
    }
  }
  Game.gridFrame ^= 1;

  // Landing — invader reaches player row → game over.
  const playerTop = Game.player.y;
  for(const inv of Game.invaders){
    if(inv.alive && inv.y + C.invaderH >= playerTop){
      siEndGame('landed');
      return;
    }
  }
}

function invaderTryFire(dt){
  if(Game.state !== 'running') return;
  // Cap concurrent invader bullets.
  let invBullets = 0;
  for(const b of Game.bullets) if(b.owner === 'invader') invBullets++;
  if(invBullets >= SI_CONFIG.maxInvaderBullets) return;

  // Find the bottom-most alive invader per column.
  const bottoms = {};
  for(const inv of Game.invaders){
    if(!inv.alive) continue;
    const prev = bottoms[inv.col];
    if(!prev || inv.y > prev.y) bottoms[inv.col] = inv;
  }
  const cols = Object.values(bottoms);
  if(cols.length === 0) return;

  const perColPerSec = SI_CONFIG.invaderFireBaseChancePerSec / cols.length;
  const chance = perColPerSec * dt;
  for(const inv of cols){
    if(Math.random() < chance){
      Game.bullets.push(makeBullet(
        inv.x + SI_CONFIG.invaderW / 2 - SI_CONFIG.bulletW / 2,
        inv.y + SI_CONFIG.invaderH,
        SI_CONFIG.invaderBulletSpeedPxSec,
        'invader'
      ));
    }
  }
}

function drawSprite(ctx, sprite, x, y, cellSize, color){
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  for(let row = 0; row < sprite.length; row++){
    const line = sprite[row];
    for(let col = 0; col < line.length; col++){
      if(line[col]){
        ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
      }
    }
  }
  ctx.restore();
}

function drawInvaders(ctx){
  const C = SI_CONFIG;
  const frame = Game.gridFrame;
  for(const inv of Game.invaders){
    if(!inv.alive) continue;
    const sprite = INVADER_SPRITES[inv.type][frame];
    const cols = sprite[0].length;
    const cell = Math.max(1, Math.floor(C.invaderW / cols));
    const pixelW = cell * cols;
    const offsetX = (C.invaderW - pixelW) / 2;
    drawSprite(ctx, sprite, inv.x + offsetX, inv.y, cell, inv.color);
  }
}

// ── COLLISIONS ──
function aabbHit(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCollisions(){
  const C = SI_CONFIG;

  // Player bullets vs invaders
  for(const bullet of Game.bullets){
    if(bullet.dead || bullet.owner !== 'player') continue;
    for(const inv of Game.invaders){
      if(!inv.alive) continue;
      const ib = { x: inv.x, y: inv.y, w: C.invaderW, h: C.invaderH };
      if(aabbHit(bullet, ib)){
        bullet.dead = true;
        inv.alive = false;
        Game.score += inv.score;
        spawnExplosion(inv.x + C.invaderW / 2, inv.y + C.invaderH / 2, inv.color);
        sfx('siKill');
        break;
      }
    }
  }

  // Invader bullets vs player
  if(Game.player && Game.player.alive){
    const p = Game.player;
    for(const bullet of Game.bullets){
      if(bullet.dead || bullet.owner !== 'invader') continue;
      if(aabbHit(bullet, p)){
        bullet.dead = true;
        Game.lives = Math.max(0, Game.lives - 1);
        if(Game.lives <= 0){
          p.alive = false;
          spawnExplosion(p.x + p.w / 2, p.y + p.h / 2, '#00ff88');
          sfx('siPlayerDie');
          siEndGame('hit');
        }
        break;
      }
    }
  }

  // Player bullets vs invader bullets — small skill bonus.
  for(const pb of Game.bullets){
    if(pb.dead || pb.owner !== 'player') continue;
    for(const ib of Game.bullets){
      if(ib.dead || ib.owner !== 'invader') continue;
      if(aabbHit(pb, ib)){
        pb.dead = true;
        ib.dead = true;
        spawnExplosion(pb.x, pb.y, '#ffffff');
        break;
      }
    }
  }

  Game.bullets = Game.bullets.filter(b => !b.dead);
}

// ── PARTICLES ──
function spawnExplosion(x, y, color){
  for(let i = 0; i < 12; i++){
    const a = Math.random() * Math.PI * 2;
    const s = 30 + Math.random() * 90;     // px/sec
    Game.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      color,
    });
  }
}

function updateParticles(dt){
  for(const p of Game.particles){
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= 2.2 * dt;   // ~0.45 sec total
  }
  Game.particles = Game.particles.filter(p => p.life > 0);
}

function drawParticles(ctx){
  for(const p of Game.particles){
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    ctx.restore();
  }
}

// ── STARFIELD ──
function initStarfield(){
  Game.starfield = [];
  for(let i = 0; i < 100; i++){
    Game.starfield.push({
      x: Math.random() * SI_W,
      y: Math.random() * SI_H,
      s: Math.random() * 1.3 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
}

function drawBg(ctx){
  ctx.fillStyle = '#020810';
  ctx.fillRect(0, 0, SI_W, SI_H);
  for(const s of Game.starfield){
    const t = 0.4 + 0.6 * Math.abs(Math.sin(Game.time * 1.2 + s.twinkle));
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = '#9ad8ff';
    ctx.fillRect(s.x, s.y, s.s, s.s);
    ctx.restore();
  }
  // Defensive line
  ctx.strokeStyle = 'rgba(0,255,136,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, SI_CONFIG.playerY + SI_CONFIG.playerH + 6);
  ctx.lineTo(SI_W, SI_CONFIG.playerY + SI_CONFIG.playerH + 6);
  ctx.stroke();
}

// ── HUD ──
function siUpdateHUD(){
  const sScore = document.getElementById('siScore');
  const sLives = document.getElementById('siLives');
  const sWave  = document.getElementById('siWave');
  if(sScore) sScore.textContent = Game.score;
  if(sLives) sLives.textContent = Game.lives;
  if(sWave)  sWave.textContent  = Game.wave;
}

// ── GAME FLOW ──
function siInitGame(){
  Game.state = 'running';
  Game.ticks = 0;
  Game.time = 0;
  Game.player = makePlayer();
  Game.invaders = buildInvaderGrid();
  Game.bullets = [];
  Game.particles = [];
  Game.score = 0;
  Game.lives = 1;
  Game.wave = 1;
  Game.gridDir = 1;
  Game.gridFrame = 0;
  Game.marchTimerSec = 0;
  Game.lastShotAt = 0;
  initStarfield();
  for(const k of Object.keys(keys)) keys[k] = false;
  siUpdateHUD();
  const ov = document.getElementById('siOverlay');
  if(ov) ov.classList.remove('show');
}

function siEndGame(cause){
  if(Game.state !== 'running') return;
  const won = (cause === 'win');
  Game.state = won ? 'win' : 'gameover';
  const prevBest = siBest();
  let isNewBest = false;
  if(Game.wave > prevBest){
    siSaveBest(Game.wave);
    isNewBest = true;
  }
  const ov = document.getElementById('siOverlay');
  const ot = document.getElementById('siOverlayTitle');
  const os = document.getElementById('siOverlaySub');
  if(ov && ot && os){
    ov.classList.add('show');
    ot.className = 'overlay-title ' + (won ? 'win' : 'lose');
    ot.textContent = won ? 'VICTORY' : 'GAME OVER';
    const subMap = {
      win:    'EARTH IS SAFE — FOR NOW',
      landed: 'THE INVADERS HAVE LANDED',
      hit:    'YOUR CANNON HAS FALLEN',
    };
    os.textContent = subMap[cause] || subMap.hit;
  }
  if(won) sfx('siWin');
  if(window.posthog) posthog.capture('si_game_ended', {
    cause, wave: Game.wave, score: Game.score, won, new_best: isNewBest,
  });
}

function siResetGame(){
  if(window.posthog) posthog.capture('si_game_restarted', {
    previous_wave: Game.wave, previous_score: Game.score,
  });
  siInitGame();
}

// ── UPDATE / RENDER ──
function update(dt){
  // dt is in seconds, fixed step (~1/60 s).
  Game.ticks++;
  Game.time += dt;

  if(Game.state !== 'running'){
    updateParticles(dt);
    return;
  }

  updatePlayer(dt);
  if(keys['Space']) tryPlayerShoot();

  // March cadence — accelerates as invaders die.
  Game.marchTimerSec += dt;
  let interval = marchIntervalSec();
  while(Game.marchTimerSec >= interval){
    marchStep();
    Game.marchTimerSec -= interval;
    if(Game.state !== 'running') break;
    interval = marchIntervalSec();
  }

  if(Game.state === 'running'){
    invaderTryFire(dt);
    updateBullets(dt);
    resolveCollisions();
    updateParticles(dt);
    if(aliveInvaders() === 0) siEndGame('win');
  }

  siUpdateHUD();
}

function render(ctx){
  drawBg(ctx);
  drawInvaders(ctx);
  drawBullets(ctx);
  drawPlayer(ctx);
  drawParticles(ctx);

  // FPS counter (kept from scaffold).
  ctx.save();
  ctx.fillStyle = 'rgba(0,255,136,0.55)';
  ctx.font = '600 11px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('FPS: ' + siFpsDisplay.toFixed(0), 12, 10);
  ctx.fillText('BEST WAVE: ' + siBest(), 12, 26);
  ctx.restore();
}

// ── GAME LOOP ──
let siRaf = null;
let siLastTime = 0;
let siAccum = 0;
let siFpsDisplay = 0;
let siFpsAccum = 0;
let siFpsFrames = 0;

function siLoop(ts){
  const rawDt = ts - siLastTime;
  siLastTime = ts;
  const dt = Math.min(rawDt, SI_CONFIG.maxFrameMs);

  siAccum += dt;
  while(siAccum >= SI_CONFIG.targetMs){
    update(SI_CONFIG.targetMs / 1000);
    siAccum -= SI_CONFIG.targetMs;
  }

  siFpsAccum += dt;
  siFpsFrames++;
  if(siFpsAccum >= 500){
    siFpsDisplay = (siFpsFrames * 1000) / siFpsAccum;
    siFpsAccum = 0;
    siFpsFrames = 0;
  }

  render(siCtx);
  siRaf = requestAnimationFrame(siLoop);
}

function siStart(){
  siLastTime = performance.now();
  siAccum = 0;
  siFpsAccum = 0;
  siFpsFrames = 0;
  if(!siRaf) siRaf = requestAnimationFrame(siLoop);
}

function siStop(){
  if(siRaf){ cancelAnimationFrame(siRaf); siRaf = null; }
}

// ── LIFECYCLE ──
registerGame('si', {
  init(){
    siInitGame();
    document.addEventListener('keydown', siOnKeyDown);
    document.addEventListener('keyup', siOnKeyUp);
    siStart();
    if(window.posthog) posthog.capture('si_game_started', {});
  },
  cleanup(){
    document.removeEventListener('keydown', siOnKeyDown);
    document.removeEventListener('keyup', siOnKeyUp);
    siStop();
  },
});
