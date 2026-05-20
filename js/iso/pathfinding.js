// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — PATHFINDING
// ════════════════════════════════════════════════════
//
// A* on the iso tile grid. 8-directional moves with octile heuristic and
// the standard "no corner-cutting through obstacles" rule (a diagonal step
// is blocked when both of its orthogonal neighbours are blocked).
//
// HIGHGROUND is passable here. The theme contract notes a path penalty
// is "handled later" — when the combat hoglet lands ramps/cliffs they can
// tweak the cost table without touching this file.
//
// Public API:
//   findPath(map, startCol, startRow, goalCol, goalRow, opts?) → tile[]
//   nearestPassableTile(map, col, row, maxRadius?)             → tile | null
//
// `tile` here is `{col, row}` (the foundation Tile shape minus extras).
// Returned path excludes the start cell and includes the goal cell.
// Returns null if unreachable, [] if already at the goal.

const _OCTILE_D2 = Math.SQRT2;

const _PATH_NEIGHBORS = [
  [ 1,  0, 1],
  [-1,  0, 1],
  [ 0,  1, 1],
  [ 0, -1, 1],
  [ 1,  1, _OCTILE_D2],
  [ 1, -1, _OCTILE_D2],
  [-1,  1, _OCTILE_D2],
  [-1, -1, _OCTILE_D2],
];

function _octile(c0, r0, c1, r1){
  const dx = Math.abs(c0 - c1);
  const dy = Math.abs(r0 - r1);
  return (dx + dy) + (_OCTILE_D2 - 2) * Math.min(dx, dy);
}

function findPath(map, startCol, startRow, goalCol, goalRow, opts){
  opts = opts || {};
  if (!map) return null;
  if (!map.inBounds(startCol, startRow)) return null;
  if (!map.inBounds(goalCol, goalRow))   return null;
  if (startCol === goalCol && startRow === goalRow) return [];

  // If the destination is impassable, snap to the nearest passable tile
  // (helps when the user right-clicks on an obstacle / water).
  if (!map.isPassable(goalCol, goalRow)){
    const snap = nearestPassableTile(map, goalCol, goalRow, 8);
    if (!snap) return null;
    goalCol = snap.col;
    goalRow = snap.row;
    if (startCol === goalCol && startRow === goalRow) return [];
  }

  const cols = map.cols;
  const key = (c, r) => r * cols + c;

  const startKey = key(startCol, startRow);
  const goalKey  = key(goalCol, goalRow);

  const gScore   = new Map();
  const cameFrom = new Map();
  const open     = [];     // [fScore, col, row]
  const inOpen   = new Set();

  gScore.set(startKey, 0);
  open.push([_octile(startCol, startRow, goalCol, goalRow), startCol, startRow]);
  inOpen.add(startKey);

  const maxIter = cols * map.rows * 8;
  let iter = 0;

  while (open.length){
    if (++iter > maxIter) return null;

    // Pop entry with lowest f. Linear scan — fine for the 48×48 default;
    // upgrade to a heap if maps grow.
    let bestIdx = 0;
    let bestF = open[0][0];
    for (let i = 1; i < open.length; i++){
      if (open[i][0] < bestF){ bestF = open[i][0]; bestIdx = i; }
    }
    const cur = open[bestIdx];
    open[bestIdx] = open[open.length - 1];
    open.pop();
    const cc = cur[1], cr = cur[2];
    const ck = key(cc, cr);
    inOpen.delete(ck);

    if (ck === goalKey){
      const out = [];
      let k = goalKey;
      while (k !== startKey){
        const c = k % cols;
        const r = (k - c) / cols;
        out.push({ col: c, row: r });
        const prev = cameFrom.get(k);
        if (prev === undefined) break;
        k = prev;
      }
      out.reverse();
      return out;
    }

    const curG = gScore.get(ck);

    for (let i = 0; i < _PATH_NEIGHBORS.length; i++){
      const dc = _PATH_NEIGHBORS[i][0];
      const dr = _PATH_NEIGHBORS[i][1];
      const cost = _PATH_NEIGHBORS[i][2];
      const nc = cc + dc;
      const nr = cr + dr;
      if (!map.inBounds(nc, nr)) continue;
      if (!map.isPassable(nc, nr)) continue;
      // Block diagonal corner-cutting through walls.
      if (dc !== 0 && dr !== 0){
        if (!map.isPassable(cc + dc, cr)) continue;
        if (!map.isPassable(cc, cr + dr)) continue;
      }
      const nk = key(nc, nr);
      const tentative = curG + cost;
      const prevG = gScore.get(nk);
      if (prevG === undefined || tentative < prevG){
        cameFrom.set(nk, ck);
        gScore.set(nk, tentative);
        const f = tentative + _octile(nc, nr, goalCol, goalRow);
        if (!inOpen.has(nk)){
          open.push([f, nc, nr]);
          inOpen.add(nk);
        }
      }
    }
  }
  return null;
}

// Spiral outward from (col, row) until a passable tile is found, up to
// the given radius (Chebyshev). Returns null if everything in range is blocked.
function nearestPassableTile(map, col, row, maxRadius){
  if (!map) return null;
  if (map.inBounds(col, row) && map.isPassable(col, row)) return { col, row };
  const R = maxRadius || 6;
  for (let r = 1; r <= R; r++){
    for (let dr = -r; dr <= r; dr++){
      for (let dc = -r; dc <= r; dc++){
        if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (map.inBounds(nc, nr) && map.isPassable(nc, nr)) return { col: nc, row: nr };
      }
    }
  }
  return null;
}

window.findPath           = findPath;
window.nearestPassableTile = nearestPassableTile;
