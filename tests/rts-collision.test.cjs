const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeContext(){
  const context = vm.createContext({
    STRUCT_COSTS: {
      barracks: { gold: 20 }, cannon: { gold: 20 },
      structure: { gold: 20, oil: 0 }, aerial: { gold: 20, oil: 0 },
      oilrig: { gold: 20 },
    },
    window: { _mpMultiplayer: false },
    S: { entities: [], playerBase: null, enemyBase: null },
    rtsRand: () => 0.5,
    RW: 4000, RH: 1400,
    console,
    Math,
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'rts', 'game.js'), 'utf8');
  vm.runInContext(source, context);
  return context;
}

test('overlapping ground warriors are pushed apart to exactly their combined radius', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const a={id:1,type:'warrior',side:'player',x:100,y:100,hp:40};
    const b={id:2,type:'warrior',side:'enemy',x:105,y:100,hp:40};
    S.entities=[a,b];
    resolveUnitCollisions();
    return {ax:a.x,ay:a.y,bx:b.x,by:b.y,dist:Math.hypot(b.x-a.x,b.y-a.y)};
  })()`, context);
  assert.ok(Math.abs(result.dist - 22) < 1e-9, `expected combined radius 22, got ${result.dist}`);
  // pushed apart symmetrically along the same axis
  assert.equal(result.ay, 100);
  assert.equal(result.by, 100);
});

test('non-overlapping units are left untouched', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const a={id:1,type:'warrior',side:'player',x:100,y:100,hp:40};
    const b={id:2,type:'worker',side:'enemy',x:300,y:100,hp:20};
    S.entities=[a,b];
    resolveUnitCollisions();
    return {ax:a.x,ay:a.y,bx:b.x,by:b.y};
  })()`, context);
  assert.deepEqual({ ...result }, { ax: 100, ay: 100, bx: 300, by: 100 });
});

test('aerial units fly through ground units and each other untouched', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const flyer={id:1,type:'warrior',subtype:'starfighter',aerial:true,side:'player',x:100,y:100,hp:70};
    const groundling={id:2,type:'warrior',side:'enemy',x:100,y:100,hp:40};
    S.entities=[flyer,groundling];
    resolveUnitCollisions();
    return {fx:flyer.x,fy:flyer.y,gx:groundling.x,gy:groundling.y};
  })()`, context);
  assert.deepEqual({ ...result }, { fx: 100, fy: 100, gx: 100, gy: 100 });
});

test('warriors cannot walk into an enemy building', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const base={id:1,type:'base',side:'enemy',x:500,y:500,hp:300};
    const warrior={id:2,type:'warrior',side:'player',x:505,y:500,hp:40};
    S.entities=[base,warrior];
    resolveUnitCollisions();
    return {bx:base.x,by:base.y,dist:Math.hypot(warrior.x-base.x,warrior.y-base.y)};
  })()`, context);
  assert.equal(result.bx, 500); // buildings never move
  assert.equal(result.by, 500);
  assert.ok(result.dist >= 39, `warrior should be pushed outside the base footprint, got dist ${result.dist}`);
});

test('workers are exempt from collision entirely — they pass through buildings and other units', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const base={id:1,type:'base',side:'enemy',x:500,y:500,hp:300};
    const warrior={id:2,type:'warrior',side:'player',x:500,y:500,hp:40};
    const workerA={id:3,type:'worker',side:'player',x:500,y:500,hp:20};
    const workerB={id:4,type:'worker',side:'player',x:500,y:500,hp:20};
    S.entities=[base,warrior,workerA,workerB];
    resolveUnitCollisions();
    return {wax:workerA.x,way:workerA.y,wbx:workerB.x,wby:workerB.y};
  })()`, context);
  // workers never move even when exactly coincident with a building and other units
  assert.deepEqual({ ...result }, { wax: 500, way: 500, wbx: 500, wby: 500 });
});

test('a melee warrior can still close to attack range against a building', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const base={id:1,type:'base',side:'enemy',x:0,y:0,hp:300};
    const warrior={id:2,type:'warrior',side:'player',x:35,y:0,hp:40,range:50};
    S.entities=[base,warrior];
    resolveUnitCollisions();
    return {dist:Math.hypot(warrior.x-base.x,warrior.y-base.y)};
  })()`, context);
  assert.ok(result.dist <= 50, `melee range should still be reachable, got dist ${result.dist}`);
});

test('dead units (hp<=0) do not participate in collision resolution', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const a={id:1,type:'warrior',side:'player',x:100,y:100,hp:0};
    const b={id:2,type:'warrior',side:'enemy',x:100,y:100,hp:40};
    S.entities=[a,b];
    resolveUnitCollisions();
    return {ax:a.x,ay:a.y,bx:b.x,by:b.y};
  })()`, context);
  assert.deepEqual({ ...result }, { ax: 100, ay: 100, bx: 100, by: 100 });
});

test('units are clamped to stay within the map bounds', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const a={id:1,type:'warrior',side:'player',x:-40,y:2000,hp:40};
    S.entities=[a];
    resolveUnitCollisions();
    return {ax:a.x,ay:a.y};
  })()`, context);
  assert.equal(result.ax, 11); // default warrior collision radius
  assert.equal(result.ay, 1400 - 11);
});

test('workers are still clamped to the map bounds even though they skip unit/building collision', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const w={id:1,type:'worker',side:'player',x:-40,y:2000,hp:20};
    S.entities=[w];
    resolveUnitCollisions();
    return {wx:w.x,wy:w.y};
  })()`, context);
  assert.equal(result.wx, 10); // fallback radius used for workers (collision radius is 0)
  assert.equal(result.wy, 1400 - 10);
});

test('exact-overlap ties are broken deterministically by entity id, not randomness', () => {
  const context = makeContext();
  const run = () => vm.runInContext(`(() => {
    const a={id:5,type:'warrior',side:'player',x:50,y:50,hp:40};
    const b={id:6,type:'warrior',side:'enemy',x:50,y:50,hp:40};
    S.entities=[a,b];
    resolveUnitCollisions();
    return {ax:a.x,bx:b.x,ay:a.y,by:b.y};
  })()`, context);
  const first = run();
  const second = run();
  // same id pair always resolves to the same positions — no Math.random involved
  assert.deepEqual({ ...first }, { ...second });
  assert.ok(Math.abs(Math.hypot(first.bx - first.ax, first.by - first.ay) - 22) < 1e-9);
});

test('a large exact-coincident stack fully separates within a handful of ticks', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const units=[];
    for(let i=0;i<30;i++) units.push({id:i+1,type:'warrior',side:'player',x:800,y:400,hp:40});
    S.entities=units;
    for(let t=0;t<20;t++) resolveUnitCollisions();
    let overlaps=0;
    for(let i=0;i<units.length;i++) for(let j=i+1;j<units.length;j++){
      const a=units[i],b=units[j];
      if(Math.hypot(a.x-b.x,a.y-b.y) < 22-0.5) overlaps++;
    }
    return {overlaps};
  })()`, context);
  assert.equal(result.overlaps, 0);
});
