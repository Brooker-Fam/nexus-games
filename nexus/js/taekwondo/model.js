const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const visible = point => point && Number.isFinite(point.x) && Number.isFinite(point.y)
  && point.visibility >= 0.55 && point.x > 0.015 && point.x < 0.985 && point.y > 0.015 && point.y < 0.985;

export const DEMO_STANCE = Object.freeze({
  centerX: 0.5, shoulderY: 0.25, hipY: 0.55, floorY: 0.9, bodyHeight: 0.65, aspect: 16 / 9,
});

// Kick catalog. `reach` is the ideal target height as a fraction of the
// player's standing height (0.58 ≈ belt, 0.72 ≈ solar plexus, 0.9 ≈ head);
// `spread` is the sideways distance from the body centre in body heights.
// Each kick gets its own height and lane so pads for different kicks never
// land on the same spot: axe drops close in, front kicks straight ahead,
// back and side kicks drive low and long, and the turning kicks go high and wide.
export const KICKS = Object.freeze({
  front: Object.freeze({ name: 'Front kick', korean: 'Ap chagi', reach: 0.7, spread: 0.26 }),
  roundhouse: Object.freeze({ name: 'Roundhouse', korean: 'Dollyo chagi', reach: 0.8, spread: 0.5 }),
  side: Object.freeze({ name: 'Side kick', korean: 'Yeop chagi', reach: 0.62, spread: 0.74 }),
  back: Object.freeze({ name: 'Back kick', korean: 'Dwit chagi', reach: 0.58, spread: 0.4 }),
  axe: Object.freeze({ name: 'Axe kick', korean: 'Naeryo chagi', reach: 0.94, spread: 0.14 }),
  hook: Object.freeze({ name: 'Hook kick', korean: 'Huryeo chagi', reach: 0.88, spread: 0.64 }),
});

// Span of natural kick heights, squeezed under a less flexible player's cap.
const LOWEST_REACH = 0.58;
const HIGHEST_REACH = 0.94;

// The highest a player is comfortable kicking, as a fraction of their height.
export const FLEXIBILITY = Object.freeze({
  stiff: Object.freeze({ name: 'Stiff · waist high', cap: 0.5 }),
  average: Object.freeze({ name: 'Average · stomach high', cap: 0.64 }),
  flexible: Object.freeze({ name: 'Flexible · chest high', cap: 0.78 }),
  splits: Object.freeze({ name: 'Very flexible · head high', cap: 0.94 }),
});

export const DEFAULT_PROFILE = Object.freeze({
  heightCm: 160, units: 'cm', flexibility: 'average', kicks: Object.freeze(['front', 'roundhouse', 'side']),
});

// Standing proportions used to map real heights onto the calibrated body,
// whose span runs from the ankles to the shoulders.
const ANKLE_HEIGHT = 0.039;
const SHOULDER_HEIGHT = 0.818;

export function normalizeProfile(profile = {}) {
  const heightCm = Number(profile.heightCm);
  const kicks = Array.isArray(profile.kicks) ? profile.kicks.filter(kick => KICKS[kick]) : [];
  return {
    heightCm: Number.isFinite(heightCm) ? clamp(Math.round(heightCm), 90, 230) : DEFAULT_PROFILE.heightCm,
    units: profile.units === 'ftin' ? 'ftin' : 'cm',
    flexibility: FLEXIBILITY[profile.flexibility] ? profile.flexibility : DEFAULT_PROFILE.flexibility,
    kicks: [...new Set(kicks)],
  };
}

export function formatHeight(cm, units = 'cm') {
  if (units !== 'ftin') return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

// Fraction of standing height a kick's pad sits at: the kick's natural
// target, with the whole kick range compressed under what the player's
// flexibility allows so kicks keep their relative heights instead of all
// collapsing onto the cap.
export function kickReach(kick, flexibility, difficulty = 'easy') {
  const top = Math.min(FLEXIBILITY[flexibility].cap, HIGHEST_REACH);
  const bottom = Math.max(0.36, Math.min(LOWEST_REACH, top - 0.2));
  const reach = bottom + (KICKS[kick].reach - LOWEST_REACH) * (top - bottom) / (HIGHEST_REACH - LOWEST_REACH);
  return difficulty === 'easy' ? reach * 0.92 : reach;
}

export function bodyVisible(points) {
  return [11, 12, 23, 24, 25, 26, 27, 28, 31, 32].every(index => visible(points?.[index]));
}

export function measureStance(points, aspect) {
  if (!bodyVisible(points)) return null;
  const shoulderY = (points[11].y + points[12].y) / 2;
  const hipY = (points[23].y + points[24].y) / 2;
  const floorY = (points[27].y + points[28].y) / 2;
  const bodyHeight = floorY - shoulderY;
  if (bodyHeight < 0.32 || shoulderY > hipY - 0.1 || hipY > floorY - 0.16
    || Math.abs(points[27].y - points[28].y) > bodyHeight * 0.12) return null;
  return { centerX: (points[23].x + points[24].x) / 2, shoulderY, hipY, floorY, bodyHeight, aspect };
}

function segmentDistance(start, end, point, aspect) {
  const dx = (end.x - start.x) * aspect;
  const dy = end.y - start.y;
  const px = (point.x - start.x) * aspect;
  const py = point.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp((px * dx + py * dy) / length, 0, 1) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

export class KickDetector {
  constructor(calibration) {
    this.calibration = calibration;
    this.reset();
  }

  reset() {
    this.feet = { left: { armed: false }, right: { armed: false } };
  }

  update(points, timestamp, target) {
    const { aspect, bodyHeight, floorY } = this.calibration;
    let hit = null;
    for (const [side, ankle, toe] of [['left', 27, 31], ['right', 28, 32]]) {
      const foot = this.feet[side];
      if (!visible(points?.[ankle]) || !visible(points?.[toe])) {
        this.feet[side] = { armed: false };
        continue;
      }
      const point = {
        x: (points[ankle].x + points[toe].x) / 2,
        y: (points[ankle].y + points[toe].y) / 2,
      };
      if (point.y >= floorY - bodyHeight * 0.07) foot.armed = true;
      const elapsed = (timestamp - foot.timestamp) / 1000;
      if (!hit && target && foot.armed && foot.point && elapsed > 0 && elapsed <= 0.22) {
        const distance = Math.hypot((point.x - foot.point.x) * aspect, point.y - foot.point.y);
        const speed = distance / elapsed;
        const radius = target.radius + bodyHeight * 0.02;
        const previouslyOutside = Math.hypot((foot.point.x - target.x) * aspect, foot.point.y - target.y) > radius;
        if (point.y < floorY - bodyHeight * 0.14 && speed > bodyHeight * 0.6
          && speed < bodyHeight * 14 && distance > bodyHeight * 0.018 && previouslyOutside
          && segmentDistance(foot.point, point, target, aspect) <= radius) {
          hit = side;
          foot.armed = false;
        }
      }
      foot.point = point;
      foot.timestamp = timestamp;
    }
    return hit;
  }
}

export class DojoRound {
  constructor(calibration, difficulty = 'easy', profile = DEFAULT_PROFILE) {
    this.calibration = calibration;
    this.difficulty = difficulty;
    this.profile = normalizeProfile(profile);
    if (!this.profile.kicks.length) this.profile.kicks = [...DEFAULT_PROFILE.kicks];
    this.remaining = 60;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.sequence = 0;
    this.recovery = 0;
    this.spawn();
  }

  get finished() { return this.remaining <= 0; }
  get accuracy() { return this.hits + this.misses ? Math.round(this.hits / (this.hits + this.misses) * 100) : 0; }

  spawn() {
    const { centerX, floorY, bodyHeight, aspect } = this.calibration;
    const { heightCm, units, flexibility, kicks } = this.profile;
    const radius = clamp(bodyHeight * (this.difficulty === 'easy' ? 0.12 : 0.095), 0.04, 0.078);
    const side = this.sequence % 2 ? 'right' : 'left';
    const kick = kicks[Math.floor(this.sequence / 2) % kicks.length];
    const reach = kickReach(kick, flexibility, this.difficulty);
    const stature = bodyHeight / (SHOULDER_HEIGHT - ANKLE_HEIGHT);
    const offset = bodyHeight * KICKS[kick].spread / aspect;
    const total = this.difficulty === 'easy' ? 4 : 2.8;
    this.target = {
      x: clamp(centerX + (side === 'left' ? -offset : offset), radius / aspect + 0.03, 1 - radius / aspect - 0.03),
      y: clamp(floorY - (reach - ANKLE_HEIGHT) * stature, radius + 0.03, floorY - bodyHeight * 0.2),
      radius, remaining: total, total, side, id: this.sequence++,
      kick, kickName: KICKS[kick].name, heightCm: reach * heightCm, heightLabel: formatHeight(reach * heightCm, units),
    };
  }

  advance(seconds) {
    if (this.finished || !Number.isFinite(seconds) || seconds <= 0) return;
    this.remaining = Math.max(0, this.remaining - seconds);
    if (this.finished) {
      this.target = null;
      return;
    }
    if (!this.target) {
      this.recovery -= seconds;
      if (this.recovery <= 0) this.spawn();
    } else {
      this.target.remaining -= seconds;
      if (this.target.remaining <= 0) {
        this.misses++;
        this.combo = 0;
        this.target = null;
        this.recovery = 0.4;
      }
    }
  }

  hit() {
    if (!this.target || this.finished) return null;
    const target = this.target;
    this.hits++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const points = 100 * Math.min(4, 1 + Math.floor((this.combo - 1) / 5));
    this.score += points;
    this.target = null;
    this.recovery = 0.45;
    return { ...target, points };
  }
}

//# sourceMappingURL=model.js.map
