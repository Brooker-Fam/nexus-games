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

test('Prism Princess is a costly royal artillery unit',()=>{
  const context=makeContext();
  const stats=vm.runInContext(`(() => {
    const princess=makePrincess('player','prism',100,100);
    return {subtype:princess.subtype,hp:princess.hp,damage:princess.damage,range:princess.range,time:BUILD_TIMES.princess};
  })()`,context);
  assert.deepEqual({...stats},{subtype:'princess',hp:260,damage:65,range:420,time:2400});

  const factionContext=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts','factions.js'),'utf8'),factionContext);
  const costs=vm.runInContext('({gold:FACTION_CFG.prism.princessCost,light:FACTION_CFG.prism.princessOilCost})',factionContext);
  assert.deepEqual({...costs},{gold:200,light:75});
});
