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

test('Gongui, the Roboto King is a unique Factory champion, distinct from the Shockbot elite',()=>{
  const context=makeContext();
  const units=vm.runInContext(`(() => ({
    shockbot:makeElite('player','roboto',100,100),
    gongui:makeGongui('player','roboto',100,100),
  }))()`,context);

  assert.equal(units.shockbot.subtype,'elite');
  assert.equal(units.gongui.subtype,'gongui');
  assert.ok(units.gongui.hp>units.shockbot.hp);
  assert.ok(units.gongui.damage>units.shockbot.damage);

  const factionContext=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),factionContext);
  const presentation=vm.runInContext('({label:FACTION_CFG.roboto.gonguiLabel,desc:FACTION_CFG.roboto.gonguiDesc,gold:FACTION_CFG.roboto.gonguiCost,oil:FACTION_CFG.roboto.gonguiOilCost})',factionContext);
  assert.equal(presentation.label,'GONGUI');
  assert.match(presentation.desc,/limit 1/);
  assert.ok(presentation.gold>0 && presentation.oil>0);
});

test('Gongui is limited to one existing, queued, or Capital-Ship-boarded unit',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:1000},oil:{player:1000},playerFaction:'roboto',enemyFaction:'shadow'},
    makeWorker:()=>{}, makeWarrior:()=>{}, makeWarbot:()=>{}, makeLegionnaireSquad:()=>{},
    makeWizard:()=>{}, makeNecromancer:()=>{}, makeTank:()=>{}, makeStarFighter:()=>{},
    makeSkyAttacker:()=>{}, makeWarship:()=>{}, makeLightFighter:()=>{}, makeDestroyer:()=>{},
    updateRtsHUD:()=>{}, rtsSetLog:()=>{},
    queueUnit:(building,label,time,fn,unitType)=>{ building.queue.push({label,time,fn,unitType}); return true; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);
  const result=vm.runInContext(`(() => {
    const factory={id:1,type:'base',side:'player',faction:'roboto',x:0,y:0,queue:[]};
    S.entities=[factory];
    executeCommand({type:'train_unit',buildingId:1,unitType:'gongui',side:'player'});
    const afterFirst={gold:S.gold.player,oil:S.oil.player,queued:factory.queue.length};
    executeCommand({type:'train_unit',buildingId:1,unitType:'gongui',side:'player'});
    const afterQueuedAttempt={gold:S.gold.player,oil:S.oil.player,queued:factory.queue.length};
    factory.queue=[];
    S.entities.push(makeGongui('player','roboto',10,10));
    executeCommand({type:'train_unit',buildingId:1,unitType:'gongui',side:'player'});
    const afterExistingAttempt={gold:S.gold.player,oil:S.oil.player,queued:factory.queue.length};
    S.entities=S.entities.filter(e=>e.subtype!=='gongui');
    S.entities.push({id:2,type:'warrior',side:'player',faction:'roboto',subtype:'capitalship',passenger:{hp:1,maxHp:1}});
    executeCommand({type:'train_unit',buildingId:1,unitType:'gongui',side:'player'});
    return {afterFirst,afterQueuedAttempt,afterExistingAttempt,afterBoardedAttempt:{gold:S.gold.player,oil:S.oil.player,queued:factory.queue.length}};
  })()`,context);
  assert.deepEqual({...result.afterFirst},{gold:920,oil:965,queued:1});
  assert.deepEqual({...result.afterQueuedAttempt},{gold:920,oil:965,queued:1});
  assert.deepEqual({...result.afterExistingAttempt},{gold:920,oil:965,queued:0});
  assert.deepEqual({...result.afterBoardedAttempt},{gold:920,oil:965,queued:0});
});

test('Roboto Capital Ship always fires one bullet at every enemy it faces, unlike the toggleable Warship',()=>{
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
    const ship=makeCapitalShip('player','roboto',100,100);
    const nearA={id:20,side:'enemy',hp:10,x:150,y:100};
    const nearB={id:21,side:'enemy',hp:10,x:100,y:250};
    const far={id:22,side:'enemy',hp:10,x:500,y:100};
    S.entities=[ship,nearA,nearB,far];
    fireWarriorProjectiles(ship,nearA);
    return S.projectiles.map(projectile=>projectile.tx.id);
  })()`,context);

  assert.deepEqual([...targets],[20,21]);
});

test('Capital Ship boards, carries, and can only deploy Gongui once landed',()=>{
  const context=makeContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),context);
  Object.assign(context,{
    window:{_mpMultiplayer:false}, mpConnected:false,
    S:{frame:0,entities:[],gold:{player:0},oil:{player:0},playerFaction:'roboto',enemyFaction:'shadow'},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0}},
    rtsSetLog:()=>{}, updateRtsHUD:()=>{}, sfx:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','commands.js'),'utf8'),context);

  const result=vm.runInContext(`(() => {
    const ship=makeCapitalShip('player','roboto',100,100);
    const gongui=makeGongui('player','roboto',110,105);
    gongui.hp=140;
    S.entities=[ship,gongui];

    const flat=()=>({
      hasPassenger:!!ship.passenger,
      passengerHp:ship.passenger?ship.passenger.hp:null,
      passengerMaxHp:ship.passenger?ship.passenger.maxHp:null,
      gonguiCount:S.entities.filter(e=>e.subtype==='gongui').length,
    });

    executeCommand({type:'deploy_gongui',unitId:ship.id,side:'player'});
    const deployWhileFlying=flat();

    executeCommand({type:'board_gongui',unitId:ship.id,side:'player'});
    const afterBoard=flat();

    executeCommand({type:'deploy_gongui',unitId:ship.id,side:'player'});
    const deployWhileAirborneStillBoarded=flat();

    executeCommand({type:'toggle_capitalship_landed',unitId:ship.id,side:'player'});
    const afterLand={landed:ship.landed,aerial:ship.aerial};

    executeCommand({type:'deploy_gongui',unitId:ship.id,side:'player'});
    const redeployed=S.entities.find(e=>e.subtype==='gongui');
    return {
      deployWhileFlying, afterBoard, deployWhileAirborneStillBoarded, afterLand,
      afterDeploy:{...flat(),gonguiHp:redeployed?redeployed.hp:null},
    };
  })()`,context);

  assert.deepEqual({...result.deployWhileFlying},{hasPassenger:false,passengerHp:null,passengerMaxHp:null,gonguiCount:1});
  assert.deepEqual({...result.afterBoard},{hasPassenger:true,passengerHp:140,passengerMaxHp:260,gonguiCount:0});
  assert.deepEqual({...result.deployWhileAirborneStillBoarded},{hasPassenger:true,passengerHp:140,passengerMaxHp:260,gonguiCount:0});
  assert.deepEqual({...result.afterLand},{landed:true,aerial:false});
  assert.deepEqual({...result.afterDeploy},{hasPassenger:false,passengerHp:null,passengerMaxHp:null,gonguiCount:1,gonguiHp:140});
});

test('A landed Capital Ship cannot move or attack until it takes off again',()=>{
  const context=makeContext();
  Object.assign(context,{
    window:{_mpMultiplayer:false},
    S:{frame:0,entities:[],projectiles:[]},
    STRUCT_COSTS:{barracks:{gold:0},cannon:{gold:0},structure:{gold:0,oil:0},aerial:{gold:0,oil:0},oilrig:{gold:0}},
    FACTION_CFG:{roboto:{color:'#fff'}},
    sfx:()=>{},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','game.js'),'utf8'),context);
  const result=vm.runInContext(`(() => {
    const ship=makeCapitalShip('player','roboto',100,100);
    ship.landed=true; ship.aerial=false;
    const enemy={id:5,type:'warrior',side:'enemy',hp:10,x:150,y:100};
    S.entities=[ship,enemy];
    const before={x:ship.x,y:ship.y,state:ship.state};
    warriorTick(ship,{x:0,y:0},{x:0,y:0});
    return {before,after:{x:ship.x,y:ship.y,state:ship.state},projectiles:S.projectiles.length};
  })()`,context);

  assert.deepEqual(result.before,result.after);
  assert.equal(result.projectiles,0);
});

test('Gongui and Capital Ship use distinct renderers from other Roboto units',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','warriors.js'),'utf8');

  assert.match(source,/w\.subtype==='gongui'[\s\S]*?drawGongui\(rc,cfg,w\)/);
  assert.match(source,/w\.subtype==='capitalship'[\s\S]*?drawCapitalShipUnit\(rc,cfg,w\)/);
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
    makePrincess:()=>{}, makeElite:()=>{},
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
    makePrincess:()=>{}, makeElite:()=>{},
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
    makePrincess:()=>{}, makeElite:()=>{},
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

test('Prism Oracle and Princess remain distinct units',()=>{
  const context=makeContext();
  const units=vm.runInContext(`(() => ({
    oracle:makeElite('player','prism',100,100),
    princess:makePrincess('player','prism',100,100),
  }))()`,context);

  assert.equal(units.oracle.subtype,'elite');
  assert.equal(units.oracle.summonsLegionnaires,undefined);
  assert.equal(units.oracle.fireRate,60);
  assert.equal(units.princess.subtype,'princess');
  assert.equal(units.princess.summonsLegionnaires,true);
  assert.equal(units.princess.fireRate,180);

  const factionContext=vm.createContext({});
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8');
  vm.runInContext(source,factionContext);
  const presentation=vm.runInContext('({oracle:FACTION_CFG.prism.eliteLabel,princess:FACTION_CFG.prism.princessLabel,desc:FACTION_CFG.prism.princessDesc,gold:FACTION_CFG.prism.princessCost,light:FACTION_CFG.prism.princessOilCost})',factionContext);
  assert.equal(presentation.oracle,'ORACLE');
  assert.equal(presentation.princess,'PRINCESS');
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

test('Prism Princess uses a distinct renderer from the Oracle',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','warriors.js'),'utf8');

  assert.match(source,/w\.subtype==='princess'[\s\S]*?drawPrincess\(rc,cfg,w\)/);
  assert.match(source,/w\.subtype==='elite'[\s\S]*?drawEliteOracle\(rc,cfg,w\)/);
});

test('Prism Princess keeps a broader, taller silhouette than the Oracle',()=>{
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
    return {oracle:trace(drawEliteOracle),princess:trace(drawPrincess)};
  })()`,context);

  assert.ok(silhouettes.princess.width>silhouettes.oracle.width);
  assert.ok(silhouettes.princess.top<silhouettes.oracle.top);
});

test('Prism Princess is limited to one existing or queued unit',()=>{
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
    executeCommand({type:'train_unit',buildingId:1,unitType:'princess',side:'player'});
    const afterFirst={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};
    executeCommand({type:'train_unit',buildingId:1,unitType:'princess',side:'player'});
    const afterQueuedAttempt={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};
    temple.queue=[];
    S.entities.push(makePrincess('player','prism',10,10));
    executeCommand({type:'train_unit',buildingId:1,unitType:'princess',side:'player'});
    return {afterFirst,afterQueuedAttempt,afterExistingAttempt:{gold:S.gold.player,light:S.oil.player,queued:temple.queue.length}};
  })()`,context);
  assert.deepEqual({...result.afterFirst},{gold:800,light:925,queued:1});
  assert.deepEqual({...result.afterQueuedAttempt},{gold:800,light:925,queued:1});
  assert.deepEqual({...result.afterExistingAttempt},{gold:800,light:925,queued:0});
});

test('Prism Princess trains at the Temple rather than the Shrine',()=>{
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

  assert.deepEqual([...locations.temple],['ACOLYTE','PRINCESS']);
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
