const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const model = import('../nexus/js/taekwondo/model.js');
const controllerSource = fs.readFileSync(path.join(__dirname, '../nexus/js/taekwondo/game.js'), 'utf8')
  .replace(/^import .*;\n/gm, '');

async function controller() {
  let now = 1000;
  const element = () => ({ value: 'easy', dataset: {}, addEventListener() {}, setAttribute() {} });
  const refs = new Proxy({}, { get: (target, key) => target[key] ||= element() });
  const context = vm.createContext({
    ...await model,
    performance: { now: () => now },
    localStorage: { getItem: () => null },
    document: { getElementById: element, addEventListener() {} },
    window: { addEventListener() {}, registerGame() {} },
    location: { hash: '' },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    createDojoView: () => refs,
    DojoRenderer: class { burst() {} },
    createPoseTracker: () => ({ stop() {} }),
  });
  vm.runInContext(controllerSource, context);
  vm.runInContext(`
    active = true;
    phase = 'playing';
    mode = 'camera';
    calibration = { ...DEMO_STANCE };
    round = new DojoRound(calibration);
    detector = new KickDetector(calibration);
  `, context);
  return {
    target: vm.runInContext('round.target', context),
    get score() { return vm.runInContext('round.score', context); },
    receive(points, capturedAt, deliveredAt = capturedAt) {
      now = deliveredAt;
      context.receivePose(points, capturedAt);
    },
  };
}

function pose(target) {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  for (const [left, right, y] of [[11, 12, 0.25], [23, 24, 0.55], [25, 26, 0.72], [27, 28, 0.9], [31, 32, 0.91]]) {
    points[left] = { x: 0.56, y, visibility: 1 };
    points[right] = { x: 0.44, y, visibility: 1 };
  }
  if (target) points[27] = points[31] = { x: 1 - target.x, y: target.y, visibility: 1 };
  return points;
}

test('pose callbacks reject stale kicks before the next animation frame', async () => {
  const fresh = await controller();
  fresh.receive(pose(), 1000);
  fresh.receive(pose(fresh.target), 1100);
  assert.equal(fresh.score, 100);

  const delayed = await controller();
  delayed.receive(pose(), 1000);
  delayed.receive(pose(delayed.target), 1100, 1600);
  assert.equal(delayed.score, 0);
});
