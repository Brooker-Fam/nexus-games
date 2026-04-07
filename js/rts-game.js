// ════════════════════════════════════════════════════
//  DEEP SPACE OPS — RTS ENGINE
// ════════════════════════════════════════════════════
let rtsRAF=null, rtsFrame=0;
let rtsGold=0, rtsPlayerFaction='prism', rtsEnemyFaction='shadow';
let rtsBaseHP=100, rtsEnemyBaseHP=100;
let rtsGameOver=false;
let rtsEntities=[];   // all units + bases
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
      camX = camDragCamX - (e.clientX - camDragStartX);
      camY = camDragCamY - (e.clientY - camDragStartY);
      clampCam();
    }
    // track mouse in world coords for placement preview
    const canvas2=document.getElementById('rts-canvas');
    if(canvas2){
      const rect=canvas2.getBoundingClientRect();
      const sx=e.clientX-rect.left, sy=e.clientY-rect.top;
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

  // Scroll wheel pans horizontally
  wrap.addEventListener('wheel', e=>{
    e.preventDefault();
    camX += e.deltaX || e.deltaY * 0.5;
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

// ── FACTION CONFIG ──
const FACTION_CFG={
  prism:{
    color:'#00ddff', accent:'#aaffff', workerColor:'#88ccff',
    warriorColor:'#ffffff', buildingName:'TEMPLE',
    workerLabel:'ACOLYTE', warriorLabel:'WITCH',
    buildingColor:'#c0e8ff',
    // unit barracks (produces warriors)
    barracksName:'PORTAL', barracksLabel:'PORTAL',
    warriorCost:10,
    // secondary structure (elites)
    structName:'SHRINE', structLabel:'SHRINE',
    eliteLabel:'ORACLE', eliteDesc:'Ranged — high damage prismatic bolts',
    eliteCost:18,
    elite2Label:'WIZARD', elite2Desc:'Ranged — chain lightning bounces between enemies',
    elite2Cost:14,
  },
  shadow:{
    color:'#9922ff', accent:'#dd88ff', workerColor:'#8855cc',
    warriorColor:'#cc88ff', buildingName:'TEMPLE',
    workerLabel:'SHADE', warriorLabel:'SWORDSMAN',
    buildingColor:'#1a0030',
    barracksName:'TRAINING FIELD', barracksLabel:'TRAINING FIELD',
    warriorCost:10,
    structName:'DARK SHRINE', structLabel:'DARK SHRINE',
    eliteLabel:'DARK WARRIOR', eliteDesc:'Ranged — black magic bolts that chain',
    eliteCost:18,
    elite2Label:'NECROMANCER', elite2Desc:'Raises dead Swordsmen from the battlefield',
    elite2Cost:20,
  },
  roboto:{
    color:'#ff8800', accent:'#ffcc44', workerColor:'#aa6622',
    warriorColor:'#ff9933', buildingName:'FACTORY',
    workerLabel:'DRONE', warriorLabel:'GUNBOT',
    buildingColor:'#2a2010',
    barracksName:'BARRACKS', barracksLabel:'BARRACKS',
    warriorCost:6,
    structName:'ARMORY', structLabel:'ARMORY',
    eliteLabel:'SHOCKBOT', eliteDesc:'Ranged — chain lightning hits multiple enemies',
    eliteCost:18,
    elite2Label:'TANK', elite2Desc:'Heavy armored unit — high HP, slow range cannon',
    elite2Cost:25,
  },
};

// ── ENTITY TYPES ──
// type: 'base','worker','warrior'
// side: 'player','enemy'
function makeBase(side){
  const x = side==='player' ? PLAYER_BASE_X : ENEMY_BASE_X;
  return { id:Math.random(), type:'base', side, x, y:BASE_Y,
    hp:100, maxHp:100, w:60, h:80,
    queue:[], trainTimer:0,
  };
}
function makeWorker(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X : ENEMY_BASE_X);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const spread = (Math.random()-0.5)*160;
  const offsetX = side==='player' ? 80 : -80;
  return { id:Math.random(), type:'worker', side, faction,
    x: bx+offsetX, y: by+spread,
    hp:20, maxHp:20, speed:0.65,
    state:'idle',
    target:null, goldCarry:0, goldCap:3,
    mineTimer:0, frame:0,
  };
}
function makeWarrior(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X+120 : ENEMY_BASE_X-120);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const isRanged = faction==='prism'||faction==='roboto';
  const fireRate = faction==='roboto' ? 14 : faction==='prism' ? 55 : 45;
  const hp = faction==='roboto' ? 12 : 40;
  const offsetX = side==='player' ? 80 : -80;
  return { id:Math.random(), type:'warrior', side, faction,
    x: bx+offsetX, y: by+(Math.random()-0.5)*200,
    hp, maxHp:hp, speed: faction==='shadow' ? 2.2 : 0.7,
    state:'idle',
    target:null, attackTimer:0,
    damage: faction==='roboto' ? 5 : isRanged ? 12 : 10,
    range: isRanged?220:50,
    ranged: isRanged,
    fireRate,
    frame:0,
    selected:false,
    forcedTarget:null,   // right-click attack target
    moveTarget:null,     // right-click move destination
  };
}

// ── BUILD TIMES (ticks at 60/s) ──
const BUILD_TIMES={
  structure: 300,  // 5s to construct a building
  barracks:  300,
  cannon:    240,  // 4s
  worker:    180,  // 3s train time
  warrior:   240,  // 4s
  elite:     360,  // 6s
  elite2:    400,
};
const QUEUE_MAX = 5; // max units queued per building

// ── SECONDARY STRUCTURES ──
function makeStructure(side, faction, x, y, overrideType){
  const cfg=FACTION_CFG[faction];
  const structType = overrideType || (faction==='roboto'?'armory': faction==='prism'?'shrine':'darkgen');
  return {
    id:Math.random(), type:'structure', side, faction,
    x, y, hp:80, maxHp:80,
    structType,
    selected:false, frame:0,
    label: cfg.structLabel,
    // construction
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.structure,
    // train queue
    queue:[], trainTimer:0,
  };
}

function makeBarracks(side, faction, x, y){
  const typeMap={roboto:'barracks', prism:'portal', shadow:'trainingfield'};
  const cfg=FACTION_CFG[faction];
  return {
    id:Math.random(), type:'structure', side, faction,
    x, y, hp:80, maxHp:80,
    structType: typeMap[faction]||'barracks',
    selected:false, frame:0,
    label: cfg.barracksLabel,
    isBarracks:true,
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.barracks,
    queue:[], trainTimer:0,
  };
}

function makeCannon(side, faction, x, y){
  return {
    id:Math.random(), type:'cannon', side, faction,
    x, y, hp:60, maxHp:60,
    range:280, damage:20, cooldown:0, rate:80,
    aimAngle:0,
    selected:false, frame:0,
    label:'CANNON',
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.cannon,
  };
}

// ── ELITE WARRIORS ──
function makeElite(side, faction, nearX, nearY){
  const spread=(Math.random()-0.5)*100;
  const isPlayer=side==='player';
  // speeds match faction standard (shadow elite is dark warrior — not swordsman, so standard speed)
  const speed = faction==='prism'?0.7 : faction==='roboto'?0.7 : 0.75;
  return {
    id:Math.random(), type:'warrior', subtype:'elite', side, faction,
    x: nearX+(isPlayer?50:-50), y: nearY+spread,
    hp:70, maxHp:70,
    speed,
    state:'idle',
    target:null, attackTimer:0,
    damage: faction==='roboto'?8:18,
    range:240,
    ranged:true,
    fireRate: faction==='roboto'?20:60,
    frame:0, selected:false,
    forcedTarget:null, moveTarget:null,
  };
}
function makeWizard(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:Math.random(), type:'warrior', subtype:'wizard', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(Math.random()-0.5)*120,
    hp:50, maxHp:50, speed:0.7,
    state:'idle', target:null, attackTimer:0,
    damage:10, range:260, ranged:true, fireRate:50,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
const deadSwordsmenPool=[];
function makeNecromancer(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:Math.random(), type:'warrior', subtype:'necromancer', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(Math.random()-0.5)*120,
    hp:45, maxHp:45, speed:0.75,
    state:'idle', target:null, attackTimer:0,
    damage:6, range:200, ranged:true, fireRate:70,
    reviveTimer:0, reviveCooldown:300,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
function makeTank(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:Math.random(), type:'warrior', subtype:'tank', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(Math.random()-0.5)*120,
    hp:200, maxHp:200, speed:0.7,
    state:'idle', target:null, attackTimer:0,
    damage:40, range:600, ranged:true, fireRate:100,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
function makeGoldNodes(){
  rtsGoldNodes=[];
  const MY=BASE_Y;
  // === Player-side cluster ===
  for(const [dx,dy] of [[200,-160],[200,0],[200,160],[350,-80],[350,80]]){
    rtsGoldNodes.push({ x:PLAYER_BASE_X+dx, y:MY+dy, gold:999, maxGold:999, owner:'player' });
  }
  // === Enemy-side cluster ===
  for(const [dx,dy] of [[-200,-160],[-200,0],[-200,160],[-350,-80],[-350,80]]){
    rtsGoldNodes.push({ x:ENEMY_BASE_X+dx, y:MY+dy, gold:999, maxGold:999, owner:'enemy' });
  }
  // === Center contested ===
  for(const [dx,dy] of [[0,-260],[0,-130],[0,0],[0,130],[0,260],[-200,-200],[-200,200],[200,-200],[200,200]]){
    rtsGoldNodes.push({ x:RW/2+dx, y:MY+dy, gold:999, maxGold:999, owner:'neutral' });
  }
  // === Quarter-map nodes (between base and center) ===
  const q1=RW*0.27, q2=RW*0.73;
  for(const [qx,dy] of [[q1,-300],[q1,0],[q1,300],[q2,-300],[q2,0],[q2,300]]){
    rtsGoldNodes.push({ x:qx, y:MY+dy, gold:999, maxGold:999, owner:'neutral' });
  }
}

function startRTS(playerFaction){
  rtsPlayerFaction=playerFaction;
  const factions=['prism','shadow','roboto'].filter(f=>f!==playerFaction);
  rtsEnemyFaction = factions[Math.floor(Math.random()*factions.length)];
  rtsGold=0; rtsBaseHP=100; rtsEnemyBaseHP=100;
  rtsGameOver=false; rtsFrame=0; rtsParticles=[]; rtsProjectiles=[];
  rtsSelected=[]; rtsBuildPopupOpen=false; buildStructureMode=false;
  aiGold=0; aiTimer=0; deadSwordsmenPool.length=0;
  closeBuildPopup&&closeBuildPopup(); rtsEntities=[];

  // build bases
  rtsEntities.push(makeBase('player'));
  rtsEntities.push(makeBase('enemy'));

  // 5 starting workers each side
  for(let i=0;i<5;i++){
    rtsEntities.push(makeWorker('player', playerFaction));
    rtsEntities.push(makeWorker('enemy', rtsEnemyFaction));
  }

  makeGoldNodes();
  initCamera(playerFaction);

  // update HUD labels
  const pCfg=FACTION_CFG[playerFaction];
  document.getElementById('rts-faction-badge').textContent=playerFaction.toUpperCase()+' ARMADA';
  document.getElementById('rts-faction-badge').style.color=pCfg.color;
  document.getElementById('hud-building-name').textContent=pCfg.buildingName;
  document.getElementById('rts-enemy-faction').textContent=rtsEnemyFaction.toUpperCase();
  document.getElementById('rts-enemy-faction').style.color=FACTION_CFG[rtsEnemyFaction].color;
  rtsSetLog('Click your '+pCfg.buildingName+' to train units!');

  if(rtsRAF) cancelAnimationFrame(rtsRAF);
  rtsLastTime=performance.now(); rtsAccum=0;
  rtsRAF=requestAnimationFrame(rtsLoop);
}

// ── BUILD POPUP ──
let rtsBuildPopupOpen = false;
let buildStructureMode = false;
let rtsBuildingSource = null; // the building entity that opened the popup

function openBuildPopup(screenX, screenY, context){
  // remember which entity spawned this popup so units spawn there
  rtsBuildingSource = rtsSelected[0] || null;
  const cfg = FACTION_CFG[rtsPlayerFaction];
  const popup = document.getElementById('rts-build-popup');
  const title = document.getElementById('rbp-title');
  const opts  = document.getElementById('rbp-options');
  opts.innerHTML='';

  if(context==='base'){
    // Base/Factory/Temple: workers only
    title.textContent = cfg.buildingName;
    const workerBtn=document.createElement('button');
    workerBtn.className='rbp-option'; workerBtn.disabled=rtsGold<5;
    const wIcon=rtsPlayerFaction==='roboto'?'🤖':rtsPlayerFaction==='shadow'?'🥷':'🧙';
    workerBtn.innerHTML=`<span class="rbp-opt-icon">${wIcon}</span>
      <span class="rbp-opt-info"><span class="rbp-opt-name">${cfg.workerLabel}</span>
      <span class="rbp-opt-desc">Gathers gold from mines</span></span>
      <span class="rbp-opt-cost">5g</span>`;
    workerBtn.onclick=()=>trainUnit('worker');
    opts.appendChild(workerBtn);

  } else if(context==='barracks'){
    // Barracks/Portal/Training Field: warriors only
    const sel=rtsSelected[0]; if(!sel) return;
    title.textContent = cfg.barracksLabel;
    const warIcon=rtsPlayerFaction==='roboto'?'🦾':rtsPlayerFaction==='shadow'?'⚔':'✨';
    const warDesc=rtsPlayerFaction==='roboto'?'Ranged — rapid fire gun':
                  rtsPlayerFaction==='prism'?'Ranged — magic projectiles':'Melee — fast sword charge';
    const wBtn=document.createElement('button');
    wBtn.className='rbp-option'; wBtn.disabled=rtsGold<cfg.warriorCost;
    wBtn.innerHTML=`<span class="rbp-opt-icon">${warIcon}</span>
      <span class="rbp-opt-info"><span class="rbp-opt-name">${cfg.warriorLabel}</span>
      <span class="rbp-opt-desc">${warDesc}</span></span>
      <span class="rbp-opt-cost">${cfg.warriorCost}g</span>`;
    wBtn.onclick=()=>{
      if(rtsGold<cfg.warriorCost){ rtsSetLog('Not enough gold!'); return; }
      if(sel.underConstruction){ rtsSetLog('Still under construction!'); return; }
      const fn=()=>makeWarrior('player',rtsPlayerFaction,sel.x,sel.y);
      if(!queueUnit(sel,cfg.warriorLabel,BUILD_TIMES.warrior,fn)) return;
      rtsGold-=cfg.warriorCost; updateRtsHUD();
      rtsSetLog(`${cfg.warriorLabel} queued (${sel.queue.length}/${QUEUE_MAX})`);
      openBuildPopup(sel.x-camX,sel.y-camY,'barracks');
    };
    opts.appendChild(wBtn);

  } else if(context==='worker'){
    title.textContent = 'WORKER ACTIONS';
    const addOpt=(icon,name,desc,cost,onclick)=>{
      const btn=document.createElement('button');
      btn.className='rbp-option'; btn.disabled=rtsGold<cost;
      btn.innerHTML=`<span class="rbp-opt-icon">${icon}</span>
        <span class="rbp-opt-info"><span class="rbp-opt-name">${name}</span>
        <span class="rbp-opt-desc">${desc}</span></span>
        <span class="rbp-opt-cost">${cost}g</span>`;
      btn.onclick=onclick; opts.appendChild(btn);
    };

    // Build Barracks/Portal/Training Field
    const barIcon=rtsPlayerFaction==='roboto'?'🪖':rtsPlayerFaction==='prism'?'🌀':'⚔';
    addOpt(barIcon,`Build ${cfg.barracksLabel}`,`Right-click to place — trains ${cfg.warriorLabel}s (20g)`,20,()=>{
      buildStructureMode='barracks'; rtsGold-=20; updateRtsHUD();
      rtsSetLog(`Right-click to place your ${cfg.barracksLabel}!`); closeBuildPopup();
    });

    // Build secondary structure (Shrine/Dark Shrine/Armory)
    const strIcon=rtsPlayerFaction==='roboto'?'🏭':rtsPlayerFaction==='prism'?'🏛':'⚡';
    addOpt(strIcon,`Build ${cfg.structLabel}`,`Right-click to place — trains elite units (20g)`,20,()=>{
      buildStructureMode=true; rtsGold-=20; updateRtsHUD();
      rtsSetLog(`Right-click to place your ${cfg.structLabel}!`); closeBuildPopup();
    });

    // Build Cannon
    addOpt('💣','Build CANNON','Auto-attacks nearby enemies (15g)',15,()=>{
      buildStructureMode='cannon'; rtsGold-=15; updateRtsHUD();
      rtsSetLog('Right-click to place your CANNON!'); closeBuildPopup();
    });

    // Build another base
    const baseIcon=rtsPlayerFaction==='roboto'?'🏗':'🏰';
    addOpt(baseIcon,`Build ${cfg.buildingName}`,`Right-click to place — trains more workers (25g)`,25,()=>{
      buildStructureMode='base'; rtsGold-=25; updateRtsHUD();
      rtsSetLog(`Right-click to place your new ${cfg.buildingName}!`); closeBuildPopup();
    });

  } else if(context==='structure'){
    const sel=rtsSelected[0];
    if(!sel) return;
    title.textContent = cfg.structLabel;

    // Build list of units for this faction's structure
    const structUnits=[];
    if(rtsPlayerFaction==='prism'){
      structUnits.push({icon:'🔮',label:cfg.eliteLabel,  desc:cfg.eliteDesc,  cost:cfg.eliteCost,  fn:()=>makeElite('player',rtsPlayerFaction,sel.x,sel.y)});
      structUnits.push({icon:'⚡',label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, fn:()=>makeWizard('player',rtsPlayerFaction,sel.x,sel.y)});
    } else if(rtsPlayerFaction==='shadow'){
      structUnits.push({icon:'🌑',label:cfg.eliteLabel,  desc:cfg.eliteDesc,  cost:cfg.eliteCost,  fn:()=>makeElite('player',rtsPlayerFaction,sel.x,sel.y)});
      structUnits.push({icon:'💀',label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, fn:()=>makeNecromancer('player',rtsPlayerFaction,sel.x,sel.y)});
    } else {
      structUnits.push({icon:'⚡',label:cfg.eliteLabel,  desc:cfg.eliteDesc,  cost:cfg.eliteCost,  fn:()=>makeElite('player',rtsPlayerFaction,sel.x,sel.y)});
      structUnits.push({icon:'🚗',label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, fn:()=>makeTank('player',rtsPlayerFaction,sel.x,sel.y)});
    }

    for(const u of structUnits){
      const btn=document.createElement('button');
      btn.className='rbp-option'; btn.disabled=rtsGold<u.cost||(sel.underConstruction);
      btn.innerHTML=`<span class="rbp-opt-icon">${u.icon}</span>
        <span class="rbp-opt-info"><span class="rbp-opt-name">${u.label}</span>
        <span class="rbp-opt-desc">${u.desc}</span></span>
        <span class="rbp-opt-cost">${u.cost}g</span>`;
      btn.onclick=(()=>{
        const _u=u;
        return ()=>{
          if(rtsGold<_u.cost){ rtsSetLog('Not enough gold!'); return; }
          if(sel.underConstruction){ rtsSetLog('Still under construction!'); return; }
          if(!queueUnit(sel,_u.label,BUILD_TIMES.elite,_u.fn)) return;
          rtsGold-=_u.cost; updateRtsHUD();
          rtsSetLog(`${_u.label} queued (${sel.queue.length}/${QUEUE_MAX})`);
          openBuildPopup(sel.x-camX,sel.y-camY,'structure');
        };
      })();
      opts.appendChild(btn);
    }
  }

  // show queue / construction status if building
  const src = rtsSelected[0];
  if(src && src.queue!==undefined){
    if(src.underConstruction){
      const pct=Math.floor((src.buildProgress/src.buildTime)*100);
      const info=document.createElement('div');
      info.style.cssText='margin-top:8px;padding:6px 8px;background:rgba(255,180,0,0.1);border:1px solid rgba(255,180,0,0.3);font-size:10px;letter-spacing:1px;color:#ffcc44;text-align:center;';
      info.textContent=`⚙ UNDER CONSTRUCTION ${pct}%`;
      opts.appendChild(info);
    } else if(src.queue && src.queue.length>0){
      const qDiv=document.createElement('div');
      qDiv.style.cssText='margin-top:8px;padding:6px 8px;background:rgba(0,20,40,0.8);border:1px solid rgba(0,245,255,0.15);';
      const qTitle=document.createElement('div');
      qTitle.style.cssText='font-family:Orbitron,sans-serif;font-size:8px;letter-spacing:2px;color:rgba(0,245,255,0.5);margin-bottom:4px;';
      qTitle.textContent=`QUEUE (${src.queue.length}/${QUEUE_MAX})`;
      qDiv.appendChild(qTitle);
      src.queue.forEach((item,i)=>{
        const row=document.createElement('div');
        row.style.cssText='font-size:10px;color:var(--text-dim);display:flex;align-items:center;gap:6px;margin-bottom:2px;';
        if(i===0){
          // show progress bar for item being trained
          const pct=Math.floor(((src.trainTimer||0)/item.time)*100);
          row.innerHTML=`<span style="color:var(--neon-cyan)">▶</span><span>${item.label}</span>
            <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--neon-cyan);transition:width 0.3s;"></div>
            </div><span style="font-size:9px;color:var(--neon-cyan)">${pct}%</span>`;
        } else {
          row.innerHTML=`<span style="color:rgba(255,255,255,0.2)">${i+1}</span><span>${item.label}</span>`;
        }
        qDiv.appendChild(row);
      });
      opts.appendChild(qDiv);
    }
  }

  // position popup
  const wrap=document.getElementById('rts-viewport-wrap');
  const ww=wrap.offsetWidth, wh=wrap.offsetHeight;
  const pw=240, ph=220;
  let px=Math.min(screenX+20,ww-pw-10);
  let py=Math.max(10,Math.min(screenY-ph/2,wh-ph-10));
  popup.style.left=px+'px'; popup.style.top=py+'px';
  popup.style.display='block';
  rtsBuildPopupOpen=true;
}

function closeBuildPopup(){
  document.getElementById('rts-build-popup').style.display='none';
  rtsBuildPopupOpen = false;
  rtsBuildingSource = null;
}

function trainUnit(unitType){
  const cost = unitType==='worker'?5:10;
  if(rtsGold<cost){ rtsSetLog('Not enough gold!'); return; }
  const building = rtsBuildingSource;
  if(!building){ rtsSetLog('No building selected!'); return; }
  if(building.underConstruction){ rtsSetLog('Building still under construction!'); return; }
  const cfg = FACTION_CFG[rtsPlayerFaction];
  const spawnX=building.x, spawnY=building.y;
  const label = unitType==='worker'?cfg.workerLabel:cfg.warriorLabel;
  const time  = unitType==='worker'?BUILD_TIMES.worker:BUILD_TIMES.warrior;
  const fn    = unitType==='worker'
    ? ()=>makeWorker('player',rtsPlayerFaction,spawnX,spawnY)
    : ()=>makeWarrior('player',rtsPlayerFaction,spawnX,spawnY);
  if(!queueUnit(building, label, time, fn)) return;
  rtsGold-=cost;
  rtsSetLog(`${label} queued (${building.queue.length}/${QUEUE_MAX})`);
  updateRtsHUD();
  // keep popup open so player can queue more
  openBuildPopup(building.x-camX, building.y-camY, building.isBarracks?'barracks':'base');
}

// stub so old references don't break
function rtsBuild(unitType){ trainUnit(unitType); }

function rtsOrderAttack(){
  let count=0;
  for(const e of rtsSelected.length ? rtsSelected : rtsEntities){
    if(e.type==='warrior'&&e.side==='player'&&e.state==='idle'){ e.state='march'; count++; }
  }
  rtsSetLog(count>0?`${count} warriors advancing!`:'No idle warriors selected.');
}

// Convert screen coords → world coords
function screenToWorld(sx, sy){ return { x: sx+camX, y: sy+camY }; }
// Get canvas-relative mouse position
function canvasPos(e){
  const rect=document.getElementById('rts-canvas').getBoundingClientRect();
  return { x:e.clientX-rect.left, y:e.clientY-rect.top };
}

function rtsHandleClick(e){
  if(rtsGameOver) return;
  const sp=canvasPos(e);
  const wp=screenToWorld(sp.x, sp.y);
  if(e.target.closest && e.target.closest('#rts-build-popup')) return;
  if(rtsBuildPopupOpen){ closeBuildPopup(); }

  for(const ent of rtsEntities) ent.selected=false;
  rtsSelected=[];

  let hit=null, hitDist=Infinity;
  for(const ent of rtsEntities){
    if(ent.side!=='player') continue;
    const r=ent.type==='base'?70:ent.type==='structure'?50:ent.type==='cannon'?36:ent.type==='warrior'?20:14;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<hitDist){ hit=ent; hitDist=d; }
  }

  if(hit){
    hit.selected=true; rtsSelected=[hit];
    const cfg=FACTION_CFG[rtsPlayerFaction];
    const sx=hit.x-camX, sy=hit.y-camY;
    if(hit.type==='base'){
      openBuildPopup(sx,sy,'base');
      rtsSetLog(`${cfg.buildingName} — train workers here.`);
    } else if(hit.type==='structure' && hit.isBarracks){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.barracksLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'barracks');
        rtsSetLog(`${cfg.barracksLabel} — train ${cfg.warriorLabel}s here.`);
      }
    } else if(hit.type==='structure'){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.structLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'structure');
        rtsSetLog(`${cfg.structLabel} — train elite units.`);
      }
    } else if(hit.type==='cannon'){
      const pct=hit.underConstruction?` (building ${Math.floor((hit.buildProgress/hit.buildTime)*100)}%)`:'';
      rtsSetLog(`CANNON${pct} — HP: ${Math.floor(hit.hp)}/${hit.maxHp}  Range: ${hit.range}`);
    } else if(hit.type==='worker'){
      openBuildPopup(sx,sy,'worker');
      rtsSetLog(`${cfg.workerLabel} selected — build or right-click to move.`);
    } else if(hit.type==='warrior'){
      const lbl=hit.subtype==='elite'?cfg.eliteLabel:hit.subtype==='wizard'?cfg.elite2Label:hit.subtype==='necromancer'?cfg.elite2Label:hit.subtype==='tank'?cfg.elite2Label:cfg.warriorLabel;
      rtsSetLog(`${lbl} selected — right-click to move or attack.`);
    }
  }
}

function rtsHandleRightClick(e){
  e.preventDefault();
  if(rtsGameOver) return;
  const sp=canvasPos(e);
  const wp=screenToWorld(sp.x,sp.y);

  // structure/base placement mode
  if(buildStructureMode){
    const worker=rtsSelected.find(s=>s.type==='worker'&&s.side==='player');
    const dispatchWorker=(buildTarget)=>{
      if(worker){ worker.buildTarget=buildTarget; worker.state='building'; }
      else {
        const nearest=rtsEntities.filter(en=>en.type==='worker'&&en.side==='player'&&en.state!=='building')
          .sort((a,b)=>Math.hypot(a.x-wp.x,a.y-wp.y)-Math.hypot(b.x-wp.x,b.y-wp.y))[0];
        if(nearest){ nearest.buildTarget=buildTarget; nearest.state='building'; }
      }
    };
    if(buildStructureMode==='base'){
      const nb={id:Math.random(),type:'base',side:'player',x:wp.x,y:wp.y,hp:100,maxHp:100,w:60,h:80,selected:false};
      rtsEntities.push(nb);
      rtsSetLog(`New ${FACTION_CFG[rtsPlayerFaction].buildingName} placed!`);
    } else if(buildStructureMode==='cannon'){
      // store what to build in the worker's buildTarget
      dispatchWorker({x:wp.x,y:wp.y,buildType:'cannon'});
    } else if(buildStructureMode==='barracks'){
      dispatchWorker({x:wp.x,y:wp.y,buildType:'barracks'});
    } else {
      // standard structure
      dispatchWorker({x:wp.x,y:wp.y,buildType:'structure'});
    }
    buildStructureMode=false;
    rtsParticles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#ffdd00',size:0,isRing:true,radius:4});
    return;
  }

  if(rtsSelected.length===0) return;

  // check enemy hit
  let enemyHit=null, enemyDist=Infinity;
  for(const ent of rtsEntities){
    if(ent.side==='player') continue;
    const r=ent.type==='base'?60:ent.type==='structure'?50:20;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<enemyDist){ enemyHit=ent; enemyDist=d; }
  }

  let moved=0, attacked=0;
  for(const sel of rtsSelected){
    if(sel.side!=='player') continue;
    if(enemyHit&&(sel.type==='warrior')){
      sel.forcedTarget=enemyHit; sel.moveTarget=null; sel.state='march'; attacked++;
    } else {
      const spread=rtsSelected.indexOf(sel);
      sel.moveTarget={x:wp.x+(spread%3-1)*35, y:wp.y+Math.floor(spread/3)*35};
      sel.forcedTarget=null;
      sel.state=sel.type==='warrior'?'march':'moving';
      moved++;
    }
  }
  if(attacked>0) rtsSetLog(`Attack order issued to ${attacked} unit${attacked>1?'s':''}!`);
  else if(moved>0) rtsSetLog(`Move order issued to ${moved} unit${moved>1?'s':''}!`);
  rtsParticles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,
    color:enemyHit?'#ff4444':'#00ff88',size:0,isRing:true,radius:4});
}

function rtsSetLog(msg){ document.getElementById('rts-log').textContent=msg; }
function updateRtsHUD(){
  document.getElementById('rts-gold').textContent=Math.floor(rtsGold);
  const units=rtsEntities.filter(e=>e.side==='player'&&e.type!=='base').length;
  document.getElementById('rts-units').textContent=units;
  document.getElementById('rts-base-hp').textContent=rtsBaseHP;
  // refresh popup options if open so gold costs update
  if(rtsBuildPopupOpen){
    const opts=document.getElementById('rbp-options');
    if(opts) opts.querySelectorAll('.rbp-option').forEach(btn=>{
      const cost=parseInt(btn.querySelector('.rbp-opt-cost').textContent);
      btn.disabled = rtsGold < cost;
    });
  }
}

// ── AI LOGIC ──
let aiGold=0, aiTimer=0;
function aiTick(){
  aiTimer++;
  if(aiTimer%240===0){
    const workers=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='worker').length;
    const warriors=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='warrior'&&e.subtype!=='elite').length;
    const structs=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='structure').length;
    const barracks=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='structure'&&e.isBarracks).length;
    const cannons=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='cannon').length;
    const eb=rtsEntities.find(e=>e.type==='base'&&e.side==='enemy');
    if(!eb) return;

    // build barracks first (to get warriors)
    if(aiGold>=20 && barracks===0 && workers>=3){
      aiGold-=20;
      rtsEntities.push(makeBarracks('enemy',rtsEnemyFaction,eb.x-150+(Math.random()-0.5)*80,eb.y+(Math.random()-0.5)*200));
    }
    // build a cannon for defense
    else if(aiGold>=15 && cannons===0 && workers>=4){
      aiGold-=15;
      rtsEntities.push(makeCannon('enemy',rtsEnemyFaction,eb.x-120+(Math.random()-0.5)*60,eb.y+(Math.random()-0.5)*160));
    }
    // build elite structure
    else if(aiGold>=20 && structs-barracks===0 && workers>=5){
      aiGold-=20;
      rtsEntities.push(makeStructure('enemy',rtsEnemyFaction,eb.x-200,eb.y+(Math.random()-0.5)*200));
    }
    // train elites
    else if(aiGold>=18 && structs-barracks>0){
      const str=rtsEntities.find(e=>e.side==='enemy'&&e.type==='structure'&&!e.isBarracks&&!e.underConstruction);
      if(str && (!str.queue||str.queue.length<QUEUE_MAX)){
        aiGold-=18;
        queueUnit(str,'Elite',BUILD_TIMES.elite,()=>makeElite('enemy',rtsEnemyFaction,str.x,str.y));
      }
    }
    // train warriors from barracks
    else if(aiGold>=10 && barracks>0 && warriors<workers*0.8){
      const bar=rtsEntities.find(e=>e.side==='enemy'&&e.type==='structure'&&e.isBarracks&&!e.underConstruction);
      if(bar && (!bar.queue||bar.queue.length<QUEUE_MAX)){
        aiGold-=10;
        queueUnit(bar,'Warrior',BUILD_TIMES.warrior,()=>makeWarrior('enemy',rtsEnemyFaction,bar.x,bar.y));
      }
    }
    // train workers
    else if(aiGold>=5 && workers<14){
      const base=rtsEntities.find(e=>e.type==='base'&&e.side==='enemy');
      if(base && (!base.queue||base.queue.length<QUEUE_MAX)){
        aiGold-=5;
        queueUnit(base,'Worker',BUILD_TIMES.worker,()=>makeWorker('enemy',rtsEnemyFaction));
      }
    }
  }
  // AI sends warriors every ~400 frames
  if(aiTimer%400===0){
    for(const e of rtsEntities){
      if((e.type==='warrior')&&e.side==='enemy'&&e.state==='idle') e.state='march';
    }
  }
}

// ── TICK ──
function rtsTick(){
  if(rtsGameOver) return;
  rtsFrame++;
  tickCamera();
  aiTick();

  // gold passive trickle per worker mining
  const playerBase = rtsEntities.find(e=>e.type==='base'&&e.side==='player');
  const enemyBase  = rtsEntities.find(e=>e.type==='base'&&e.side==='enemy');
  if(!playerBase||!enemyBase) return;

  for(const e of rtsEntities){
    e.frame=(e.frame||0)+1;
    if(e.type==='worker') workerTick(e, playerBase, enemyBase);
    if(e.type==='warrior') warriorTick(e, playerBase, enemyBase);
    if(e.type==='cannon') cannonTick(e);
    if(e.type==='structure' && e.queue) buildingTick(e);
    if(e.type==='base' && e.queue) buildingTick(e);
    // necromancer revival tick
    if(e.type==='warrior' && e.subtype==='necromancer' && e.state!=='idle'){
      e.reviveTimer=(e.reviveTimer||0)+1;
      if(e.reviveTimer>=e.reviveCooldown && deadSwordsmenPool.length>0){
        e.reviveTimer=0;
        const pos=deadSwordsmenPool.pop();
        // raise at where they fell, on necromancer's side
        const revived=makeWarrior(e.side, e.faction, pos.x-80, pos.y);
        revived.state='march';
        revived.x=pos.x; revived.y=pos.y;
        rtsEntities.push(revived);
        spawnMagicBurst(pos.x, pos.y, '#9922ff');
        if(e.side==='player') rtsSetLog('Necromancer raised a Swordsman from the dead!');
      }
    }
  }

  // remove dead units — record fallen swordsmen for necromancer
  for(let i=rtsEntities.length-1;i>=0;i--){
    const e=rtsEntities[i];
    if(e.type!=='base' && e.hp<=0){
      if(e.type==='warrior' && e.faction==='shadow' && !e.subtype){
        deadSwordsmenPool.push({x:e.x, y:e.y, side:e.side});
        if(deadSwordsmenPool.length>12) deadSwordsmenPool.shift();
      }
      spawnDeathParticles(e.x,e.y,FACTION_CFG[e.faction]?.color||'#886633');
      sfx('rtsUnitDie',120);
      rtsEntities.splice(i,1);
    }
  }

  updateProjectiles();

  // check base HP
  if(playerBase.hp<=0){ rtsBaseHP=0; endRTS(false); return; }
  if(enemyBase.hp<=0){ rtsEnemyBaseHP=0; endRTS(true); return; }
  rtsBaseHP=Math.floor(playerBase.hp);
  rtsEnemyBaseHP=Math.floor(enemyBase.hp);

  // particles
  for(let i=rtsParticles.length-1;i>=0;i--){
    const p=rtsParticles[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=0.9; p.vy*=0.9; p.life--;
    if(p.life<=0) rtsParticles.splice(i,1);
  }

  updateRtsHUD();
}

function workerTick(w, playerBase, enemyBase){
  const myBase = w.side==='player'?playerBase:enemyBase;

  // building a structure: walk to build location then place it
  if(w.state==='building' && w.buildTarget){
    const dx=w.buildTarget.x-w.x, dy=w.buildTarget.y-w.y, d=Math.hypot(dx,dy);
    if(d>20){ w.x+=dx/d*w.speed; w.y+=dy/d*w.speed; return; }
    // arrived — start or continue constructing
    const bt=w.buildTarget.buildType||'structure';
    // place a ghost building on first arrival
    if(!w.buildTarget.ghost){
      let ghost=null;
      if(bt==='cannon') ghost=makeCannon(w.side,w.faction,w.buildTarget.x,w.buildTarget.y);
      else if(bt==='barracks') ghost=makeBarracks(w.side,w.faction,w.buildTarget.x,w.buildTarget.y);
      else ghost=makeStructure(w.side,w.faction,w.buildTarget.x,w.buildTarget.y);
      rtsEntities.push(ghost);
      w.buildTarget.ghost=ghost;
    }
    // advance construction
    const ghost=w.buildTarget.ghost;
    if(!ghost || ghost.hp<=0){ w.state='idle'; w.buildTarget=null; return; }
    ghost.buildProgress=(ghost.buildProgress||0)+1;
    w.buildTimer=(w.buildTimer||0)+1;
    w.hammerSwing=Math.sin(w.buildTimer*0.4);
    // hammer sound on the downswing
    if(w.hammerSwing<-0.95 && w.buildTimer>2) sfx('rtsHammer',200);
    if(ghost.buildProgress>=ghost.buildTime){
      ghost.underConstruction=false;
      ghost.hp=ghost.maxHp;
      sfx('rtsBuildDone');
      if(w.side==='player'){
        const lbl=bt==='cannon'?'CANNON':bt==='barracks'?FACTION_CFG[w.faction].barracksLabel:FACTION_CFG[w.faction].structLabel;
        rtsSetLog(`${lbl} complete!`);
      }
      w.state='idle'; w.buildTarget=null; w.hammerSwing=0; w.buildTimer=0;
    }
    return;
  }

  // manual move order overrides normal AI
  if(w.moveTarget){
    const dx=w.moveTarget.x-w.x, dy=w.moveTarget.y-w.y, d=Math.hypot(dx,dy);
    if(d<10){ w.moveTarget=null; w.state='idle'; return; }
    w.x+=dx/d*w.speed; w.y+=dy/d*w.speed;
    return;
  }
  if(w.state==='idle'||w.state==='moving'){
    // find nearest node with gold (prefer own-side nodes)
    let best=null, bestScore=Infinity;
    for(const node of rtsGoldNodes){
      if(node.gold<=0) continue;
      const d=Math.hypot(node.x-w.x, node.y-w.y);
      // prefer nodes on own side; neutral is fine too; enemy nodes are far anyway
      const penalty = node.owner==='neutral'?200: node.owner===w.side?0:400;
      const score=d+penalty;
      if(score<bestScore){ bestScore=score; best=node; }
    }
    if(!best){ w.state='idle'; return; }
    w.target=best; w.state='moving';
    const dx=best.x-w.x, dy=best.y-w.y, d=Math.hypot(dx,dy);
    if(d<8){ w.state='mining'; w.mineTimer=0; return; }
    w.x+=dx/d*w.speed; w.y+=dy/d*w.speed;
  } else if(w.state==='mining'){
    w.mineTimer++;
    if(w.mineTimer>60){
      if(w.target && w.target.gold>0){
        w.target.gold--; w.goldCarry++;
        if(w.goldCarry>=w.goldCap) w.state='returning';
      } else { w.state='idle'; }
      w.mineTimer=0;
    }
  } else if(w.state==='returning'){
    // return to nearest friendly base (not always the original)
    let nearestBase=null, nearestBaseDist=Infinity;
    for(const ent of rtsEntities){
      if(ent.type!=='base'||ent.side!==w.side) continue;
      const d=Math.hypot(ent.x-w.x,ent.y-w.y);
      if(d<nearestBaseDist){ nearestBaseDist=d; nearestBase=ent; }
    }
    const dropoff = nearestBase || myBase;
    const dx=dropoff.x-w.x, dy=dropoff.y-w.y, d=Math.hypot(dx,dy);
    if(d<55){
      if(w.side==='player') rtsGold+=w.goldCarry;
      else aiGold+=w.goldCarry;
      w.goldCarry=0; w.state='idle';
    } else { w.x+=dx/d*w.speed; w.y+=dy/d*w.speed; }
  }
}

// ── CANNON TICK ──
function cannonTick(c){
  if(c.underConstruction) return; // can't fire while being built
  c.cooldown=Math.max(0,(c.cooldown||0)-1);
  if(c.cooldown>0) return;
  // find nearest enemy within range
  let target=null, bestDist=c.range;
  const enemySide=c.side==='player'?'enemy':'player';
  for(const e of rtsEntities){
    if(e.side!==enemySide) continue;
    const d=Math.hypot(e.x-c.x,e.y-c.y);
    if(d<bestDist){ bestDist=d; target=e; }
  }
  if(!target) return;
  c.aimAngle=Math.atan2(target.y-c.y,target.x-c.x);
  c.cooldown=c.rate;
  const _cSnd={prism:'rtsPrismCannon',shadow:'rtsShadowCannon',roboto:'rtsCannonFire'};
  sfx(_cSnd[c.faction]||'rtsCannonFire',300);
  const _cCol={prism:'#00f5ff',shadow:'#cc44ff',roboto:'#ffaa00'};
  // fire a cannon projectile
  rtsProjectiles.push({
    x:c.x, y:c.y, tx:target,
    speed:8, damage:c.damage,
    faction:c.faction, color:_cCol[c.faction]||'#ffaa00',
    type:'cannonball', trail:[], side:c.side,
  });
}

// ── BUILDING TICK — processes train queues ──
function buildingTick(b){
  if(b.underConstruction) return; // can't train while being built
  if(!b.queue || b.queue.length===0) return;
  b.trainTimer=(b.trainTimer||0)+1;
  const item=b.queue[0];
  if(b.trainTimer>=item.time){
    b.trainTimer=0;
    b.queue.shift();
    // spawn the unit
    const u=item.fn();
    rtsEntities.push(u);
    if(b.side==='player') rtsSetLog(`${item.label} ready!`);
  }
}

function queueUnit(building, label, time, fn){
  if(!building.queue) building.queue=[];
  if(building.queue.length>=QUEUE_MAX){ rtsSetLog('Queue full!'); return false; }
  building.queue.push({label,time,fn});
  return true;
}

// player attack order
function rtsOrderAttack(){
  let count=0;
  for(const e of rtsEntities){
    if(e.type==='warrior'&&e.side==='player'&&e.state==='idle'){ e.state='march'; count++; }
  }
  rtsSetLog(count>0?`${count} warriors advancing!`:'No idle warriors to command.');
}

function warriorTick(w, playerBase, enemyBase){
  if(w.state==='idle') return;

  const enemyBase2 = w.side==='player'?enemyBase:playerBase;

  // --- MOVE ORDER: walk to position first ---
  if(w.moveTarget){
    const dx=w.moveTarget.x-w.x, dy=w.moveTarget.y-w.y, d=Math.hypot(dx,dy);
    if(d<8){ w.moveTarget=null; w.state='idle'; return; }
    w.x+=dx/d*w.speed; w.y+=dy/d*w.speed;
    return;
  }

  // --- FORCED ATTACK TARGET (right-click on enemy) ---
  let target=null, targetDist=Infinity;
  if(w.forcedTarget){
    if(w.forcedTarget.hp<=0||!rtsEntities.includes(w.forcedTarget)){
      w.forcedTarget=null; // target dead, resume normal
    } else {
      target=w.forcedTarget;
      targetDist=Math.hypot(target.x-w.x, target.y-w.y);
    }
  }

  // --- AUTO-TARGETING (march mode, no forced target) ---
  if(!target){
    let nearestEnemy=null, nearestDist=Infinity;
    for(const e of rtsEntities){
      if(e.side===w.side||e.type==='base') continue;
      const d=Math.hypot(e.x-w.x,e.y-w.y);
      if(d<nearestDist){ nearestDist=d; nearestEnemy=e; }
    }
    target = nearestEnemy || enemyBase2;
    targetDist = nearestEnemy ? nearestDist : Math.hypot(enemyBase2.x-w.x,enemyBase2.y-w.y);
  }

  if(!target) return;

  if(w.ranged){
    if(targetDist<=w.range){
      w.state='attack';
      w.attackTimer++;
      if(w.attackTimer>=(w.fireRate||50)){ w.attackTimer=0; spawnProjectile(w, target); }
    } else {
      w.state='march';
      const dx=target.x-w.x, dy=target.y-w.y, d=Math.hypot(dx,dy)||1;
      const spread=(w.id%13)*4-24;
      w.x+=dx/d*w.speed; w.y+=(dy+spread*0.05)/d*w.speed;
    }
  } else {
    if(targetDist<=w.range){
      w.state='attack';
      w.attackTimer++;
      if(w.attackTimer>=45){
        w.attackTimer=0;
        target.hp-=w.damage;
        if(target.type==='base') spawnHitFlash(target.x+(w.side==='player'?-30:30),target.y+(Math.random()-0.5)*60,'#ff4444');
        else spawnHitFlash(target.x,target.y,FACTION_CFG[w.faction].color);
      }
    } else {
      w.state='march';
      const dx=target.x-w.x, dy=target.y-w.y, d=Math.hypot(dx,dy)||1;
      const spread=(w.id%11)*5-25;
      w.x+=dx/d*w.speed; w.y+=(dy+spread*0.04)/d*w.speed;
    }
  }
}

// ── PROJECTILES ──
let rtsProjectiles=[];
function spawnProjectile(shooter, target){
  const cfg=FACTION_CFG[shooter.faction];
  const isElite = shooter.subtype==='elite';
  const isWizard = shooter.subtype==='wizard';
  const isNecro  = shooter.subtype==='necromancer';
  const isTank   = shooter.subtype==='tank';

  let ptype='magic';
  if(isTank) ptype='shell';
  else if(isWizard) ptype='lightning';
  else if(isNecro) ptype='darkmagic';
  else if(shooter.faction==='roboto') ptype=isElite?'lightning':'bullet';
  else if(shooter.faction==='shadow') ptype=isElite?'darkmagic':'magic';
  else ptype=isElite?'prismblast':'magic';

  const color = isTank?'#ff6600' : isWizard?'#88ffff' : isNecro?'#440088' :
    isElite?(shooter.faction==='roboto'?'#44ffff':shooter.faction==='shadow'?'#220044':'#ffffff')
    : cfg.color;

  rtsProjectiles.push({
    x:shooter.x, y:shooter.y,
    tx:target,
    speed: isTank?9 : (shooter.faction==='roboto'&&!isWizard) ? 11 : isWizard?6 : 4,
    damage:shooter.damage,
    faction:shooter.faction,
    color, type:ptype,
    trail:[],
    isElite, isWizard, isNecro, isTank,
    side:shooter.side,
  });
  // fire sound per type
  const fireSnd={bullet:'rtsBullet',lightning:'rtsLightning',darkmagic:'rtsDarkMagic',magic:'rtsMagicFire',shell:'rtsCannonFire',cannonball:'rtsCannonFire',prismblast:'rtsMagicFire'};
  sfx(fireSnd[ptype]||'rtsBullet', 80);
}

function updateProjectiles(){
  for(let i=rtsProjectiles.length-1;i>=0;i--){
    const p=rtsProjectiles[i];
    p.trail.push({x:p.x,y:p.y});
    if(p.trail.length>8) p.trail.shift();
    if(!p.tx||p.tx.hp<=0){ rtsProjectiles.splice(i,1); continue; }
    const dx=p.tx.x-p.x, dy=p.tx.y-p.y, d=Math.hypot(dx,dy);
    if(d<p.speed+4){
      p.tx.hp-=p.damage;
      if(p.type==='bullet') spawnHitFlash(p.tx.x,p.tx.y,'#ffcc44');
      else if(p.type==='cannonball'){
        p.tx.hp-=p.damage;
        spawnHitParticles2(p.tx.x,p.tx.y);
      }
      else if(p.type==='shell'){
        // tank shell — AOE explosion
        for(const ent of rtsEntities){
          if(ent.side===p.side||ent.type==='base') continue;
          if(Math.hypot(ent.x-p.tx.x,ent.y-p.tx.y)<80) ent.hp-=p.damage*0.5;
        }
        spawnHitParticles2(p.tx.x, p.tx.y);
      }
      else if(p.type==='lightning'||p.type==='darkmagic'){
        spawnLightningHit(p.tx.x,p.tx.y,p.color);
        chainLightning(p.tx, p.damage*0.6, p.color, p.side, 2);
      } else {
        spawnMagicBurst(p.tx.x,p.tx.y,p.color);
      }
      rtsProjectiles.splice(i,1);
    } else {
      p.x+=dx/d*p.speed; p.y+=dy/d*p.speed;
    }
  }
}

function chainLightning(origin, damage, color, shooterSide, bounces){
  if(bounces<=0) return;
  // find nearest enemy unit within 200px not the origin
  let best=null, bestD=200;
  for(const e of rtsEntities){
    if(e.side===shooterSide||e===origin||e.type==='base') continue;
    const d=Math.hypot(e.x-origin.x,e.y-origin.y);
    if(d<bestD){ bestD=d; best=e; }
  }
  if(!best) return;
  best.hp-=damage;
  // draw arc between origin and best as a particle trail
  const steps=8;
  for(let s=0;s<=steps;s++){
    const t2=s/steps;
    const jx=(Math.random()-0.5)*20*(1-t2);
    const jy=(Math.random()-0.5)*20*(1-t2);
    rtsParticles.push({
      x:origin.x+(best.x-origin.x)*t2+jx,
      y:origin.y+(best.y-origin.y)*t2+jy,
      vx:0,vy:0,life:12,maxLife:12,color,size:3,
    });
  }
  spawnLightningHit(best.x,best.y,color);
  setTimeout(()=>chainLightning(best,damage*0.6,color,shooterSide,bounces-1),60);
}

function spawnLightningHit(x,y,color){
  for(let i=0;i<6;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*4+2;
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:16,maxLife:16,color,size:2+Math.random()*2});
  }
  rtsParticles.push({x,y,vx:0,vy:0,life:10,maxLife:10,color,size:0,isRing:true,radius:3});
}

function spawnMagicBurst(x,y,color){
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2;
    rtsParticles.push({x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:22,maxLife:22,color,size:3});
  }
  rtsParticles.push({x,y,vx:0,vy:0,life:12,maxLife:12,color,size:0,isRing:true,radius:2});
}

function spawnHitParticles2(x,y){
  // big fiery explosion for tank shells
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*6+3;
    const cols=['#ff4400','#ff8800','#ffcc00','#ffffff','#ff2200'];
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,maxLife:30,color:cols[Math.floor(Math.random()*cols.length)],size:4+Math.random()*4});
  }
  rtsParticles.push({x,y,vx:0,vy:0,life:18,maxLife:18,color:'#ff8800',size:0,isRing:true,radius:4});
  rtsParticles.push({x,y,vx:0,vy:0,life:12,maxLife:12,color:'#ffcc44',size:0,isRing:true,radius:6});
}

function spawnHitFlash(x,y,color){
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*2+1;
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:18,maxLife:18,color,size:2+Math.random()*2});
  }
}
function spawnDeathParticles(x,y,color){
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*3+1;
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,maxLife:30,color,size:3+Math.random()*3});
  }
}

function endRTS(playerWon){
  rtsGameOver=true;
  const ov=document.getElementById('rts-gameover-overlay');
  const title=document.getElementById('rts-over-title');
  const sub=document.getElementById('rts-over-sub');
  ov.style.display='flex';
  if(playerWon){ title.textContent='VICTORY'; title.className='rts-over-title win'; sub.textContent='The enemy base has been destroyed.'; }
  else { title.textContent='DEFEAT'; title.className='rts-over-title lose'; sub.textContent='Your base has fallen.'; }
}

// ══════════════════
//  RTS DRAW ENGINE
// ══════════════════
let rtsLastTime=0, rtsAccum=0;
function rtsLoop(ts){
  const dt = Math.min(ts - rtsLastTime, 100);
  rtsLastTime = ts;
  rtsAccum += dt;
  while(rtsAccum >= TARGET_MS){
    rtsTick();
    rtsAccum -= TARGET_MS;
  }
  rtsDraw();
  rtsRAF=requestAnimationFrame(rtsLoop);
}

const rc2=()=>document.getElementById('rts-canvas').getContext('2d');

