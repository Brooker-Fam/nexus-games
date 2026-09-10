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
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'td', 'logic.js'), 'utf8');
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
