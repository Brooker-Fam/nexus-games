// ════════════════════════════════════════════════════
//  DUNE — A* PATHFINDING
// ════════════════════════════════════════════════════
//
// Tile-grid A* with 8-way movement, terrain-cost aware. The terrain interface
// (see terrain.js) supplies `isPassable(x,y)` and `getMovementCost(x,y)`.
//
// Public API:
//   dunePath(terrain, sx, sy, tx, ty, opts?) → array of {x,y} or null
//
// opts.blockedSet: Set<"x,y"> of tiles that should be treated as blocked
//                  (other units, structures, etc.). The goal tile is never
//                  blocked-by-others — callers can request a path "toward"
//                  an occupied tile; the unit logic decides whether to stop
//                  one tile short or to wait.
// opts.maxNodes:   safety cap so unreachable goals don't pin the main thread.
//                  Default: cols*rows (full map sweep).
//
// Heuristic is octile distance, admissible for 8-way grids with uniform base
// cost. Diagonal moves cost √2 × averaged tile cost; cardinal moves cost
// 1 × tile cost.
//
// Implementation note: this is a simple binary-heap-less impl — it scans the
// open list for the lowest-f node. Maps are <2000 tiles so the constant
// factor is fine and the code stays one screen.

const _DUNE_DIRS = [
  { dx:  1, dy:  0, cost: 1 },
  { dx: -1, dy:  0, cost: 1 },
  { dx:  0, dy:  1, cost: 1 },
  { dx:  0, dy: -1, cost: 1 },
  { dx:  1, dy:  1, cost: Math.SQRT2 },
  { dx:  1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy:  1, cost: Math.SQRT2 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
];

function _duneHeuristic(ax, ay, bx, by){
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  // Octile: cardinal + diagonal mix
  return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

function dunePath(terrain, sx, sy, tx, ty, opts){
  opts = opts || {};
  const blockedSet = opts.blockedSet || null;
  const maxNodes = opts.maxNodes || (terrain.cols * terrain.rows);

  if(sx === tx && sy === ty) return [];
  // Goal must be in bounds — passability of goal is checked but goal can be
  // blocked-by-other-unit; we still try to reach it (caller decides to stop short).
  if(!terrain.inBounds(tx, ty)) return null;
  if(!terrain.isPassable(tx, ty)) return null;

  const key = (x, y) => x + ',' + y;
  const open = new Map();   // key → node
  const closed = new Set();

  const start = { x: sx, y: sy, g: 0, f: _duneHeuristic(sx, sy, tx, ty), parent: null };
  open.set(key(sx, sy), start);

  let visited = 0;

  while(open.size > 0 && visited < maxNodes){
    // Pop lowest-f
    let best = null;
    for(const node of open.values()){
      if(!best || node.f < best.f) best = node;
    }
    open.delete(key(best.x, best.y));
    closed.add(key(best.x, best.y));
    visited++;

    if(best.x === tx && best.y === ty){
      // Reconstruct
      const path = [];
      let cur = best;
      while(cur.parent){
        path.push({ x: cur.x, y: cur.y });
        cur = cur.parent;
      }
      path.reverse();
      return path;
    }

    for(const d of _DUNE_DIRS){
      const nx = best.x + d.dx, ny = best.y + d.dy;
      if(!terrain.inBounds(nx, ny)) continue;
      if(!terrain.isPassable(nx, ny)) continue;
      // Treat dynamic blockers as impassable EXCEPT the goal itself.
      if(blockedSet && !(nx === tx && ny === ty) && blockedSet.has(key(nx, ny))) continue;
      // Disallow diagonal squeezing through two impassable corners
      if(d.dx !== 0 && d.dy !== 0){
        if(!terrain.isPassable(best.x + d.dx, best.y)) continue;
        if(!terrain.isPassable(best.x, best.y + d.dy)) continue;
      }
      const k = key(nx, ny);
      if(closed.has(k)) continue;

      const stepCost = d.cost * terrain.getMovementCost(nx, ny);
      const g = best.g + stepCost;
      const existing = open.get(k);
      if(existing && existing.g <= g) continue;

      const node = {
        x: nx, y: ny, g,
        f: g + _duneHeuristic(nx, ny, tx, ty),
        parent: best,
      };
      open.set(k, node);
    }
  }

  return null;
}

// Find a passable tile near (tx, ty) — useful when the goal is occupied or
// adjacent to a structure. Returns {x,y} or null. Spirals outward by Manhattan
// distance up to `maxRadius`.
function duneNearestPassable(terrain, tx, ty, maxRadius, blockedSet){
  if(terrain.isPassable(tx, ty) && (!blockedSet || !blockedSet.has(tx + ',' + ty))){
    return { x: tx, y: ty };
  }
  for(let r = 1; r <= maxRadius; r++){
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        if(Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // ring only
        const nx = tx + dx, ny = ty + dy;
        if(!terrain.inBounds(nx, ny)) continue;
        if(!terrain.isPassable(nx, ny)) continue;
        if(blockedSet && blockedSet.has(nx + ',' + ny)) continue;
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}
