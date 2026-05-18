// ── ATARI PONG ──
/*
  Pong survey hook events for future PostHog Surveys wiring.
  Subscribe with: window.addEventListener('pong:event', handler)
  All events are dispatched as:
    window.dispatchEvent(new CustomEvent('pong:event', { detail: { type, ...payload } }))

  Event detail payloads:
  - { type: 'first_visit' } on first ever Pong load, guarded by localStorage flag `pong_visited`.
  - { type: 'mode_selected', mode: '1p' | '2p' } when a player chooses the mode.
  - { type: 'game_over', winner, mode, difficulty?, score } when a round reaches the win score.
  - { type: 'returned_to_menu', rounds_played } when the user backs out to the Pong menu.
  - { type: 'pause_or_idle', reason } after 60s idle on a Pong menu screen or when gameplay is paused.
*/

const pongCanvas = document.getElementById('pongCanvas');
const pongCtx = pongCanvas.getContext('2d');
const PONG_W = pongCanvas.width;
const PONG_H = pongCanvas.height;

const PONG_WIN_SCORE = 7;
const PONG_TARGET_MS = 1000 / 60;
const PONG_IDLE_MS = 60000;

const PONG_CONFIG = {
  paddleW: 14,
  paddleH: 86,
  paddleInset: 34,
  humanSpeed: 520,
  ballSize: 14,
  serveSpeed: 360,
  speedUp: 1.045,
  maxBallSpeed: 760,
};

const PONG_DIFFICULTIES = {
  easy: {
    label: 'Easy',
    aiSpeed: 235,
    reactionDelay: 0.38,
    trackingError: 96,
    jitter: 52,
    missChance: 0.34,
    description: 'Slow reaction · frequent misses',
  },
  medium: {
    label: 'Medium',
    aiSpeed: 345,
    reactionDelay: 0.2,
    trackingError: 42,
    jitter: 24,
    missChance: 0.15,
    description: 'Moderate tracking · occasional misses',
  },
  hard: {
    label: 'Hard',
    aiSpeed: 485,
    reactionDelay: 0.08,
    trackingError: 14,
    jitter: 8,
    missChance: 0.04,
    description: 'Fast reaction · rare misses',
  },
};

let pongRaf = null;
let pongLastTime = 0;
let pongAccum = 0;
let pongSessionRoundsPlayed = 0;
let pongIdleTimer = null;
let pongPauseTimer = null;

let pongState = {
  screen: 'mode',
  mode: null,
  difficulty: null,
  leftScore: 0,
  rightScore: 0,
  winner: null,
  rally: 0,
  frame: 0,
  keys: {
    leftUp: false,
    leftDown: false,
    rightUp: false,
    rightDown: false,
  },
  leftPaddle: { y: PONG_H / 2 - PONG_CONFIG.paddleH / 2, vy: 0 },
  rightPaddle: { y: PONG_H / 2 - PONG_CONFIG.paddleH / 2, vy: 0 },
  ball: {
    x: PONG_W / 2 - PONG_CONFIG.ballSize / 2,
    y: PONG_H / 2 - PONG_CONFIG.ballSize / 2,
    vx: PONG_CONFIG.serveSpeed,
    vy: 0,
    speed: PONG_CONFIG.serveSpeed,
  },
};

let pongAi = {
  targetY: PONG_H / 2,
  reactionTimer: 0,
  rallyMistake: 0,
  jitterSeed: Math.random() * 1000,
};

function pongDispatchEvent(type, payload){
  const detail = Object.assign({ type }, payload || {});
  window.dispatchEvent(new CustomEvent('pong:event', { detail }));
}

function pongCheckFirstVisit(){
  let shouldDispatch = false;
  try {
    if(localStorage.getItem('pong_visited') !== '1'){
      localStorage.setItem('pong_visited', '1');
      shouldDispatch = true;
    }
  } catch(e){
    if(!window.__pongVisitedFallback){
      window.__pongVisitedFallback = true;
      shouldDispatch = true;
    }
  }
  if(shouldDispatch) pongDispatchEvent('first_visit');
}

function pongEls(){
  return {
    overlay: document.getElementById('pongOverlay'),
    title: document.getElementById('pongOverlayTitle'),
    sub: document.getElementById('pongOverlaySub'),
    modeMenu: document.getElementById('pongModeMenu'),
    difficultyMenu: document.getElementById('pongDifficultyMenu'),
    gameOverMenu: document.getElementById('pongGameOverMenu'),
    leftScore: document.getElementById('pongLeftScore'),
    rightScore: document.getElementById('pongRightScore'),
    mode: document.getElementById('pongModeStat'),
    difficulty: document.getElementById('pongDifficultyStat'),
    status: document.getElementById('pongStatusLine'),
  };
}

function pongClearTimers(){
  if(pongIdleTimer){ clearTimeout(pongIdleTimer); pongIdleTimer = null; }
  if(pongPauseTimer){ clearTimeout(pongPauseTimer); pongPauseTimer = null; }
}

function pongIsMenuScreen(){
  return pongState.screen === 'mode' || pongState.screen === 'difficulty' || pongState.screen === 'gameover';
}

function pongNoteMenuInput(){
  if(pongIsMenuScreen()) pongArmMenuIdleTimer();
}

function pongArmMenuIdleTimer(){
  if(pongIdleTimer) clearTimeout(pongIdleTimer);
  pongIdleTimer = setTimeout(function(){
    if(pongIsMenuScreen()){
      pongDispatchEvent('pause_or_idle', { reason: 'menu_idle' });
    }
  }, PONG_IDLE_MS);
}

function pongArmPauseTimer(){
  if(pongPauseTimer) clearTimeout(pongPauseTimer);
  pongPauseTimer = setTimeout(function(){
    if(pongState.screen === 'paused'){
      pongDispatchEvent('pause_or_idle', { reason: 'pause' });
    }
  }, PONG_IDLE_MS);
}

function pongShowMenuScreen(screen){
  const els = pongEls();
  pongState.screen = screen;
  els.overlay.classList.add('show');
  els.modeMenu.classList.toggle('hidden', screen !== 'mode');
  els.difficultyMenu.classList.toggle('hidden', screen !== 'difficulty');
  els.gameOverMenu.classList.toggle('hidden', screen !== 'gameover');

  if(screen === 'mode'){
    els.title.textContent = 'PONG';
    els.sub.textContent = 'SELECT MODE';
    els.status.textContent = 'MENU';
  } else if(screen === 'difficulty'){
    els.title.textContent = '1 PLAYER';
    els.sub.textContent = 'SELECT AI DIFFICULTY';
    els.status.textContent = 'CHOOSE DIFFICULTY';
  } else if(screen === 'gameover'){
    els.title.textContent = pongWinnerTitle();
    els.sub.textContent = 'FINAL SCORE ' + pongState.leftScore + ' - ' + pongState.rightScore;
    els.status.textContent = 'ROUND COMPLETE';
  }

  pongClearTimers();
  pongArmMenuIdleTimer();
  pongUpdateHUD();
}

function pongWinnerTitle(){
  return pongState.winner ? pongState.winner.toUpperCase() + ' WINS' : 'GAME OVER';
}

function pongShowPause(){
  const els = pongEls();
  pongState.screen = 'paused';
  els.overlay.classList.add('show');
  els.modeMenu.classList.add('hidden');
  els.difficultyMenu.classList.add('hidden');
  els.gameOverMenu.classList.add('hidden');
  els.title.textContent = 'PAUSED';
  els.sub.textContent = 'PRESS P TO RESUME';
  els.status.textContent = 'PAUSED';
  pongClearTimers();
  pongArmPauseTimer();
}

function pongHideOverlay(){
  const els = pongEls();
  els.overlay.classList.remove('show');
  els.modeMenu.classList.add('hidden');
  els.difficultyMenu.classList.add('hidden');
  els.gameOverMenu.classList.add('hidden');
  pongClearTimers();
}

function pongUpdateHUD(){
  const els = pongEls();
  els.leftScore.textContent = pongState.leftScore;
  els.rightScore.textContent = pongState.rightScore;
  els.mode.textContent = pongState.mode ? pongState.mode.toUpperCase() : '—';
  els.difficulty.textContent = pongState.mode === '1p' && pongState.difficulty
    ? PONG_DIFFICULTIES[pongState.difficulty].label.toUpperCase()
    : (pongState.mode === '2p' ? 'LOCAL' : '—');
}

function pongResetPositions(){
  pongState.leftPaddle.y = PONG_H / 2 - PONG_CONFIG.paddleH / 2;
  pongState.rightPaddle.y = PONG_H / 2 - PONG_CONFIG.paddleH / 2;
  pongState.leftPaddle.vy = 0;
  pongState.rightPaddle.vy = 0;
}

function pongServe(direction){
  const angle = (Math.random() * 0.7 - 0.35);
  const dir = direction || (Math.random() < 0.5 ? -1 : 1);
  const speed = PONG_CONFIG.serveSpeed;
  pongState.ball.x = PONG_W / 2 - PONG_CONFIG.ballSize / 2;
  pongState.ball.y = PONG_H / 2 - PONG_CONFIG.ballSize / 2;
  pongState.ball.speed = speed;
  pongState.ball.vx = Math.cos(angle) * speed * dir;
  pongState.ball.vy = Math.sin(angle) * speed;
  pongState.rally++;
  pongAi.reactionTimer = 0;
  pongAi.targetY = PONG_H / 2;
  pongAi.jitterSeed = Math.random() * 1000;
  pongAi.rallyMistake = 0;
  if(pongState.mode === '1p'){
    const diff = PONG_DIFFICULTIES[pongState.difficulty];
    if(Math.random() < diff.missChance){
      pongAi.rallyMistake = (Math.random() < 0.5 ? -1 : 1) * (PONG_CONFIG.paddleH * (0.85 + Math.random() * 0.65));
    }
  }
}

function pongSelectMode(mode){
  pongState.mode = mode;
  pongState.difficulty = null;
  pongDispatchEvent('mode_selected', { mode });
  if(mode === '1p'){
    pongShowMenuScreen('difficulty');
  } else {
    pongStartGame('2p');
  }
}

function pongSelectDifficulty(difficulty){
  pongStartGame('1p', difficulty);
}

function pongStartGame(mode, difficulty){
  pongState.mode = mode;
  pongState.difficulty = mode === '1p' ? difficulty : null;
  pongState.leftScore = 0;
  pongState.rightScore = 0;
  pongState.winner = null;
  pongState.screen = 'playing';
  pongResetPositions();
  pongServe(Math.random() < 0.5 ? -1 : 1);
  pongHideOverlay();
  pongUpdateHUD();
  pongEls().status.textContent = mode === '1p' ? 'PLAYER VS AI' : 'LOCAL 2 PLAYER';
}

function pongPlayAgain(){
  if(pongState.mode === '1p'){
    pongStartGame('1p', pongState.difficulty || 'medium');
  } else {
    pongStartGame('2p');
  }
}

function pongReturnToMenu(){
  pongState.mode = null;
  pongState.difficulty = null;
  pongState.leftScore = 0;
  pongState.rightScore = 0;
  pongState.winner = null;
  pongResetPositions();
  pongServe(1);
  pongDispatchEvent('returned_to_menu', { rounds_played: pongSessionRoundsPlayed });
  pongShowMenuScreen('mode');
}

function pongTogglePause(){
  if(pongState.screen === 'playing'){
    pongShowPause();
    pongDispatchEvent('pause_or_idle', { reason: 'pause' });
  } else if(pongState.screen === 'paused'){
    pongState.screen = 'playing';
    pongHideOverlay();
    pongEls().status.textContent = pongState.mode === '1p' ? 'PLAYER VS AI' : 'LOCAL 2 PLAYER';
  }
}

function pongEndGame(winner){
  pongState.screen = 'gameover';
  pongState.winner = winner;
  pongSessionRoundsPlayed++;
  const score = { left: pongState.leftScore, right: pongState.rightScore };
  const payload = {
    winner,
    mode: pongState.mode,
    score,
  };
  if(pongState.mode === '1p') payload.difficulty = pongState.difficulty;
  pongShowMenuScreen('gameover');
  pongDispatchEvent('game_over', payload);
}

function pongScore(side){
  if(side === 'left') pongState.leftScore++;
  else pongState.rightScore++;
  pongUpdateHUD();

  if(pongState.leftScore >= PONG_WIN_SCORE){
    pongEndGame('Player 1');
  } else if(pongState.rightScore >= PONG_WIN_SCORE){
    pongEndGame(pongState.mode === '1p' ? 'AI' : 'Player 2');
  } else {
    pongServe(side === 'left' ? 1 : -1);
  }
}

function pongClampPaddle(paddle){
  if(paddle.y < 0) paddle.y = 0;
  if(paddle.y > PONG_H - PONG_CONFIG.paddleH) paddle.y = PONG_H - PONG_CONFIG.paddleH;
}

function pongMoveHumanPaddle(paddle, up, down, dt){
  let dir = 0;
  if(up) dir -= 1;
  if(down) dir += 1;
  paddle.vy = dir * PONG_CONFIG.humanSpeed;
  paddle.y += paddle.vy * dt;
  pongClampPaddle(paddle);
}

function pongPredictBallY(targetX){
  const ball = pongState.ball;
  if(ball.vx <= 0) return PONG_H / 2;
  const seconds = (targetX - (ball.x + PONG_CONFIG.ballSize / 2)) / ball.vx;
  let y = ball.y + PONG_CONFIG.ballSize / 2 + ball.vy * Math.max(0, seconds);
  const limit = PONG_H;
  while(y < 0 || y > limit){
    if(y < 0) y = -y;
    if(y > limit) y = limit - (y - limit);
  }
  return y;
}

function pongUpdateAi(dt){
  const diff = PONG_DIFFICULTIES[pongState.difficulty || 'medium'];
  const paddle = pongState.rightPaddle;
  const targetX = PONG_W - PONG_CONFIG.paddleInset - PONG_CONFIG.paddleW;
  pongAi.reactionTimer -= dt;

  if(pongAi.reactionTimer <= 0){
    if(pongState.ball.vx > 0){
      const trackingNoise = (Math.random() * 2 - 1) * diff.trackingError;
      const wave = Math.sin(pongState.frame * 0.045 + pongAi.jitterSeed) * diff.jitter;
      pongAi.targetY = pongPredictBallY(targetX) + trackingNoise + wave + pongAi.rallyMistake;
    } else {
      const drift = Math.sin(pongState.frame * 0.025 + pongAi.jitterSeed) * diff.jitter;
      pongAi.targetY = PONG_H / 2 + drift;
    }
    pongAi.reactionTimer = diff.reactionDelay;
  }

  const paddleCenter = paddle.y + PONG_CONFIG.paddleH / 2;
  const delta = pongAi.targetY - paddleCenter;
  if(Math.abs(delta) < 5){
    paddle.vy = 0;
  } else {
    paddle.vy = Math.sign(delta) * diff.aiSpeed;
  }
  paddle.y += paddle.vy * dt;
  pongClampPaddle(paddle);
}

function pongRectHit(ball, paddleX, paddleY){
  return ball.x < paddleX + PONG_CONFIG.paddleW &&
    ball.x + PONG_CONFIG.ballSize > paddleX &&
    ball.y < paddleY + PONG_CONFIG.paddleH &&
    ball.y + PONG_CONFIG.ballSize > paddleY;
}

function pongBounceFromPaddle(paddle, side){
  const ball = pongState.ball;
  const paddleCenter = paddle.y + PONG_CONFIG.paddleH / 2;
  const ballCenter = ball.y + PONG_CONFIG.ballSize / 2;
  const impact = Math.max(-1, Math.min(1, (ballCenter - paddleCenter) / (PONG_CONFIG.paddleH / 2)));
  const newSpeed = Math.min(PONG_CONFIG.maxBallSpeed, ball.speed * PONG_CONFIG.speedUp + 8);
  ball.speed = newSpeed;
  ball.vx = Math.cos(impact * 0.85) * newSpeed * side;
  ball.vy = Math.sin(impact * 0.85) * newSpeed;
}

function pongTick(dt){
  if(pongState.screen !== 'playing') return;
  pongState.frame++;

  pongMoveHumanPaddle(pongState.leftPaddle, pongState.keys.leftUp, pongState.keys.leftDown, dt);
  if(pongState.mode === '2p'){
    pongMoveHumanPaddle(pongState.rightPaddle, pongState.keys.rightUp, pongState.keys.rightDown, dt);
  } else {
    pongUpdateAi(dt);
  }

  const ball = pongState.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if(ball.y <= 0){
    ball.y = 0;
    ball.vy = Math.abs(ball.vy);
  } else if(ball.y + PONG_CONFIG.ballSize >= PONG_H){
    ball.y = PONG_H - PONG_CONFIG.ballSize;
    ball.vy = -Math.abs(ball.vy);
  }

  const leftX = PONG_CONFIG.paddleInset;
  const rightX = PONG_W - PONG_CONFIG.paddleInset - PONG_CONFIG.paddleW;

  if(ball.vx < 0 && pongRectHit(ball, leftX, pongState.leftPaddle.y)){
    ball.x = leftX + PONG_CONFIG.paddleW;
    pongBounceFromPaddle(pongState.leftPaddle, 1);
  } else if(ball.vx > 0 && pongRectHit(ball, rightX, pongState.rightPaddle.y)){
    ball.x = rightX - PONG_CONFIG.ballSize;
    pongBounceFromPaddle(pongState.rightPaddle, -1);
  }

  if(ball.x + PONG_CONFIG.ballSize < 0){
    pongScore('right');
  } else if(ball.x > PONG_W){
    pongScore('left');
  }
}

function pongDrawCenterLine(ctx){
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  const dashH = 22;
  const gap = 17;
  const x = Math.floor(PONG_W / 2) - 3;
  for(let y = 12; y < PONG_H; y += dashH + gap){
    ctx.fillRect(x, y, 6, dashH);
  }
}

function pongDrawScore(ctx){
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = '76px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(pongState.leftScore), PONG_W / 2 - 110, 28);
  ctx.fillText(String(pongState.rightScore), PONG_W / 2 + 110, 28);
  ctx.restore();
}

function pongDrawPaddle(ctx, x, y){
  ctx.fillStyle = '#fff';
  ctx.fillRect(Math.round(x), Math.round(y), PONG_CONFIG.paddleW, PONG_CONFIG.paddleH);
}

function pongDraw(){
  const ctx = pongCtx;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, PONG_W, PONG_H);

  pongDrawCenterLine(ctx);
  pongDrawScore(ctx);

  const leftX = PONG_CONFIG.paddleInset;
  const rightX = PONG_W - PONG_CONFIG.paddleInset - PONG_CONFIG.paddleW;
  pongDrawPaddle(ctx, leftX, pongState.leftPaddle.y);
  pongDrawPaddle(ctx, rightX, pongState.rightPaddle.y);

  ctx.fillStyle = '#fff';
  ctx.fillRect(Math.round(pongState.ball.x), Math.round(pongState.ball.y), PONG_CONFIG.ballSize, PONG_CONFIG.ballSize);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const label = pongState.screen === 'playing'
    ? 'P TO PAUSE'
    : (pongState.screen === 'paused' ? 'PAUSED' : 'FIRST TO ' + PONG_WIN_SCORE);
  ctx.fillText(label, PONG_W / 2, PONG_H - 14);
}

function pongGameLoop(ts){
  if(!pongLastTime) pongLastTime = ts;
  const dt = Math.min(ts - pongLastTime, 100);
  pongLastTime = ts;
  pongAccum += dt;
  while(pongAccum >= PONG_TARGET_MS){
    pongTick(PONG_TARGET_MS / 1000);
    pongAccum -= PONG_TARGET_MS;
  }
  pongDraw();
  pongRaf = requestAnimationFrame(pongGameLoop);
}

function pongOnKey(e){
  if(e.type === 'keydown') pongNoteMenuInput();
  if(e.key === 'p' || e.key === 'P'){
    if(pongState.screen === 'playing' || pongState.screen === 'paused'){
      pongTogglePause();
      e.preventDefault();
    }
    return;
  }

  const down = e.type === 'keydown';
  let handled = false;
  switch(e.key){
    case 'w': case 'W':
      pongState.keys.leftUp = down;
      handled = true;
      break;
    case 's': case 'S':
      pongState.keys.leftDown = down;
      handled = true;
      break;
    case 'ArrowUp':
      pongState.keys.rightUp = down;
      handled = true;
      break;
    case 'ArrowDown':
      pongState.keys.rightDown = down;
      handled = true;
      break;
    case 'Enter':
      if(down && pongState.screen === 'gameover'){
        pongPlayAgain();
        handled = true;
      }
      break;
    case 'Escape':
      if(down && (pongState.screen === 'difficulty' || pongState.screen === 'gameover')){
        pongReturnToMenu();
        handled = true;
      }
      break;
  }
  if(handled) e.preventDefault();
}

function pongOnOverlayClick(e){
  pongNoteMenuInput();
  const modeBtn = e.target.closest('[data-pong-mode]');
  if(modeBtn){
    pongSelectMode(modeBtn.dataset.pongMode);
    return;
  }
  const difficultyBtn = e.target.closest('[data-pong-difficulty]');
  if(difficultyBtn){
    pongSelectDifficulty(difficultyBtn.dataset.pongDifficulty);
    return;
  }
  const actionBtn = e.target.closest('[data-pong-action]');
  if(!actionBtn) return;
  if(actionBtn.dataset.pongAction === 'play-again') pongPlayAgain();
  if(actionBtn.dataset.pongAction === 'menu') pongReturnToMenu();
}

function pongAttachInput(){
  document.addEventListener('keydown', pongOnKey);
  document.addEventListener('keyup', pongOnKey);
  const overlay = document.getElementById('pongOverlay');
  overlay.addEventListener('click', pongOnOverlayClick);
  overlay.addEventListener('mousemove', pongNoteMenuInput);
}

function pongDetachInput(){
  document.removeEventListener('keydown', pongOnKey);
  document.removeEventListener('keyup', pongOnKey);
  const overlay = document.getElementById('pongOverlay');
  overlay.removeEventListener('click', pongOnOverlayClick);
  overlay.removeEventListener('mousemove', pongNoteMenuInput);
}

function pongInitState(){
  pongState.keys.leftUp = false;
  pongState.keys.leftDown = false;
  pongState.keys.rightUp = false;
  pongState.keys.rightDown = false;
  pongState.mode = null;
  pongState.difficulty = null;
  pongState.leftScore = 0;
  pongState.rightScore = 0;
  pongState.winner = null;
  pongResetPositions();
  pongServe(1);
  pongShowMenuScreen('mode');
  pongCheckFirstVisit();
}

pongDraw();

registerGame('pong', {
  init(){
    pongInitState();
    pongAttachInput();
    pongLastTime = performance.now();
    pongAccum = 0;
    if(!pongRaf) pongRaf = requestAnimationFrame(pongGameLoop);
  },
  cleanup(){
    pongDetachInput();
    pongClearTimers();
    if(pongRaf){ cancelAnimationFrame(pongRaf); pongRaf = null; }
    pongLastTime = 0;
    pongAccum = 0;
  },
});

//# sourceMappingURL=game.js.map
