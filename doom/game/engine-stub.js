// Stub for Lizzie's raycaster engine. The gameplay layer only depends on
// these methods; swap this module for the real engine when it lands.
//
// Coordinate convention:
//   - World space: x to the right, y forward, both in tile units.
//   - Angle 0 = +x, increases counter-clockwise (standard math).
//
// Contract — the real engine must provide:
//   engine.attach(canvas)                            -> void
//   engine.setLevel(level)                           -> void  (see level-stub.js)
//   engine.castRay(x, y, angle, maxDist)             -> { distance, hit, tileX, tileY, side }
//   engine.lineOfSight(x1, y1, x2, y2)               -> boolean
//   engine.render(camera, sprites)                   -> void  (camera = {x, y, angle, pitch?})
//   engine.getCanvas()                               -> HTMLCanvasElement
//   engine.getViewport()                             -> { width, height }
//
// Until the engine lands we provide a minimal grid raycast + a top-down
// preview renderer so gameplay code is testable in isolation.

export function createStubEngine() {
  let canvas = null;
  let ctx = null;
  let level = null;
  let lastSprites = [];

  function attach(c) {
    canvas = c;
    ctx = c.getContext('2d');
  }

  function setLevel(l) { level = l; }

  function getCanvas() { return canvas; }
  function getViewport() {
    return canvas ? { width: canvas.width, height: canvas.height } : { width: 0, height: 0 };
  }

  // DDA grid raycast against level.getTile.
  function castRay(x, y, angle, maxDist = 64) {
    if (!level) return { distance: maxDist, hit: false, tileX: 0, tileY: 0, side: 0 };

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let mapX = Math.floor(x);
    let mapY = Math.floor(y);

    const deltaX = Math.abs(1 / dx) || 1e9;
    const deltaY = Math.abs(1 / dy) || 1e9;

    let stepX, stepY, sideX, sideY;
    if (dx < 0) { stepX = -1; sideX = (x - mapX) * deltaX; }
    else        { stepX = 1;  sideX = (mapX + 1 - x) * deltaX; }
    if (dy < 0) { stepY = -1; sideY = (y - mapY) * deltaY; }
    else        { stepY = 1;  sideY = (mapY + 1 - y) * deltaY; }

    let side = 0;
    let dist = 0;
    while (dist < maxDist) {
      if (sideX < sideY) {
        dist = sideX;
        sideX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        dist = sideY;
        sideY += deltaY;
        mapY += stepY;
        side = 1;
      }
      if (level.getTile(mapX, mapY) > 0) {
        return { distance: dist, hit: true, tileX: mapX, tileY: mapY, side };
      }
    }
    return { distance: maxDist, hit: false, tileX: mapX, tileY: mapY, side };
  }

  function lineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return true;
    const angle = Math.atan2(dy, dx);
    const r = castRay(x1, y1, angle, dist);
    return !r.hit || r.distance >= dist - 0.01;
  }

  // Fallback top-down debug renderer. The real engine will replace this with
  // a proper textured raycaster.
  function render(camera, sprites) {
    lastSprites = sprites || [];
    if (!ctx || !level) return;
    const w = canvas.width, h = canvas.height;
    const cell = Math.min(w / level.width, h / level.height);

    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, w, h);

    // tiles
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const t = level.getTile(x, y);
        if (t > 0) {
          ctx.fillStyle = '#5a3a25';
          ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
        }
      }
    }

    // sprites
    for (const s of lastSprites) {
      ctx.fillStyle = s.color || '#f5a';
      ctx.beginPath();
      ctx.arc(s.x * cell, s.y * cell, (s.radius || 0.3) * cell, 0, Math.PI * 2);
      ctx.fill();
    }

    // player
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(camera.x * cell, camera.y * cell, 0.25 * cell, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(camera.x * cell, camera.y * cell);
    ctx.lineTo((camera.x + Math.cos(camera.angle)) * cell,
               (camera.y + Math.sin(camera.angle)) * cell);
    ctx.stroke();
  }

  return { attach, setLevel, castRay, lineOfSight, render, getCanvas, getViewport };
}
