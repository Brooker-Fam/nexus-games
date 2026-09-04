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

test('warship has another tenfold attack-rate increase',()=>{
  const context=makeContext();
  const stats=vm.runInContext(`(() => {
    const warship=makeWarship('player','roboto',100,100);
    return {damage:warship.damage,fireRate:warship.fireRate,burstCount:warship.burstCount};
  })()`,context);

  assert.deepEqual({...stats},{damage:4,fireRate:0.7,burstCount:3});
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

test('Prism elite is a Princess that summons Legionnaires',()=>{
  const context=makeContext();
  const princess=vm.runInContext("makeElite('player','prism',100,100)",context);

  assert.equal(princess.summonsLegionnaires,true);
  assert.equal(princess.fireRate,180);

  const factionContext=vm.createContext({});
  const source=fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8');
  vm.runInContext(source,factionContext);
  const presentation=vm.runInContext('({label:FACTION_CFG.prism.eliteLabel,desc:FACTION_CFG.prism.eliteDesc,gold:FACTION_CFG.prism.eliteCost,light:FACTION_CFG.prism.eliteOilCost})',factionContext);
  assert.equal(presentation.label,'PRINCESS');
  assert.match(presentation.desc,/Legionnaires/);
  assert.match(presentation.desc,/limit 1/);
  assert.equal(presentation.gold,200);
  assert.equal(presentation.light,75);
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
    executeCommand({type:'train_unit',buildingId:1,unitType:'elite',side:'player'});
    const afterFirst={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};
    executeCommand({type:'train_unit',buildingId:1,unitType:'elite',side:'player'});
    const afterQueuedAttempt={gold:S.gold.player,light:S.oil.player,queued:temple.queue.length};
    temple.queue=[];
    S.entities.push(makeElite('player','prism',10,10));
    executeCommand({type:'train_unit',buildingId:1,unitType:'elite',side:'player'});
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
  assert.deepEqual([...locations.shrine],['WIZARD']);
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
