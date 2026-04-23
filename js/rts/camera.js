// ════════════════════════════════════════════════════
//  DEEP SPACE OPS — RTS ENGINE
// ════════════════════════════════════════════════════

// World map size
const RW=4000, RH=1400;
// Viewport (canvas element size)
const VW=1200, VH=580;
const PLAYER_BASE_X=160, ENEMY_BASE_X=RW-160, BASE_Y=RH/2;

// ── CENTRALIZED RTS STATE ──
// All mutable game state in one object. resetRtsState() restores defaults.
const S = {
  // game flow
  raf: null, frame: 0, speed: 1, gameOver: false, log: '',
  // resources & factions
  gold: {player:0, enemy:0},
  oil:  {player:0, enemy:0},
  playerFaction: 'prism', enemyFaction: 'shadow',
  // base HP
  baseHP: 150, enemyBaseHP: 150,
  // entities
  entities: [], playerBase: null, enemyBase: null,
  particles: [], goldNodes: [], projectiles: [],
  // selection / UI
  selected: [], buildPopupOpen: false, buildStructureMode: false, buildingSource: null,
  // AI
  aiTimer: 0,
  // camera
  camX: 0, camY: RH/2 - VH/2, mouseWorld: null,
  // performance stats (reset each game)
  stats: { kills:0, deaths:0, goldEarned:0, unitsBuilt:0 },
};

function resetRtsState(){
  S.raf=null; S.frame=0; S.speed=1; S.gameOver=false; S.log='';
  S.gold={player:0, enemy:0}; S.oil={player:0, enemy:0}; S.baseHP=150; S.enemyBaseHP=150;
  S.entities=[]; S.playerBase=null; S.enemyBase=null;
  S.particles=[]; S.goldNodes=[]; S.projectiles=[];
  S.selected=[]; S.buildPopupOpen=false; S.buildStructureMode=false; S.buildingSource=null;
  S.aiTimer=0;
  S.stats={ kills:0, deaths:0, goldEarned:0, unitsBuilt:0 };
  S.camX=0; S.camY=RH/2-VH/2; S.mouseWorld=null;
}

// ── CAMERA ──
let camDragging=false, camDragActive=false, camDragStartX=0, camDragStartY=0, camDragCamX=0, camDragCamY=0;
const CAM_SPEED=14;
const keysHeld={};

function clampCam(){
  S.camX=Math.max(0,Math.min(RW-VW,S.camX));
  S.camY=Math.max(0,Math.min(RH-VH,S.camY));
}

let cameraControlsInitialized = false;

function initCamera(playerFaction){
  S.camX = PLAYER_BASE_X - VW * 0.3;
  S.camY = RH/2 - VH/2;
  clampCam();
  if(!cameraControlsInitialized){
    cameraControlsInitialized = true;
    setupCameraControls();
  }
}

function setupCameraControls(){
  // Keyboard
  document.addEventListener('keydown', e=>{
    const game = document.getElementById('dso-game');
    if(!game || game.style.display==='none') return;
    keysHeld[e.key] = true;
    // prevent page scroll with arrow keys when game is open
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('keyup', e=>{ delete keysHeld[e.key]; });

  // Mouse drag — attach to the wrapper div
  const wrap = document.getElementById('rts-viewport-wrap');
  if(!wrap) return;

  wrap.addEventListener('mousedown', e=>{
    if(e.button !== 0) return;
    camDragging=false; // reset
    camDragActive=true;
    camDragStartX=e.clientX; camDragStartY=e.clientY;
    camDragCamX=S.camX; camDragCamY=S.camY;
  });
  window.addEventListener('mousemove', e=>{
    const moved=Math.hypot(e.clientX-camDragStartX, e.clientY-camDragStartY);
    if(camDragActive && moved>6 && (e.buttons&1)){
      camDragging=true;
      const c2=document.getElementById('rts-canvas');
      const r2=c2?c2.getBoundingClientRect():{width:VW,height:VH};
      const sx=c2?c2.width/r2.width:1, sy2=c2?c2.height/r2.height:1;
      S.camX = camDragCamX - (e.clientX - camDragStartX)*sx;
      S.camY = camDragCamY - (e.clientY - camDragStartY)*sy2;
      clampCam();
    }
    // track mouse in world coords for placement preview
    const canvas2=document.getElementById('rts-canvas');
    if(canvas2){
      const rect=canvas2.getBoundingClientRect();
      const scX=canvas2.width/rect.width, scY=canvas2.height/rect.height;
      const sx=(e.clientX-rect.left)*scX, sy=(e.clientY-rect.top)*scY;
      if(sx>=0&&sy>=0&&sx<=VW&&sy<=VH){
        S.mouseWorld={x:sx+S.camX, y:sy+S.camY};
      }
    }
    // update cursor style
    const wrap2=document.getElementById('rts-viewport-wrap');
    if(wrap2) wrap2.style.cursor=S.buildStructureMode?'crosshair':camDragging?'grabbing':'grab';
  });
  window.addEventListener('mouseup', ()=>{ camDragActive=false; setTimeout(()=>camDragging=false, 50); });

  // Touch drag
  wrap.addEventListener('touchstart', e=>{
    const t=e.touches[0];
    camDragging=true;
    camDragStartX=t.clientX; camDragStartY=t.clientY;
    camDragCamX=S.camX; camDragCamY=S.camY;
  },{passive:true});
  wrap.addEventListener('touchmove', e=>{
    if(!camDragging) return;
    const t=e.touches[0];
    S.camX = camDragCamX - (t.clientX - camDragStartX);
    S.camY = camDragCamY - (t.clientY - camDragStartY);
    clampCam();
  },{passive:true});
  wrap.addEventListener('touchend', ()=>{ camDragging=false; });

  // Scroll wheel pans the camera
  wrap.addEventListener('wheel', e=>{
    const game = document.getElementById('dso-game');
    if(!game || game.style.display==='none') return;
    e.preventDefault();
    if(e.deltaX) S.camX += e.deltaX;
    if(e.deltaY) S.camY += e.deltaY * 0.5;
    clampCam();
  },{passive:false});

  // LEFT CLICK — select / build
  wrap.addEventListener('click', e=>{
    if(camDragging) return; // ignore if was dragging
    rtsHandleClick(e);
  });

  // RIGHT CLICK — move / attack
  wrap.addEventListener('contextmenu', e=>{
    rtsHandleRightClick(e);
  });
}

function tickCamera(){
  if(keysHeld['ArrowLeft']||keysHeld['a']||keysHeld['A']) S.camX-=CAM_SPEED;
  if(keysHeld['ArrowRight']||keysHeld['d']||keysHeld['D']) S.camX+=CAM_SPEED;
  if(keysHeld['ArrowUp']||keysHeld['w']||keysHeld['W']) S.camY-=CAM_SPEED;
  if(keysHeld['ArrowDown']||keysHeld['s']||keysHeld['S']) S.camY+=CAM_SPEED;
  clampCam();
}


//# sourceMappingURL=camera.js.map
