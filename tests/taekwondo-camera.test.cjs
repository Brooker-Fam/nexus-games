const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const model = import('../js/taekwondo/model.js');
const controllerSource = fs.readFileSync(path.join(__dirname, '../js/taekwondo/game.js'), 'utf8')
  .replace(/^import .*;\n/gm, '');

async function harness() {
  const captured = [];
  const exceptions = [];
  const element = () => ({ value: 'easy', dataset: {}, addEventListener() {}, setAttribute() {} });
  const refs = new Proxy({}, { get: (target, key) => target[key] ||= element() });
  const posthog = {
    capture: (event, props) => captured.push({ event, props }),
    captureException: (error, props) => exceptions.push({ error, props }),
  };
  const context = vm.createContext({
    ...await model,
    performance: { now: () => 1000 },
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: element, addEventListener() {} },
    window: { addEventListener() {}, registerGame() {}, posthog },
    location: { hash: '' },
    posthog,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    createDojoView: () => refs,
    DojoRenderer: class { burst() {} render() {} },
    createPoseTracker: () => ({ start() {}, stop() {} }),
  });
  vm.runInContext(controllerSource, context);
  vm.runInContext('active = true;', context);
  return {
    events: name => captured.filter(entry => entry.event === name),
    exceptions,
    cameraError(error) { vm.runInContext('cameraError', context)(error); },
    startCamera() { return vm.runInContext('startCamera', context)(); },
  };
}

test('expected camera faults are shown but never reported as exceptions', async () => {
  for (const reason of ['camera_disconnected', 'video_failed', 'permission_timeout', 'unsupported_browser']) {
    const app = await harness();
    app.cameraError({ name: 'Error', reason, expected: true, message: 'friendly copy' });
    assert.equal(app.exceptions.length, 0);
    const failed = app.events('taekwondo_camera_failed');
    assert.equal(failed.length, 1);
    assert.equal(failed[0].props.reason, reason);
  }
});

test('handled device conditions from getUserMedia are not reported as exceptions', async () => {
  for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError']) {
    const app = await harness();
    app.cameraError({ name, message: 'device condition' });
    assert.equal(app.exceptions.length, 0);
    assert.equal(app.events('taekwondo_camera_failed')[0].props.reason, name);
  }
});

test('worker load failures are still reported as exceptions', async () => {
  const app = await harness();
  const error = { name: 'Error', reason: 'worker_failed', message: 'Body tracking could not run.' };
  app.cameraError(error);
  assert.equal(app.exceptions.length, 1);
  assert.equal(app.exceptions[0].error, error);
  assert.equal(app.events('taekwondo_camera_failed')[0].props.reason, 'worker_failed');
});

test('cancellation is neither reported nor counted as a failure', async () => {
  const app = await harness();
  app.cameraError({ name: 'AbortError', message: 'Camera session cancelled.' });
  assert.equal(app.exceptions.length, 0);
  assert.equal(app.events('taekwondo_camera_failed').length, 0);
});

test('starting the camera records a session start for the failure denominator', async () => {
  const app = await harness();
  await app.startCamera();
  assert.equal(app.events('taekwondo_camera_started').length, 1);
});
