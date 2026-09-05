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
      spawned:{subtype:first.subtype,faction:first.faction,infested:first.infested},
      nextQueue:factory.queue.map(item=>item.unitType),
    };
  })()`,context);

  assert.equal(result.afterInfest.infested,true);
  assert.deepEqual([...result.afterInfest.queue],['infestedGunbot']);
  assert.equal(result.afterDroneAttempt.gold,1000);
  assert.deepEqual([...result.afterDroneAttempt.queue],['infestedGunbot']);
  assert.deepEqual({...result.spawned},{subtype:'infestedGunbot',faction:'roboto',infested:true});
  assert.deepEqual([...result.nextQueue],['infestedGunbot']);
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

test('Prism Princess uses a distinct renderer from the Oracle',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','warriors.js'),'utf8');

  assert.match(source,/w\.subtype==='princess'[\s\S]*?drawPrincess\(rc,cfg,w\)/);
  assert.match(source,/w\.subtype==='elite'[\s\S]*?drawEliteOracle\(rc,cfg,w\)/);
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
