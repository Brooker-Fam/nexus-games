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
  const presentation=vm.runInContext('({label:FACTION_CFG.prism.eliteLabel,desc:FACTION_CFG.prism.eliteDesc})',factionContext);
  assert.equal(presentation.label,'PRINCESS');
  assert.match(presentation.desc,/Legionnaires/);
});
