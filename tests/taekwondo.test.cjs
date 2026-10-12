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

test('targets stay inside the video on narrow screens', async () => {
  const { DojoRound } = await model;
  for (const aspect of [9 / 16, 4 / 3, 16 / 9]) {
    const round = new DojoRound({ ...stance, aspect }, 'normal', { heightCm: 170, flexibility: 'splits', kicks: ['axe', 'side', 'hook'] });
    for (let n = 0; n < 8; n++) {
      const target = round.target;
      assert.ok(target.x > target.radius / aspect && target.x < 1 - target.radius / aspect);
      assert.ok(target.y > target.radius && target.y < stance.floorY - 0.1);
      round.hit();
      round.advance(0.5);
    }
  }
});

test('targets cycle through known kicks on alternating legs', async () => {
  const { DojoRound } = await model;
  const round = new DojoRound(stance, 'normal', { kicks: ['side', 'axe'] });
  const seen = [];
  for (let n = 0; n < 5; n++) {
    seen.push(`${round.target.kick}:${round.target.side}`);
    round.hit();
    round.advance(0.5);
  }
  assert.deepEqual(seen, ['side:left', 'side:right', 'axe:left', 'axe:right', 'side:left']);
  assert.deepEqual(new DojoRound(stance, 'easy', { kicks: [] }).profile.kicks, ['front', 'roundhouse', 'side']);
});

test('flexibility caps kick height and taller players get higher real-world pads', async () => {
  const { DojoRound } = await model;
  const pad = (flexibility, heightCm = 170, kick = 'axe') => new DojoRound(stance, 'normal', { heightCm, flexibility, kicks: [kick] }).target;
  const heights = ['stiff', 'average', 'flexible', 'splits'].map(level => pad(level));
  for (let n = 1; n < heights.length; n++) {
    assert.ok(heights[n].y < heights[n - 1].y, 'more flexibility raises the pad on screen');
    assert.ok(heights[n].heightCm > heights[n - 1].heightCm);
  }
  assert.ok(pad('stiff').y > stance.hipY - 0.05, 'stiff players kick around waist height');
  assert.ok(pad('splits').y < stance.shoulderY, 'head-height kicks sit above the shoulders');
  assert.equal(pad('splits', 150).heightCm < pad('splits', 190).heightCm, true);
  assert.ok(pad('stiff', 170, 'front').heightCm < pad('stiff', 170, 'axe').heightCm, 'capped kicks keep distinct heights');
  assert.ok(pad('stiff', 170, 'axe').heightCm <= 0.5 * 170 + 1e-9, 'no pad rises above the flexibility cap');
  assert.ok(pad('splits', 170, 'front').y > pad('splits', 170, 'axe').y, 'kick type sets the target height');
});

test('every kick gets its own pad position', async () => {
  const { DojoRound, KICKS, FLEXIBILITY } = await model;
  for (const flexibility of Object.keys(FLEXIBILITY)) {
    const pads = Object.keys(KICKS).map(kick => new DojoRound(stance, 'normal', { heightCm: 170, flexibility, kicks: [kick] }).target);
    for (let a = 0; a < pads.length; a++) {
      for (let b = a + 1; b < pads.length; b++) {
        const apart = Math.hypot((pads[a].x - pads[b].x) * stance.aspect, pads[a].y - pads[b].y);
        assert.ok(apart > pads[a].radius * 0.6, `${pads[a].kick} and ${pads[b].kick} overlap at ${flexibility}`);
      }
    }
  }
});

test('profile input is sanitised and heights format in either unit', async () => {
  const { normalizeProfile, formatHeight } = await model;
  assert.deepEqual(normalizeProfile({ heightCm: 999, units: 'x', flexibility: 'rubber', kicks: ['axe', 'axe', 'flying'] }),
    { heightCm: 230, units: 'cm', flexibility: 'average', kicks: ['axe'] });
  assert.equal(formatHeight(152.4, 'ftin'), '5′0″');
  assert.equal(formatHeight(120.2), '120 cm');
});
