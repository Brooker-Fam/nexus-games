// ════════════════════════════════════════════════════
//  DUNE — FOG OF WAR
// ════════════════════════════════════════════════════
// Three states per tile, mirroring classic RTS fog:
//   UNEXPLORED — never seen, render black
//   EXPLORED   — seen at least once, render dimmed (no live unit info)
//   VISIBLE    — currently within line-of-sight of a friendly unit/building
//
// Per-frame pattern other systems will use:
//   1. fog.beginFrame()            // demote all VISIBLE → EXPLORED
//   2. for each vision source:
//        fog.revealTile(tx, ty, radius)
//   3. renderer reads fog.get(tx, ty) to decide tile shading
//
// `revealTile(x, y, radius)` marks every tile within a circular radius as
// VISIBLE and upgrades any UNEXPLORED tile to at least EXPLORED. Callers
// pass tile coordinates (integers), not world pixels.

const DUNE_FOG = {
  UNEXPLORED: 0,
  EXPLORED:   1,
  VISIBLE:    2,
};

class DuneFog {
  constructor(width, height){
    this.width  = width;
    this.height = height;
    this.state  = new Uint8Array(width * height); // defaults to UNEXPLORED (0)
  }

  reset(){
    this.state.fill(DUNE_FOG.UNEXPLORED);
  }

  inBounds(x, y){
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x, y){
    if(!this.inBounds(x, y)) return DUNE_FOG.UNEXPLORED;
    return this.state[y * this.width + x];
  }

  isVisible(x, y){   return this.get(x, y) === DUNE_FOG.VISIBLE; }
  isExplored(x, y){  return this.get(x, y) >= DUNE_FOG.EXPLORED; }

  // Call once per frame before re-revealing from current vision sources.
  // Drops every VISIBLE tile back to EXPLORED — the next round of
  // revealTile() calls will promote tiles that are still in sight.
  beginFrame(){
    const s = this.state;
    for(let i = 0; i < s.length; i++){
      if(s[i] === DUNE_FOG.VISIBLE) s[i] = DUNE_FOG.EXPLORED;
    }
  }

  // Mark every tile inside the circular radius as VISIBLE.
  // Tiles previously UNEXPLORED are also recorded as having been seen.
  revealTile(cx, cy, radius){
    const r = Math.max(0, radius | 0);
    const r2 = r * r;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(this.width  - 1, cx + r);
    const y1 = Math.min(this.height - 1, cy + r);
    for(let y = y0; y <= y1; y++){
      for(let x = x0; x <= x1; x++){
        const dx = x - cx, dy = y - cy;
        if(dx*dx + dy*dy <= r2){
          this.state[y * this.width + x] = DUNE_FOG.VISIBLE;
        }
      }
    }
  }

  // Permanently mark a region as EXPLORED without making it VISIBLE.
  // Useful for replays / fast-forward / cheats / scripted scouting.
  markExplored(cx, cy, radius){
    const r = Math.max(0, radius | 0);
    const r2 = r * r;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(this.width  - 1, cx + r);
    const y1 = Math.min(this.height - 1, cy + r);
    for(let y = y0; y <= y1; y++){
      for(let x = x0; x <= x1; x++){
        const dx = x - cx, dy = y - cy;
        if(dx*dx + dy*dy <= r2){
          const idx = y * this.width + x;
          if(this.state[idx] === DUNE_FOG.UNEXPLORED) this.state[idx] = DUNE_FOG.EXPLORED;
        }
      }
    }
  }

  // Debug / test: reveal everything permanently.
  revealAll(){
    this.state.fill(DUNE_FOG.VISIBLE);
  }
}
