// ════════════════════════════════════════════════════
//  DEEP SPACE OPS — RTS ENGINE
// ════════════════════════════════════════════════════
let rtsRAF=null, rtsFrame=0, rtsSpeed=1;
let rtsGold=0, rtsPlayerFaction='prism', rtsEnemyFaction='shadow';
let rtsBaseHP=100, rtsEnemyBaseHP=100;
let rtsGameOver=false;
let rtsEntities=[];   // all units + bases
let rtsPlayerBase=null, rtsEnemyBase=null; // cached refs — set in startRTS()
let rtsParticles=[];
let rtsGoldNodes=[];  // gold mines in center
let rtsLog='';

// World map size
const RW=4000, RH=1400;
// Viewport (canvas element size)
const VW=1200, VH=580;
const PLAYER_BASE_X=160, ENEMY_BASE_X=RW-160, BASE_Y=RH/2;

// ── CAMERA ──
let camX=0, camY=RH/2-VH/2;
let camDragging=false, camDragStartX=0, camDragStartY=0, camDragCamX=0, camDragCamY=0;
const CAM_SPEED=14;
const keysHeld={};
let rtsMouseWorld=null; // tracks mouse position in world coords

function clampCam(){
  camX=Math.max(0,Math.min(RW-VW,camX));
  camY=Math.max(0,Math.min(RH-VH,camY));
}

let cameraControlsInitialized = false;

function initCamera(playerFaction){
  camX = PLAYER_BASE_X - VW * 0.3;
  camY = RH/2 - VH/2;
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
    camDragStartX=e.clientX; camDragStartY=e.clientY;
    camDragCamX=camX; camDragCamY=camY;
  });
  window.addEventListener('mousemove', e=>{
    const moved=Math.hypot(e.clientX-camDragStartX, e.clientY-camDragStartY);
    if(moved>6 && (e.buttons&1)){
      camDragging=true;
      const c2=document.getElementById('rts-canvas');
      const r2=c2?c2.getBoundingClientRect():{width:VW,height:VH};
      const sx=c2?c2.width/r2.width:1, sy2=c2?c2.height/r2.height:1;
      camX = camDragCamX - (e.clientX - camDragStartX)*sx;
      camY = camDragCamY - (e.clientY - camDragStartY)*sy2;
      clampCam();
    }
    // track mouse in world coords for placement preview
    const canvas2=document.getElementById('rts-canvas');
    if(canvas2){
      const rect=canvas2.getBoundingClientRect();
      const scX=canvas2.width/rect.width, scY=canvas2.height/rect.height;
      const sx=(e.clientX-rect.left)*scX, sy=(e.clientY-rect.top)*scY;
      if(sx>=0&&sy>=0&&sx<=VW&&sy<=VH){
        rtsMouseWorld={x:sx+camX, y:sy+camY};
      }
    }
    // update cursor style
    const wrap2=document.getElementById('rts-viewport-wrap');
    if(wrap2) wrap2.style.cursor=buildStructureMode?'crosshair':camDragging?'grabbing':'grab';
  });
  window.addEventListener('mouseup', ()=>{ setTimeout(()=>camDragging=false, 50); });

  // Touch drag
  wrap.addEventListener('touchstart', e=>{
    const t=e.touches[0];
    camDragging=true;
    camDragStartX=t.clientX; camDragStartY=t.clientY;
    camDragCamX=camX; camDragCamY=camY;
  },{passive:true});
  wrap.addEventListener('touchmove', e=>{
    if(!camDragging) return;
    const t=e.touches[0];
    camX = camDragCamX - (t.clientX - camDragStartX);
    camY = camDragCamY - (t.clientY - camDragStartY);
    clampCam();
  },{passive:true});
  wrap.addEventListener('touchend', ()=>{ camDragging=false; });

  // Scroll wheel pans the camera
  wrap.addEventListener('wheel', e=>{
    const game = document.getElementById('dso-game');
    if(!game || game.style.display==='none') return;
    e.preventDefault();
    if(e.deltaX) camX += e.deltaX;
    if(e.deltaY) camY += e.deltaY * 0.5;
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
  if(keysHeld['ArrowLeft']||keysHeld['a']||keysHeld['A']) camX-=CAM_SPEED;
  if(keysHeld['ArrowRight']||keysHeld['d']||keysHeld['D']) camX+=CAM_SPEED;
  if(keysHeld['ArrowUp']||keysHeld['w']||keysHeld['W']) camY-=CAM_SPEED;
  if(keysHeld['ArrowDown']||keysHeld['s']||keysHeld['S']) camY+=CAM_SPEED;
  clampCam();
}

