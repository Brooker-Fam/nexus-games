// ════════════════════════════════════════════════════
//  CITADEL OPS — COMMAND BUS
// ════════════════════════════════════════════════════
//
// The single API both the player's input handlers and the AI opponent
// call. Returns true/false on validity so callers can react. Keeps all
// the "can I afford this / is supply free / is tile passable" checks in
// one place — meaning the AI uses the EXACT same rules as the player.
//
// Public surface:
//   isoCmdMove(unit, x, y)            — issue move order
//   isoCmdAttack(unit, target)        — issue attack order
//   isoCmdGather(worker, node)        — assign worker to mine a node
//   isoCmdRally(building, col, row)   — set rally point
//   isoCmdBuild(side, worker, type, col, row)
//                                     — place a building at (col, row);
//                                       worker walks over to construct
//   isoCmdTrain(building, type)       — enqueue a unit at a building
//   isoCmdStop(unit)                  — cancel current order

function _entFreeAt(world, col, row, ignoreId){
  // returns true if no other building occupies this tile
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.kind !== 'building') continue;
    if (e.id === ignoreId) continue;
    if (e.col === col && e.row === row) return false;
  }
  return true;
}

function isoCanBuild(world, side, type, col, row){
  const st = ISO_STATS[type];
  if (!st || st.kind !== 'building') return false;
  if (!side.canAfford(st.cost)) return false;
  if (!world.map.inBounds(col, row)) return false;
  if (!world.map.isPassable(col, row)) return false;
  if (!_entFreeAt(world, col, row, -1)) return false;
  return true;
}

function isoCmdMove(unit, x, y){
  if (!unit || unit.kind !== 'unit' || unit.dead) return false;
  const ord = unit.components.order;
  const mov = unit.components.movement;
  ord.kind = 'move';
  ord.targetId = null;
  ord.targetX = x;
  ord.targetY = y;
  ord.state = null;
  mov.targetX = x;
  mov.targetY = y;
  mov.moving = true;
  return true;
}

function isoCmdAttack(unit, target){
  if (!unit || unit.kind !== 'unit' || unit.dead) return false;
  if (!target || target.dead) return false;
  const ord = unit.components.order;
  ord.kind = 'attack';
  ord.targetId = target.id;
  ord.targetX = null;
  ord.targetY = null;
  ord.state = null;
  return true;
}

function isoCmdAttackMove(unit, x, y){
  if (!unit || unit.kind !== 'unit' || unit.dead) return false;
  const ord = unit.components.order;
  const mov = unit.components.movement;
  ord.kind = 'attack_move';
  ord.targetId = null;
  ord.targetX = x;
  ord.targetY = y;
  ord.state = null;
  mov.targetX = x;
  mov.targetY = y;
  mov.moving = true;
  return true;
}

function isoCmdGather(worker, node){
  if (!worker || worker.type !== ISO_TYPE.WORKER || worker.dead) return false;
  if (!node || node.dead || node.remaining <= 0) return false;
  const ord = worker.components.order;
  ord.kind = 'gather';
  ord.targetId = node.id;
  ord.state = 'to_resource';
  ord.cargoGold = ord.cargoGold || 0;
  return true;
}

function isoCmdRally(building, col, row){
  if (!building || building.kind !== 'building' || building.dead) return false;
  building.components.building.rallyCol = col;
  building.components.building.rallyRow = row;
  return true;
}

function isoCmdBuild(world, side, worker, type, col, row){
  if (!isoCanBuild(world, side, type, col, row)) return false;
  if (!worker || worker.type !== ISO_TYPE.WORKER || worker.dead) return false;
  if (!side.spend(ISO_STATS[type].cost)) return false;
  const b = isoMakeBuilding(world, side, type, col, row, { completed:false });
  // Mark the worker to walk over and build
  const ord = worker.components.order;
  ord.kind = 'build';
  ord.targetId = b.id;
  ord.targetX = b.x;
  ord.targetY = b.y;
  ord.state = 'to_site';
  return true;
}

function isoCmdTrain(building, type){
  if (!building || building.kind !== 'building' || building.dead) return false;
  const b = building.components.building;
  if (b.construction < 1) return false;
  const st = ISO_STATS[type];
  if (!st || st.kind !== 'unit') return false;
  const side = building.side;
  if (!side.canAfford(st.cost)) return false;
  if (!side.hasSupplyFor(st.supply)) return false;
  // type→building eligibility
  if (type === ISO_TYPE.WORKER  && building.type !== ISO_TYPE.HQ)        return false;
  if (type === ISO_TYPE.SOLDIER && building.type !== ISO_TYPE.BARRACKS)  return false;
  side.spend(st.cost);
  side.supplyUsed += st.supply;            // reserve supply at queue time
  b.trainQueue.push({ type, elapsedMs:0, timeMs:st.trainMs });
  return true;
}

function isoCmdStop(unit){
  if (!unit || unit.kind !== 'unit') return false;
  const ord = unit.components.order;
  const mov = unit.components.movement;
  ord.kind = 'idle';
  ord.targetId = null;
  ord.targetX = null;
  ord.targetY = null;
  ord.state = null;
  mov.moving = false;
  return true;
}

window.isoCanBuild     = isoCanBuild;
window.isoCmdMove      = isoCmdMove;
window.isoCmdAttack    = isoCmdAttack;
window.isoCmdAttackMove= isoCmdAttackMove;
window.isoCmdGather    = isoCmdGather;
window.isoCmdRally     = isoCmdRally;
window.isoCmdBuild     = isoCmdBuild;
window.isoCmdTrain     = isoCmdTrain;
window.isoCmdStop      = isoCmdStop;
