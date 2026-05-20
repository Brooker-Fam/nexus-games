// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — GAME ENTRY POINT
// ════════════════════════════════════════════════════
//
// Spins up the match: world, camera, sides, spawn, AI, win/loss, input,
// HUD. Tear-down detaches input and stops the RAF; the world object is
// kept around for inspection but rebuilt on the next isoStart().
//
// Public entry points (used by the game registry and reset overlay):
//   isoStart()   — idempotent; build a fresh match if not running
//   isoStop()    — idempotent; tear down RAF, detach input + camera
//   ISO_GAME     — globals bag with the live world/camera/sides

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
  player:   null,
  ai:       null,
  aiCtl:    null,
  winLoss:  null,
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
  // Make sure any lingering end-game overlay is gone
  if (typeof isoHideEndOverlay === 'function') isoHideEndOverlay();

  ISO_GAME.canvas  = canvas;
  ISO_GAME.ctx     = canvas.getContext('2d');

  const map        = generateDemoMap(ISO_MAP_COLS, ISO_MAP_ROWS);
  ISO_GAME.world   = new World(map);
  ISO_GAME.camera  = new IsoCamera(ISO_GAME.world, canvas.width, canvas.height);
  ISO_GAME.camera.attach(canvas);

  // Spawn match — entities + systems (movement/order/production/cleanup)
  const sides = isoSpawnMatch(ISO_GAME.world);
  ISO_GAME.player = sides.player;
  ISO_GAME.ai     = sides.ai;

  // AI opponent — pushed as a system; throttles itself internally
  ISO_GAME.aiCtl  = new IsoAiOpponent(ISO_GAME.world, ISO_GAME.ai, ISO_GAME.player);
  ISO_GAME.world.systems.push(ISO_GAME.aiCtl);

  // Win/loss scanner (system) and DOM overlay (lazy)
  ISO_GAME.winLoss = new IsoWinLossSystem(ISO_GAME.player, ISO_GAME.ai);
  ISO_GAME.world.systems.push(ISO_GAME.winLoss);

  // HUD bindings
  isoHudInit(ISO_GAME.player, ISO_GAME.ai);
  ISO_GAME.world.systems.push(isoHudSystem);

  // Player input
  isoInputAttach(canvas, ISO_GAME.player);

  // Center camera on the player HQ so the user can see their base on start
  const hq = isoFindOwnHq(ISO_GAME.world, ISO_GAME.player);
  if (hq){
    ISO_GAME.camera.x = hq.x - canvas.width  / 2;
    ISO_GAME.camera.y = hq.y - canvas.height / 2;
    ISO_GAME.camera.clamp();
  }

  ISO_GAME.running = true;
  ISO_GAME.lastMs  = performance.now();
  ISO_GAME.raf     = requestAnimationFrame(_isoFrame);
}

function isoStop(){
  if (ISO_GAME.raf){ cancelAnimationFrame(ISO_GAME.raf); ISO_GAME.raf = null; }
  if (ISO_GAME.camera){ ISO_GAME.camera.detach(); }
  if (typeof isoInputDetach === 'function') isoInputDetach();
  ISO_GAME.running = false;
}

function _isoFrame(nowMs){
  if (!ISO_GAME.running) return;
  let dt = nowMs - ISO_GAME.lastMs;
  ISO_GAME.lastMs = nowMs;
  if (dt > 100) dt = 100;

  ISO_GAME.world.update(dt);
  ISO_GAME.camera.update(dt);
  _isoRenderFrame(ISO_GAME.ctx, ISO_GAME.world, ISO_GAME.camera);

  if (dt > 0){
    const inst = 1000 / dt;
    ISO_GAME._fpsEma = ISO_GAME._fpsEma * 0.92 + inst * 0.08;
    ISO_GAME.fps     = Math.round(ISO_GAME._fpsEma);
    const fpsEl = document.getElementById('iso-fps');
    if (fpsEl) fpsEl.textContent = ISO_GAME.fps + ' FPS';
  }

  ISO_GAME.raf = requestAnimationFrame(_isoFrame);
}

// Extended render: foundation render + selection overlay on top.
function _isoRenderFrame(ctx, world, cam){
  isoRender(ctx, world, cam);
  if (typeof isoDrawSelectionOverlay === 'function'){
    isoDrawSelectionOverlay(ctx, world, cam);
  }
}

registerGame('iso', {
  init(){ isoStart(); },
  cleanup(){ isoStop(); },
});

window.ISO_GAME = ISO_GAME;
window.isoStart = isoStart;
window.isoStop  = isoStop;
