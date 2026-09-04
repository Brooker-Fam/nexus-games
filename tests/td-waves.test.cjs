const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeContext(){
  const elements = new Map();
  const element = () => ({
    children: [],
    classList: { add() {}, remove() {} },
    addEventListener() {},
    getContext: () => ({}),
    insertBefore(child){ this.children.unshift(child); },
    removeChild(child){ this.children.splice(this.children.indexOf(child), 1); },
    querySelectorAll: () => [],
  });
  const document = {
    createElement: element,
    getElementById(id){
      if(!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    document,
    window: {},
    console,
    Math,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    registerGame() {},
    sfx() {},
    renderPreviewGun() {},
    renderPreviewLaser() {},
    renderPreviewMissile() {},
    renderPreviewCryo() {},
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'td', 'logic.js'), 'utf8');
  vm.runInContext(source, context);
  return context;
}

test('every fifth wave is identified as a boss wave', () => {
  const context = makeContext();
  const results = vm.runInContext('[1, 4, 5, 6, 10].map(isBossWave)', context);
  assert.deepEqual([...results], [false, false, true, false, true]);
});

test('exactly the final enemy of a fifth wave spawns as the boss', () => {
  const context = makeContext();
  const bosses = vm.runInContext(`(() => {
    state.wave = 5;
    state.waveEnemiesLeft = 3;
    while(state.waveEnemiesLeft > 0){
      spawnEnemy();
      state.waveEnemiesLeft--;
    }
    return state.enemies.map(enemy => enemy.boss);
  })()`, context);
  assert.deepEqual([...bosses], [false, false, true]);
});

test('non-fifth waves do not spawn a boss', () => {
  const context = makeContext();
  const isBoss = vm.runInContext(`(() => {
    state.wave = 4;
    state.waveEnemiesLeft = 1;
    spawnEnemy();
    return state.enemies[0].boss;
  })()`, context);
  assert.equal(isBoss, false);
});
