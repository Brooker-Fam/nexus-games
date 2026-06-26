// ── NEXUS SNAKE ──
const snakeCanvas = document.getElementById('snakeCanvas');
const snakeCtx = snakeCanvas.getContext('2d');
const SNAKE_W = snakeCanvas.width, SNAKE_H = snakeCanvas.height;

const SNAKE_CONFIG = {
  cell: 24,
  cols: 30,
  rows: 20,
  startLen: 3,
  baseMoveTicks: 10,    // ticks between moves at 1× (60 Hz → ~167 ms/move)
  moveTickFloor: 3,     // fastest move cadence
  moveTickShave: 0.4,   // ticks shaved per food eaten
  bestKey: 'nexus_snake_best',
};

const SNAKE_DEFAULTS = {
  snake: [],            // [{x, y}, ...] head first
  dir:    {x: 1, y: 0},
  nextDir:{x: 1, y: 0},
  food:   null,
  score: 0,
  length: SNAKE_CONFIG.startLen,
  speed: 1,             // 1× / 2× / 3× UI multiplier
  moveInterval: SNAKE_CONFIG.baseMoveTicks,
  moveTimer: SNAKE_CONFIG.baseMoveTicks,
  gameOver: false,
  frame: 0,
};

let snakeState = {...SNAKE_DEFAULTS, snake: []};

function snakeBest(){
  try { return parseInt(localStorage.getItem(SNAKE_CONFIG.bestKey)||'0',10)||0; }
  catch(e){ return 0; }
}
function snakeSaveBest(v){
  try { localStorage.setItem(SNAKE_CONFIG.bestKey, String(v)); } catch(e){}
}

function snakeInitState(){
  const cx = Math.floor(SNAKE_CONFIG.cols/2);
  const cy = Math.floor(SNAKE_CONFIG.rows/2);
  const snake = [];
  for(let i=0;i<SNAKE_CONFIG.startLen;i++) snake.push({x:cx-i, y:cy});
  snakeState = {
    ...SNAKE_DEFAULTS,
    snake,
    dir:    {x:1, y:0},
    nextDir:{x:1, y:0},
    moveInterval: SNAKE_CONFIG.baseMoveTicks,
    moveTimer:    SNAKE_CONFIG.baseMoveTicks,
    speed: snakeState.speed || 1,  // preserve speed across resets
  };
  snakeSpawnFood();
}

function snakeSpawnFood(){
  const occupied = new Set(snakeState.snake.map(s=>s.x+','+s.y));
  let x, y, tries=0;
  do {
    x = Math.floor(Math.random()*SNAKE_CONFIG.cols);
    y = Math.floor(Math.random()*SNAKE_CONFIG.rows);
    tries++;
  } while(occupied.has(x+','+y) && tries<200);
  snakeState.food = {x, y};
}

function snakeUpdateHUD(){
  document.getElementById('snakeScore').textContent = snakeState.score;
  document.getElementById('snakeLen').textContent = snakeState.snake.length;
  document.getElementById('snakeBest').textContent = snakeBest();
}

function snakeStep(){
  // commit queued direction (already validated against 180° at input time)
  snakeState.dir = snakeState.nextDir;
  const head = snakeState.snake[0];
  const nx = head.x + snakeState.dir.x;
  const ny = head.y + snakeState.dir.y;

  // wall collision
  if(nx<0 || ny<0 || nx>=SNAKE_CONFIG.cols || ny>=SNAKE_CONFIG.rows){
    snakeEndGame('wall'); return;
  }
  // self collision (skip tail tip since it will move away — unless we just ate)
  const ateFood = snakeState.food && nx===snakeState.food.x && ny===snakeState.food.y;
  const bodyToCheck = ateFood ? snakeState.snake : snakeState.snake.slice(0, -1);
  if(bodyToCheck.some(s=>s.x===nx && s.y===ny)){
    snakeEndGame('self'); return;
  }

  snakeState.snake.unshift({x:nx, y:ny});

  if(ateFood){
    const lenBonus = 1 + Math.floor(snakeState.snake.length / 10);
    snakeState.score += lenBonus;
    snakeState.moveInterval = Math.max(
      SNAKE_CONFIG.moveTickFloor,
      snakeState.moveInterval - SNAKE_CONFIG.moveTickShave
    );
    sfx('snakeEat');
    snakeSpawnFood();
    snakeUpdateHUD();
    if(window.posthog) posthog.capture('snake_food_eaten', {
      score: snakeState.score,
      length: snakeState.snake.length,
    });
  } else {
    snakeState.snake.pop();
  }
}

function snakeTick(){
  if(snakeState.gameOver) return;
  snakeState.frame++;
  snakeState.moveTimer--;
  if(snakeState.moveTimer <= 0){
    snakeStep();
    snakeState.moveTimer = snakeState.moveInterval;
  }
}

function snakeEndGame(cause){
  snakeState.gameOver = true;
  sfx('snakeDie');
  const score = snakeState.score;
  const len = snakeState.snake.length;
  const prevBest = snakeBest();
  let isNewBest = false;
  if(score > prevBest){ snakeSaveBest(score); isNewBest = true; }
  const ov = document.getElementById('snakeOverlay');
  const ot = document.getElementById('snakeOverlayTitle');
  const os = document.getElementById('snakeOverlaySub');
  ov.classList.add('show');
  ot.className = 'overlay-title ' + (isNewBest ? 'win' : 'lose');
  ot.textContent = isNewBest ? 'NEW RECORD' : 'GAME OVER';
  os.textContent = `SCORE: ${score} — LENGTH: ${len}`;
  snakeUpdateHUD();
  if(window.posthog) posthog.capture('snake_game_ended', {
    score, length: len, cause, new_best: isNewBest,
  });
}

function snakeReset(){
  if(window.posthog) posthog.capture('snake_game_restarted', {
    previous_score: snakeState.score,
    previous_length: snakeState.snake.length,
  });
  document.getElementById('snakeOverlay').classList.remove('show');
  snakeInitState();
  snakeUpdateHUD();
  snakeLastTime = performance.now();
  snakeAccum = 0;
}

function snakeSetSpeed(s, btn){
  snakeState.speed = s;
  const grp = btn.parentElement;
  grp.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// ── INPUT ──
function snakeOnKey(e){
  if(snakeState.gameOver){
    if(e.key==='Enter' || e.key===' '){ snakeReset(); e.preventDefault(); }
    return;
  }
  let nd = null;
  switch(e.key){
    case 'ArrowUp': case 'w': case 'W':    nd = {x: 0, y:-1}; break;
    case 'ArrowDown': case 's': case 'S':  nd = {x: 0, y: 1}; break;
    case 'ArrowLeft': case 'a': case 'A':  nd = {x:-1, y: 0}; break;
    case 'ArrowRight': case 'd': case 'D': nd = {x: 1, y: 0}; break;
  }
  if(!nd) return;
  // disallow 180° turn against current committed direction
  const cur = snakeState.dir;
  if(nd.x === -cur.x && nd.y === -cur.y) return;
  if(nd.x === snakeState.nextDir.x && nd.y === snakeState.nextDir.y) return;
  snakeState.nextDir = nd;
  e.preventDefault();
}

// ── DRAW ──
function snakeDrawBg(){
  const ctx = snakeCtx;
  ctx.fillStyle = '#020810';
  ctx.fillRect(0, 0, SNAKE_W, SNAKE_H);
  // faint cyan grid
  ctx.strokeStyle = 'rgba(0,245,255,0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let x=0; x<=SNAKE_CONFIG.cols; x++){
    ctx.moveTo(x*SNAKE_CONFIG.cell+0.5, 0);
    ctx.lineTo(x*SNAKE_CONFIG.cell+0.5, SNAKE_H);
  }
  for(let y=0; y<=SNAKE_CONFIG.rows; y++){
    ctx.moveTo(0, y*SNAKE_CONFIG.cell+0.5);
    ctx.lineTo(SNAKE_W, y*SNAKE_CONFIG.cell+0.5);
  }
  ctx.stroke();
}

function snakeDrawFood(){
  if(!snakeState.food) return;
  const ctx = snakeCtx;
  const c = SNAKE_CONFIG.cell;
  const cx = snakeState.food.x*c + c/2;
  const cy = snakeState.food.y*c + c/2;
  const pulse = 0.5 + 0.5*Math.sin(snakeState.frame*0.15);
  const r = c*0.32 + pulse*2;
  ctx.save();
  ctx.shadowColor = '#ff0088';
  ctx.shadowBlur = 18;
  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  grad.addColorStop(0, '#ffaadd');
  grad.addColorStop(0.5, '#ff0088');
  grad.addColorStop(1, 'rgba(255,0,136,0.2)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function snakeDrawSnake(){
  const ctx = snakeCtx;
  const c = SNAKE_CONFIG.cell;
  const segs = snakeState.snake;
  for(let i=segs.length-1; i>=0; i--){
    const s = segs[i];
    const x = s.x*c, y = s.y*c;
    const t = i / Math.max(segs.length-1, 1); // 0 head → 1 tail
    // gradient: bright cyan head → deep blue tail
    const r = Math.round(0   + (0  -0)   *t);
    const g = Math.round(245 + (80 -245) *t);
    const b = Math.round(255 + (200-255) *t);
    const color = `rgb(${r},${g},${b})`;
    ctx.save();
    if(i===0){
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 16;
    } else {
      ctx.shadowColor = 'rgba(0,245,255,0.3)';
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = color;
    const pad = i===0 ? 1 : 2;
    ctx.fillRect(x+pad, y+pad, c-pad*2, c-pad*2);
    ctx.restore();
    // eyes on head
    if(i===0){
      ctx.fillStyle = '#020810';
      const cx = x + c/2, cy = y + c/2;
      const ex = snakeState.dir.x, ey = snakeState.dir.y;
      // two eyes offset perpendicular to direction
      const px = -ey, py = ex; // perpendicular
      const off = c*0.18;
      const fwd = c*0.18;
      ctx.beginPath();
      ctx.arc(cx + ex*fwd + px*off, cy + ey*fwd + py*off, 2, 0, Math.PI*2);
      ctx.arc(cx + ex*fwd - px*off, cy + ey*fwd - py*off, 2, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function snakeDraw(){
  snakeDrawBg();
  snakeDrawFood();
  snakeDrawSnake();
}

// ── GAME LOOP ──
const SNAKE_TARGET_MS = 1000/60;
let snakeRaf = null;
let snakeLastTime = 0;
let snakeAccum = 0;

function snakeGameLoop(ts){
  const dt = Math.min(ts - snakeLastTime, 100);
  snakeLastTime = ts;
  if(!snakeState.gameOver){
    snakeAccum += dt * snakeState.speed;
    while(snakeAccum >= SNAKE_TARGET_MS){
      snakeTick();
      snakeAccum -= SNAKE_TARGET_MS;
    }
  }
  snakeDraw();
  snakeRaf = requestAnimationFrame(snakeGameLoop);
}

// ── LIFECYCLE ──
registerGame('snake', {
  init(){
    snakeInitState();
    snakeUpdateHUD();
    document.getElementById('snakeOverlay').classList.remove('show');
    document.addEventListener('keydown', snakeOnKey);
    snakeLastTime = performance.now();
    snakeAccum = 0;
    if(!snakeRaf) snakeRaf = requestAnimationFrame(snakeGameLoop);
    if(window.posthog) posthog.capture('snake_game_started', {});
  },
  cleanup(){
    document.removeEventListener('keydown', snakeOnKey);
    if(snakeRaf){ cancelAnimationFrame(snakeRaf); snakeRaf = null; }
  },
});

//# sourceMappingURL=game.js.map
