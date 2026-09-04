const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeContext(){
  const context=vm.createContext({S:{map:null,mapDecor:[],goldNodes:[]},console});
  vm.runInContext('const RW=4000, RH=1400, PLAYER_BASE_X=160, ENEMY_BASE_X=3840, BASE_Y=700;',context);
  for(const file of ['rng.js','maps.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','rts',file),'utf8'),context);
  }
  return context;
}

test('battlefields and resource jitter are repeatable from a seed',()=>{
  const context=makeContext();
  const generate=seed=>vm.runInContext(`(() => {
    rtsRandSeed(${seed}); makeBattlefield(); makeMapGoldNodes();
    return JSON.stringify({map:S.map.id,decor:S.mapDecor,nodes:S.goldNodes});
  })()`,context);
  assert.equal(generate(92741),generate(92741));
});

test('random map generation offers multiple layouts and mirrored resources',()=>{
  const context=makeContext();
  const result=vm.runInContext(`(() => {
    const maps=new Set(); let fair=true;
    for(let seed=1;seed<=30;seed++){
      rtsRandSeed(seed); makeBattlefield(); makeMapGoldNodes(); maps.add(S.map.id);
      const owned=S.goldNodes.filter(n=>n.owner!=='neutral');
      const players=owned.filter(n=>n.owner==='player');
      const enemies=owned.filter(n=>n.owner==='enemy');
      fair=fair && players.length===enemies.length && players.every((p,i)=>
        Math.abs((p.x+enemies[i].x)-RW)<.001 && p.y===enemies[i].y
      );
    }
    return {count:maps.size,fair};
  })()`,context);
  assert.ok(result.count>=4,'seeds should select a useful variety of maps');
  assert.equal(result.fair,true);
});

test('battlefield decoration and every gold deposit are horizontally symmetrical',()=>{
  const context=makeContext();
  const result=vm.runInContext(`(() => {
    const mirrored=(items,item)=>items.some(other=>
      Math.abs(other.x-(RW-item.x))<.001 && Math.abs(other.y-item.y)<.001
    );
    const result={palette:true,decor:true,gold:true};
    for(let seed=1;seed<=30;seed++){
      rtsRandSeed(seed); makeBattlefield(); makeMapGoldNodes();
      result.palette=result.palette && S.map.colors[0]===S.map.colors[2];
      result.decor=result.decor && S.mapDecor.every(item=>mirrored(S.mapDecor,item));
      result.gold=result.gold && S.goldNodes.every(item=>mirrored(S.goldNodes,item));
    }
    return result;
  })()`,context);
  assert.equal(result.palette,true);
  assert.equal(result.decor,true);
  assert.equal(result.gold,true);
});

test('starting gold forms tight mirrored half circles around the bases',()=>{
  const context=makeContext();
  const result=vm.runInContext(`(() => {
    rtsRandSeed(7204); makeBattlefield(); makeMapGoldNodes();
    const players=S.goldNodes.filter(node=>node.owner==='player');
    const radii=players.map(node=>Math.hypot(node.x-PLAYER_BASE_X,node.y-BASE_Y));
    return {
      allInward:players.every(node=>node.x>PLAYER_BASE_X),
      minRadius:Math.min(...radii), maxRadius:Math.max(...radii),
      mirrored:players.every(player=>S.goldNodes.some(enemy=>
        enemy.owner==='enemy' && Math.abs(enemy.x-(RW-player.x))<.001 && enemy.y===player.y
      )),
    };
  })()`,context);
  assert.equal(result.allInward,true);
  assert.ok(result.minRadius>=215 && result.maxRadius<=235,'gold arcs should stay compact');
  assert.equal(result.mirrored,true);
});
