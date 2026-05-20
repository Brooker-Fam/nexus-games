// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — COORDINATES
// ════════════════════════════════════════════════════
//
// Three coordinate spaces. Other hoglets MUST use these utilities for
// click handling, unit positioning, and pathfinding instead of rolling
// their own conversions.
//
//   tile-space    integer (col, row), one diamond per cell
//   world-space   continuous pixels — tile(0,0) CENTER is at world (0, 0)
//   screen-space  pixels inside the canvas (camera offset applied)
//
// Diamond layout: 2:1 width-to-height. The diamond for tile (col, row) is
// centered at tileToWorld(col, row); its top/bottom/left/right vertices
// are at (cx, cy ± H/2) and (cx ± W/2, cy).
//
// World-space bounds for a map of (cols × rows):
//   x ∈ [-(rows-1)*W/2 - W/2,  (cols-1)*W/2 + W/2]
//   y ∈ [-H/2,                 (cols+rows-2)*H/2 + H/2]

const ISO_TILE_W = 64;
const ISO_TILE_H = 32;

// ── tile ↔ world ─────────────────────────────────────
function tileToWorld(col, row){
  return {
    x: (col - row) * (ISO_TILE_W / 2),
    y: (col + row) * (ISO_TILE_H / 2),
  };
}
function worldToTile(wx, wy){
  const halfW = ISO_TILE_W / 2;
  const halfH = ISO_TILE_H / 2;
  // Inverse of tileToWorld. The combinations cancel out the rotation.
  const col = Math.floor((wx / halfW + wy / halfH) / 2);
  const row = Math.floor((wy / halfH - wx / halfW) / 2);
  return { col, row };
}

// ── world ↔ screen ───────────────────────────────────
function worldToScreen(wx, wy, cam){
  return { x: wx - cam.x, y: wy - cam.y };
}
function screenToWorld(sx, sy, cam){
  return { x: sx + cam.x, y: sy + cam.y };
}

// ── screen → tile (the common one) ───────────────────
function screenToTile(sx, sy, cam){
  const w = screenToWorld(sx, sy, cam);
  return worldToTile(w.x, w.y);
}

// Screen-space position of the TOP vertex of a tile diamond.
// Useful when drawing sprites anchored to the back of a tile.
function tileTopScreen(col, row, cam){
  const w = tileToWorld(col, row);
  return worldToScreen(w.x, w.y - ISO_TILE_H / 2, cam);
}

// Vanilla-JS globals (matches the rest of the repo).
// Documented in docs/rts-2d-theme.md §6.
window.ISO_TILE_W    = ISO_TILE_W;
window.ISO_TILE_H    = ISO_TILE_H;
window.tileToWorld   = tileToWorld;
window.worldToTile   = worldToTile;
window.worldToScreen = worldToScreen;
window.screenToWorld = screenToWorld;
window.screenToTile  = screenToTile;
window.tileTopScreen = tileTopScreen;
