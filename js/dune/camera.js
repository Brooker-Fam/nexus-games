// ════════════════════════════════════════════════════
//  DUNE — CAMERA
// ════════════════════════════════════════════════════
// A simple 2D camera: top-left (x, y) in world coords plus viewport size.
// Inputs (arrow keys, WASD, edge scroll, click-drag) accumulate into x/y,
// which is clamped to the map every tick.

class DuneCamera {
  constructor({ viewW, viewH, worldW, worldH, panSpeed }){
    this.x      = 0;
    this.y      = 0;
    this.viewW  = viewW;
    this.viewH  = viewH;
    this.worldW = worldW;
    this.worldH = worldH;
    this.panSpeed = panSpeed || 360; // world px per second from key/edge scroll
    // mouse state — kept here so input handlers can poke at it directly
    this.mouseSX = -1;
    this.mouseSY = -1;
    this.edgeScrollEnabled = true;
    this.edgeScrollMargin  = 24; // px from canvas edge that triggers scroll
  }

  clamp(){
    // Map smaller than viewport: pin to 0 instead of pushing camera negative.
    const maxX = Math.max(0, this.worldW - this.viewW);
    const maxY = Math.max(0, this.worldH - this.viewH);
    if(this.x < 0) this.x = 0;
    else if(this.x > maxX) this.x = maxX;
    if(this.y < 0) this.y = 0;
    else if(this.y > maxY) this.y = maxY;
  }

  centerOnWorld(wx, wy){
    this.x = wx - this.viewW / 2;
    this.y = wy - this.viewH / 2;
    this.clamp();
  }

  centerOnTile(tx, ty){
    const c = duneTileCenter(tx, ty);
    this.centerOnWorld(c.wx, c.wy);
  }

  pan(dx, dy){
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  // dt is seconds. keysHeld is an object map from key name → truthy.
  tick(dt, keysHeld){
    const px = this.panSpeed * dt;
    if(keysHeld.ArrowLeft  || keysHeld.a || keysHeld.A) this.x -= px;
    if(keysHeld.ArrowRight || keysHeld.d || keysHeld.D) this.x += px;
    if(keysHeld.ArrowUp    || keysHeld.w || keysHeld.W) this.y -= px;
    if(keysHeld.ArrowDown  || keysHeld.s || keysHeld.S) this.y += px;

    if(this.edgeScrollEnabled && this.mouseSX >= 0 && this.mouseSY >= 0){
      const m = this.edgeScrollMargin;
      if(this.mouseSX < m)               this.x -= px;
      else if(this.mouseSX > this.viewW - m) this.x += px;
      if(this.mouseSY < m)               this.y -= px;
      else if(this.mouseSY > this.viewH - m) this.y += px;
    }

    this.clamp();
  }

  setViewport(w, h){
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  setMouseScreen(sx, sy){
    this.mouseSX = sx;
    this.mouseSY = sy;
  }
}
