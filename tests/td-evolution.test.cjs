const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeContext(){
  const elements = new Map();
  const element = id => {
    if(!elements.has(id)) elements.set(id, {
      children: [],
      classList: { add(){}, remove(){} },
      insertBefore(child){ this.children.unshift(child); },
      removeChild(){ this.children.pop(); },
      addEventListener(){},
      getContext(){ return {}; },
      getBoundingClientRect(){ return { left:0, top:0, width:700, height:500 }; },
      innerHTML: '', textContent: '', disabled: false,
      width: 700, height: 500,
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: {
      getElementById: element,
      createElement: () => ({ className:'', textContent:'' }),
      querySelectorAll: () => [],
    },
    window: {},
    registerGame(){},
    requestAnimationFrame(){ return 1; },
    cancelAnimationFrame(){},
    performance: { now: () => 0 },
    sfx(){}, drawBg(){}, drawPath(){}, drawTowers(){}, drawEnemies(){},
    drawBullets(){}, drawParticles(){},
    console,
    Math,
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'nexus', 'js', 'td', 'logic.js'), 'utf8');
  vm.runInContext(source, context);
  return context;
}

test('a tower levels up and evolves toward the majority kill category', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const t = createTower('gun', 0, 0);
    for(let i=0;i<20;i++) awardTowerXP(t, { evoCategory:'armored', boss:false });
    return { level: t.level, evoPath: t.evoPath, evoName: t.evoName, damage: t.damage, baseDamage: t.baseDamage };
  })()`, context);
  assert.equal(result.level, 3);
  assert.equal(result.evoPath, 'armored');
  assert.equal(result.evoName, 'Sniper');
  assert.ok(result.damage > result.baseDamage);
});

test('a tower stays at level 1 below the level-2 XP threshold', () => {
  const context = makeContext();
  const level = vm.runInContext(`(() => {
    const t = createTower('laser', 0, 0);
    awardTowerXP(t, { evoCategory:'swarm', boss:false });
    return t.level;
  })()`, context);
  assert.equal(level, 1);
});

test('relocation cost is a fraction of the tower cost', () => {
  const context = makeContext();
  const cost = vm.runInContext(`Math.round(TOWER_TYPES.missile.cost * TD_CONFIG.moveCostFactor)`, context);
  assert.equal(cost, Math.round(120 * 0.35));
});

test('adaptive resist reduces damage only from the countered tower type', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const enemy = { resistType:'gun', resistFactor:0.5 };
    return { resisted: applyResist(enemy, 10, 'gun'), unresisted: applyResist(enemy, 10, 'laser') };
  })()`, context);
  assert.equal(result.resisted, 5);
  assert.equal(result.unresisted, 10);
});

test('spamming one tower type triggers adaptation on new enemies', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    state.towers = [createTower('gun',0,0), createTower('gun',1,0), createTower('gun',2,0), createTower('gun',3,0)];
    state.wave = 5;
    state.waveEnemiesLeft = 3;
    state.waveEnemyCount = 3;
    const before = state.enemies.length;
    let sawShielded = false;
    for(let i=0;i<10 && !sawShielded;i++){
      spawnEnemy();
      sawShielded = state.enemies.some(e => e.shielded && e.resistType==='gun');
    }
    return sawShielded;
  })()`, context);
  assert.equal(result, true);
});

test('boss phase threshold heals the boss and summons minions', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    const boss = { hp: 30, maxHp: 100, phase: 0, boss: true, wpIdx: 0, route: PATH_WAYPOINTS, x:0, y:0 };
    const before = state.enemies.length;
    checkBossPhase(boss);
    return { phase: boss.phase, healed: boss.hp > 30, minionsAdded: state.enemies.length - before, expectedMinions: TD_CONFIG.bossPhaseMinionCount };
  })()`, context);
  assert.equal(result.phase, 1);
  assert.equal(result.healed, true);
  assert.equal(result.minionsAdded, result.expectedMinions);
});

test('a boss that dies splits into two smaller bosses', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    state.wave = 5;
    state.waveActive = true;
    state.waveEnemiesLeft = 0;
    state.enemies = [{ x:100, y:100, wpIdx:2, route: PATH_WAYPOINTS, hp:0, maxHp:400, boss:true, speed:0.3, slow:0, angle:0 }];
    tick();
    return state.enemies.map(e => ({ boss:e.boss, splitDepth:e.splitDepth||0 }));
  })()`, context);
  assert.equal(result.length, 2);
  for(const child of result){
    assert.equal(child.boss, true);
    assert.equal(child.splitDepth, 1);
  }
});

test('digger enemies open the shortcut once they finish tunneling', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    state.wave = 3;
    state.enemies = [{ x:0, y:0, digging:true, digTimer:1, wpIdx:0, route: PATH_WAYPOINTS, hp:10, maxHp:10, speed:0.5, slow:0, angle:0, digger:true, diggerTriggered:true }];
    tick();
    return { shortcutOpen: state.shortcutOpen, route: state.enemies[0].route === SHORTCUT_WAYPOINTS };
  })()`, context);
  assert.equal(result.shortcutOpen, true);
  assert.equal(result.route, true);
});

test('grunt kinds spawn with their own health and pay their own XP', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    state.towers = [];
    state.waveEnemiesLeft = 10;
    state.waveEnemyCount = 10;
    const realRandom = Math.random;
    // a low roll on wave 1 picks the weakest kind; a high roll late on picks the newest (toughest)
    const spawned = [[1, 0.01], [20, 0.999]].map(([wave, roll]) => {
      state.wave = wave;
      Math.random = () => roll;
      spawnEnemy();
      Math.random = realRandom;
      const e = state.enemies[state.enemies.length-1];
      const k = ENEMY_KINDS.find(k => k.id === e.kind);
      e.expectedHp = (TD_CONFIG.enemyBaseHp + wave*TD_CONFIG.enemyHpScaling + roll*20) * k.hpMult;
      e.expectedXp = k.xp;
      return e;
    });
    const t = createTower('gun', 0, 0);
    awardTowerXP(t, spawned[0]);
    const weakXp = t.xp;
    awardTowerXP(t, spawned[1]);
    return { kinds: spawned.map(e => e.kind), hp: spawned.map(e => e.maxHp), weakXp, toughXp: t.xp - weakXp,
             expectedXp: spawned.map(e => e.expectedXp), expectedHp: spawned.map(e => e.expectedHp) };
  })()`, context);
  assert.equal(result.kinds.join(','), 'triangle,square');
  assert.equal(result.hp.join(','), result.expectedHp.join(','));
  assert.equal(result.weakXp, result.expectedXp[0]);
  assert.equal(result.toughXp, result.expectedXp[1]);
  assert.ok(result.toughXp > result.weakXp);
});

test('later waves field progressively tougher enemy kinds', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    // expected HP multiplier of a spawn at each wave, from the weighted pool
    const avgMult = wave => {
      const pool = unlockedEnemyKinds(wave);
      const total = pool.length*(pool.length+1)/2;
      return pool.reduce((sum, k, i) => sum + k.hpMult*(i+1)/total, 0);
    };
    const curve = [];
    for(let w=1; w<=20; w++) curve.push(avgMult(w));
    return { curve, wave1: unlockedEnemyKinds(1).map(k => k.id).join(','),
             late: unlockedEnemyKinds(20).map(k => k.id).join(',') };
  })()`, context);
  assert.equal(result.wave1, 'triangle');
  assert.ok(!result.late.includes('triangle'), 'weak kinds retire late game');
  assert.ok(result.late.includes('square'));
  for(let i=1; i<result.curve.length; i++) assert.ok(result.curve[i] >= result.curve[i-1]);
  assert.ok(result.curve[19] > result.curve[0] * 2);
});
