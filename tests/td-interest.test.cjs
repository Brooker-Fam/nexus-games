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

test('boss interest pays 10% on each complete block of 50 gold', () => {
  const context = makeContext();
  const interest = vm.runInContext('[calculateBossInterest(49), calculateBossInterest(50), calculateBossInterest(149), calculateBossInterest(200)]', context);
  assert.deepEqual([...interest], [0, 5, 10, 20]);
});

test('killing a boss awards interest while killing a grunt does not', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    state.gold = 125;
    state.wave = 5;
    state.waveActive = true;
    state.waveEnemiesLeft = 1;
    const enemy = boss => ({
      x: 0, y: 0, wpIdx: 0, hp: 0, boss,
      speed: 0, slow: 0,
    });
    state.enemies = [enemy(false)];
    tick();
    const afterGrunt = state.gold;
    state.enemies = [enemy(true)];
    tick();
    return { afterGrunt, afterBoss: state.gold };
  })()`, context);

  assert.deepEqual({ ...result }, { afterGrunt: 125, afterBoss: 135 });
});
