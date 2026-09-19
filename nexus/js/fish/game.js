// ── FISH FRENZY ──
const fishCanvas = document.getElementById('fishCanvas');
const fishCtx = fishCanvas.getContext('2d');
const FISH_W = fishCanvas.width, FISH_H = fishCanvas.height;

const FISH_CONFIG = {
  startSize: 14,
  winSize: 95,
  maxFish: 18,
  spawnEveryMs: 700,
  eatRatio: 0.92,    // strictly smaller (size < player * 0.92) is edible
  killRatio: 1.08,   // size > player * 1.08 is lethal
  growPerEat: 1.6,   // base growth per eaten fish (scaled by relative size)
  growMin: 0.7,
  growMax: 3.5,
  bonusChance: 0.06, // chance a spawned fish is a gold bonus
  bonusBoost: 4.5,   // size growth when eating a bonus
  bonusScore: 50,
  bestKey: 'nexus_fish_best',
  followLerp: 0.18,
  fishSpeedMin: 0.45,
  fishSpeedMax: 1.8,
  // Player feel
  playerMaxStep: 7,
};

const FISH_PALETTE = [
  '#ff6b35','#ffa600','#f56498','#4cc9f0','#90e0ef',
  '#80ed99','#c77dff','#ffd166','#ef476f','#06d6a0',
  '#ffadad','#bdb2ff','#a0c4ff','#fdffb6',
];

const fishState = {
  player: { x: FISH_W/2, y: FISH_H/2, size: FISH_CONFIG.startSize, dirX: 1, wobble: 0 },
  mouse:  { x: FISH_W/2, y: FISH_H/2, inside: false },
  fishes: [],
  bubbles: [],
  particles: [],
  score: 0,
  eaten: 0,
  gameOver: false,
  won: false,
  spawnTimer: 0,
  frame: 0,
};

function fishBest(){
  try { return parseInt(localStorage.getItem(FISH_CONFIG.bestKey)||'0',10)||0; }
  catch(e){ return 0; }
}
function fishSaveBest(v){
  try { localStorage.setItem(FISH_CONFIG.bestKey, String(v)); } catch(e){}
}

function fishRand(a, b){ return a + Math.random()*(b-a); }
function fishRandi(a, b){ return Math.floor(fishRand(a, b)); }

function fishInitState(){
  fishState.player.x = FISH_W/2;
  fishState.player.y = FISH_H/2;
  fishState.player.size = FISH_CONFIG.startSize;
  fishState.player.dirX = 1;
  fishState.player.wobble = 0;
  fishState.fishes.length = 0;
  fishState.bubbles.length = 0;
  fishState.particles.length = 0;
  fishState.score = 0;
  fishState.eaten = 0;
  fishState.gameOver = false;
  fishState.won = false;
  fishState.spawnTimer = 0;
  fishState.frame = 0;
  // Pre-populate so the ocean isn't empty
  for(let i=0;i<8;i++) fishSpawnOne(true);
  for(let i=0;i<30;i++) fishState.bubbles.push(fishMakeBubble(true));
}

function fishMakeBubble(initial){
  return {
    x: Math.random()*FISH_W,
    y: initial ? Math.random()*FISH_H : FISH_H + 8,
    r: fishRand(1.2, 3.8),
    v: fishRand(0.3, 1.0),
    drift: fishRand(-0.2, 0.2),
    a: fishRand(0.15, 0.45),
  };
}

function fishSpawnOne(initial){
  if(fishState.fishes.length >= FISH_CONFIG.maxFish) return;
  const fromLeft = Math.random() < 0.5;
  const playerSize = fishState.player.size;
  // Bias spawn size around player so the game stays exciting
  // 50% smaller (edible), 35% bigger (danger), 15% very small (easy snack)
  let size;
  const r = Math.random();
  if(r < 0.5){
    size = fishRand(playerSize*0.45, playerSize*0.88);
  } else if(r < 0.85){
    size = fishRand(playerSize*1.12, playerSize*1.7);
  } else {
    size = fishRand(7, Math.max(9, playerSize*0.35));
  }
  size = Math.max(6, Math.min(size, 110));
  const speed = fishRand(FISH_CONFIG.fishSpeedMin, FISH_CONFIG.fishSpeedMax) * (8/Math.max(6,size)) * 6;
  const dir = fromLeft ? 1 : -1;
  const isBonus = !initial && Math.random() < FISH_CONFIG.bonusChance;
  fishState.fishes.push({
    x: initial ? Math.random()*FISH_W : (fromLeft ? -size*2 : FISH_W + size*2),
    y: fishRand(size, FISH_H - size),
    vx: dir * speed,
    baseY: 0,
    wob: fishRand(0, Math.PI*2),
    wobSpeed: fishRand(0.04, 0.10),
    wobAmp: fishRand(6, 18),
    size,
    color: isBonus ? '#ffcc00' : FISH_PALETTE[fishRandi(0, FISH_PALETTE.length)],
    bonus: isBonus,
  });
  fishState.fishes[fishState.fishes.length-1].baseY = fishState.fishes[fishState.fishes.length-1].y;
}

function fishUpdateHUD(){
  document.getElementById('fishScore').textContent = fishState.score;
  document.getElementById('fishSize').textContent = Math.round(fishState.player.size);
  document.getElementById('fishBest').textContent = fishBest();
  const pct = Math.min(100, (fishState.player.size - FISH_CONFIG.startSize) /
                            (FISH_CONFIG.winSize - FISH_CONFIG.startSize) * 100);
  document.getElementById('fishMeterFill').style.width = Math.max(0, pct) + '%';
}

function fishEndGame(won){
  if(fishState.gameOver) return;
  fishState.gameOver = true;
  fishState.won = won;
  if(won) sfx('fishWin'); else sfx('fishDie');
  const prevBest = fishBest();
  const isNewBest = fishState.score > prevBest;
  if(isNewBest) fishSaveBest(fishState.score);
  const ov = document.getElementById('fishOverlay');
  const ot = document.getElementById('fishOverTitle');
  const os = document.getElementById('fishOverSub');
  document.getElementById('fishOverScore').textContent = fishState.score;
  document.getElementById('fishOverSize').textContent = Math.round(fishState.player.size);
  document.getElementById('fishOverEaten').textContent = fishState.eaten;
  ot.classList.toggle('win', won || isNewBest);
  if(won){
    ot.textContent = 'APEX PREDATOR';
    os.textContent = 'YOU RULE THE DEEP';
  } else if(isNewBest){
    ot.textContent = 'NEW RECORD';
    os.textContent = 'EATEN BY A BIGGER FISH';
  } else {
    ot.textContent = 'EATEN';
    os.textContent = 'SOMETHING BIGGER WAS HUNGRY';
  }
  ov.classList.add('show');
  fishUpdateHUD();
  if(window.posthog) posthog.capture('fish_game_ended', {
    score: fishState.score,
    size: Math.round(fishState.player.size),
    eaten: fishState.eaten,
    won,
    new_best: isNewBest,
  });
}

function fishReset(){
  if(window.posthog) posthog.capture('fish_game_restarted', {
    previous_score: fishState.score,
    previous_size: Math.round(fishState.player.size),
  });
  document.getElementById('fishOverlay').classList.remove('show');
  fishInitState();
  fishUpdateHUD();
  fishLastTime = performance.now();
}

// ── INPUT ──
function fishOnMouseMove(e){
  const rect = fishCanvas.getBoundingClientRect();
  const sx = FISH_W / rect.width;
  const sy = FISH_H / rect.height;
  fishState.mouse.x = (e.clientX - rect.left) * sx;
  fishState.mouse.y = (e.clientY - rect.top)  * sy;
  fishState.mouse.inside = true;
}
function fishOnMouseLeave(){ fishState.mouse.inside = false; }
function fishOnTouchMove(e){
  if(!e.touches || !e.touches[0]) return;
  const t = e.touches[0];
  const rect = fishCanvas.getBoundingClientRect();
  const sx = FISH_W / rect.width;
  const sy = FISH_H / rect.height;
  fishState.mouse.x = (t.clientX - rect.left) * sx;
  fishState.mouse.y = (t.clientY - rect.top)  * sy;
  fishState.mouse.inside = true;
  e.preventDefault();
}

// ── SIM ──
function fishStepPlayer(){
  if(!fishState.mouse.inside) return;
  const p = fishState.player;
  const dx = fishState.mouse.x - p.x;
  const dy = fishState.mouse.y - p.y;
  // velocity with clamp
  let vx = dx * FISH_CONFIG.followLerp;
  let vy = dy * FISH_CONFIG.followLerp;
  const mag = Math.hypot(vx, vy);
  const max = FISH_CONFIG.playerMaxStep;
  if(mag > max){ vx = vx/mag*max; vy = vy/mag*max; }
  p.x += vx; p.y += vy;
  if(Math.abs(vx) > 0.4) p.dirX = vx > 0 ? 1 : -1;
  p.wobble += 0.15 + Math.min(0.3, mag*0.04);
  // clamp inside canvas
  const r = p.size;
  if(p.x < r) p.x = r;
  if(p.x > FISH_W - r) p.x = FISH_W - r;
  if(p.y < r) p.y = r;
  if(p.y > FISH_H - r) p.y = FISH_H - r;
}

function fishStepFishes(){
  for(let i=fishState.fishes.length-1; i>=0; i--){
    const f = fishState.fishes[i];
    f.x += f.vx;
    f.wob += f.wobSpeed;
    f.y = f.baseY + Math.sin(f.wob) * f.wobAmp;
    // remove off-screen
    if(f.vx > 0 && f.x > FISH_W + f.size*3) { fishState.fishes.splice(i,1); continue; }
    if(f.vx < 0 && f.x < -f.size*3)         { fishState.fishes.splice(i,1); continue; }
  }
}

function fishCheckCollisions(){
  const p = fishState.player;
  for(let i=fishState.fishes.length-1; i>=0; i--){
    const f = fishState.fishes[i];
    const dx = f.x - p.x, dy = f.y - p.y;
    const d = Math.hypot(dx, dy);
    if(d > (f.size + p.size) * 0.78) continue;

    if(f.bonus){
      // bonus is always eaten regardless of size
      p.size += FISH_CONFIG.bonusBoost;
      fishState.score += FISH_CONFIG.bonusScore;
      fishState.eaten++;
      fishBurst(f.x, f.y, '#ffcc00', 24);
      sfx('fishBonus');
      fishState.fishes.splice(i, 1);
    } else if(f.size < p.size * FISH_CONFIG.eatRatio){
      // edible
      const ratio = f.size / p.size;
      let grow = FISH_CONFIG.growPerEat * (0.5 + ratio);
      grow = Math.max(FISH_CONFIG.growMin, Math.min(FISH_CONFIG.growMax, grow));
      p.size += grow;
      const pts = Math.max(1, Math.round(f.size));
      fishState.score += pts;
      fishState.eaten++;
      fishBurst(f.x, f.y, f.color, 12);
      sfx('fishEat');
      fishState.fishes.splice(i, 1);
      if(p.size >= FISH_CONFIG.winSize){
        fishUpdateHUD();
        fishEndGame(true);
        return;
      }
    } else if(f.size > p.size * FISH_CONFIG.killRatio){
      // lethal
      fishBurst(p.x, p.y, '#ff3060', 36);
      fishEndGame(false);
      return;
    }
    // similar size → harmless bump (no effect)
  }
  fishUpdateHUD();
}

function fishBurst(x, y, color, count){
  for(let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2;
    const v = fishRand(1.2, 4.5);
    fishState.particles.push({
      x, y,
      vx: Math.cos(a)*v,
      vy: Math.sin(a)*v - 0.5,
      life: fishRandi(20, 40),
      color,
    });
  }
}

function fishStepParticles(){
  for(let i=fishState.particles.length-1; i>=0; i--){
    const p = fishState.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.vx *= 0.97;
    p.life--;
    if(p.life <= 0) fishState.particles.splice(i, 1);
  }
}

function fishStepBubbles(){
  for(let i=fishState.bubbles.length-1; i>=0; i--){
    const b = fishState.bubbles[i];
    b.y -= b.v;
    b.x += b.drift;
    if(b.y < -8) fishState.bubbles.splice(i, 1);
  }
  // top up
  while(fishState.bubbles.length < 30){
    fishState.bubbles.push(fishMakeBubble(false));
  }
}

function fishTick(dt){
  if(fishState.gameOver) return;
  fishState.frame++;
  fishStepPlayer();
  fishStepFishes();
  fishStepBubbles();
  fishStepParticles();
  fishCheckCollisions();

  fishState.spawnTimer += dt;
  if(fishState.spawnTimer >= FISH_CONFIG.spawnEveryMs){
    fishState.spawnTimer = 0;
    fishSpawnOne(false);
  }
}

// ── DRAW ──
function fishDrawBg(){
  const ctx = fishCtx;
  // base gradient
  const g = ctx.createLinearGradient(0, 0, 0, FISH_H);
  g.addColorStop(0, '#021428');
  g.addColorStop(0.55, '#01101f');
  g.addColorStop(1, '#000810');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FISH_W, FISH_H);
  // light rays
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i=0;i<3;i++){
    const x = (i*FISH_W/3) + Math.sin(fishState.frame*0.003 + i)*40;
    const rg = ctx.createLinearGradient(x, 0, x + 60, FISH_H);
    rg.addColorStop(0, 'rgba(0,180,255,0.06)');
    rg.addColorStop(1, 'rgba(0,180,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x-30, 0);
    ctx.lineTo(x+90, 0);
    ctx.lineTo(x+220, FISH_H);
    ctx.lineTo(x-160, FISH_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function fishDrawBubbles(){
  const ctx = fishCtx;
  for(const b of fishState.bubbles){
    ctx.save();
    ctx.globalAlpha = b.a;
    ctx.strokeStyle = 'rgba(180,230,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function fishDrawFishShape(ctx, x, y, size, dirX, color, wob, halo){
  // body ellipse + triangular tail + eye
  const len = size*1.7;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dirX, 1);
  ctx.rotate(Math.sin(wob)*0.05);
  // halo / outline
  if(halo){
    ctx.shadowColor = halo;
    ctx.shadowBlur = 14;
  }
  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, len*0.45, size*0.6, 0, 0, Math.PI*2);
  ctx.fill();
  // tail (animated)
  const tailWob = Math.sin(wob*2) * size * 0.15;
  ctx.beginPath();
  ctx.moveTo(-len*0.4, 0);
  ctx.lineTo(-len*0.75, -size*0.5 + tailWob);
  ctx.lineTo(-len*0.75,  size*0.5 + tailWob);
  ctx.closePath();
  ctx.fill();
  // top fin
  ctx.beginPath();
  ctx.moveTo(-size*0.1, -size*0.5);
  ctx.quadraticCurveTo(0, -size*1.0, size*0.25, -size*0.45);
  ctx.closePath();
  ctx.fill();
  // belly highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, size*0.18, len*0.3, size*0.22, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // eye white
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(len*0.28, -size*0.12, size*0.16, 0, Math.PI*2);
  ctx.fill();
  // pupil
  ctx.fillStyle = '#020810';
  ctx.beginPath();
  ctx.arc(len*0.32, -size*0.12, size*0.08, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function fishDrawFishes(){
  const p = fishState.player;
  for(const f of fishState.fishes){
    let halo = null;
    if(f.bonus){
      halo = '#ffcc00';
    } else if(f.size < p.size * FISH_CONFIG.eatRatio){
      halo = 'rgba(0,255,136,0.7)';
    } else if(f.size > p.size * FISH_CONFIG.killRatio){
      halo = 'rgba(255,48,96,0.7)';
    } else {
      halo = 'rgba(255,200,0,0.4)';
    }
    const dir = f.vx >= 0 ? 1 : -1;
    fishDrawFishShape(fishCtx, f.x, f.y, f.size, dir, f.color, f.wob, halo);
  }
}

function fishDrawPlayer(){
  const p = fishState.player;
  // glow ring under player
  const ctx = fishCtx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createRadialGradient(p.x, p.y, p.size*0.4, p.x, p.y, p.size*2.2);
  rg.addColorStop(0, 'rgba(0,245,255,0.35)');
  rg.addColorStop(1, 'rgba(0,245,255,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size*2.2, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  fishDrawFishShape(ctx, p.x, p.y, p.size, p.dirX, '#00f5ff', p.wobble, '#00f5ff');
}

function fishDrawParticles(){
  const ctx = fishCtx;
  for(const p of fishState.particles){
    const a = Math.max(0, p.life / 40);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + a*2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function fishDrawCursor(){
  if(!fishState.mouse.inside) return;
  const ctx = fishCtx;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,245,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(fishState.mouse.x, fishState.mouse.y, 5, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function fishDraw(){
  fishDrawBg();
  fishDrawBubbles();
  fishDrawFishes();
  fishDrawPlayer();
  fishDrawParticles();
  fishDrawCursor();
}

// ── LOOP ──
let fishRaf = null;
let fishLastTime = 0;

function fishGameLoop(ts){
  const dt = Math.min(ts - fishLastTime, 100);
  fishLastTime = ts;
  fishTick(dt);
  fishDraw();
  fishRaf = requestAnimationFrame(fishGameLoop);
}

// ── LIFECYCLE ──
registerGame('fish', {
  init(){
    fishInitState();
    fishUpdateHUD();
    document.getElementById('fishOverlay').classList.remove('show');
    fishCanvas.addEventListener('mousemove', fishOnMouseMove);
    fishCanvas.addEventListener('mouseleave', fishOnMouseLeave);
    fishCanvas.addEventListener('touchmove', fishOnTouchMove, { passive: false });
    fishLastTime = performance.now();
    if(!fishRaf) fishRaf = requestAnimationFrame(fishGameLoop);
    if(window.posthog) posthog.capture('fish_game_started', {});
  },
  cleanup(){
    fishCanvas.removeEventListener('mousemove', fishOnMouseMove);
    fishCanvas.removeEventListener('mouseleave', fishOnMouseLeave);
    fishCanvas.removeEventListener('touchmove', fishOnTouchMove);
    if(fishRaf){ cancelAnimationFrame(fishRaf); fishRaf = null; }
  },
});
