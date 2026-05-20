// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — FOUNDATION ENTRY POINT
// ════════════════════════════════════════════════════
//
// Rendering library choice: HTML5 Canvas 2D (no external library).
// Rationale lives in js/iso/render.js. tl;dr — no build step, no
// runtime deps, matches the rest of the repo, plenty fast at this
// scale.
//
// Lifecycle:
//   registerGame('iso', { init, cleanup })
//     init()    — runs when the iso tab activates
//     cleanup() — runs when leaving the tab; cancels RAF, detaches camera
//
// Public entry points (for follow-up hoglets):
//   isoStart()   — idempotent; spins up the world if not running
//   isoStop()    — idempotent; tears down and detaches input
//   ISO_GAME     — globals bag with { canvas, world, camera, running }
//
// Game loop:
//   - requestAnimationFrame driven
//   - dt is wall-clock ms since previous frame (clamped to 100ms to
//     avoid the "huge dt" hiccup after a tab is backgrounded)
//   - World.update(dt) → IsoCamera.update(dt) → isoRender(ctx, world, cam)
//
// Extension points for later hoglets:
//   - push systems onto world.systems (movement, AI, combat, etc.)
//   - set entity.components.render to draw your own sprites
//   - swap window.isoRender for a custom render function

const ISO_MAP_COLS = 48;
const ISO_MAP_ROWS = 48;

const ISO_GAME = {
  canvas:   null,
  ctx:      null,
  world:    null,
  camera:   null,
  raf:      null,
  running:  false,
  lastMs:   0,
  fps:      60,
  _fpsEma:  60,
};

function _getIsoCanvas(){
  return document.getElementById('iso-canvas');
}

function isoStart(){
  if (ISO_GAME.running) return;
  const canvas = _getIsoCanvas();
  if (!canvas){
    console.warn('[iso] #iso-canvas not found; aborting start');
    return;
  }
  ISO_GAME.canvas  = canvas;
  ISO_GAME.ctx     = canvas.getContext('2d');

  const map        = generateDemoMap(ISO_MAP_COLS, ISO_MAP_ROWS);
  ISO_GAME.world   = new World(map);
  ISO_GAME.camera  = new IsoCamera(ISO_GAME.world, canvas.width, canvas.height);
  ISO_GAME.camera.attach(canvas);

  ISO_GAME.running = true;
  ISO_GAME.lastMs  = performance.now();
  ISO_GAME.raf     = requestAnimationFrame(_isoFrame);
}

function isoStop(){
  if (ISO_GAME.raf){ cancelAnimationFrame(ISO_GAME.raf); ISO_GAME.raf = null; }
  if (ISO_GAME.camera){ ISO_GAME.camera.detach(); }
  ISO_GAME.running = false;
  // Keep ISO_GAME.world/camera around for inspection in dev tools; init
  // rebuilds them anyway.
}

function _isoFrame(nowMs){
  if (!ISO_GAME.running) return;
  let dt = nowMs - ISO_GAME.lastMs;
  ISO_GAME.lastMs = nowMs;
  if (dt > 100) dt = 100;  // clamp big stalls (tab unfocus, etc.)

  ISO_GAME.world.update(dt);
  ISO_GAME.camera.update(dt);
  isoRender(ISO_GAME.ctx, ISO_GAME.world, ISO_GAME.camera);

  // Tiny FPS readout in the HUD (rough EMA).
  if (dt > 0){
    const inst = 1000 / dt;
    ISO_GAME._fpsEma = ISO_GAME._fpsEma * 0.92 + inst * 0.08;
    ISO_GAME.fps     = Math.round(ISO_GAME._fpsEma);
    const fpsEl = document.getElementById('iso-fps');
    if (fpsEl) fpsEl.textContent = ISO_GAME.fps + ' FPS';
  }

  ISO_GAME.raf = requestAnimationFrame(_isoFrame);
}

// Hook into the existing game-registry lifecycle.
registerGame('iso', {
  init(){
    isoStart();
  },
  cleanup(){
    isoStop();
  },
});

window.ISO_GAME = ISO_GAME;
window.isoStart = isoStart;
window.isoStop  = isoStop;
