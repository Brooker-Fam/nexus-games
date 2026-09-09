const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeContext(){
  const context=vm.createContext({
    rtsRand:()=>0.5,
    console,
  });
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','entities.js'),'utf8');
  vm.runInContext(source,context);
  return context;
}

test('warship starts in slower multiple-target mode and defines a 112 BPM single-target rate',()=>{
  const context=makeContext();
  const stats=vm.runInContext(`(() => {
    const warship=makeWarship('player','roboto',100,100);
    return {damage:warship.damage,attackMode:warship.attackMode,fireRate:warship.fireRate,singleFireRate:warship.singleFireRate,multipleFireRate:warship.multipleFireRate};
  })()`,context);

  assert.deepEqual({...stats},{damage:4,attackMode:'multiple',fireRate:60,singleFireRate:3600/112,multipleFireRate:60});
});

test('warship attack-mode command switches its rate and resets its firing cycle',()=>{
  const context=makeContext();
  Object.assign(context,{
    S:{frame:0,entities:[],playerFaction:'roboto',enemyFaction:'shadow'},
    window:{_mpMultiplayer:false}, mpConnected:false,
    FACTION_CFG:{roboto:{},shadow:{}}, rtsSetLog:()=>{}, updateRtsHUD:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);
  const modes=vm.runInContext(`(() => {
    const warship=makeWarship('player','roboto',100,100);
    warship.attackTimer=20;
    S.entities=[warship];
    executeCommand({type:'toggle_warship_attack_mode',unitId:warship.id,side:'player'});
    const single={mode:warship.attackMode,rate:warship.fireRate,timer:warship.attackTimer};
    executeCommand({type:'toggle_warship_attack_mode',unitId:warship.id,side:'player'});
    return {single,multiple:{mode:warship.attackMode,rate:warship.fireRate,timer:warship.attackTimer}};
  })()`,context);

  assert.deepEqual({...modes.single},{mode:'single',rate:3600/112,timer:0});
  assert.deepEqual({...modes.multiple},{mode:'multiple',rate:60,timer:0});
});

test('warship multiple mode fires one bullet at every enemy in range',()=>{
  const context=makeContext();
  Object.assign(context,{
    window:{_mpMultiplayer:false},
    S:{entities:[],projectiles:[]},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0}},
    FACTION_CFG:{roboto:{color:'#fff'}},
    sfx:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);
  const targets=vm.runInContext(`(() => {
    const warship=makeWarship('player','roboto',100,100);
    const nearA={id:20,side:'enemy',hp:10,x:150,y:100};
    const nearB={id:21,side:'enemy',hp:10,x:100,y:250};
    const far={id:22,side:'enemy',hp:10,x:500,y:100};
    const friendly={id:23,side:'player',hp:10,x:120,y:100};
    S.entities=[warship,nearA,nearB,far,friendly];
    fireWarriorProjectiles(warship,nearA);
    const multiple=S.projectiles.map(projectile=>projectile.tx.id);
    S.projectiles=[];
    warship.attackMode='single';
    fireWarriorProjectiles(warship,nearA);
    return {multiple,single:S.projectiles.map(projectile=>projectile.tx.id)};
  })()`,context);

  assert.deepEqual([...targets.multiple],[20,21]);
  assert.deepEqual([...targets.single],[20]);
});

test('Roboto warship uses a spaceship icon',()=>{
  const context=vm.createContext({});
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8');
  vm.runInContext(source,context);

  const icon=vm.runInContext('FACTION_CFG.roboto.aerial2Icon',context);
  assert.equal(icon,'🚀');
});

test('Roboto warship has a premium resource cost',()=>{
  const context=vm.createContext({});
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8');
  vm.runInContext(source,context);

  const costs=vm.runInContext('({gold:FACTION_CFG.roboto.aerial2Cost,oil:FACTION_CFG.roboto.aerial2OilCost})',context);
  assert.deepEqual({...costs},{gold:60,oil:30});
});

test('Roboto Factory infestation is permanent, blocks Drones, and continuously makes Infested GunBots',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:0},stats:{unitsBuilt:0},playerFaction:'roboto',enemyFaction:'shadow'},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0}},
    rtsSetLog:()=>{}, updateRtsHUD:()=>{}, sfx:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const factory={id:1,type:'base',side:'player',faction:'roboto',x:100,y:100,hp:100,maxHp:100,queue:[],trainTimer:0};
    S.entities=[factory];
    executeCommand({type:'infest_factory',buildingId:factory.id,side:'player'});
    const afterInfest={infested:factory.infested,queue:factory.queue.map(item=>item.unitType)};

    executeCommand({type:'train_unit',buildingId:factory.id,unitType:'worker',side:'player'});
    const afterDroneAttempt={gold:S.gold.player,queue:factory.queue.map(item=>item.unitType)};

    factory.trainTimer=BUILD_TIMES.infestedGunbot-1;
    buildingTick(factory);
    const first=S.entities.find(entity=>entity.subtype==='infestedGunbot');
    return {
      afterInfest,
      afterDroneAttempt,
      spawned:{subtype:first.subtype,faction:first.faction,infested:first.infested,hp:first.hp,maxHp:first.maxHp,damage:first.damage},
      nextQueue:factory.queue.map(item=>item.unitType),
    };
  })()`,context);

  assert.equal(result.afterInfest.infested,true);
  assert.deepEqual([...result.afterInfest.queue],['infestedGunbot']);
  assert.equal(result.afterDroneAttempt.gold,1000);
  assert.deepEqual([...result.afterDroneAttempt.queue],['infestedGunbot']);
  assert.deepEqual({...result.spawned},{subtype:'infestedGunbot',faction:'roboto',infested:true,hp:15,maxHp:15,damage:3});
  assert.deepEqual([...result.nextQueue],['infestedGunbot']);
});

test('Shadow Temple spends gold and essence to call down twelve allied infested Lings',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:120,entities:[],particles:[],gold:{player:100},oil:{player:50},playerFaction:'shadow',enemyFaction:'prism'},
    STRUCT_COSTS:{}, rtsSetLog:()=>{}, updateRtsHUD:()=>{}, rtsRand:()=>0.5,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const temple={id:1,type:'base',side:'player',x:20,y:30};
    S.entities=[temple];
    executeCommand({type:'call_down_lings',buildingId:1,x:400,y:250,side:'player'});
    const firstCall=S.entities.filter(entity=>entity.subtype==='ling');
    executeCommand({type:'call_down_lings',buildingId:1,x:500,y:350,side:'player'});
    return {lings:firstCall.map(ling=>({side:ling.side,faction:ling.faction})),cooldown:temple.lingCallCooldown,particles:S.particles.length,total:S.entities.filter(entity=>entity.subtype==='ling').length,gold:S.gold.player,essence:S.oil.player};
  })()`,context);

  assert.equal(result.lings.length,12);
  assert.ok(result.lings.every(ling=>ling.side==='player' && ling.faction==='shadow'));
  assert.equal(result.cooldown,1920);
  assert.equal(result.particles,18);
  assert.equal(result.total,12);
  assert.equal(result.gold,50);
  assert.equal(result.essence,25);
});

test('Shadow Ling Nest is a free-standing structure that continuously spawns Lings with no cost',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:1000},stats:{unitsBuilt:0},playerFaction:'shadow',enemyFaction:'prism'},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0},lingnest:{gold:0,oil:0}},
    BUILDING_HEALTH:{base:300,structure:160,cannon:120,aerial:140},
    rtsSetLog:()=>{}, updateRtsHUD:()=>{}, sfx:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const nest=makeLingNest('player','shadow',100,100);
    S.entities=[nest];
    const beforeGold=S.gold.player, beforeOil=S.oil.player;
    const afterConstruction={isLingNest:nest.isLingNest,queue:nest.queue.map(item=>item.unitType)};

    // still under construction — no production yet
    buildingTick(nest);
    const duringConstruction=nest.queue.length;

    nest.underConstruction=false;
    nest.hp=nest.maxHp;
    buildingTick(nest);
    const queuedAfterOpen=nest.queue.map(item=>item.unitType);

    nest.trainTimer=BUILD_TIMES.ling-1;
    buildingTick(nest);
    const spawned=S.entities.find(entity=>entity.subtype==='ling');
    return {
      afterConstruction, duringConstruction,
      queuedAfterOpen,
      spawned:{side:spawned.side,faction:spawned.faction,subtype:spawned.subtype},
      nextQueue:nest.queue.map(item=>item.unitType),
      goldSpent:beforeGold-S.gold.player, oilSpent:beforeOil-S.oil.player,
    };
  })()`,context);

  assert.equal(result.afterConstruction.isLingNest,true);
  assert.deepEqual([...result.afterConstruction.queue],[]);
  assert.equal(result.duringConstruction,0);
  assert.deepEqual([...result.queuedAfterOpen],['ling']);
  assert.deepEqual({...result.spawned},{side:'player',faction:'shadow',subtype:'ling'});
  assert.deepEqual([...result.nextQueue],['ling']);
  assert.equal(result.goldSpent,0);
  assert.equal(result.oilSpent,0);
});

test('Shadow Temple rejects a Ling call when either resource is insufficient',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:120,entities:[],particles:[],gold:{player:49},oil:{player:100},playerFaction:'shadow',enemyFaction:'prism'},
    STRUCT_COSTS:{}, rtsSetLog:()=>{}, updateRtsHUD:()=>{}, rtsRand:()=>0.5,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const temple={id:1,type:'base',side:'player'};
    S.entities=[temple];
    executeCommand({type:'call_down_lings',buildingId:1,x:400,y:250,side:'player'});
    S.gold.player=100;
    S.oil.player=24;
    executeCommand({type:'call_down_lings',buildingId:1,x:400,y:250,side:'player'});
    return {entities:S.entities.length,cooldown:temple.lingCallCooldown,gold:S.gold.player,essence:S.oil.player};
  })()`,context);

  assert.deepEqual({...result},{entities:1,cooldown:undefined,gold:100,essence:24});
});

test('Roboto Warbot, Tank, and Warship require completed (gold-cost) research at the Research Lab, and Prism Legionnaires require a completed Council of Light',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:1000},research:{player:false},playerFaction:'roboto',enemyFaction:'shadow'},
    BUILDING_HEALTH:{structure:160},
    BUILD_TIMES:{research:1500},
    updateRtsHUD:()=>{}, rtsSetLog:()=>{},
    queueUnit:(building,label,time,fn,unitType)=>{ building.queue.push({label,time,fn,unitType}); return true; },
    makeWizard:()=>{}, makeNecromancer:()=>{}, makeTank:()=>{},
    makeStarFighter:()=>{}, makeSkyAttacker:()=>{}, makeWarship:()=>{}, makeLightFighter:()=>{}, makeDestroyer:()=>{},
    makePrism:()=>{}, makeElite:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const barracks={id:'barracks',type:'structure',side:'player',faction:'roboto',x:0,y:0,queue:[],isBarracks:true};
    S.entities=[barracks];
    executeCommand({type:'train_unit',buildingId:'barracks',unitType:'warrior2',side:'player'});
    const withoutLab={queued:barracks.queue.length,gold:S.gold.player};

    const lab=makeResearchLab('player','roboto',50,50);
    S.entities.push(lab);
    barracks.queue=[];
    executeCommand({type:'train_unit',buildingId:'barracks',unitType:'warrior2',side:'player'});
    const withUnfinishedLab={queued:barracks.queue.length,gold:S.gold.player};

    lab.underConstruction=false;
    barracks.queue=[];
    executeCommand({type:'train_unit',buildingId:'barracks',unitType:'warrior2',side:'player'});
    const withFinishedLabNoResearch={queued:barracks.queue.length,gold:S.gold.player};

    // Starting research costs gold and queues at the lab, but doesn't
    // unlock anything until it completes.
    executeCommand({type:'start_research',buildingId:lab.id,side:'player'});
    const goldAfterStartingResearch=S.gold.player;
    barracks.queue=[];
    executeCommand({type:'train_unit',buildingId:'barracks',unitType:'warrior2',side:'player'});
    const whileResearching={queued:barracks.queue.length,gold:S.gold.player};

    // Once research completes (simulated directly), Warbot unlocks.
    S.research.player=true;
    barracks.queue=[];
    executeCommand({type:'train_unit',buildingId:'barracks',unitType:'warrior2',side:'player'});
    const withFinishedResearch={queued:barracks.queue.length,gold:S.gold.player};

    return {withoutLab,withUnfinishedLab,withFinishedLabNoResearch,goldAfterStartingResearch,whileResearching,withFinishedResearch};
  })()`,context);

  const warrior2Cost=vm.runInContext('FACTION_CFG.roboto.warrior2Cost',context);
  const researchCost=vm.runInContext('FACTION_CFG.roboto.researchCost',context);
  assert.deepEqual({...result.withoutLab},{queued:0,gold:1000});
  assert.deepEqual({...result.withUnfinishedLab},{queued:0,gold:1000});
  assert.deepEqual({...result.withFinishedLabNoResearch},{queued:0,gold:1000});
  assert.equal(result.goldAfterStartingResearch,1000-researchCost);
  assert.deepEqual({...result.whileResearching},{queued:0,gold:1000-researchCost});
  assert.equal(result.withFinishedResearch.queued,1);
  assert.equal(result.withFinishedResearch.gold,1000-researchCost-warrior2Cost);

  const prismResult=vm.runInContext(`(() => {
    const portal={id:2,type:'structure',side:'player',faction:'prism',x:0,y:0,queue:[],isBarracks:true};
    S.playerFaction='prism';
    S.gold.player=1000;
    S.entities=[portal];
    executeCommand({type:'train_unit',buildingId:2,unitType:'warrior2',side:'player'});
    const withoutCouncil={queued:portal.queue.length,gold:S.gold.player};

    const council=makeCouncilOfLight('player','prism',50,50);
    S.entities.push(council);
    portal.queue=[];
    executeCommand({type:'train_unit',buildingId:2,unitType:'warrior2',side:'player'});
    const withUnfinishedCouncil={queued:portal.queue.length,gold:S.gold.player};

    council.underConstruction=false;
    portal.queue=[];
    executeCommand({type:'train_unit',buildingId:2,unitType:'warrior2',side:'player'});
    const withFinishedCouncil={queued:portal.queue.length,gold:S.gold.player};

    return {withoutCouncil,withUnfinishedCouncil,withFinishedCouncil};
  })()`,context);
  assert.equal(prismResult.withoutCouncil.queued,0);
  assert.equal(prismResult.withUnfinishedCouncil.queued,0);
  assert.equal(prismResult.withFinishedCouncil.queued,1);
});

test('Shadow Necromancer and Destroyer both require a completed Council of Darkness',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:1000},playerFaction:'shadow',enemyFaction:'roboto'},
    BUILDING_HEALTH:{structure:160},
    updateRtsHUD:()=>{}, rtsSetLog:()=>{},
    queueUnit:(building,label,time,fn,unitType)=>{ building.queue.push({label,time,fn,unitType}); return true; },
    makeWizard:()=>{}, makeNecromancer:()=>({id:99}), makeTank:()=>{},
    makeStarFighter:()=>{}, makeSkyAttacker:()=>{}, makeWarship:()=>{}, makeLightFighter:()=>{}, makeDestroyer:()=>({id:98}),
    makePrism:()=>{}, makeElite:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const shrine={id:1,type:'structure',side:'player',faction:'shadow',x:0,y:0,queue:[]};
    const conduit={id:2,type:'structure',side:'player',faction:'shadow',x:0,y:0,queue:[],isAerialHangar:true};
    S.entities=[shrine,conduit];
    executeCommand({type:'train_unit',buildingId:1,unitType:'elite2',side:'player'});
    executeCommand({type:'train_unit',buildingId:2,unitType:'aerial2',side:'player'});
    const withoutCouncil={elite2:shrine.queue.length,aerial2:conduit.queue.length};

    const council=makeCouncilOfDarkness('player','shadow',50,50);
    S.entities.push(council);
    shrine.queue=[]; conduit.queue=[];
    executeCommand({type:'train_unit',buildingId:1,unitType:'elite2',side:'player'});
    executeCommand({type:'train_unit',buildingId:2,unitType:'aerial2',side:'player'});
    const withUnfinishedCouncil={elite2:shrine.queue.length,aerial2:conduit.queue.length};

    council.underConstruction=false;
    shrine.queue=[]; conduit.queue=[];
    executeCommand({type:'train_unit',buildingId:1,unitType:'elite2',side:'player'});
    executeCommand({type:'train_unit',buildingId:2,unitType:'aerial2',side:'player'});
    const withFinishedCouncil={elite2:shrine.queue.length,aerial2:conduit.queue.length};

    return {withoutCouncil,withUnfinishedCouncil,withFinishedCouncil};
  })()`,context);

  assert.deepEqual({...result.withoutCouncil},{elite2:0,aerial2:0});
  assert.deepEqual({...result.withUnfinishedCouncil},{elite2:0,aerial2:0});
  assert.deepEqual({...result.withFinishedCouncil},{elite2:1,aerial2:1});
});

test('start_research is gold-gated, one-shot, and unlocks Warbot/Tank/Warship together',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:50},oil:{player:1000},research:{player:false},playerFaction:'roboto',enemyFaction:'shadow'},
    BUILDING_HEALTH:{structure:160},
    BUILD_TIMES:{research:1500},
    updateRtsHUD:()=>{}, rtsSetLog:()=>{},
    queueUnit:(building,label,time,fn,unitType)=>{ building.queue.push({label,time,fn,unitType}); return true; },
    makeWizard:()=>{}, makeNecromancer:()=>{}, makeTank:()=>{},
    makeStarFighter:()=>{}, makeSkyAttacker:()=>{}, makeWarship:()=>{}, makeLightFighter:()=>{}, makeDestroyer:()=>{},
    makePrism:()=>{}, makeElite:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const lab=makeResearchLab('player','roboto',50,50);
    lab.underConstruction=false;
    S.entities=[lab];

    // Too poor to afford it.
    executeCommand({type:'start_research',buildingId:lab.id,side:'player'});
    const tooPoor={queued:lab.queue.length,gold:S.gold.player};

    S.gold.player=1000;
    executeCommand({type:'start_research',buildingId:lab.id,side:'player'});
    const started={queued:lab.queue.length,gold:S.gold.player};

    // Can't start a second research run while one is queued.
    executeCommand({type:'start_research',buildingId:lab.id,side:'player'});
    const secondAttempt={queued:lab.queue.length,gold:S.gold.player};

    return {tooPoor,started,secondAttempt};
  })()`,context);

  const researchCost=vm.runInContext('FACTION_CFG.roboto.researchCost',context);
  assert.deepEqual({...result.tooPoor},{queued:0,gold:50});
  assert.deepEqual({...result.started},{queued:1,gold:1000-researchCost});
  assert.deepEqual({...result.secondAttempt},{queued:1,gold:1000-researchCost});
});

test('Prism Oracle and Prism remain distinct units',()=>{
  const context=makeContext();
  const units=vm.runInContext(`(() => ({
    oracle:makeElite('player','prism',100,100),
    prism:makePrism('player','prism',100,100),
  }))()`,context);

  assert.equal(units.oracle.subtype,'elite');
  assert.equal(units.oracle.summonsLegionnaires,undefined);
  assert.equal(units.oracle.fireRate,60);
  assert.equal(units.prism.subtype,'prism');
  assert.equal(units.prism.summonsLegionnaires,true);
  assert.equal(units.prism.fireRate,180);

  const factionContext=vm.createContext({});
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8');
  vm.runInContext(source,factionContext);
  const presentation=vm.runInContext('({oracle:FACTION_CFG.prism.eliteLabel,prism:FACTION_CFG.prism.prismLabel,desc:FACTION_CFG.prism.prismDesc,gold:FACTION_CFG.prism.prismCost,light:FACTION_CFG.prism.prismOilCost})',factionContext);
  assert.equal(presentation.oracle,'ORACLE');
  assert.equal(presentation.prism,'PRISM');
  assert.match(presentation.desc,/Legionnaires/);
  assert.match(presentation.desc,/limit 1/);
  assert.equal(presentation.gold,200);
  assert.equal(presentation.light,75);
});

test('Prism Oracle and Wizard cost Light, with Wizard favoring Light over Gold',()=>{
  const context=vm.createContext({});
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8');
  vm.runInContext(source,context);

  const costs=vm.runInContext(`({
    oracle:{gold:FACTION_CFG.prism.eliteCost,light:FACTION_CFG.prism.eliteOilCost},
    wizard:{gold:FACTION_CFG.prism.elite2Cost,light:FACTION_CFG.prism.elite2OilCost},
  })`,context);
  assert.deepEqual({...costs.oracle},{gold:30,light:20});
  assert.deepEqual({...costs.wizard},{gold:18,light:25});
  assert.ok(costs.wizard.light>costs.wizard.gold);
});

test('Prism unit uses a distinct renderer from the Oracle',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','warriors.js'),'utf8');

  assert.match(source,/w\.subtype==='prism'[\s\S]*?drawPrism\(rc,cfg,w\)/);
  assert.match(source,/w\.subtype==='elite'[\s\S]*?drawEliteOracle\(rc,cfg,w\)/);
});

test('Prism unit keeps a broader, taller silhouette than the Oracle',()=>{
  const context=vm.createContext({console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','elites.js'),'utf8'),context);
  const silhouettes=vm.runInContext(`(() => {
    function trace(draw){
      const points=[];
      const gradient={addColorStop(){}};
      const rc={
        beginPath(){},closePath(){},fill(){},stroke(){},
        createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},
        moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},
        quadraticCurveTo(cx,cy,x,y){points.push([cx,cy],[x,y]);},
        bezierCurveTo(a,b,c,d,x,y){points.push([a,b],[c,d],[x,y]);},
        arc(x,y,r){points.push([x-r,y-r],[x+r,y+r]);},
        ellipse(x,y,rx,ry){points.push([x-rx,y-ry],[x+rx,y+ry]);},
      };
      draw(rc,{}, {frame:0,state:'idle'});
      return {
        width:Math.max(...points.map(([x])=>x))-Math.min(...points.map(([x])=>x)),
        top:Math.min(...points.map(([,y])=>y)),
      };
    }
    return {oracle:trace(drawEliteOracle),prism:trace(drawPrism)};
  })()`,context);

  assert.ok(silhouettes.prism.width>silhouettes.oracle.width);
  assert.ok(silhouettes.prism.top<silhouettes.oracle.top);
});

test('Prism unit is limited to one existing or queued unit',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:1000},playerFaction:'prism',enemyFaction:'shadow'},
    makeWorker:()=>{}, makeWarrior:()=>{}, makeWarbot:()=>{}, makeLegionnaireSquad:()=>{},
    makeWizard:()=>{}, makeNecromancer:()=>{}, makeTank:()=>{}, makeStarFighter:()=>{},
    makeSkyAttacker:()=>{}, makeWarship:()=>{}, makeLightFighter:()=>{}, makeDestroyer:()=>{},
    updateRtsHUD:()=>{}, rtsSetLog:()=>{},
    queueUnit:(building,label,time,fn,unitType)=>{ building.queue.push({label,time,fn,unitType}); return true; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);
  const result=vm.runInContext(`(() => {
    const temple={id:1,type:'base',side:'player',faction:'prism',x:0,y:0,queue:[]};
    S.entities=[temple];
    executeCommand({type:'train_unit',buildingId:1,unitType:'prism',side:'player'});
    const afterFirst={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};
    executeCommand({type:'train_unit',buildingId:1,unitType:'prism',side:'player'});
    const afterQueuedAttempt={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};
    temple.queue=[];
    S.entities.push(makePrism('player','prism',10,10));
    executeCommand({type:'train_unit',buildingId:1,unitType:'prism',side:'player'});
    return {afterFirst,afterQueuedAttempt,afterExistingAttempt:{gold:S.gold.player,light:S.oil.player,queued:temple.queue.length}};
  })()`,context);
  assert.deepEqual({...result.afterFirst},{gold:800,light:925,queued:1});
  assert.deepEqual({...result.afterQueuedAttempt},{gold:800,light:925,queued:1});
  assert.deepEqual({...result.afterExistingAttempt},{gold:800,light:925,queued:0});
});

test('Prism unit trains at the Temple rather than the Shrine',()=>{
  const context=vm.createContext({});
  for(const file of ['factions.js','ui.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts',file),'utf8'),context);
  }

  const locations=vm.runInContext(`(() => {
    const cfg=FACTION_CFG.prism;
    return {
      temple:baseTrainingTypes(cfg,'prism').map(unit=>unit.label),
      shrine:structureEliteTypes(cfg,'prism').map(unit=>unit.label),
      shadowTemple:baseTrainingTypes(FACTION_CFG.shadow,'shadow').map(unit=>unit.label),
    };
  })()`,context);

  assert.deepEqual([...locations.temple],['ACOLYTE','PRISM','ARKSHIP']);
  assert.deepEqual([...locations.shrine],['ORACLE','WIZARD']);
  assert.deepEqual([...locations.shadowTemple],['SHADE']);
});

test('Legionnaire starts in sword mode and can switch to bow mode',()=>{
  const context=makeContext();
  const initial=vm.runInContext(`(() => {
    const unit=makeLegionnaire('player','prism',100,100);
    return {bowMode:unit.bowMode,ranged:unit.ranged,damage:unit.damage,range:unit.range};
  })()`,context);
  assert.deepEqual({...initial},{bowMode:false,ranged:false,damage:14,range:50});

  Object.assign(context,{
    S:{frame:0,entities:[],playerFaction:'prism',enemyFaction:'shadow'},
    window:{_mpMultiplayer:false}, mpConnected:false,
    FACTION_CFG:{prism:{}}, rtsSetLog:()=>{}, updateRtsHUD:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);
  const bow=vm.runInContext(`(() => {
    const unit=makeLegionnaire('player','prism',100,100); S.entities=[unit];
    executeCommand({type:'toggle_weapon',unitId:unit.id,side:'player'});
    return {bowMode:unit.bowMode,ranged:unit.ranged,damage:unit.damage,range:unit.range,fireRate:unit.fireRate,speed:unit.speed};
  })()`,context);
  assert.deepEqual({...bow},{bowMode:true,ranged:true,damage:10,range:210,fireRate:48,speed:0.8});

  const sword=vm.runInContext(`(() => {
    executeCommand({type:'toggle_weapon',unitId:S.entities[0].id,side:'player'});
    const unit=S.entities[0];
    return {bowMode:unit.bowMode,ranged:unit.ranged,damage:unit.damage,range:unit.range,fireRate:unit.fireRate,speed:unit.speed};
  })()`,context);
  assert.deepEqual({...sword},{bowMode:false,ranged:false,damage:14,range:50,fireRate:0,speed:1.0});
});

test('Legionnaire squads spawn with an even mix of swords and bows',()=>{
  const context=makeContext();
  const squad=vm.runInContext(`makeLegionnaireSquad('player','prism',100,100).map(unit => ({
    bowMode:unit.bowMode,
    ranged:unit.ranged,
    damage:unit.damage,
    range:unit.range,
    fireRate:unit.fireRate,
    speed:unit.speed,
  }))`,context);

  assert.equal(squad.length,4);
  assert.equal(squad.filter(unit=>unit.bowMode).length,2);
  assert.deepEqual({...squad.find(unit=>unit.bowMode)},
    {bowMode:true,ranged:true,damage:10,range:210,fireRate:48,speed:0.8});
  assert.deepEqual({...squad.find(unit=>!unit.bowMode)},
    {bowMode:false,ranged:false,damage:14,range:50,fireRate:0,speed:1});
});

test('bow-mode legionnaire can target aerial units, sword-mode cannot',()=>{
  const context=makeContext();
  Object.assign(context,{
    STRUCT_COSTS:{
      barracks:{gold:20}, cannon:{gold:20},
      structure:{gold:20,oil:0}, aerial:{gold:20,oil:0},
      oilrig:{gold:20},
    },
    window:{_mpMultiplayer:false}, S:{entities:[],playerBase:null,enemyBase:null},
  });
  const gameSource=fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8');
  vm.runInContext(gameSource,context);
  const result=vm.runInContext(`(() => {
    const unit=makeLegionnaire('player','prism',100,100);
    const sword=canTargetAerial(unit);
    unit.bowMode=true;
    const bow=canTargetAerial(unit);
    return {sword,bow};
  })()`,context);
  assert.deepEqual({...result},{sword:false,bow:true});
});

test('Prism Arkship is a unique flagship that starts in attacking mode with no crew deployed',()=>{
  const context=makeContext();
  const ark=vm.runInContext(`makeArkship('player','prism',100,100)`,context);
  assert.equal(ark.subtype,'arkship');
  assert.equal(ark.arkMode,'attacking');
  assert.equal(ark.deployedCrew,false);
  assert.equal(ark.beam,true);
  assert.equal(ark.aerial,true);

  const factionContext=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),factionContext);
  const presentation=vm.runInContext('({label:FACTION_CFG.prism.arkshipLabel,desc:FACTION_CFG.prism.arkshipDesc,gold:FACTION_CFG.prism.arkshipCost,light:FACTION_CFG.prism.arkshipOilCost})',factionContext);
  assert.equal(presentation.label,'ARKSHIP');
  assert.match(presentation.desc,/Prism/);
  assert.match(presentation.desc,/limit 1/);
  assert.equal(presentation.gold,150);
  assert.equal(presentation.light,60);
});

test('Arkship requires an existing Prism to build, consumes her on completion, and is limited to one',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:1000},playerFaction:'prism',enemyFaction:'shadow'},
    makeWorker:()=>{}, makeWarrior:()=>{}, makeWarbot:()=>{}, makeLegionnaireSquad:()=>{},
    makeWizard:()=>{}, makeNecromancer:()=>{}, makeTank:()=>{}, makeStarFighter:()=>{},
    makeSkyAttacker:()=>{}, makeWarship:()=>{}, makeLightFighter:()=>{}, makeDestroyer:()=>{},
    updateRtsHUD:()=>{}, rtsSetLog:()=>{},
    queueUnit:(building,label,time,fn,unitType)=>{ building.queue.push({label,time,fn,unitType}); return true; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const temple={id:1,type:'base',side:'player',faction:'prism',x:0,y:0,queue:[]};
    S.entities=[temple];

    // No Prism yet — the Arkship can't be queued.
    executeCommand({type:'train_unit',buildingId:1,unitType:'arkship',side:'player'});
    const withoutPrism={gold:S.gold.player,queued:temple.queue.length};

    const prism=makePrism('player','prism',10,10);
    S.entities.push(prism);
    executeCommand({type:'train_unit',buildingId:1,unitType:'arkship',side:'player'});
    const afterQueue={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};

    // Can't queue a second Arkship while one is already queued.
    executeCommand({type:'train_unit',buildingId:1,unitType:'arkship',side:'player'});
    const secondAttempt={gold:S.gold.player,queued:temple.queue.length};

    // Completing the build removes the Prism and the Arkship appears
    // where she stood.
    const ark=temple.queue[0].fn();
    const prismGoneAfterBuild=!S.entities.includes(prism);

    return {withoutPrism,afterQueue,secondAttempt,prismGoneAfterBuild,ark:{subtype:ark.subtype,x:ark.x,y:ark.y}};
  })()`,context);

  const arkshipCost=vm.runInContext('FACTION_CFG.prism.arkshipCost',context);
  const arkshipOil=vm.runInContext('FACTION_CFG.prism.arkshipOilCost',context);
  assert.deepEqual({...result.withoutPrism},{gold:1000,queued:0});
  assert.deepEqual({...result.afterQueue},{gold:1000-arkshipCost,light:1000-arkshipOil,queued:1});
  assert.deepEqual({...result.secondAttempt},{gold:1000-arkshipCost,queued:1});
  assert.equal(result.prismGoneAfterBuild,true);
  assert.deepEqual({...result.ark},{subtype:'arkship',x:60,y:10});
});

test('toggle_arkship_mode deploys the Prism with 5 Witches exactly once, and switching back keeps them on the field',()=>{
  const context=makeContext();
  Object.assign(context,{
    S:{frame:0,entities:[],particles:[],gold:{player:0},oil:{player:0},playerFaction:'prism',enemyFaction:'shadow'},
    window:{_mpMultiplayer:false}, mpConnected:false,
    FACTION_CFG:{prism:{color:'#00ddff'}}, rtsSetLog:()=>{}, updateRtsHUD:()=>{}, sfx:()=>{},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0}},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const ark=makeArkship('player','prism',100,100);
    S.entities=[ark];
    executeCommand({type:'toggle_arkship_mode',unitId:ark.id,side:'player'});
    const afterPhasing={mode:ark.arkMode,deployed:ark.deployedCrew,count:S.entities.length,
      subtypeCounts:S.entities.reduce((acc,e)=>{const k=e.subtype||'witch';acc[k]=(acc[k]||0)+1;return acc;},{})};

    executeCommand({type:'toggle_arkship_mode',unitId:ark.id,side:'player'});
    const afterAttacking={mode:ark.arkMode,count:S.entities.length};

    executeCommand({type:'toggle_arkship_mode',unitId:ark.id,side:'player'});
    const afterSecondPhasing={mode:ark.arkMode,count:S.entities.length};

    return {afterPhasing,afterAttacking,afterSecondPhasing};
  })()`,context);

  assert.equal(result.afterPhasing.mode,'phasing');
  assert.equal(result.afterPhasing.deployed,true);
  assert.equal(result.afterPhasing.count,7); // arkship + prism + 5 witches
  assert.deepEqual({...result.afterPhasing.subtypeCounts},{arkship:1,prism:1,witch:5});

  assert.equal(result.afterAttacking.mode,'attacking');
  assert.equal(result.afterAttacking.count,7);

  assert.equal(result.afterSecondPhasing.mode,'phasing');
  assert.equal(result.afterSecondPhasing.count,7); // no second deployment
});

test('Arkship fires twin beams in attacking mode — a second enemy in range takes a separate beam, otherwise the lone target takes both',()=>{
  const context=makeContext();
  Object.assign(context,{
    S:{frame:100,entities:[],particles:[]},
    window:{_mpMultiplayer:false},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0}},
    FACTION_CFG:{prism:{color:'#00ddff'}}, sfx:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const ark=makeArkship('player','prism',100,100);
    ark.x=100; ark.y=100;
    const t1={id:1,side:'enemy',hp:100,x:150,y:100};
    const t2={id:2,side:'enemy',hp:100,x:100,y:200};
    S.entities=[ark,t1,t2];
    arkshipBeamAttackTick(ark,t1);
    const twoTargets={t1hp:t1.hp,t2hp:t2.hp,beamTarget:ark.beamTarget.id,beamTarget2:ark.beamTarget2.id};

    S.entities=[ark,t1];
    t1.hp=100;
    arkshipBeamAttackTick(ark,t1);
    const soloTarget={damage:100-t1.hp,beamTarget:ark.beamTarget.id,beamTarget2:ark.beamTarget2.id};

    ark.arkMode='phasing';
    t1.hp=100;
    arkshipBeamAttackTick(ark,t1);
    const phasing={hp:t1.hp,beamTarget:ark.beamTarget,beamTarget2:ark.beamTarget2};

    return {twoTargets,soloTarget,phasing};
  })()`,context);

  assert.ok(result.twoTargets.t1hp<100 && result.twoTargets.t2hp<100);
  assert.deepEqual({beamTarget:result.twoTargets.beamTarget,beamTarget2:result.twoTargets.beamTarget2},{beamTarget:1,beamTarget2:2});
  assert.deepEqual({beamTarget:result.soloTarget.beamTarget,beamTarget2:result.soloTarget.beamTarget2},{beamTarget:1,beamTarget2:1});
  assert.equal(result.soloTarget.damage,result.twoTargets.t1hp>0?(100-result.twoTargets.t1hp)*2:result.soloTarget.damage);
  assert.deepEqual({...result.phasing},{hp:100,beamTarget:null,beamTarget2:null});
});

test('Prism Arkship uses a distinct renderer from the Warship and Light Fighter',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','warriors.js'),'utf8');
  assert.match(source,/w\.subtype==='arkship'[\s\S]*?drawArkshipUnit\(rc,cfg,w\)/);
});

test('Ling cannot target aerial units',()=>{
  const context=makeContext();
  Object.assign(context,{
    STRUCT_COSTS:{
      barracks:{gold:20}, cannon:{gold:20},
      structure:{gold:20,oil:0}, aerial:{gold:20,oil:0},
      oilrig:{gold:20},
    },
    window:{_mpMultiplayer:false}, S:{entities:[],playerBase:null,enemyBase:null},
  });
  const gameSource=fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8');
  vm.runInContext(gameSource,context);
  const result=vm.runInContext(`(() => {
    const unit=makeLing('player',100,100);
    return canTargetAerial(unit);
  })()`,context);
  assert.equal(result,false);
});
