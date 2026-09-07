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

test('ground units cannot walk into an enemy building', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const base={id:1,type:'base',side:'enemy',x:500,y:500,hp:300};
    const worker={id:2,type:'worker',side:'player',x:505,y:500,hp:20};
    S.entities=[base,worker];
    resolveUnitCollisions();
    return {bx:base.x,by:base.y,dist:Math.hypot(worker.x-base.x,worker.y-base.y)};
  })()`, context);
  assert.equal(result.bx, 500); // buildings never move
  assert.equal(result.by, 500);
  assert.ok(result.dist >= 37, `worker should be pushed outside the base footprint, got dist ${result.dist}`);
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

test('a worker docked at its own build target is exempt from that building\'s collision', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const ghost={id:1,type:'structure',side:'player',x:100,y:100,hp:160,underConstruction:true};
    const worker={id:2,type:'worker',side:'player',x:105,y:100,hp:20,state:'building',buildTarget:{x:100,y:100,ghost}};
    S.entities=[ghost,worker];
    resolveUnitCollisions();
    return {wx:worker.x,wy:worker.y};
  })()`, context);
  assert.deepEqual({ ...result }, { wx: 105, wy: 100 });
});

test('a worker mining its assigned oil rig is exempt from that rig\'s collision', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const rig={id:1,type:'structure',side:'player',isOilRig:true,x:300,y:300,hp:160};
    const worker={id:2,type:'worker',side:'player',x:305,y:300,hp:20,state:'mining',target:rig};
    S.entities=[rig,worker];
    resolveUnitCollisions();
    return {wx:worker.x,wy:worker.y};
  })()`, context);
  assert.deepEqual({ ...result }, { wx: 305, wy: 300 });
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
