// ════════════════════════════════════════════════════
//  DUNE — GAME ENTRY / LIFECYCLE
// ════════════════════════════════════════════════════
// Owns: canvas reference, the central DUNE state object, input wiring,
// the render loop, and the game-registry lifecycle hooks.
//
// PUBLIC SURFACE (read by units/buildings/UI hoglets):
//   DUNE.map        — current DuneMap   (use map.get(tx,ty) / map.inBounds)
//   DUNE.fog        — current DuneFog   (use fog.revealTile, fog.get, etc.)
//   DUNE.camera     — current DuneCamera
//   DUNE.tileSize   — px per tile (== DUNE_TILE_SIZE)
//   DUNE.revealTile(tx, ty, r)     — convenience wrapper
//   DUNE.worldToTile / tileToWorld / screenToWorld / screenToTile

const DUNE = {
  map: null,
  fog: null,
  camera: null,
  tileSize: DUNE_TILE_SIZE,
  canvas: null,
  ctx: null,
  raf: null,
  lastTime: 0,
  keysHeld: {},
  startingVisionRadius: 8,

  // exposed helpers — thin wrappers so hoglets only need to know `DUNE.x`.
  revealTile(tx, ty, r){ if(this.fog) this.fog.revealTile(tx, ty, r); },
  worldToTile:   duneWorldToTile,
  tileToWorld:   duneTileOrigin,
  tileCenter:    duneTileCenter,
  worldToScreen: duneWorldToScreen,
  screenToWorld(sx, sy){ return duneScreenToWorld(sx, sy, this.camera); },
  screenToTile(sx, sy){  return duneScreenToTile(sx, sy, this.camera);  },
  isPassable(tx, ty){    return this.map ? duneIsPassable(this.map.get(tx, ty)) : false; },
  isBuildable(tx, ty){   return this.map ? duneIsBuildable(this.map.get(tx, ty)) : false; },
};

// ── INIT ──
function duneStart(opts){
  const useProcedural = !!(opts && opts.procedural);
  const seed          = opts && opts.seed;

  DUNE.canvas = document.getElementById('duneCanvas');
  if(!DUNE.canvas){ console.error('duneStart: #duneCanvas missing'); return; }
  DUNE.ctx    = DUNE.canvas.getContext('2d');

  DUNE.map = useProcedural
    ? duneGenerateMap({ seed: seed != null ? seed : (Date.now() & 0x7fffffff) })
    : duneLoadMap('test-arrakis-64');

  DUNE.fog = new DuneFog(DUNE.map.width, DUNE.map.height);

  DUNE.camera = new DuneCamera({
    viewW:  DUNE.canvas.width,
    viewH:  DUNE.canvas.height,
    worldW: DUNE.map.width  * DUNE_TILE_SIZE,
    worldH: DUNE.map.height * DUNE_TILE_SIZE,
  });
  DUNE.camera.centerOnTile(Math.floor(DUNE.map.width / 2), Math.floor(DUNE.map.height / 2));

  // Initial vision around the map centre — gives the player something to see
  // immediately. Units/buildings will take over reveal duty later.
  DUNE.fog.revealTile(
    Math.floor(DUNE.map.width / 2),
    Math.floor(DUNE.map.height / 2),
    DUNE.startingVisionRadius,
  );

  duneAttachInput();
  duneUpdateHUD();
  duneStartLoop();

  if(window.posthog){
    posthog.capture('dune_game_started', {
      map: DUNE.map.name,
      width: DUNE.map.width,
      height: DUNE.map.height,
      procedural: useProcedural,
    });
  }
}

function duneStop(){
  if(DUNE.raf){ cancelAnimationFrame(DUNE.raf); DUNE.raf = null; }
  duneDetachInput();
}

// ── HUD ──
function duneUpdateHUD(){
  const elName = document.getElementById('duneMapName');
  const elSize = document.getElementById('duneMapSize');
  if(elName && DUNE.map) elName.textContent = DUNE.map.name;
  if(elSize && DUNE.map) elSize.textContent = DUNE.map.width + '×' + DUNE.map.height;
}

// ── INPUT WIRING ──
let _duneInputAttached = false;
function duneOnKeyDown(e){
  if(!duneTabIsActive()) return;
  DUNE.keysHeld[e.key] = true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
}
function duneOnKeyUp(e){ delete DUNE.keysHeld[e.key]; }

function duneOnMouseMove(e){
  if(!DUNE.canvas || !DUNE.camera) return;
  const r = DUNE.canvas.getBoundingClientRect();
  const scaleX = DUNE.canvas.width  / r.width;
  const scaleY = DUNE.canvas.height / r.height;
  const sx = (e.clientX - r.left) * scaleX;
  const sy = (e.clientY - r.top)  * scaleY;
  if(sx >= 0 && sy >= 0 && sx <= DUNE.canvas.width && sy <= DUNE.canvas.height){
    DUNE.camera.setMouseScreen(sx, sy);
  } else {
    DUNE.camera.setMouseScreen(-1, -1);
  }
}

function duneOnMouseLeave(){ if(DUNE.camera) DUNE.camera.setMouseScreen(-1, -1); }

function duneTabIsActive(){
  const tab = document.getElementById('tab-dune');
  return tab && tab.classList.contains('active');
}

function duneAttachInput(){
  if(_duneInputAttached) return;
  _duneInputAttached = true;
  document.addEventListener('keydown', duneOnKeyDown);
  document.addEventListener('keyup',   duneOnKeyUp);
  if(DUNE.canvas){
    DUNE.canvas.addEventListener('mousemove',  duneOnMouseMove);
    DUNE.canvas.addEventListener('mouseleave', duneOnMouseLeave);
  }
}

function duneDetachInput(){
  if(!_duneInputAttached) return;
  _duneInputAttached = false;
  document.removeEventListener('keydown', duneOnKeyDown);
  document.removeEventListener('keyup',   duneOnKeyUp);
  if(DUNE.canvas){
    DUNE.canvas.removeEventListener('mousemove',  duneOnMouseMove);
    DUNE.canvas.removeEventListener('mouseleave', duneOnMouseLeave);
  }
  DUNE.keysHeld = {};
}

// ── LOOP ──
function duneStartLoop(){
  DUNE.lastTime = performance.now();
  if(!DUNE.raf) DUNE.raf = requestAnimationFrame(duneFrame);
}

function duneFrame(ts){
  const dt = Math.min((ts - DUNE.lastTime) / 1000, 0.1); // clamp to 100ms
  DUNE.lastTime = ts;

  if(DUNE.camera) DUNE.camera.tick(dt, DUNE.keysHeld);

  if(DUNE.ctx && DUNE.map && DUNE.fog && DUNE.camera){
    duneDrawMap(DUNE.ctx, DUNE.map, DUNE.fog, DUNE.camera);
  }

  DUNE.raf = requestAnimationFrame(duneFrame);
}

// ── REGENERATE (sidebar button) ──
function duneRegenerate(){
  duneStart({ procedural: true });
}
function duneLoadTestMap(){
  duneStart({ procedural: false });
}

// ── LIFECYCLE REGISTRATION ──
registerGame('dune', {
  init(){
    // Defensive: if init runs before the canvas is in the DOM, bail —
    // tab activation always inserts it first, but keep the guard cheap.
    if(!document.getElementById('duneCanvas')) return;
    duneStart({ procedural: false });
  },
  cleanup(){
    duneStop();
  },
});
