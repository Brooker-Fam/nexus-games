// ════════════════════════════════════════════════════
//  CITADEL OPS — MATCH SPAWN
// ════════════════════════════════════════════════════
//
// One entry point: isoSpawnMatch(world). Lays down:
//   - two HQs at opposing corners of the map
//   - 4 workers per side, idling near their HQ
//   - two gold-node clusters per side, a short walk from their HQ
//
// The player is always SHADOW (purple). The AI is always PRISM (cyan).
// This mirrors the existing 1D RTS faction colors and the theme doc.

const ISO_PLAYER_FACTION = 'shadow';
const ISO_AI_FACTION     = 'prism';

function isoSpawnMatch(world){
  const map = world.map;
  // Two bases: top-left and bottom-right pockets.
  const playerHq = { col: 3, row: 3 };
  const aiHq     = { col: map.cols - 5, row: map.rows - 5 };

  // Clear a small playable area at each base so the demo map's obstacles
  // can't snake into a corner.
  _clearArea(map, playerHq.col, playerHq.row, 6);
  _clearArea(map, aiHq.col,     aiHq.row,     6);

  const player = new Side({
    id:'player', factionId: ISO_PLAYER_FACTION,
    homeCol: playerHq.col, homeRow: playerHq.row,
  });
  const ai = new Side({
    id:'ai', factionId: ISO_AI_FACTION,
    homeCol: aiHq.col, homeRow: aiHq.row,
  });

  const playerHQ = isoMakeBuilding(world, player, ISO_TYPE.HQ, playerHq.col, playerHq.row, { completed:true });
  playerHQ.components.building.construction = 1;
  playerHQ.components.building.rallyCol = playerHq.col;
  playerHQ.components.building.rallyRow = playerHq.row + 2;

  const aiHQ     = isoMakeBuilding(world, ai,     ISO_TYPE.HQ, aiHq.col,     aiHq.row,     { completed:true });
  aiHQ.components.building.construction = 1;
  aiHQ.components.building.rallyCol = aiHq.col;
  aiHQ.components.building.rallyRow = aiHq.row - 2;

  // Spawn 4 workers per side near each HQ
  _spawnWorkers(world, player, playerHq.col + 1, playerHq.row + 1, 4);
  _spawnWorkers(world, ai,     aiHq.col - 1,     aiHq.row - 1,     4);

  // Gold node clusters near each base
  _spawnGoldCluster(world, playerHq.col + 4, playerHq.row + 1, 3);
  _spawnGoldCluster(world, playerHq.col + 1, playerHq.row + 4, 3);
  _spawnGoldCluster(world, aiHq.col - 4,     aiHq.row - 1,     3);
  _spawnGoldCluster(world, aiHq.col - 1,     aiHq.row - 4,     3);

  // Push our systems onto the world (order matters: orders → movement → production → cleanup)
  world.systems.push(isoOrderSystem);
  world.systems.push(isoMovementSystem);
  world.systems.push(isoProductionSystem);
  world.systems.push(isoConstructionSystem);
  world.systems.push(isoCleanupSystem);

  return { player, ai };
}

function _clearArea(map, cx, cy, r){
  for (let dr = -r; dr <= r; dr++){
    for (let dc = -r; dc <= r; dc++){
      const c = cx + dc, rr = cy + dr;
      if (!map.inBounds(c, rr)) continue;
      map.set(c, rr, TERRAIN.GROUND);
    }
  }
}

function _spawnWorkers(world, side, col, row, count){
  const supply = ISO_STATS[ISO_TYPE.WORKER].supply;
  for (let i = 0; i < count; i++){
    const angle = (i / count) * Math.PI * 2;
    const w = tileToWorld(col, row);
    const x = w.x + Math.cos(angle) * 26;
    const y = w.y + Math.sin(angle) * 26;
    isoMakeUnit(world, side, ISO_TYPE.WORKER, x, y);
    side.supplyUsed += supply;
  }
}

function _spawnGoldCluster(world, col, row, count){
  // Place gold nodes adjacent to (col, row) on passable tiles
  let placed = 0;
  const offsets = [
    [0,0],[1,0],[-1,0],[0,1],[0,-1],
    [1,1],[-1,-1],[1,-1],[-1,1],
  ];
  for (const [dc, dr] of offsets){
    if (placed >= count) break;
    const c = col + dc, r = row + dr;
    if (!world.map.inBounds(c, r)) continue;
    if (!world.map.isPassable(c, r)) continue;
    isoMakeGoldNode(world, c, r, 600);
    placed++;
  }
}

window.ISO_PLAYER_FACTION = ISO_PLAYER_FACTION;
window.ISO_AI_FACTION     = ISO_AI_FACTION;
window.isoSpawnMatch      = isoSpawnMatch;
