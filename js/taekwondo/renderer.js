const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
];
const CYAN = '#7afcff';
const PURPLE = '#c69bff';
const TAU = Math.PI * 2;

export class DojoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.background = document.createElement('canvas');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.width = 960;
    this.height = 540;
    this.viewport = { x: 0, y: 0, width: 960, height: 540 };
    this.impacts = [];
    this.lastSize = '';
  }

  resize() {
    const width = this.canvas.clientWidth || 960;
    const height = this.canvas.clientHeight || 540;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const size = `${width}:${height}:${pixelRatio}`;
    if (size === this.lastSize) return;
    this.lastSize = size;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const backgroundContext = this.background.getContext('2d');
    backgroundContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.drawRoom(backgroundContext);
  }

  render(scene) {
    this.resize();
    const ctx = this.context;
    const video = scene.video;
    const hasVideo = video && video.readyState >= 2 && video.videoWidth > 0;
    const aspect = hasVideo ? video.videoWidth / video.videoHeight : 16 / 9;
    const width = Math.min(this.width, this.height * aspect);
    const height = width / aspect;
    this.viewport = { x: (this.width - width) / 2, y: (this.height - height) / 2, width, height };
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.background, 0, 0, this.width, this.height);
    if (hasVideo) {
      const rect = this.viewport;
      ctx.save();
      ctx.translate(rect.x + rect.width, rect.y);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, rect.width, rect.height);
      ctx.restore();
      ctx.fillStyle = 'rgba(3, 12, 27, 0.12)';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    } else if (!scene.landmarks) {
      this.drawGuide(scene.target ? scene.target.x : 0.72);
      if (!scene.target && ['idle', 'menu', 'ready'].includes(scene.phase)) {
        this.drawPad({ x: 0.56, y: 0.47, radius: 0.065, side: 'left', remaining: 1, total: 1 }, 0, true);
        this.drawPad({ x: 0.87, y: 0.56, radius: 0.065, side: 'right', remaining: 1, total: 1 }, 0, true);
      }
    }
    if (scene.calibration && !scene.target) this.drawCalibration(scene.calibration);
    if (scene.showSkeleton !== false && scene.landmarks) this.drawSkeleton(scene.landmarks);
    if (scene.target) this.drawPad(scene.target, this.reducedMotion ? 0 : scene.time || 0);
    this.drawImpacts(Math.max(0, Math.min(scene.delta || 0, 0.1)));
    return this.viewport;
  }

  point(x, y) {
    return { x: this.viewport.x + x * this.viewport.width, y: this.viewport.y + y * this.viewport.height };
  }

  drawRoom(ctx) {
    const w = this.width;
    const h = this.height;
    const floor = h * 0.74;
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#0a1224');
    base.addColorStop(0.7, '#101d35');
    base.addColorStop(1, '#050b16');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, w * 0.5);
    glow.addColorStop(0, 'rgba(50, 75, 149, 0.27)');
    glow.addColorStop(1, 'rgba(5, 12, 26, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(95, 141, 185, 0.11)';
    for (let i = 1; i < 10; i++) {
      const x = w * i / 10;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.13);
      ctx.lineTo(x, floor);
      ctx.stroke();
    }
    for (const y of [0.23, 0.47, 0.71]) {
      ctx.beginPath();
      ctx.moveTo(0, h * y);
      ctx.lineTo(w, h * y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(78, 176, 213, 0.19)';
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + i * w * 0.07, floor);
      ctx.lineTo(w * 0.5 + i * w * 0.19, h);
      ctx.stroke();
    }
    for (const y of [0, 0.08, 0.2, 0.38, 0.63, 0.97]) {
      ctx.beginPath();
      ctx.moveTo(0, floor + y * (h - floor));
      ctx.lineTo(w, floor + y * (h - floor));
      ctx.stroke();
    }
    for (const [x, color] of [[0.52, CYAN], [0.93, PURPLE]]) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 19;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.2);
      ctx.lineTo(w * x, h * 0.64);
      ctx.stroke();
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(0, 0, w * 0.63, 0);
    shade.addColorStop(0, 'rgba(3, 10, 23, 0.88)');
    shade.addColorStop(0.6, 'rgba(3, 10, 23, 0.42)');
    shade.addColorStop(1, 'rgba(3, 10, 23, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  }

  drawGuide(centerX) {
    const ctx = this.context;
    const center = this.point(centerX, 0.5);
    const scale = this.viewport.height;
    const x = center.x;
    const y = this.viewport.y;
    ctx.save();
    ctx.fillStyle = 'rgba(79, 182, 226, 0.08)';
    ctx.beginPath();
    ctx.ellipse(x, y + scale * 0.84, scale * 0.19, scale * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 218, 242, 0.23)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const limb = (points, color, width) => {
      ctx.beginPath();
      points.forEach(([px, py], index) => {
        if (!index) ctx.moveTo(x + px * scale, y + py * scale);
        else ctx.lineTo(x + px * scale, y + py * scale);
      });
      ctx.strokeStyle = '#13283e';
      ctx.lineWidth = scale * (width + 0.016);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = scale * width;
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    limb([[-0.038, 0.57], [-0.072, 0.69], [-0.13, 0.81]], '#466781', 0.055);
    limb([[0.038, 0.57], [0.08, 0.69], [0.13, 0.81]], '#55778d', 0.055);
    limb([[-0.067, 0.38], [-0.13, 0.46], [-0.16, 0.36]], '#63899e', 0.037);
    limb([[0.067, 0.38], [0.13, 0.46], [0.16, 0.36]], '#7896aa', 0.037);
    ctx.beginPath();
    ctx.moveTo(x - scale * 0.069, y + scale * 0.355);
    ctx.lineTo(x + scale * 0.069, y + scale * 0.355);
    ctx.lineTo(x + scale * 0.06, y + scale * 0.57);
    ctx.lineTo(x - scale * 0.06, y + scale * 0.57);
    ctx.closePath();
    const uniform = ctx.createLinearGradient(x - scale * 0.1, 0, x + scale * 0.1, 0);
    uniform.addColorStop(0, '#557b92');
    uniform.addColorStop(0.7, '#90abb9');
    uniform.addColorStop(1, '#486b88');
    ctx.fillStyle = uniform;
    ctx.fill();
    ctx.strokeStyle = '#a3cbd7';
    ctx.lineWidth = 1;
    ctx.stroke();
    limb([[-0.045, 0.36], [0, 0.43], [0.045, 0.36]], '#1b324b', 0.016);
    limb([[-0.058, 0.535], [0.06, 0.535]], '#101c30', 0.022);
    limb([[0.02, 0.535], [0.033, 0.606]], '#17243a', 0.018);
    ctx.beginPath();
    ctx.ellipse(x, y + scale * 0.283, scale * 0.036, scale * 0.045, 0, 0, TAU);
    ctx.fillStyle = '#759db2';
    ctx.fill();
    ctx.fillStyle = '#172b43';
    ctx.fillRect(x - scale * 0.035, y + scale * 0.257, scale * 0.07, scale * 0.014);
    for (const side of [-1, 1]) {
      const footX = x + side * scale * 0.13;
      ctx.strokeStyle = side < 0 ? CYAN : PURPLE;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(footX, y + scale * 0.823, scale * 0.043, scale * 0.014, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSkeleton(landmarks) {
    const ctx = this.context;
    const visible = point => point && (point.visibility ?? 1) >= 0.5;
    ctx.save();
    ctx.lineWidth = Math.max(2, this.viewport.height * 0.004);
    ctx.strokeStyle = 'rgba(128, 247, 255, 0.6)';
    ctx.lineCap = 'round';
    for (const [from, to] of BONES) {
      if (!visible(landmarks[from]) || !visible(landmarks[to])) continue;
      const start = this.point(landmarks[from].x, landmarks[from].y);
      const end = this.point(landmarks[to].x, landmarks[to].y);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    for (const index of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32]) {
      if (!visible(landmarks[index])) continue;
      const point = this.point(landmarks[index].x, landmarks[index].y);
      const foot = index >= 27;
      ctx.fillStyle = foot ? (index % 2 ? CYAN : PURPLE) : '#e7fbff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, this.viewport.height * (foot ? 0.011 : 0.006), 0, TAU);
      ctx.fill();
      if (foot) {
        ctx.strokeStyle = index % 2 ? CYAN : PURPLE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.viewport.height * 0.019, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawCalibration(calibration) {
    if (!Number.isFinite(calibration.floorY)) return;
    const ctx = this.context;
    const left = this.point(calibration.centerX - 0.17, calibration.floorY);
    const right = this.point(calibration.centerX + 0.17, calibration.floorY);
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(122, 252, 255, 0.65)';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
    ctx.restore();
  }

  drawPad(target, time, decorative = false) {
    const ctx = this.context;
    const point = this.point(target.x, target.y);
    const radius = this.viewport.height * target.radius;
    const color = target.side === 'left' ? CYAN : PURPLE;
    const progress = Math.max(0, Math.min(1, target.remaining / (target.total || 1)));
    const pulse = decorative ? 0 : Math.sin(time * 4) * 0.035;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.globalAlpha = decorative ? 0.75 : 1;
    const glow = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 1.9);
    glow.addColorStop(0, target.side === 'left' ? 'rgba(50, 241, 255, 0.2)' : 'rgba(170, 104, 255, 0.24)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 4);
    ctx.scale(1 + pulse, 1 + pulse);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(5, 21, 40, 0.88)';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8 - Math.PI / 8;
      const x = Math.cos(angle) * radius * 0.85;
      const y = Math.sin(angle) * radius * 0.85;
      if (!i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.17)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, radius * 0.05);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.3, 0);
    ctx.lineTo(radius * 0.3, 0);
    ctx.moveTo(0, -radius * 0.3);
    ctx.lineTo(0, radius * 0.3);
    ctx.stroke();
    if (!decorative) {
      const fontSize = Math.max(10, Math.min(14, this.viewport.height * 0.022));
      ctx.font = `700 ${fontSize}px Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const text = target.side === 'left' ? 'LEFT PAD' : 'RIGHT PAD';
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(3, 12, 24, 0.86)';
      ctx.fillRect(-textWidth / 2 - 7, radius + 10, textWidth + 14, fontSize + 8);
      ctx.fillStyle = color;
      ctx.fillText(text, 0, radius + 14);
    }
    ctx.restore();
  }

  burst(x, y, label = 'NICE!') {
    const count = this.reducedMotion ? 0 : 14;
    const particles = Array.from({ length: count }, (_, index) => {
      const angle = index * TAU / count;
      const speed = 0.1 + Math.random() * 0.11;
      return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 2 + Math.random() * 3 };
    });
    this.impacts.push({ x, y, label, age: 0, particles });
    if (this.impacts.length > 8) this.impacts.shift();
  }

  drawImpacts(delta) {
    const ctx = this.context;
    this.impacts = this.impacts.filter(impact => impact.age < 0.7);
    for (const impact of this.impacts) {
      impact.age += delta;
      const point = this.point(impact.x, impact.y);
      const age = impact.age;
      const opacity = Math.max(0, 1 - age / 0.7);
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = CYAN;
      for (const particle of impact.particles) {
        const x = point.x + particle.vx * age * this.viewport.height;
        const y = point.y + (particle.vy * age + age * age * 0.12) * this.viewport.height;
        ctx.fillRect(x, y, particle.size, particle.size);
      }
      if (!this.reducedMotion) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.viewport.height * (0.04 + age * 0.12), 0, TAU);
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#062235';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.max(16, this.viewport.height * 0.043)}px Orbitron, sans-serif`;
      const rise = this.reducedMotion ? 0 : age * this.viewport.height * 0.055;
      ctx.fillText(impact.label, point.x, point.y - this.viewport.height * 0.1 - rise);
      ctx.restore();
    }
  }
}

//# sourceMappingURL=renderer.js.map
