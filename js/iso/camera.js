// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — CAMERA + INPUT
// ════════════════════════════════════════════════════
//
// IsoCamera holds world-space pan offset and viewport size. attach()
// wires up edge-scroll (mouse near canvas edge) + WASD + arrow keys.
// Panning is clamped to the map's world bounds.
//
// The camera's (x, y) is the world-space offset of the canvas's
// top-left corner — i.e. canvas pixel (0,0) corresponds to world
// position (cam.x, cam.y). Use worldToScreen/screenToWorld in
// coords.js to convert.

const ISO_CAM_SPEED       = 520;   // px/sec for WASD / arrows
const ISO_CAM_EDGE_PX     = 36;    // mouse within this many px of canvas edge → scroll
const ISO_CAM_EDGE_SPEED  = 480;   // px/sec for edge-scroll

class IsoCamera {
  constructor(world, viewportW, viewportH){
    this.world      = world;
    this.viewportW  = viewportW;
    this.viewportH  = viewportH;
    this.x          = 0;
    this.y          = 0;
    this._keys      = Object.create(null);
    this._mouse     = { sx: -1, sy: -1, inside: false };
    this._handlers  = null;   // set by attach(), used by detach()
    this._canvas    = null;
    this.center();
  }

  // Center the camera on the middle of the map.
  center(){
    const b = this.world.map.worldBounds();
    const midX = (b.minX + b.maxX) / 2;
    const midY = (b.minY + b.maxY) / 2;
    this.x = midX - this.viewportW / 2;
    this.y = midY - this.viewportH / 2;
    this.clamp();
  }

  clamp(){
    const b = this.world.map.worldBounds();
    const mapW = b.maxX - b.minX;
    const mapH = b.maxY - b.minY;
    // If the map is smaller than the viewport, just center it.
    if (mapW <= this.viewportW){
      this.x = b.minX + (mapW - this.viewportW) / 2;
    } else {
      this.x = Math.max(b.minX, Math.min(b.maxX - this.viewportW, this.x));
    }
    if (mapH <= this.viewportH){
      this.y = b.minY + (mapH - this.viewportH) / 2;
    } else {
      this.y = Math.max(b.minY, Math.min(b.maxY - this.viewportH, this.y));
    }
  }

  // Wire up input. Idempotent — calling twice is a no-op after the first.
  attach(canvasEl){
    if (this._handlers) return;
    this._canvas = canvasEl;

    const onKeyDown = (e) => {
      // Only intercept when the iso tab is the active tab.
      if (!_isoTabActive()) return;
      this._keys[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => { delete this._keys[e.key]; };

    const onMove = (e) => {
      const rect = canvasEl.getBoundingClientRect();
      const scX  = canvasEl.width  / rect.width;
      const scY  = canvasEl.height / rect.height;
      const sx   = (e.clientX - rect.left) * scX;
      const sy   = (e.clientY - rect.top)  * scY;
      const inside = sx >= 0 && sy >= 0 && sx <= canvasEl.width && sy <= canvasEl.height;
      this._mouse.sx = sx;
      this._mouse.sy = sy;
      this._mouse.inside = inside;
    };
    const onLeave = () => { this._mouse.inside = false; };
    const onBlur  = () => { this._keys = Object.create(null); };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    window.addEventListener('blur',    onBlur);
    canvasEl.addEventListener('mousemove', onMove);
    canvasEl.addEventListener('mouseleave', onLeave);

    this._handlers = { onKeyDown, onKeyUp, onMove, onLeave, onBlur };
  }

  detach(){
    if (!this._handlers || !this._canvas) return;
    const h = this._handlers;
    window.removeEventListener('keydown', h.onKeyDown);
    window.removeEventListener('keyup',   h.onKeyUp);
    window.removeEventListener('blur',    h.onBlur);
    this._canvas.removeEventListener('mousemove',  h.onMove);
    this._canvas.removeEventListener('mouseleave', h.onLeave);
    this._handlers = null;
    this._canvas   = null;
    this._keys     = Object.create(null);
  }

  update(dt){
    const dtSec = dt / 1000;

    // Keyboard pan (WASD + arrow keys).
    let kx = 0, ky = 0;
    const k = this._keys;
    if (k['a'] || k['A'] || k['ArrowLeft'])  kx -= 1;
    if (k['d'] || k['D'] || k['ArrowRight']) kx += 1;
    if (k['w'] || k['W'] || k['ArrowUp'])    ky -= 1;
    if (k['s'] || k['S'] || k['ArrowDown'])  ky += 1;
    if (kx || ky){
      // normalize diagonals so speed is consistent
      const len = Math.hypot(kx, ky) || 1;
      this.x += (kx / len) * ISO_CAM_SPEED * dtSec;
      this.y += (ky / len) * ISO_CAM_SPEED * dtSec;
    }

    // Edge-scroll (StarCraft-style).
    if (this._mouse.inside && this._canvas){
      const { sx, sy } = this._mouse;
      let ex = 0, ey = 0;
      if (sx < ISO_CAM_EDGE_PX)                     ex = -1;
      else if (sx > this._canvas.width - ISO_CAM_EDGE_PX)  ex =  1;
      if (sy < ISO_CAM_EDGE_PX)                     ey = -1;
      else if (sy > this._canvas.height - ISO_CAM_EDGE_PX) ey =  1;
      if (ex || ey){
        const len = Math.hypot(ex, ey) || 1;
        this.x += (ex / len) * ISO_CAM_EDGE_SPEED * dtSec;
        this.y += (ey / len) * ISO_CAM_EDGE_SPEED * dtSec;
      }
    }

    this.clamp();
  }
}

// The iso tab is only "active" when its tab-content has .active. The
// game-registry already calls our cleanup() when the tab is switched,
// but using this guard makes the keyboard handler defensive against
// hot-reload or weird DOM states.
function _isoTabActive(){
  const tab = document.getElementById('tab-iso');
  return !!(tab && tab.classList.contains('active'));
}

window.IsoCamera = IsoCamera;
