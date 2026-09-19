const assert = require('node:assert/strict');
const test = require('node:test');

const model = import('../nexus/js/taekwondo/model.js');
const stance = { centerX: 0.5, shoulderY: 0.25, hipY: 0.55, floorY: 0.9, bodyHeight: 0.65, aspect: 16 / 9 };

function pose() {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.2, visibility: 1 }));
  for (const [left, right, y] of [[11, 12, 0.25], [23, 24, 0.55], [25, 26, 0.72], [27, 28, 0.9], [31, 32, 0.91]]) {
    points[left] = { x: 0.44, y, visibility: 1 };
    points[right] = { x: 0.56, y, visibility: 1 };
  }
  return points;
}

test('calibration requires visible feet and a standing pose', async () => {
  const { measureStance } = await model;
  assert.ok(measureStance(pose(), stance.aspect));
  const hidden = pose();
  hidden[27].visibility = 0.1;
  assert.equal(measureStance(hidden, stance.aspect), null);
  const cropped = pose();
  cropped[32].y = 1.08;
  assert.equal(measureStance(cropped, stance.aspect), null);
  const kicking = pose();
  kicking[27].y = 0.65;
  assert.equal(measureStance(kicking, stance.aspect), null);
});

test('swept foot contact catches a fast kick between camera frames once', async () => {
  const { KickDetector } = await model;
  const detector = new KickDetector(stance);
  const target = { x: 0.32, y: 0.68, radius: 0.065 };
  const points = pose();
  detector.update(points, 0, target);
  points[27] = points[31] = { x: 0.2, y: 0.46, visibility: 1 };
  assert.equal(detector.update(points, 100, target), 'left');
  assert.equal(detector.update(points, 150, target), null);
  points[27] = points[31] = { x: 0.44, y: 0.9, visibility: 1 };
  assert.equal(detector.update(points, 200, target), null);
  points[27] = points[31] = { x: 0.2, y: 0.46, visibility: 1 };
  assert.equal(detector.update(points, 300, target), 'left');
});

test('hidden feet and stale camera samples cannot register kicks', async () => {
  const { KickDetector } = await model;
  const target = { x: 0.32, y: 0.68, radius: 0.065 };
  for (const [time, visibility] of [[100, 0.1], [1000, 1]]) {
    const detector = new KickDetector(stance);
    const points = pose();
    detector.update(points, 0, target);
    points[27] = points[31] = { x: 0.2, y: 0.46, visibility };
    assert.equal(detector.update(points, time, target), null);
  }
});

test('rounds expire targets, reset combos, and finish after 60 active seconds', async () => {
  const { DojoRound } = await model;
  const round = new DojoRound(stance, 'easy');
  round.hit();
  assert.equal(round.hits, 1);
  assert.equal(round.score, 100);
  assert.equal(round.combo, 1);
  assert.equal(round.hit(), null);
  round.advance(0.5);
  assert.ok(round.target);
  round.advance(5);
  assert.equal(round.misses, 1);
  assert.equal(round.combo, 0);
  round.advance(54.5);
  assert.equal(round.remaining, 0);
  assert.equal(round.finished, true);
  assert.equal(round.hit(), null);
});

test('calibrated targets stay below hips and inside the video on narrow screens', async () => {
  const { DojoRound } = await model;
  for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
    const round = new DojoRound({ ...stance, aspect }, 'normal');
    for (let n = 0; n < 8; n++) {
      const target = round.target;
      assert.ok(target.x > target.radius / aspect && target.x < 1 - target.radius / aspect);
      assert.ok(target.y >= stance.hipY);
      assert.ok(target.y < stance.floorY - 0.1);
      round.hit();
      round.advance(0.5);
    }
  }
});
