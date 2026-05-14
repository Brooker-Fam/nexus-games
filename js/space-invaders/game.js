// ── SPACE INVADERS ──
// Scaffold only — no gameplay yet.
// Follow-up hoglets will add Player, Invaders, Bullets, collisions, etc.

const siCanvas = document.getElementById('siCanvas');
const siCtx = siCanvas.getContext('2d');
const SI_W = siCanvas.width, SI_H = siCanvas.height;

const SI_CONFIG = {
  targetHz: 60,
  targetMs: 1000 / 60,
  maxFrameMs: 100,   // clamp dt spikes (tab switch, breakpoint, etc.)
};

// Game state — Game object with entity arrays so the next hoglet can
// drop in Player, Invaders, Bullets cleanly.
const Game = {
  state: 'running',  // 'running' | 'paused' | 'gameover'
  ticks: 0,
  time: 0,           // seconds accumulated via fixed step
  player: null,
  invaders: [],
  bullets: [],
  particles: [],
  score: 0,
  lives: 3,
};

// Input — code-based so it's layout-independent.
const keys = Object.create(null);

function siOnKeyDown(e){
  keys[e.code] = true;
  if(e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space'){
    e.preventDefault();
  }
}
function siOnKeyUp(e){
  keys[e.code] = false;
}

// ── UPDATE / RENDER STUBS ──
// Next hoglet: split these into module functions (updatePlayer, updateInvaders, ...).

function update(dt){
  // dt is in seconds, fixed step (~1/60 s).
  Game.ticks++;
  Game.time += dt;
  // TODO: updatePlayer(dt, keys);
  // TODO: updateInvaders(dt);
  // TODO: updateBullets(dt);
  // TODO: collisions();
}

function render(ctx){
  // Background — deep space.
  ctx.fillStyle = '#020810';
  ctx.fillRect(0, 0, SI_W, SI_H);

  // Faint starfield-ish grid to prove draw is alive.
  ctx.strokeStyle = 'rgba(0,245,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let x = 0; x <= SI_W; x += 40){
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, SI_H);
  }
  for(let y = 0; y <= SI_H; y += 40){
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(SI_W, y + 0.5);
  }
  ctx.stroke();

  // Title — proves loop+render works.
  ctx.save();
  ctx.fillStyle = '#00f5ff';
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 24;
  ctx.font = '700 48px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPACE INVADERS', SI_W / 2, SI_H / 2 - 20);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(232,244,255,0.6)';
  ctx.font = '400 14px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCAFFOLD — GAMEPLAY COMING NEXT', SI_W / 2, SI_H / 2 + 18);
  ctx.fillText('← →  MOVE     SPACE  FIRE', SI_W / 2, SI_H / 2 + 40);
  ctx.restore();

  // FPS counter — proves the loop is running and the dt math is sane.
  ctx.save();
  ctx.fillStyle = 'rgba(0,255,136,0.9)';
  ctx.font = '600 12px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('FPS: ' + siFpsDisplay.toFixed(0), 12, 10);
  ctx.fillText('TICK: ' + Game.ticks, 12, 26);
  ctx.restore();
}

// ── GAME LOOP ──
// Fixed timestep (60 Hz) with a delta-time accumulator, decoupled from render.
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

  if(Game.state === 'running'){
    siAccum += dt;
    while(siAccum >= SI_CONFIG.targetMs){
      update(SI_CONFIG.targetMs / 1000);
      siAccum -= SI_CONFIG.targetMs;
    }
  }

  // FPS rolling average over ~0.5s windows.
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
    document.addEventListener('keydown', siOnKeyDown);
    document.addEventListener('keyup', siOnKeyUp);
    siStart();
  },
  cleanup(){
    document.removeEventListener('keydown', siOnKeyDown);
    document.removeEventListener('keyup', siOnKeyUp);
    siStop();
  },
});
