// ════════════════════════════════════════════════════
//  HOMESTEAD WARS — RTS ENGINE
// ════════════════════════════════════════════════════

// World map size
const HW_RW=4000, HW_RH=1400;
// Viewport (canvas element size)
const HW_VW=1200, HW_VH=580;
const HW_PLAYER_BASE_X=160, HW_ENEMY_BASE_X=HW_RW-160, HW_BASE_Y=HW_RH/2;

// ── CENTRALIZED HW STATE ──
// All mutable game state in one object. resetHwState() restores defaults.
const H = {
  // game flow
  raf: null, frame: 0, speed: 1, gameOver: false, log: '',
  // resources & factions
  hay: {player:0, enemy:0},
  playerFaction: 'creek', enemyFaction: 'barnyard',
  // base HP
  baseHP: 150, enemyBaseHP: 150,
  // entities
  entities: [], playerBase: null, enemyBase: null,
  particles: [], hayNodes: [], projectiles: [],
  // selection / UI
  selected: [], buildPopupOpen: false, buildStructureMode: false, buildingSource: null,
  // AI
  aiTimer: 0,
  // camera
  camX: 0, camY: HW_RH/2 - HW_VH/2, mouseWorld: null,
};

function resetHwState(){
  H.raf=null; H.frame=0; H.speed=1; H.gameOver=false; H.log='';
  H.hay={player:0, enemy:0}; H.baseHP=150; H.enemyBaseHP=150;
  H.entities=[]; H.playerBase=null; H.enemyBase=null;
  H.particles=[]; H.hayNodes=[]; H.projectiles=[];
  H.selected=[]; H.buildPopupOpen=false; H.buildStructureMode=false; H.buildingSource=null;
  H.aiTimer=0;
  H.camX=0; H.camY=HW_RH/2-HW_VH/2; H.mouseWorld=null;
}

// ── CAMERA ──
let hwCamDragging=false, hwCamDragActive=false, hwCamDragStartX=0, hwCamDragStartY=0, hwCamDragCamX=0, hwCamDragCamY=0;
const HW_CAM_SPEED=14;
const hwKeysHeld={};

function hwClampCam(){
  H.camX=Math.max(0,Math.min(HW_RW-HW_VW,H.camX));
  H.camY=Math.max(0,Math.min(HW_RH-HW_VH,H.camY));
}

let hwCameraControlsInitialized = false;

function hwInitCamera(playerFaction){
  H.camX = HW_PLAYER_BASE_X - HW_VW * 0.3;
  H.camY = HW_RH/2 - HW_VH/2;
  hwClampCam();
  if(!hwCameraControlsInitialized){
    hwCameraControlsInitialized = true;
    hwSetupCameraControls();
  }
}

function hwSetupCameraControls(){
  // Keyboard
  document.addEventListener('keydown', e=>{
    const game = document.getElementById('hw-game');
    if(!game || game.style.display==='none') return;
    hwKeysHeld[e.key] = true;
    // prevent page scroll with arrow keys when game is open
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('keyup', e=>{ delete hwKeysHeld[e.key]; });

  // Mouse drag — attach to the wrapper div
  const wrap = document.getElementById('hw-viewport-wrap');
  if(!wrap) return;

  wrap.addEventListener('mousedown', e=>{
    if(e.button !== 0) return;
    hwCamDragging=false; // reset
    hwCamDragActive=true;
    hwCamDragStartX=e.clientX; hwCamDragStartY=e.clientY;
    hwCamDragCamX=H.camX; hwCamDragCamY=H.camY;
  });
  window.addEventListener('mousemove', e=>{
    const moved=Math.hypot(e.clientX-hwCamDragStartX, e.clientY-hwCamDragStartY);
    if(hwCamDragActive && moved>6 && (e.buttons&1)){
      hwCamDragging=true;
      const c2=document.getElementById('hw-canvas');
      const r2=c2?c2.getBoundingClientRect():{width:HW_VW,height:HW_VH};
      const sx=c2?c2.width/r2.width:1, sy2=c2?c2.height/r2.height:1;
      H.camX = hwCamDragCamX - (e.clientX - hwCamDragStartX)*sx;
      H.camY = hwCamDragCamY - (e.clientY - hwCamDragStartY)*sy2;
      hwClampCam();
    }
    // track mouse in world coords for placement preview
    const canvas2=document.getElementById('hw-canvas');
    if(canvas2){
      const rect=canvas2.getBoundingClientRect();
      const scX=canvas2.width/rect.width, scY=canvas2.height/rect.height;
      const sx=(e.clientX-rect.left)*scX, sy=(e.clientY-rect.top)*scY;
      if(sx>=0&&sy>=0&&sx<=HW_VW&&sy<=HW_VH){
        H.mouseWorld={x:sx+H.camX, y:sy+H.camY};
      }
    }
    // update cursor style
    const wrap2=document.getElementById('hw-viewport-wrap');
    if(wrap2) wrap2.style.cursor=H.buildStructureMode?'crosshair':hwCamDragging?'grabbing':'grab';
  });
  window.addEventListener('mouseup', ()=>{ hwCamDragActive=false; setTimeout(()=>hwCamDragging=false, 50); });

  // Touch drag
  wrap.addEventListener('touchstart', e=>{
    const t=e.touches[0];
    hwCamDragging=true;
    hwCamDragStartX=t.clientX; hwCamDragStartY=t.clientY;
    hwCamDragCamX=H.camX; hwCamDragCamY=H.camY;
  },{passive:true});
  wrap.addEventListener('touchmove', e=>{
    if(!hwCamDragging) return;
    const t=e.touches[0];
    H.camX = hwCamDragCamX - (t.clientX - hwCamDragStartX);
    H.camY = hwCamDragCamY - (t.clientY - hwCamDragStartY);
    hwClampCam();
  },{passive:true});
  wrap.addEventListener('touchend', ()=>{ hwCamDragging=false; });

  // Scroll wheel pans the camera
  wrap.addEventListener('wheel', e=>{
    const game = document.getElementById('hw-game');
    if(!game || game.style.display==='none') return;
    e.preventDefault();
    if(e.deltaX) H.camX += e.deltaX;
    if(e.deltaY) H.camY += e.deltaY * 0.5;
    hwClampCam();
  },{passive:false});

  // LEFT CLICK — select / build
  wrap.addEventListener('click', e=>{
    if(hwCamDragging) return; // ignore if was dragging
    hwHandleClick(e);
  });

  // RIGHT CLICK — move / attack
  wrap.addEventListener('contextmenu', e=>{
    hwHandleRightClick(e);
  });
}

function hwTickCamera(){
  if(hwKeysHeld['ArrowLeft']||hwKeysHeld['a']||hwKeysHeld['A']) H.camX-=HW_CAM_SPEED;
  if(hwKeysHeld['ArrowRight']||hwKeysHeld['d']||hwKeysHeld['D']) H.camX+=HW_CAM_SPEED;
  if(hwKeysHeld['ArrowUp']||hwKeysHeld['w']||hwKeysHeld['W']) H.camY-=HW_CAM_SPEED;
  if(hwKeysHeld['ArrowDown']||hwKeysHeld['s']||hwKeysHeld['S']) H.camY+=HW_CAM_SPEED;
  hwClampCam();
}
