const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const visible = point => point && Number.isFinite(point.x) && Number.isFinite(point.y)
  && point.visibility >= 0.55 && point.x > 0.015 && point.x < 0.985 && point.y > 0.015 && point.y < 0.985;

export const DEMO_STANCE = Object.freeze({
  centerX: 0.5, shoulderY: 0.25, hipY: 0.55, floorY: 0.9, bodyHeight: 0.65, aspect: 16 / 9,
});

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
  constructor(calibration, difficulty = 'easy') {
    this.calibration = calibration;
    this.difficulty = difficulty;
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
    const { centerX, floorY, hipY, bodyHeight, aspect } = this.calibration;
    const radius = clamp(bodyHeight * (this.difficulty === 'easy' ? 0.12 : 0.095), 0.04, 0.078);
    const side = this.sequence % 2 ? 'right' : 'left';
    const offset = bodyHeight * 0.48 / aspect;
    const height = this.difficulty === 'easy' ? 0.5 : [0.55, 0.72, 0.62, 0.8][this.sequence % 4];
    const total = this.difficulty === 'easy' ? 4 : 2.8;
    this.target = {
      x: clamp(centerX + (side === 'left' ? -offset : offset), radius / aspect + 0.03, 1 - radius / aspect - 0.03),
      y: floorY - (floorY - hipY) * height,
      radius, remaining: total, total, side, id: this.sequence++,
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
