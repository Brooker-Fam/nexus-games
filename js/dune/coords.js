// ════════════════════════════════════════════════════
//  DUNE — COORDINATE UTILITIES
// ════════════════════════════════════════════════════
// One source of truth for world / screen / tile conversions.
// Every gameplay system (units, buildings, combat, input) goes
// through these helpers — never compute tile = wx / TILE_SIZE inline.
//
// Coordinate spaces:
//   tile   — integer column/row in the map grid (tx, ty)
//   world  — floating-point pixels in the map (wx, wy). One tile = TILE_SIZE px.
//   screen — pixels in the canvas/viewport (sx, sy). camera offsets world→screen.

const DUNE_TILE_SIZE = 24;

// Map: tile (tx, ty) → centre of tile in world coords.
function duneTileCenter(tx, ty){
  return { wx: (tx + 0.5) * DUNE_TILE_SIZE, wy: (ty + 0.5) * DUNE_TILE_SIZE };
}

// Map: tile (tx, ty) → top-left corner in world coords.
function duneTileOrigin(tx, ty){
  return { wx: tx * DUNE_TILE_SIZE, wy: ty * DUNE_TILE_SIZE };
}

// Map: world (wx, wy) → tile (tx, ty). Floors — may return out-of-bounds values;
// callers are responsible for bounds-checking against the map.
function duneWorldToTile(wx, wy){
  return {
    tx: Math.floor(wx / DUNE_TILE_SIZE),
    ty: Math.floor(wy / DUNE_TILE_SIZE),
  };
}

// Camera shape: { x, y, viewW, viewH }. x/y is the top-left world pixel that
// maps to screen (0, 0).
function duneWorldToScreen(wx, wy, cam){
  return { sx: wx - cam.x, sy: wy - cam.y };
}

function duneScreenToWorld(sx, sy, cam){
  return { wx: sx + cam.x, wy: sy + cam.y };
}

function duneScreenToTile(sx, sy, cam){
  const w = duneScreenToWorld(sx, sy, cam);
  return duneWorldToTile(w.wx, w.wy);
}

// Range of tiles currently inside the viewport, inclusive on both axes.
// Useful for rendering / fog updates that should skip off-screen work.
function duneVisibleTileRange(cam, mapW, mapH){
  const x0 = Math.max(0, Math.floor(cam.x / DUNE_TILE_SIZE));
  const y0 = Math.max(0, Math.floor(cam.y / DUNE_TILE_SIZE));
  const x1 = Math.min(mapW - 1, Math.ceil((cam.x + cam.viewW) / DUNE_TILE_SIZE));
  const y1 = Math.min(mapH - 1, Math.ceil((cam.y + cam.viewH) / DUNE_TILE_SIZE));
  return { x0, y0, x1, y1 };
}

// Euclidean tile distance (for vision/attack radii). Returns float.
function duneTileDistance(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx*dx + dy*dy);
}
