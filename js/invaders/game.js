// ══════════════════════════════════════════════
//  NEXUS INVADERS — Space Invaders with polish
//  Includes HUD, waves, bunkers, audio, juice
// ══════════════════════════════════════════════

const invCanvas = document.getElementById('invadersCanvas');
const invCtx = invCanvas.getContext('2d');
const INV_W = invCanvas.width, INV_H = invCanvas.height;

const INV_CONFIG = {
  // grid
  cols: 11,
  rows: 5,
  invW: 32,
  invH: 22,
  gapX: 18,
  gapY: 14,
  topMargin: 78,
  sideMargin: 56,

  // player
  playerW: 44,
  playerH: 18,
  playerY: INV_H - 56,
  playerSpeed: 320,            // px/s
  respawnInvincibleMs: 1600,

  // bullets
  playerBulletSpeed: 580,      // px/s
  enemyBulletSpeed: 240,       // px/s, base
  enemyFireBaseRate: 0.65,     // shots/s for the whole swarm at wave 1
  enemyFireRampPerWave: 0.18,

  // invader movement
  baseStepInterval: 0.7,       // seconds between marches at wave 1, fewest invaders
  minStepInterval: 0.06,       // floor
  stepDescent: 14,             // px down per edge bump
  baseHSpeed: 14,              // px per march step at wave 1

  // bunkers
  bunkerCount: 4,
  bunkerY: INV_H - 130,
  bunkerCellSize: 4,           // pixel-block size
  bunkerCellsW: 22,
  bunkerCellsH: 14,

  // scoring (per row, top → bottom)
  rowScores: [30, 20, 20, 10, 10],
  ufoScores: [50, 100, 150, 300],
  ufoIntervalMs: 22000,
  ufoSpeed: 110,               // px/s

  // lives
  startLives: 3,
  maxLives: 5,

  // storage
  bestKey: 'nexus_invaders_best',

  // colors
  rowColors: ['#ff44aa', '#ff8855', '#ffdd44', '#88ff66', '#44ddff'],
  playerColor: '#00f5ff',
  bunkerColor: '#22ff66',
  bulletColor: '#ffffff',
  enemyBulletColor: '#ff66cc',
};

// ── STATE ──
const STATE = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
  WAVE_CLEAR: 'waveclear',
};

let invState = null;

function invFreshState(){
  return {
    phase: STATE.TITLE,
    wave: 1,
    score: 0,
    lives: INV_CONFIG.startLives,
    invaders: [],            // {x,y,row,col,alive,frame}
    invDir: 1,               // 1 right, -1 left
    invStepTimer: 0,
    invStepInterval: INV_CONFIG.baseStepInterval,
    invAnimFrame: 0,         // 0/1 for the two-pose march
    invMarchTone: 0,         // 0..3 for the iconic 4-tone cadence
    invJustBumped: false,    // edge bump → drop
    player: {
      x: INV_W/2 - INV_CONFIG.playerW/2,
      y: INV_CONFIG.playerY,
      alive: true,
      respawnT: 0,           // invincible-ms remaining
      deathAnim: 0,          // explosion timer
    },
    pBullet: null,           // {x,y,vy}
    eBullets: [],            // [{x,y,vy,kind}]
    bunkers: [],             // [{x,y,cells:[[1/0]]}]
    particles: [],           // explosion particles
    flashes: [],             // brief invader flash markers
    ufo: null,               // {x,y,score,dir}
    ufoTimer: INV_CONFIG.ufoIntervalMs / 1000,
    shake: 0,                // remaining shake ms
    waveClearT: 0,           // delay before next wave
    gameOverT: 0,            // small entry delay so user can read it
    invadersAlive: 0,
    waveStartFloor: INV_CONFIG.baseStepInterval,
    bestNow: invBest(),
    newBest: false,
    marchTimer: 0,
    keys: {},
  };
}

// ── HIGH SCORE PERSISTENCE ──
function invBest(){
  try { return parseInt(localStorage.getItem(INV_CONFIG.bestKey)||'0',10)||0; }
  catch(e){ return 0; }
}
function invSaveBest(v){
  try { localStorage.setItem(INV_CONFIG.bestKey, String(v)); } catch(e){}
}

// ── WAVE / SPAWN ──
function invSpawnWave(wave){
  const c = INV_CONFIG;
  const out = [];
  // descend faster on higher waves (capped); start slightly lower too
  const drop = Math.min(6, wave - 1) * 12;
  for(let r=0; r<c.rows; r++){
    for(let col=0; col<c.cols; col++){
      out.push({
        x: c.sideMargin + col*(c.invW + c.gapX),
        y: c.topMargin + drop + r*(c.invH + c.gapY),
        row: r,
        col,
        alive: true,
      });
    }
  }
  invState.invaders = out;
  invState.invadersAlive = out.length;
  invState.invDir = 1;
  invState.invStepTimer = 0;
  invState.invAnimFrame = 0;
  invState.invJustBumped = false;
  // step interval scales down with both wave and remaining count
  invState.waveStartFloor = Math.max(
    INV_CONFIG.minStepInterval,
    INV_CONFIG.baseStepInterval - (wave - 1) * 0.07
  );
  invState.invStepInterval = invState.waveStartFloor;
}

function invSpawnBunkers(){
  const c = INV_CONFIG;
  const totalW = INV_W;
  const slot = totalW / (c.bunkerCount + 1);
  const bunkers = [];
  for(let i=0; i<c.bunkerCount; i++){
    const cx = slot * (i + 1);
    const x = Math.round(cx - (c.bunkerCellsW * c.bunkerCellSize) / 2);
    bunkers.push({
      x,
      y: c.bunkerY,
      cells: invMakeBunkerShape(),
    });
  }
  invState.bunkers = bunkers;
}

// Classic arched bunker pixel map (1 = solid, 0 = empty)
function invMakeBunkerShape(){
  const W = INV_CONFIG.bunkerCellsW;
  const H = INV_CONFIG.bunkerCellsH;
  const grid = [];
  for(let y=0; y<H; y++){
    const row = [];
    for(let x=0; x<W; x++){
      let on = 1;
      // top corners rounded
      if(y < 3){
        const cornerDepth = 3 - y;
        if(x < cornerDepth || x >= W - cornerDepth) on = 0;
      }
      // bottom archway
      if(y >= H - 5){
        const archInsetL = Math.max(0, Math.floor(W * 0.32));
        const archInsetR = W - archInsetL;
        if(x >= archInsetL && x < archInsetR){
          // ovaloid arch — wider at the bottom
          const archRow = y - (H - 5);
          if(archRow >= 0){
            on = 0;
          }
        }
      }
      row.push(on);
    }
    grid.push(row);
  }
  return grid;
}

// ── INPUT ──
function invOnKeyDown(e){
  if(!invState) return;
  invState.keys[e.code] = true;

  if(invState.phase === STATE.TITLE){
    if(e.code === 'Space' || e.code === 'Enter'){
      invStartNewGame();
      e.preventDefault();
    }
    return;
  }

  if(invState.phase === STATE.GAME_OVER){
    if((e.code === 'Space' || e.code === 'Enter') && invState.gameOverT <= 0){
      invStartNewGame();
      e.preventDefault();
    }
    return;
  }

  if(e.code === 'KeyP' || e.code === 'Escape'){
    if(invState.phase === STATE.PLAYING){ invState.phase = STATE.PAUSED; e.preventDefault(); }
    else if(invState.phase === STATE.PAUSED){ invState.phase = STATE.PLAYING; e.preventDefault(); }
    return;
  }

  if(invState.phase === STATE.PLAYING){
    if(e.code === 'Space' && invState.player.alive && !invState.pBullet){
      invFirePlayerBullet();
      e.preventDefault();
    }
  }
}
function invOnKeyUp(e){
  if(!invState) return;
  invState.keys[e.code] = false;
}

function invFirePlayerBullet(){
  const p = invState.player;
  invState.pBullet = {
    x: p.x + INV_CONFIG.playerW/2 - 1.5,
    y: p.y - 4,
    vy: -INV_CONFIG.playerBulletSpeed,
  };
  sfx('invShoot');
}

// ── LIFECYCLE ──
function invStartNewGame(){
  const prev = invState ? invState : invFreshState();
  invState = invFreshState();
  invState.phase = STATE.PLAYING;
  invState.bestNow = invBest();
  invSpawnWave(1);
  invSpawnBunkers();
  if(window.posthog) posthog.capture('invaders_game_started', {});
}

function invNextWave(){
  invState.wave++;
  invState.score += 50; // wave bonus
  invSpawnWave(invState.wave);
  invSpawnBunkers();    // fresh bunkers each wave
  invState.pBullet = null;
  invState.eBullets = [];
  invState.phase = STATE.PLAYING;
  if(window.posthog) posthog.capture('invaders_wave_started', { wave: invState.wave });
}

function invPlayerDie(){
  const p = invState.player;
  if(!p.alive || p.respawnT > 0) return;
  p.alive = false;
  p.deathAnim = 900;          // ms of explosion before respawn
  invState.shake = 360;
  invState.eBullets = [];     // clear screen of enemy bullets
  invSpawnParticles(p.x + INV_CONFIG.playerW/2, p.y + INV_CONFIG.playerH/2, '#00f5ff', 32);
  sfx('invPlayerDie');
  invState.lives--;
  if(invState.lives <= 0){
    invState.phase = STATE.GAME_OVER;
    invState.gameOverT = 700;  // brief delay before restart accepted
    const prevBest = invBest();
    if(invState.score > prevBest){
      invSaveBest(invState.score);
      invState.bestNow = invState.score;
      invState.newBest = true;
    } else {
      invState.bestNow = prevBest;
    }
    if(window.posthog) posthog.capture('invaders_game_ended', {
      score: invState.score,
      wave: invState.wave,
      new_best: invState.newBest,
    });
  }
}

function invRespawnPlayer(){
  const p = invState.player;
  p.alive = true;
  p.x = INV_W/2 - INV_CONFIG.playerW/2;
  p.y = INV_CONFIG.playerY;
  p.respawnT = INV_CONFIG.respawnInvincibleMs;
  p.deathAnim = 0;
}

// ── UPDATE ──
function invUpdate(dt){
  const s = invState;
  if(!s) return;
  if(s.phase !== STATE.PLAYING && s.phase !== STATE.WAVE_CLEAR) {
    // tick down game-over input lock, but otherwise no sim
    if(s.phase === STATE.GAME_OVER && s.gameOverT > 0) s.gameOverT -= dt*1000;
    s.shake = Math.max(0, s.shake - dt*1000);
    return;
  }

  s.shake = Math.max(0, s.shake - dt*1000);

  // ── PLAYER ──
  const p = s.player;
  if(!p.alive){
    p.deathAnim -= dt*1000;
    if(p.deathAnim <= 0 && s.lives > 0){
      invRespawnPlayer();
    }
  } else {
    if(p.respawnT > 0) p.respawnT -= dt*1000;
    const left  = s.keys['ArrowLeft'] || s.keys['KeyA'];
    const right = s.keys['ArrowRight'] || s.keys['KeyD'];
    const v = (right?1:0) - (left?1:0);
    p.x += v * INV_CONFIG.playerSpeed * dt;
    if(p.x < 8) p.x = 8;
    if(p.x > INV_W - INV_CONFIG.playerW - 8) p.x = INV_W - INV_CONFIG.playerW - 8;
  }

  // ── PLAYER BULLET ──
  if(s.pBullet){
    s.pBullet.y += s.pBullet.vy * dt;
    if(s.pBullet.y < -10){ s.pBullet = null; }
  }

  // ── ENEMY BULLETS ──
  for(let i=s.eBullets.length-1; i>=0; i--){
    const b = s.eBullets[i];
    b.y += b.vy * dt;
    if(b.y > INV_H + 10){ s.eBullets.splice(i,1); }
  }

  // ── INVADERS MARCH ──
  if(s.phase === STATE.PLAYING){
    s.invStepTimer += dt;
    // step interval shortens as invaders die (classic SI accelerating march)
    const aliveFrac = s.invadersAlive / Math.max(1, INV_CONFIG.cols * INV_CONFIG.rows);
    const targetInterval = Math.max(
      INV_CONFIG.minStepInterval,
      s.waveStartFloor * (0.35 + aliveFrac * 0.65)
    );
    s.invStepInterval = targetInterval;

    if(s.invStepTimer >= s.invStepInterval){
      s.invStepTimer = 0;
      invStepInvaders();
    }
  }

  // ── COLLISIONS ──
  invHandleCollisions();

  // ── ENEMY FIRE ──
  if(s.phase === STATE.PLAYING){
    invMaybeEnemyFire(dt);
  }

  // ── UFO ──
  invUpdateUfo(dt);

  // ── PARTICLES / FLASHES ──
  for(let i=s.particles.length-1; i>=0; i--){
    const pt = s.particles[i];
    pt.x += pt.vx*dt; pt.y += pt.vy*dt;
    pt.vy += 320*dt; // light gravity for explosion flecks
    pt.life -= dt;
    if(pt.life <= 0) s.particles.splice(i,1);
  }
  for(let i=s.flashes.length-1; i>=0; i--){
    s.flashes[i].life -= dt*1000;
    if(s.flashes[i].life <= 0) s.flashes.splice(i,1);
  }

  // ── WAVE CLEAR ──
  if(s.invadersAlive <= 0 && s.phase === STATE.PLAYING){
    s.phase = STATE.WAVE_CLEAR;
    s.waveClearT = 1100;
    sfx('invWaveClear');
  }
  if(s.phase === STATE.WAVE_CLEAR){
    s.waveClearT -= dt*1000;
    if(s.waveClearT <= 0) invNextWave();
  }

  // ── LOSS: INVADERS REACH PLAYER LINE ──
  for(const inv of s.invaders){
    if(!inv.alive) continue;
    if(inv.y + INV_CONFIG.invH >= INV_CONFIG.playerY + 4){
      // immediate game over
      s.lives = 1;        // ensure die ends the game
      invPlayerDie();
      break;
    }
  }
}

function invStepInvaders(){
  const s = invState;
  // detect bump
  let willBump = false;
  for(const inv of s.invaders){
    if(!inv.alive) continue;
    const nx = inv.x + s.invDir * INV_CONFIG.baseHSpeed;
    if(nx < 6 || nx > INV_W - INV_CONFIG.invW - 6){ willBump = true; break; }
  }
  if(willBump){
    for(const inv of s.invaders){
      if(!inv.alive) continue;
      inv.y += INV_CONFIG.stepDescent;
    }
    s.invDir *= -1;
  } else {
    for(const inv of s.invaders){
      if(!inv.alive) continue;
      inv.x += s.invDir * INV_CONFIG.baseHSpeed;
    }
  }
  s.invAnimFrame = 1 - s.invAnimFrame;
  // iconic four-tone march
  const tones = ['invMarch1','invMarch2','invMarch3','invMarch4'];
  sfx(tones[s.invMarchTone]);
  s.invMarchTone = (s.invMarchTone + 1) % 4;
}

function invMaybeEnemyFire(dt){
  const s = invState;
  const rate = INV_CONFIG.enemyFireBaseRate + (s.wave - 1) * INV_CONFIG.enemyFireRampPerWave;
  if(Math.random() < rate * dt){
    // find a random alive column-bottom invader (only the lowest in a column fires)
    const colBottom = new Map();
    for(const inv of s.invaders){
      if(!inv.alive) continue;
      const cur = colBottom.get(inv.col);
      if(!cur || inv.y > cur.y) colBottom.set(inv.col, inv);
    }
    const candidates = [...colBottom.values()];
    if(!candidates.length) return;
    const shooter = candidates[Math.floor(Math.random() * candidates.length)];
    s.eBullets.push({
      x: shooter.x + INV_CONFIG.invW/2 - 1.5,
      y: shooter.y + INV_CONFIG.invH,
      vy: INV_CONFIG.enemyBulletSpeed + (s.wave - 1) * 18,
    });
  }
}

function invUpdateUfo(dt){
  const s = invState;
  if(s.ufo){
    s.ufo.x += s.ufo.dir * INV_CONFIG.ufoSpeed * dt;
    if(s.ufo.x < -60 || s.ufo.x > INV_W + 60){ s.ufo = null; }
  } else if(s.phase === STATE.PLAYING){
    s.ufoTimer -= dt;
    if(s.ufoTimer <= 0){
      const fromLeft = Math.random() < 0.5;
      const score = INV_CONFIG.ufoScores[Math.floor(Math.random() * INV_CONFIG.ufoScores.length)];
      s.ufo = {
        x: fromLeft ? -40 : INV_W + 40,
        y: 32,
        dir: fromLeft ? 1 : -1,
        score,
      };
      s.ufoTimer = INV_CONFIG.ufoIntervalMs/1000 + Math.random() * 8;
    }
  }
}

// ── COLLISIONS ──
function invHandleCollisions(){
  const s = invState;

  // player bullet → invaders
  if(s.pBullet){
    const b = s.pBullet;
    for(const inv of s.invaders){
      if(!inv.alive) continue;
      if(b.x >= inv.x && b.x <= inv.x + INV_CONFIG.invW &&
         b.y >= inv.y && b.y <= inv.y + INV_CONFIG.invH){
        inv.alive = false;
        s.invadersAlive--;
        const pts = INV_CONFIG.rowScores[inv.row] ?? 10;
        s.score += pts;
        s.flashes.push({ x: inv.x, y: inv.y, life: 140 });
        invSpawnParticles(
          inv.x + INV_CONFIG.invW/2,
          inv.y + INV_CONFIG.invH/2,
          INV_CONFIG.rowColors[inv.row] || '#fff',
          14
        );
        sfx('invHit');
        s.pBullet = null;
        return;
      }
    }
  }

  // player bullet → ufo
  if(s.pBullet && s.ufo){
    const b = s.pBullet;
    if(b.x >= s.ufo.x - 18 && b.x <= s.ufo.x + 18 &&
       b.y >= s.ufo.y - 8 && b.y <= s.ufo.y + 8){
      s.score += s.ufo.score;
      s.flashes.push({ x: s.ufo.x - 18, y: s.ufo.y - 8, life: 200 });
      invSpawnParticles(s.ufo.x, s.ufo.y, '#ff44aa', 28);
      sfx('invUfoHit');
      s.ufo = null;
      s.pBullet = null;
    }
  }

  // player bullet → bunkers
  if(s.pBullet){
    if(invBunkerHit(s.pBullet.x, s.pBullet.y, 'up')) s.pBullet = null;
  }

  // enemy bullets → bunkers
  for(let i=s.eBullets.length-1; i>=0; i--){
    const b = s.eBullets[i];
    if(invBunkerHit(b.x, b.y + 6, 'down')){
      s.eBullets.splice(i,1);
    }
  }

  // enemy bullets → player
  if(s.player.alive && s.player.respawnT <= 0){
    const p = s.player;
    for(let i=s.eBullets.length-1; i>=0; i--){
      const b = s.eBullets[i];
      if(b.x >= p.x && b.x <= p.x + INV_CONFIG.playerW &&
         b.y >= p.y && b.y <= p.y + INV_CONFIG.playerH){
        s.eBullets.splice(i,1);
        invPlayerDie();
        break;
      }
    }
  }

  // also chip bunkers when invaders march into them (classic)
  for(const inv of s.invaders){
    if(!inv.alive) continue;
    if(inv.y + INV_CONFIG.invH < INV_CONFIG.bunkerY) continue;
    // chip in a small footprint
    invBunkerChipRect(
      inv.x + 2,
      inv.y + INV_CONFIG.invH - 4,
      INV_CONFIG.invW - 4,
      8
    );
  }
}

function invBunkerHit(bx, by, dir){
  const c = INV_CONFIG;
  for(const bunker of invState.bunkers){
    if(bx < bunker.x || bx > bunker.x + c.bunkerCellsW*c.bunkerCellSize) continue;
    if(by < bunker.y || by > bunker.y + c.bunkerCellsH*c.bunkerCellSize) continue;
    const cx = Math.floor((bx - bunker.x) / c.bunkerCellSize);
    const cy = Math.floor((by - bunker.y) / c.bunkerCellSize);
    if(cy < 0 || cy >= c.bunkerCellsH || cx < 0 || cx >= c.bunkerCellsW) continue;

    // ray-march into the bunker until we find a solid cell; chip a small crater
    const stepY = dir === 'up' ? -1 : 1;
    for(let dy=0; dy<c.bunkerCellsH; dy++){
      const tcy = cy + dy*stepY;
      if(tcy < 0 || tcy >= c.bunkerCellsH) break;
      if(bunker.cells[tcy][cx]){
        // crater around (cx, tcy)
        const rad = 2;
        for(let oy=-rad; oy<=rad; oy++){
          for(let ox=-rad; ox<=rad; ox++){
            const ny = tcy + oy, nx = cx + ox;
            if(ny<0||ny>=c.bunkerCellsH||nx<0||nx>=c.bunkerCellsW) continue;
            const d2 = ox*ox + oy*oy;
            if(d2 <= rad*rad){
              // chip with falloff: outer ring chance, inner ring guaranteed
              if(d2 <= 1 || Math.random() < 0.7){
                bunker.cells[ny][nx] = 0;
              }
            }
          }
        }
        sfx('invBunkerChip');
        return true;
      }
    }
  }
  return false;
}

function invBunkerChipRect(x, y, w, h){
  const c = INV_CONFIG;
  for(const bunker of invState.bunkers){
    const bx0 = Math.floor((x - bunker.x) / c.bunkerCellSize);
    const by0 = Math.floor((y - bunker.y) / c.bunkerCellSize);
    const bx1 = Math.ceil((x + w - bunker.x) / c.bunkerCellSize);
    const by1 = Math.ceil((y + h - bunker.y) / c.bunkerCellSize);
    for(let cy=Math.max(0,by0); cy<Math.min(c.bunkerCellsH,by1); cy++){
      for(let cx=Math.max(0,bx0); cx<Math.min(c.bunkerCellsW,bx1); cx++){
        bunker.cells[cy][cx] = 0;
      }
    }
  }
}

// ── JUICE ──
function invSpawnParticles(x, y, color, count){
  for(let i=0; i<count; i++){
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 180;
    invState.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      life: 0.35 + Math.random() * 0.5,
      lifeMax: 0.85,
      color,
      size: 1.5 + Math.random() * 2,
    });
  }
}

// ── DRAW ──
function invDraw(){
  const ctx = invCtx;
  const s = invState;

  // background
  ctx.fillStyle = '#02060d';
  ctx.fillRect(0, 0, INV_W, INV_H);

  // starfield (subtle, deterministic-ish)
  invDrawStars();

  // screen shake transform
  let sx = 0, sy = 0;
  if(s.shake > 0){
    const k = s.shake / 360;
    sx = (Math.random() - 0.5) * 8 * k;
    sy = (Math.random() - 0.5) * 8 * k;
  }
  ctx.save();
  ctx.translate(sx, sy);

  // HUD
  invDrawHud();

  // ground line
  ctx.strokeStyle = '#22ff66';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#22ff66';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, INV_H - 18);
  ctx.lineTo(INV_W, INV_H - 18);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // bunkers
  invDrawBunkers();

  // invaders
  invDrawInvaders();

  // UFO
  if(s.ufo) invDrawUfo();

  // bullets
  invDrawBullets();

  // player
  invDrawPlayer();

  // flashes
  for(const f of s.flashes){
    ctx.globalAlpha = Math.max(0, f.life / 140);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(f.x - 2, f.y - 2, INV_CONFIG.invW + 4, INV_CONFIG.invH + 4);
    ctx.globalAlpha = 1;
  }

  // particles
  for(const p of s.particles){
    ctx.globalAlpha = Math.max(0, p.life / 0.85);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // overlays (do NOT shake)
  if(s.phase === STATE.TITLE)        invDrawTitle();
  else if(s.phase === STATE.PAUSED)  invDrawPaused();
  else if(s.phase === STATE.GAME_OVER) invDrawGameOver();
  else if(s.phase === STATE.WAVE_CLEAR) invDrawWaveClear();
}

function invDrawStars(){
  const ctx = invCtx;
  // 60 cheap stars based on a fixed seed
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for(let i=0; i<60; i++){
    const x = ((i*131) % INV_W);
    const y = ((i*223) % INV_H);
    const tw = ((i*7 + Math.floor(performance.now()/180)) & 3);
    if(tw === 0) ctx.fillStyle = 'rgba(255,255,255,0.85)';
    else ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y, 1, 1);
  }
}

function invDrawHud(){
  const ctx = invCtx;
  const s = invState;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Orbitron", monospace';
  ctx.textBaseline = 'top';

  // SCORE (top-left)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00f5ff';
  ctx.fillText('SCORE', 14, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Orbitron", monospace';
  ctx.fillText(String(s.score).padStart(4, '0'), 14, 28);

  // HIGH SCORE (top-center)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 18px "Orbitron", monospace';
  ctx.fillText('HI-SCORE', INV_W/2, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Orbitron", monospace';
  ctx.fillText(String(Math.max(s.bestNow, s.score)).padStart(4, '0'), INV_W/2, 28);

  // LIVES (top-right): label + icons
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff66cc';
  ctx.font = 'bold 18px "Orbitron", monospace';
  ctx.fillText('LIVES', INV_W - 14, 10);
  // life icons (mini ships)
  for(let i=0; i<s.lives; i++){
    const lx = INV_W - 14 - (i+1) * 28;
    invDrawMiniPlayer(lx, 34);
  }
  // wave indicator (small, bottom-left)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#88ff66';
  ctx.font = 'bold 12px "Orbitron", monospace';
  ctx.fillText('WAVE ' + s.wave, 14, INV_H - 14);
}

function invDrawMiniPlayer(x, y){
  const ctx = invCtx;
  ctx.fillStyle = INV_CONFIG.playerColor;
  ctx.fillRect(x, y+4, 18, 4);
  ctx.fillRect(x+4, y, 10, 5);
  ctx.fillRect(x+8, y-3, 2, 4);
}

function invDrawPlayer(){
  const ctx = invCtx;
  const p = invState.player;
  if(!p.alive){
    // explosion fragments handled by particles; draw a flash circle if early in death
    if(p.deathAnim > 700){
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x + INV_CONFIG.playerW/2, p.y + INV_CONFIG.playerH/2, 14, 0, Math.PI*2);
      ctx.fill();
    }
    return;
  }
  // flicker during invincibility
  if(p.respawnT > 0 && Math.floor(performance.now()/80) % 2 === 0) return;

  ctx.save();
  ctx.shadowColor = INV_CONFIG.playerColor;
  ctx.shadowBlur = 14;
  ctx.fillStyle = INV_CONFIG.playerColor;
  // base
  ctx.fillRect(p.x, p.y + 12, INV_CONFIG.playerW, 6);
  // mid
  ctx.fillRect(p.x + 6, p.y + 6, INV_CONFIG.playerW - 12, 8);
  // turret
  ctx.fillRect(p.x + INV_CONFIG.playerW/2 - 2, p.y, 4, 8);
  ctx.restore();
}

function invDrawInvaders(){
  const ctx = invCtx;
  const s = invState;
  for(const inv of s.invaders){
    if(!inv.alive) continue;
    const color = INV_CONFIG.rowColors[inv.row] || '#ffffff';
    invDrawInvaderSprite(inv.x, inv.y, color, inv.row, s.invAnimFrame);
  }
}

// Pixel-art invader sprites synthesized from row + frame
function invDrawInvaderSprite(x, y, color, row, frame){
  const ctx = invCtx;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  // each invader is 8x6 cells, scaled to 32x22
  const cellW = INV_CONFIG.invW / 8;
  const cellH = INV_CONFIG.invH / 6;
  const sprite = INV_SPRITES[row % INV_SPRITES.length][frame % 2];
  for(let cy=0; cy<sprite.length; cy++){
    const r = sprite[cy];
    for(let cx=0; cx<r.length; cx++){
      if(r[cx]){
        ctx.fillRect(
          x + cx * cellW,
          y + cy * cellH,
          cellW + 0.5,
          cellH + 0.5
        );
      }
    }
  }
  ctx.restore();
}

// Sprite atlas: rows × 2 frames (each frame is 6 rows of 8 cells)
const INV_SPRITES = [
  // row 0 — "squid" (top, 30 pts)
  [
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,0,0,0,1,0],
    ],
    [
      [0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [1,0,1,0,0,1,0,1],
    ],
  ],
  // row 1 — "crab"
  [
    [
      [0,0,1,0,0,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,0,0,0,1,0],
    ],
    [
      [1,0,0,0,0,0,0,1],
      [0,1,0,1,1,0,1,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1],
    ],
  ],
  // row 2 — "crab" (same family, different color)
  [
    [
      [0,0,1,0,0,1,0,0],
      [0,0,0,1,1,0,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,0,0,0,1,0],
    ],
    [
      [1,0,0,0,0,0,0,1],
      [0,1,0,1,1,0,1,0],
      [0,1,1,1,1,1,1,0],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1],
    ],
  ],
  // row 3 — "grunt"
  [
    [
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,1,1,0,1,0],
    ],
    [
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,1,1,0,1,0],
      [1,0,0,0,0,0,0,1],
    ],
  ],
  // row 4 — "grunt" (bottom row)
  [
    [
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,0,0,1,0,0],
      [0,1,0,1,1,0,1,0],
    ],
    [
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,0,1,1,0,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,0,1,1,0,1,0],
      [1,0,0,0,0,0,0,1],
    ],
  ],
];

function invDrawBunkers(){
  const ctx = invCtx;
  const c = INV_CONFIG;
  ctx.save();
  for(const bunker of invState.bunkers){
    for(let cy=0; cy<c.bunkerCellsH; cy++){
      for(let cx=0; cx<c.bunkerCellsW; cx++){
        if(!bunker.cells[cy][cx]) continue;
        ctx.fillStyle = c.bunkerColor;
        ctx.fillRect(
          bunker.x + cx*c.bunkerCellSize,
          bunker.y + cy*c.bunkerCellSize,
          c.bunkerCellSize,
          c.bunkerCellSize
        );
      }
    }
  }
  ctx.restore();
}

function invDrawBullets(){
  const ctx = invCtx;
  if(invState.pBullet){
    const b = invState.pBullet;
    ctx.fillStyle = INV_CONFIG.bulletColor;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(b.x, b.y, 3, 12);
    ctx.shadowBlur = 0;
  }
  for(const b of invState.eBullets){
    ctx.fillStyle = INV_CONFIG.enemyBulletColor;
    ctx.shadowColor = INV_CONFIG.enemyBulletColor;
    ctx.shadowBlur = 6;
    // zig-zag-y enemy bullet shape
    const wob = Math.sin((b.y + performance.now()*0.01) * 0.3) * 1.5;
    ctx.fillRect(b.x + wob, b.y, 3, 8);
    ctx.shadowBlur = 0;
  }
}

function invDrawUfo(){
  const ctx = invCtx;
  const u = invState.ufo;
  ctx.save();
  ctx.shadowColor = '#ff44aa';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff44aa';
  ctx.beginPath();
  ctx.ellipse(u.x, u.y, 18, 6, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#ffaadd';
  ctx.fillRect(u.x - 6, u.y - 9, 12, 4);
  ctx.restore();
}

// ── OVERLAYS ──
function invDrawCenteredOverlay(lines){
  const ctx = invCtx;
  ctx.fillStyle = 'rgba(2,6,13,0.78)';
  ctx.fillRect(0, 0, INV_W, INV_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = INV_H/2 - (lines.length * 22);
  for(const line of lines){
    ctx.fillStyle = line.color || '#ffffff';
    ctx.font = `bold ${line.size || 28}px "Orbitron", monospace`;
    if(line.glow){
      ctx.shadowColor = line.color || '#ffffff';
      ctx.shadowBlur = 14;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillText(line.text, INV_W/2, y);
    y += (line.size || 28) + 14;
  }
  ctx.shadowBlur = 0;
}

function invDrawTitle(){
  invDrawCenteredOverlay([
    { text: 'NEXUS INVADERS', size: 44, color: '#00f5ff', glow: true },
    { text: '← →  /  A  D    MOVE', size: 16, color: '#cccccc' },
    { text: 'SPACE    FIRE', size: 16, color: '#cccccc' },
    { text: 'P / ESC    PAUSE', size: 16, color: '#cccccc' },
    { text: '', size: 8 },
    { text: 'PRESS SPACE TO START', size: 22, color: '#ffdd44', glow: true },
    { text: 'HI-SCORE  ' + String(invBest()).padStart(4,'0'), size: 14, color: '#888888' },
  ]);
}

function invDrawPaused(){
  invDrawCenteredOverlay([
    { text: 'PAUSED', size: 48, color: '#88ff66', glow: true },
    { text: 'PRESS P OR ESC TO RESUME', size: 16, color: '#cccccc' },
  ]);
}

function invDrawGameOver(){
  const s = invState;
  invDrawCenteredOverlay([
    { text: 'GAME OVER', size: 44, color: '#ff44aa', glow: true },
    { text: 'FINAL SCORE  ' + String(s.score).padStart(4,'0'), size: 22, color: '#ffffff' },
    s.newBest
      ? { text: 'NEW HIGH SCORE!', size: 18, color: '#ffdd44', glow: true }
      : { text: 'HI-SCORE  ' + String(Math.max(s.bestNow, s.score)).padStart(4,'0'), size: 16, color: '#888888' },
    { text: '', size: 6 },
    { text: 'PRESS SPACE TO RESTART', size: 20, color: '#00f5ff', glow: true },
  ]);
}

function invDrawWaveClear(){
  const s = invState;
  invDrawCenteredOverlay([
    { text: 'WAVE ' + s.wave + ' CLEAR', size: 38, color: '#88ff66', glow: true },
    { text: '+50 BONUS', size: 18, color: '#ffdd44' },
    { text: 'INCOMING...', size: 16, color: '#cccccc' },
  ]);
}

// ── GAME LOOP ──
let invRaf = null;
let invLastTime = 0;
function invLoop(ts){
  const dt = Math.min(0.05, (ts - invLastTime) / 1000 || 0);
  invLastTime = ts;
  if(invState) invUpdate(dt);
  invDraw();
  invRaf = requestAnimationFrame(invLoop);
}

// ── LIFECYCLE ──
registerGame('invaders', {
  init(){
    invState = invFreshState();
    invState.phase = STATE.TITLE;
    document.addEventListener('keydown', invOnKeyDown);
    document.addEventListener('keyup',   invOnKeyUp);
    invLastTime = performance.now();
    if(!invRaf) invRaf = requestAnimationFrame(invLoop);
  },
  cleanup(){
    document.removeEventListener('keydown', invOnKeyDown);
    document.removeEventListener('keyup',   invOnKeyUp);
    if(invRaf){ cancelAnimationFrame(invRaf); invRaf = null; }
  },
});
