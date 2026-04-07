// ── ENTITY TYPES ──
// type: 'base','worker','warrior'
// side: 'player','enemy'
let _nextEntityId = 1;
function nextId(){ return _nextEntityId++; }
function makeBase(side){
  const x = side==='player' ? PLAYER_BASE_X : ENEMY_BASE_X;
  return { id:nextId(), type:'base', side, x, y:BASE_Y,
    hp:100, maxHp:100, w:60, h:80,
    queue:[], trainTimer:0,
  };
}
function makeWorker(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X : ENEMY_BASE_X);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const spread = (Math.random()-0.5)*160;
  const offsetX = side==='player' ? 80 : -80;
  return { id:nextId(), type:'worker', side, faction,
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
  return { id:nextId(), type:'warrior', side, faction,
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
    id:nextId(), type:'structure', side, faction,
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
    id:nextId(), type:'structure', side, faction,
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
    id:nextId(), type:'cannon', side, faction,
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
    id:nextId(), type:'warrior', subtype:'elite', side, faction,
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
    id:nextId(), type:'warrior', subtype:'wizard', side, faction,
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
    id:nextId(), type:'warrior', subtype:'necromancer', side, faction,
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
    id:nextId(), type:'warrior', subtype:'tank', side, faction,
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
  _nextEntityId=1;
  rtsGold=0; rtsBaseHP=100; rtsEnemyBaseHP=100;
  rtsGameOver=false; rtsFrame=0; rtsParticles=[]; rtsProjectiles=[];
  rtsCommandQueue.length=0;
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

