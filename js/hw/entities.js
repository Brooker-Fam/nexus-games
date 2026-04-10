// ── HOMESTEAD WARS — ENTITY TYPES ──
// type: 'base','worker','warrior'
// side: 'player','enemy'
let _hwNextEntityId = 1;
function hwNextId(){ return _hwNextEntityId++; }
function hwMakeBase(side, faction, x, y){
  const bx = x !== undefined ? x : (side==='player' ? HW_PLAYER_BASE_X : HW_ENEMY_BASE_X);
  const by = y !== undefined ? y : HW_BASE_Y;
  const placed = x !== undefined; // true when built by worker (not starting base)
  return { id:hwNextId(), type:'base', side, x:bx, y:by,
    hp: placed ? 1 : 150, maxHp:150, w:60, h:80,
    queue:[], trainTimer:0,
    ...(placed ? { underConstruction:true, buildProgress:0, buildTime:HW_BUILD_TIMES.structure } : {}),
  };
}
function hwMakeWorker(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? HW_PLAYER_BASE_X : HW_ENEMY_BASE_X);
  const by = nearY !== undefined ? nearY : HW_BASE_Y;
  const spread = (hwRand()-0.5)*160;
  const offsetX = side==='player' ? 80 : -80;
  return { id:hwNextId(), type:'worker', side, faction,
    x: bx+offsetX, y: by+spread,
    hp:20, maxHp:20, speed:0.65,
    state:'idle',
    target:null, hayCarry:0, hayCap:3,
    mineTimer:0, frame:0,
  };
}
function hwMakeWarrior(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? HW_PLAYER_BASE_X+120 : HW_ENEMY_BASE_X-120);
  const by = nearY !== undefined ? nearY : HW_BASE_Y;
  const isRanged = faction==='creek'||faction==='woodland';
  const fireRate = faction==='woodland' ? 14 : faction==='creek' ? 55 : 38;
  const hp = faction==='woodland' ? 20 : 40;
  const offsetX = side==='player' ? 80 : -80;
  return { id:hwNextId(), type:'warrior', side, faction,
    x: bx+offsetX, y: by+(hwRand()-0.5)*200,
    hp, maxHp:hp, speed: faction==='barnyard' ? 2.2 : 0.7,
    state:'idle',
    target:null, attackTimer:0,
    damage: faction==='woodland' ? 5 : isRanged ? 12 : 14,
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
const HW_BUILD_TIMES={
  structure: 360,  // 6s to construct a building
  barracks:  360,
  cannon:    300,  // 5s
  worker:    180,  // 3s train time
  warrior:   300,  // 5s
  elite:     420,  // 7s
  elite2:    480,  // 8s
};
const HW_QUEUE_MAX = 5; // max units queued per building

// ── SECONDARY STRUCTURES ──
function hwMakeStructure(side, faction, x, y, overrideType){
  const cfg=HW_FACTIONS[faction];
  const structType = overrideType || (faction==='woodland'?'armory': faction==='creek'?'shrine':'darkgen');
  return {
    id:hwNextId(), type:'structure', side, faction,
    x, y, hp:80, maxHp:80,
    structType,
    selected:false, frame:0,
    label: cfg.structLabel,
    // construction
    underConstruction:true, buildProgress:0, buildTime:HW_BUILD_TIMES.structure,
    // train queue
    queue:[], trainTimer:0,
  };
}

function hwMakeBarracks(side, faction, x, y){
  const typeMap={woodland:'barracks', creek:'portal', barnyard:'trainingfield'};
  const cfg=HW_FACTIONS[faction];
  return {
    id:hwNextId(), type:'structure', side, faction,
    x, y, hp:80, maxHp:80,
    structType: typeMap[faction]||'barracks',
    selected:false, frame:0,
    label: cfg.barracksLabel,
    isBarracks:true,
    underConstruction:true, buildProgress:0, buildTime:HW_BUILD_TIMES.barracks,
    queue:[], trainTimer:0,
  };
}

function hwMakeCannon(side, faction, x, y){
  return {
    id:hwNextId(), type:'cannon', side, faction,
    x, y, hp:60, maxHp:60,
    range:280, damage:25, cooldown:0, rate:90,
    aimAngle:0,
    selected:false, frame:0,
    label:'CANNON',
    underConstruction:true, buildProgress:0, buildTime:HW_BUILD_TIMES.cannon,
  };
}

// ── ELITE WARRIORS ──
function hwMakeElite(side, faction, nearX, nearY){
  const spread=(hwRand()-0.5)*100;
  const isPlayer=side==='player';
  // speeds match faction standard (barnyard elite is Bull — not Rooster, so standard speed)
  const speed = faction==='barnyard'?0.75 : faction==='creek'?0.7 : 0.7;
  return {
    id:hwNextId(), type:'warrior', subtype:'elite', side, faction,
    x: nearX+(isPlayer?50:-50), y: nearY+spread,
    hp:90, maxHp:90,
    speed,
    state:'idle',
    target:null, attackTimer:0,
    damage: faction==='woodland'?10:22,
    range:240,
    ranged:true,
    fireRate: faction==='woodland'?20:60,
    frame:0, selected:false,
    forcedTarget:null, moveTarget:null,
  };
}

// ── ELITE2 UNITS ──
// barnyard elite2: Ram (like Tank)
function hwMakeRam(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:hwNextId(), type:'warrior', subtype:'tank', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(hwRand()-0.5)*120,
    hp:220, maxHp:220, speed:0.7,
    state:'idle', target:null, attackTimer:0,
    damage:40, range:600, ranged:true, fireRate:100,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// creek elite2: Pelican (like Wizard, chain splash)
function hwMakePelican(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:hwNextId(), type:'warrior', subtype:'wizard', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(hwRand()-0.5)*120,
    hp:50, maxHp:50, speed:0.7,
    state:'idle', target:null, attackTimer:0,
    damage:10, range:260, ranged:true, fireRate:50,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// woodland elite2: Bear (like Tank)
function hwMakeBear(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:hwNextId(), type:'warrior', subtype:'tank', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(hwRand()-0.5)*120,
    hp:220, maxHp:220, speed:0.7,
    state:'idle', target:null, attackTimer:0,
    damage:40, range:600, ranged:true, fireRate:100,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// barnyard's necromancer-like mechanic: Bull revives dead Roosters
const deadRoostersPool=[];

// ── HAY NODES (resource nodes) ──
function hwMakeHayNodes(){
  H.hayNodes=[];
  const MY=HW_BASE_Y;
  // === Player-side cluster ===
  for(const [dx,dy] of [[200,-160],[200,0],[200,160],[350,-80],[350,80]]){
    H.hayNodes.push({ x:HW_PLAYER_BASE_X+dx, y:MY+dy, hay:150, maxHay:150, owner:'player' });
  }
  // === Enemy-side cluster ===
  for(const [dx,dy] of [[-200,-160],[-200,0],[-200,160],[-350,-80],[-350,80]]){
    H.hayNodes.push({ x:HW_ENEMY_BASE_X+dx, y:MY+dy, hay:150, maxHay:150, owner:'enemy' });
  }
  // === Center contested ===
  for(const [dx,dy] of [[0,-260],[0,-130],[0,0],[0,130],[0,260],[-200,-200],[-200,200],[200,-200],[200,200]]){
    H.hayNodes.push({ x:HW_RW/2+dx, y:MY+dy, hay:150, maxHay:150, owner:'neutral' });
  }
  // === Quarter-map nodes (between base and center) ===
  const q1=HW_RW*0.27, q2=HW_RW*0.73;
  for(const [qx,dy] of [[q1,-300],[q1,0],[q1,300],[q2,-300],[q2,0],[q2,300]]){
    H.hayNodes.push({ x:qx, y:MY+dy, hay:150, maxHay:150, owner:'neutral' });
  }
}

function startHW(playerFaction, enemyFaction){
  // pick enemy faction before reset
  let eFaction = enemyFaction;
  if(!eFaction && !window._hwMpMultiplayer){
    const factions=['creek','barnyard','woodland'].filter(f=>f!==playerFaction);
    eFaction = factions[Math.floor(hwRand()*factions.length)];
  }

  hwResetState();
  H.playerFaction=playerFaction;
  if(eFaction) H.enemyFaction=eFaction;
  _hwNextEntityId=1;
  hwRandSeed(42);
  hwCommandQueue.length=0;
  _hwPendingChains.length=0;
  deadRoostersPool.length=0;
  hwCloseBuildPopup&&hwCloseBuildPopup();

  // build bases
  H.playerBase=hwMakeBase('player');
  H.enemyBase=hwMakeBase('enemy');
  H.entities.push(H.playerBase);
  H.entities.push(H.enemyBase);

  // 5 starting workers each side
  for(let i=0;i<5;i++){
    H.entities.push(hwMakeWorker('player', playerFaction));
    H.entities.push(hwMakeWorker('enemy', H.enemyFaction));
  }

  hwMakeHayNodes();
  hwApplyDifficultyToAI();
  hwUpdateDifficultyHUD();
  hwInitCamera(playerFaction);

  // update HUD labels
  const pCfg=HW_FACTIONS[playerFaction];
  document.getElementById('hw-faction-badge').textContent=playerFaction.toUpperCase()+' HERD';
  document.getElementById('hw-faction-badge').style.color=pCfg.color;
  document.getElementById('hw-building-name').textContent=pCfg.buildingName;
  document.getElementById('hw-enemy-faction').textContent=H.enemyFaction.toUpperCase();
  document.getElementById('hw-enemy-faction').style.color=HW_FACTIONS[H.enemyFaction].color;
  hwSetLog('Click your '+pCfg.buildingName+' to train units!');

  if(H.raf) cancelAnimationFrame(H.raf);
  hwLastTime=performance.now(); hwAccum=0;
  H.raf=requestAnimationFrame(hwLoop);
}
