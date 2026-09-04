// ── ENTITY TYPES ──
// type: 'base','worker','warrior'
// side: 'player','enemy'
let _nextEntityId = 1;
function nextId(){ return _nextEntityId++; }
function makeBase(side, faction, x, y){
  const bx = x !== undefined ? x : (side==='player' ? PLAYER_BASE_X : ENEMY_BASE_X);
  const by = y !== undefined ? y : BASE_Y;
  const placed = x !== undefined; // true when built by worker (not starting base)
  return { id:nextId(), type:'base', side, x:bx, y:by,
    hp: placed ? 1 : BUILDING_HEALTH.base, maxHp:BUILDING_HEALTH.base, w:60, h:80,
    queue:[], trainTimer:0,
    ...(placed ? { underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.structure } : {}),
  };
}
function makeWorker(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X : ENEMY_BASE_X);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const spread = (rtsRand()-0.5)*160;
  const offsetX = side==='player' ? 80 : -80;
  return { id:nextId(), type:'worker', side, faction,
    x: bx+offsetX, y: by+spread,
    hp:20, maxHp:20, speed:0.65,
    state:'idle',
    target:null, goldCarry:0, goldCap:5,
    mineTimer:0, frame:0,
  };
}
function makeWarrior(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X+120 : ENEMY_BASE_X-120);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const isRanged = faction==='prism'||faction==='roboto';
  const fireRate = faction==='roboto' ? 14 : faction==='prism' ? 55 : 38;
  const hp = faction==='roboto' ? 20 : 40;
  const offsetX = side==='player' ? 80 : -80;
  return { id:nextId(), type:'warrior', side, faction,
    x: bx+offsetX, y: by+(rtsRand()-0.5)*200,
    hp, maxHp:hp, speed: faction==='shadow' ? 2.2 : 0.7,
    state:'idle',
    target:null, attackTimer:0,
    damage: faction==='roboto' ? 5 : isRanged ? 12 : 14,
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
  structure: 900,    // 15s
  barracks:  900,    // 15s
  cannon:    720,    // 12s
  aerial:    1080,   // 18s — warp conduit / shipyard
  worker:    480,    // 8s
  warrior:   720,    // 12s
  elite:     960,    // 16s
  elite2:    1200,   // 20s
  starfighter: 720,  // 12s
  skyattacker: 840,  // 14s
  warship:     1080, // 18s — Roboto 2nd air unit
  lightfighter: 900, // 15s — Prism 2nd air unit
  destroyer:   1260, // 21s — Shadow 2nd air unit
};
const QUEUE_MAX = 5; // max units queued per building

// ── SECONDARY STRUCTURES ──
function makeStructure(side, faction, x, y, overrideType){
  const cfg=FACTION_CFG[faction];
  const structType = overrideType || (faction==='roboto'?'armory': faction==='prism'?'shrine':'darkgen');
  return {
    id:nextId(), type:'structure', side, faction,
    x, y, hp:BUILDING_HEALTH.structure, maxHp:BUILDING_HEALTH.structure,
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
    x, y, hp:BUILDING_HEALTH.structure, maxHp:BUILDING_HEALTH.structure,
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
    x, y, hp:BUILDING_HEALTH.cannon, maxHp:BUILDING_HEALTH.cannon,
    range:280, damage:25, cooldown:0, rate:90,
    aimAngle:0,
    selected:false, frame:0,
    label:'CANNON',
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.cannon,
  };
}

// ── OIL RIG ──
function makeOilRig(side, faction, x, y){
  const cfg=FACTION_CFG[faction];
  return {
    id:nextId(), type:'structure', side, faction,
    x, y, hp:BUILDING_HEALTH.structure, maxHp:BUILDING_HEALTH.structure,
    structType:'oilrig',
    selected:false, frame:0,
    label:(cfg&&cfg.oilRigLabel)||'OIL RIG', isOilRig:true,
    oil:200, maxOil:200,
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.structure,
  };
}

// ── AERIAL BUILDINGS ──
function makeAerialBuilding(side, faction, x, y){
  const typeMap={roboto:'shipyard', prism:'warpconduit', shadow:'warpconduit'};
  const cfg=FACTION_CFG[faction];
  return {
    id:nextId(), type:'structure', side, faction,
    x, y, hp:BUILDING_HEALTH.aerial, maxHp:BUILDING_HEALTH.aerial,
    structType: typeMap[faction],
    selected:false, frame:0,
    label: cfg.aerialLabel,
    isAerialHangar:true,
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.aerial,
    queue:[], trainTimer:0,
  };
}

// ── AERIAL UNITS ──
function makeStarFighter(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'starfighter', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(rtsRand()-0.5)*120,
    hp:70, maxHp:70, speed:1.8,
    state:'idle', target:null, attackTimer:0,
    damage:7, range:200, ranged:true, fireRate:18,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
function makeSkyAttacker(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'skyattacker', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(rtsRand()-0.5)*120,
    hp:90, maxHp:90, speed:1.4,
    state:'idle', target:null, attackTimer:0,
    damage:22, range:180, ranged:true, fireRate:60,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// ── 2ND-TIER AERIAL UNITS ──
// Warship (Roboto) — heavy gunship, fires a spread of bullets at once
function makeWarship(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'warship', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(rtsRand()-0.5)*120,
    hp:130, maxHp:130, speed:1.3,
    state:'idle', target:null, attackTimer:0,
    damage:8, range:200, ranged:true, fireRate:70, burstCount:3,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
// Light Fighter (Prism) — fast interceptor, fires a piercing beam of light
function makeLightFighter(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'lightfighter', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(rtsRand()-0.5)*120,
    hp:60, maxHp:60, speed:2.4,
    state:'idle', target:null, attackTimer:0,
    damage:20, range:240, ranged:true, fireRate:45,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
// Destroyer (Shadow) — heavy void ship, hurls slow orbs of darkness that damage an area
function makeDestroyer(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'destroyer', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(rtsRand()-0.5)*120,
    hp:160, maxHp:160, speed:1.0,
    state:'idle', target:null, attackTimer:0,
    damage:34, range:260, ranged:true, fireRate:120,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// ── ELITE WARRIORS ──
function makeBloodhound(side, faction, x, y){
  return {
    id:nextId(), type:'warrior', subtype:'bloodhound', side, faction,
    x, y,
    hp:180, maxHp:180, speed:3.2,
    state:'idle', target:null, attackTimer:0,
    damage:35, range:50, ranged:false, fireRate:22,
    bowMode:false,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
function makeAssaultBot(side, faction, x, y){
  return { id:nextId(), type:'warrior', subtype:'assaultbot', side, faction,
    x, y, hp:180, maxHp:180, speed:1.5, state:'idle', target:null, attackTimer:0,
    damage:8, range:140, ranged:true, fireRate:12,
    frame:0, selected:false, forcedTarget:null, moveTarget:null };
}
function makePsionicWarrior(side, faction, x, y){
  return { id:nextId(), type:'warrior', subtype:'psionic', side, faction,
    x, y, hp:110, maxHp:110, speed:0.85, state:'idle', target:null, attackTimer:0,
    damage:28, range:270, ranged:true, fireRate:65,
    frame:0, selected:false, forcedTarget:null, moveTarget:null };
}
function makeElite(side, faction, nearX, nearY){
  const spread=(rtsRand()-0.5)*100;
  const isPlayer=side==='player';
  // speeds match faction standard (shadow elite is dark warrior — not swordsman, so standard speed)
  const speed = faction==='prism'?0.7 : faction==='roboto'?0.7 : 0.75;
  return {
    id:nextId(), type:'warrior', subtype:'elite', side, faction,
    x: nearX+(isPlayer?50:-50), y: nearY+spread,
    hp:90, maxHp:90,
    speed,
    state:'idle',
    target:null, attackTimer:0,
    damage: faction==='roboto'?10:22,
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
    x: nearX+(isPlayer?60:-60), y: nearY+(rtsRand()-0.5)*120,
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
    x: nearX+(isPlayer?60:-60), y: nearY+(rtsRand()-0.5)*120,
    hp:55, maxHp:55, speed:0.75,
    state:'idle', target:null, attackTimer:0,
    damage:10, range:200, ranged:true, fireRate:55,
    reviveTimer:0, reviveCooldown:180,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
function makeTank(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'tank', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(rtsRand()-0.5)*120,
    hp:220, maxHp:220, speed:0.7,
    state:'idle', target:null, attackTimer:0,
    damage:40, range:600, ranged:true, fireRate:100,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
function makeGoldNodes(){
  if(typeof makeMapGoldNodes==='function'){
    makeMapGoldNodes();
    return;
  }
  S.goldNodes=[];
  const MY=BASE_Y;
  // === Player-side cluster ===
  for(const [dx,dy] of [[200,-160],[200,0],[200,160],[350,-80],[350,80]]){
    S.goldNodes.push({ x:PLAYER_BASE_X+dx, y:MY+dy, gold:150, maxGold:150, owner:'player' });
  }
  // === Enemy-side cluster ===
  for(const [dx,dy] of [[-200,-160],[-200,0],[-200,160],[-350,-80],[-350,80]]){
    S.goldNodes.push({ x:ENEMY_BASE_X+dx, y:MY+dy, gold:150, maxGold:150, owner:'enemy' });
  }
  // === Center contested ===
  for(const [dx,dy] of [[0,-260],[0,-130],[0,0],[0,130],[0,260],[-200,-200],[-200,200],[200,-200],[200,200]]){
    S.goldNodes.push({ x:RW/2+dx, y:MY+dy, gold:150, maxGold:150, owner:'neutral' });
  }
  // === Quarter-map nodes (between base and center) ===
  const q1=RW*0.27, q2=RW*0.73;
  for(const [qx,dy] of [[q1,-300],[q1,0],[q1,300],[q2,-300],[q2,0],[q2,300]]){
    S.goldNodes.push({ x:qx, y:MY+dy, gold:150, maxGold:150, owner:'neutral' });
  }
}

function startRTS(playerFaction, enemyFaction, mapSeed){
  // pick enemy faction before reset
  let eFaction = enemyFaction;
  if(!eFaction && !window._mpMultiplayer){
    const factions=['prism','shadow','roboto'].filter(f=>f!==playerFaction);
    eFaction = factions[Math.floor(rtsRand()*factions.length)];
  }

  resetRtsState();
  S.playerFaction=playerFaction;
  if(eFaction) S.enemyFaction=eFaction;
  _nextEntityId=1;
  S.mapSeed=(mapSeed===undefined ? (Date.now()^(Math.random()*0x7fffffff)) : mapSeed)|0;
  rtsRandSeed(S.mapSeed);
  if(typeof makeBattlefield==='function') makeBattlefield();
  rtsCommandQueue.length=0;
  _pendingChains.length=0;
  deadSwordsmenPool.length=0;
  closeBuildPopup&&closeBuildPopup();

  // build bases
  S.playerBase=makeBase('player');
  S.enemyBase=makeBase('enemy');
  S.entities.push(S.playerBase);
  S.entities.push(S.enemyBase);

  // 5 starting workers each side
  for(let i=0;i<5;i++){
    S.entities.push(makeWorker('player', playerFaction));
    S.entities.push(makeWorker('enemy', S.enemyFaction));
  }

  makeGoldNodes();
  applyDifficultyToAI();
  updateDifficultyHUD();
  initCamera(playerFaction);

  // update HUD labels
  const pCfg=FACTION_CFG[playerFaction];
  document.getElementById('rts-faction-badge').textContent=playerFaction.toUpperCase()+' ARMADA';
  document.getElementById('rts-faction-badge').style.color=pCfg.color;
  document.getElementById('hud-building-name').textContent=pCfg.buildingName;
  document.getElementById('rts-enemy-faction').textContent=S.enemyFaction.toUpperCase();
  document.getElementById('rts-enemy-faction').style.color=FACTION_CFG[S.enemyFaction].color;
  const mapName=document.getElementById('rts-map-name');
  if(mapName) mapName.textContent=S.map?S.map.name:'ORION DIVIDE';
  rtsSetLog('Click your '+pCfg.buildingName+' to train units!');

  if(S.raf) cancelAnimationFrame(S.raf);
  rtsLastTime=performance.now(); rtsAccum=0;
  S.raf=requestAnimationFrame(rtsLoop);
}


//# sourceMappingURL=entities.js.map
