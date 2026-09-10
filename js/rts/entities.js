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
    damage:1, range:28, attackTimer:0, retaliateTimer:0, preCombatState:null,
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

// Ling — a swift, dog-like allied infested creature called down by Shadow Temples.
function makeLing(side, x, y){
  return { id:nextId(), type:'warrior', subtype:'ling', side, faction:'shadow',
    x, y, hp:45, maxHp:45, speed:2.6,
    state:'idle', target:null, attackTimer:0,
    damage:12, range:52, ranged:false, fireRate:20,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// Vanthel — a legendary, singularly powerful dark warrior. He is never
// trained directly; the Dark Warrior's Ship carries him to the battlefield
// and releases him once the ship is clear of enemies (see makeDarkWarriorShip).
function makeVanthel(side, x, y){
  return { id:nextId(), type:'warrior', subtype:'vanthel', side, faction:'shadow',
    x, y, hp:320, maxHp:320, speed:1.7,
    state:'idle', target:null, attackTimer:0,
    damage:58, range:60, ranged:false, fireRate:20,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// ── 2ND-TIER BARRACKS UNITS ──
// Warbot (Roboto) — heavier armored GunBot variant, more HP and damage
function makeWarbot(side, faction, nearX, nearY){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X+120 : ENEMY_BASE_X-120);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const offsetX = side==='player' ? 80 : -80;
  return { id:nextId(), type:'warrior', subtype:'warbot', side, faction,
    x: bx+offsetX, y: by+(rtsRand()-0.5)*200,
    hp:40, maxHp:40, speed:0.55,
    state:'idle',
    target:null, attackTimer:0,
    damage:10, range:200, ranged:true, fireRate:16,
    frame:0, selected:false,
    forcedTarget:null, moveTarget:null,
  };
}
// Legionnaire (Prism) — swordfighter or archer, trained in mixed squads of four.
// Bow mode trades damage and speed for range and aerial reach.
function makeLegionnaire(side, faction, nearX, nearY, bowMode=false){
  const bx = nearX !== undefined ? nearX : (side==='player'? PLAYER_BASE_X+120 : ENEMY_BASE_X-120);
  const by = nearY !== undefined ? nearY : BASE_Y;
  const offsetX = side==='player' ? 80 : -80;
  return { id:nextId(), type:'warrior', subtype:'legionnaire', side, faction,
    x: bx+offsetX, y: by+(rtsRand()-0.5)*200,
    hp:35, maxHp:35, speed:bowMode?0.8:1.0,
    state:'idle',
    target:null, attackTimer:0,
    damage:bowMode?10:14, range:bowMode?210:50, ranged:bowMode,
    fireRate:bowMode?48:0, bowMode,
    frame:0, selected:false,
    forcedTarget:null, moveTarget:null,
  };
}
function makeLegionnaireSquad(side, faction, nearX, nearY){
  const squad=[];
  for(let i=0;i<4;i++) squad.push(makeLegionnaire(side, faction, nearX, nearY, i%2===1));
  return squad;
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
  warbot:      780,  // 13s — Roboto 2nd barracks unit
  legionnairesquad: 1500, // 25s — Prism 2nd barracks unit, trains 4 at once
  arkship:     1800, // 30s — Prism unique flagship, requires an existing Prism unit
  research:    1500, // 25s — Research Lab military tech (unlocks Warbot/Tank/Warship)
  gongui:      1200, // 20s — unique Roboto King, trained at the Factory
  capitalship: 1500, // 25s — unique Roboto flagship, trained at the Shipyard
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

// ── RESEARCH LAB (Roboto) ── tech structure; once built, a gold-cost research
// project must be completed here before the Barracks/Armory/Shipyard can
// build Warbots, Tanks, and Warships.
function makeResearchLab(side, faction, x, y){
  const cfg=FACTION_CFG[faction];
  return {
    id:nextId(), type:'structure', side, faction,
    x, y, hp:BUILDING_HEALTH.structure, maxHp:BUILDING_HEALTH.structure,
    structType:'researchlab',
    selected:false, frame:0,
    label:(cfg&&cfg.researchLabLabel)||'RESEARCH LAB', isResearchLab:true,
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.structure,
    queue:[], trainTimer:0,
  };
}

// ── COUNCIL OF LIGHT (Prism) ── tech structure; must be built and completed
// before the Portal can train Legionnaires.
function makeCouncilOfLight(side, faction, x, y){
  const cfg=FACTION_CFG[faction];
  return {
    id:nextId(), type:'structure', side, faction,
    x, y, hp:BUILDING_HEALTH.structure, maxHp:BUILDING_HEALTH.structure,
    structType:'councillight',
    selected:false, frame:0,
    label:(cfg&&cfg.councilOfLightLabel)||'COUNCIL OF LIGHT', isCouncilOfLight:true,
    underConstruction:true, buildProgress:0, buildTime:BUILD_TIMES.structure,
  };
}

// ── COUNCIL OF DARKNESS (Shadow) ── tech structure; must be built and completed
// before the Dark Shrine can train Necromancers or the Warp Conduit can train
// Destroyers.
function makeCouncilOfDarkness(side, faction, x, y){
  const cfg=FACTION_CFG[faction];
  return {
    id:nextId(), type:'structure', side, faction,
    x, y, hp:BUILDING_HEALTH.structure, maxHp:BUILDING_HEALTH.structure,
    structType:'councildark',
    selected:false, frame:0,
    label:(cfg&&cfg.councilOfDarknessLabel)||'COUNCIL OF DARKNESS', isCouncilOfDarkness:true,
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
// Warship (Roboto) — switches between rapid focus fire and slower multi-target volleys
function makeWarship(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'warship', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(rtsRand()-0.5)*120,
    hp:130, maxHp:130, speed:1.3,
    state:'idle', target:null, attackTimer:0,
    damage:4, range:200, ranged:true,
    attackMode:'multiple', fireRate:60, singleFireRate:3600/112, multipleFireRate:60,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
// Light Fighter (Prism) — fast interceptor, projects a continuous piercing beam of light
function makeLightFighter(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'lightfighter', side, faction,
    x: nearX+(isPlayer?60:-60), y: nearY+(rtsRand()-0.5)*120,
    hp:60, maxHp:60, speed:2.4,
    state:'idle', target:null, attackTimer:0,
    damage:27, range:240, ranged:true, beam:true, beamTarget:null,
    aerial:true,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}
// Arkship (Prism) — Prism's unique flagship, which changes silhouette with
// its mode. Building one requires an existing Prism unit and draws her
// inside (see the 'arkship' train_unit handling in commands.js, which
// removes her on completion). Phasing mode collapses the hull into a short,
// squat cone and releases her again with an escort of 5 Witches; attacking
// mode unfurls a long hull with twin crescent blade-fins and fires twin
// beams (see arkshipBeamAttackTick in game.js).
function makeArkship(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'arkship', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(rtsRand()-0.5)*120,
    hp:220, maxHp:220, speed:0.9,
    state:'idle', target:null, attackTimer:0,
    damage:20, range:260, ranged:true, beam:true, beamTarget:null, beamTarget2:null,
    arkMode:'attacking', deployedCrew:false,
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

// Capital Ship (Roboto) — unique flagship. While airborne it fires one bullet
// at every enemy it faces; landing it grounds it (vulnerable to melee, cannot
// move or fight) so it can board or deploy Gongui, the Roboto King.
function makeCapitalShip(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'capitalship', side, faction,
    x: nearX+(isPlayer?80:-80), y: nearY+(rtsRand()-0.5)*120,
    hp:320, maxHp:320, speed:1.0,
    state:'idle', target:null, attackTimer:0,
    damage:6, range:220, ranged:true, fireRate:40,
    aerial:true, landed:false, passenger:null,
    frame:0, selected:false, forcedTarget:null, moveTarget:null,
  };
}

// Dark Warrior's Ship (Shadow) — a heavily armored void carrier that ferries
// Vanthel to the battlefield. Its void-orb barrage hits harder and further
// than a Destroyer's, and it won't release Vanthel while enemies are within
// sight — it has to burn them down with that barrage first (see the
// carryingVanthel check in rtsTick).
function makeDarkWarriorShip(side, faction, nearX, nearY){
  const isPlayer=side==='player';
  return {
    id:nextId(), type:'warrior', subtype:'darkwarriorship', side, faction,
    x: nearX+(isPlayer?70:-70), y: nearY+(rtsRand()-0.5)*120,
    hp:260, maxHp:260, speed:0.9,
    state:'idle', target:null, attackTimer:0,
    damage:48, range:300, ranged:true, fireRate:100,
    aerial:true, carryingVanthel:true,
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
function makePrism(side, faction, nearX, nearY){
  const prism=makeElite(side,faction,nearX,nearY);
  prism.subtype='prism';
  // A longer cadence keeps each ten-unit summon meaningful.
  prism.fireRate=180;
  prism.summonsLegionnaires=true;
  return prism;
}
// Gongui, the Roboto King — unique Factory champion. Heavier and harder-hitting
// than a plain Shockbot, and the only unit a Capital Ship can carry aboard.
function makeGongui(side, faction, nearX, nearY){
  const gongui=makeElite(side,faction,nearX,nearY);
  gongui.subtype='gongui';
  gongui.hp=260; gongui.maxHp=260;
  gongui.damage=16;
  gongui.fireRate=18;
  return gongui;
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
    S.goldNodes.push({ x:PLAYER_BASE_X+dx, y:MY+dy, gold:1600, maxGold:1600, owner:'player' });
  }
  // === Enemy-side cluster ===
  for(const [dx,dy] of [[-200,-160],[-200,0],[-200,160],[-350,-80],[-350,80]]){
    S.goldNodes.push({ x:ENEMY_BASE_X+dx, y:MY+dy, gold:1600, maxGold:1600, owner:'enemy' });
  }
  // === Center contested ===
  for(const [dx,dy] of [[0,-260],[0,-130],[0,0],[0,130],[0,260],[-200,-200],[-200,200],[200,-200],[200,200]]){
    S.goldNodes.push({ x:RW/2+dx, y:MY+dy, gold:1600, maxGold:1600, owner:'neutral' });
  }
  // === Quarter-map nodes (between base and center) ===
  const q1=RW*0.27, q2=RW*0.73;
  for(const [qx,dy] of [[q1,-300],[q1,0],[q1,300],[q2,-300],[q2,0],[q2,300]]){
    S.goldNodes.push({ x:qx, y:MY+dy, gold:1600, maxGold:1600, owner:'neutral' });
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
