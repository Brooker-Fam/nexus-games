// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — WORKERS (DRONES)
// ════════════════════════════════════════════════════
//
// Workers are the harvesting + construction unit. Hoglet #2 (Liam) owns
// the full unit/selection/pathfinding system; this file provides:
//
//   - the Worker entity factory (so we can play this tab end-to-end
//     even before Liam's PR lands),
//   - the harvest state machine,
//   - a build-a-structure flow (worker walks to site → erects building),
//   - straight-line movement (Liam can swap this for real pathfinding).
//
// When Liam's code lands, his selection/right-click dispatcher should
// call into commandHarvest / commandBuild / commandMove instead of
// us owning the click handling. Our handlers in iso-input.js are
// minimal so they can be replaced.
//
// State machine for components.worker.state:
//
//   IDLE        — no current job
//   MOVING      — moving to target.x/target.y; on arrival → IDLE
//   TO_NODE     — moving to a resource node
//   HARVESTING  — at node, counting down harvestMs
//   TO_DEPOT    — carrying resources back to a deposit building
//   DEPOSITING  — at depot, credits resources, goes back to TO_NODE
//   TO_SITE     — moving to a building site to start construction
//   CONSTRUCTING— at site, calling advanceConstruction every tick
//
// Public API (window globals):
//   WORKER_CFG
//   createWorker(col, row, faction) → Entity
//   commandMove(worker, col, row)
//   commandHarvest(worker, node)
//   commandBuild(worker, buildingType, col, row)
//   commandStop(worker)
//   WorkerSystem  — { update(dt, world) } system to push onto world.systems
//   isWorker(ent) → boolean

const WORKER_STATE = Object.freeze({
  IDLE:         'idle',
  MOVING:       'moving',
  TO_NODE:      'to_node',
  HARVESTING:   'harvesting',
  TO_DEPOT:     'to_depot',
  DEPOSITING:   'depositing',
  TO_SITE:      'to_site',
  CONSTRUCTING: 'constructing',
});

const WORKER_CFG = Object.freeze({
  speed:         80,    // world-space px/sec
  harvestMs:     2000,  // SC1-style ~2 sec per trip
  depositMs:     250,
  carryAmount:   8,     // units per trip (gold ~ small; oil same for simplicity)
  arriveEps:     6,     // px distance to count as "arrived"
  buildEps:      8,     // px distance from worker to building center
});

function isWorker(ent){
  return !!(ent && ent.type === 'worker');
}

function createWorker(col, row, faction){
  const w = tileToWorld(col, row);
  const ent = new Entity({
    type: 'worker',
    x: w.x,
    y: w.y,
    components: {
      worker: {
        faction:      faction || 'shadow',
        state:        WORKER_STATE.IDLE,
        target:       null,       // { x, y } world-space
        targetCol:    null,
        targetRow:    null,
        nodeId:       null,       // resource node we're tied to (for re-trips)
        carrying:     null,       // null or { resource, amount }
        timer:        0,
        // Build state
        buildKind:    null,
        buildCol:     null,
        buildRow:     null,
        buildingId:   null,
      },
      render: _renderWorker,
    },
  });
  return ent;
}

function _setTargetWorld(worker, x, y){
  const w = worker.components.worker;
  w.target = { x, y };
}

function _setTargetTile(worker, col, row){
  const tw = tileToWorld(col, row);
  _setTargetWorld(worker, tw.x, tw.y);
  worker.components.worker.targetCol = col;
  worker.components.worker.targetRow = row;
}

function commandStop(worker){
  const w = worker.components.worker;
  w.state      = WORKER_STATE.IDLE;
  w.target     = null;
  w.nodeId     = null;
  w.timer      = 0;
  w.buildKind  = null;
  w.buildingId = null;
  // Note: keep w.carrying so a worker can finish a delivery if re-tasked later.
}

function commandMove(worker, col, row){
  const w = worker.components.worker;
  w.state    = WORKER_STATE.MOVING;
  w.nodeId   = null;
  w.buildKind = null;
  w.buildingId = null;
  _setTargetTile(worker, col, row);
}

function commandHarvest(worker, node){
  if (!isResourceNode(node)) return;
  const rn = node.components.resourceNode;
  if (rn.depleted) return;
  const w = worker.components.worker;
  w.nodeId   = node.id;
  w.buildKind = null;
  w.buildingId = null;
  // If we're already carrying, head to depot first; otherwise to the node.
  if (w.carrying){
    w.state = WORKER_STATE.TO_DEPOT;
  } else {
    w.state = WORKER_STATE.TO_NODE;
    _setTargetWorld(worker, node.x, node.y);
  }
}

function commandBuild(worker, buildingType, col, row){
  const w = worker.components.worker;
  w.buildKind  = buildingType;
  w.buildCol   = col;
  w.buildRow   = row;
  w.buildingId = null;
  w.nodeId     = null;
  w.state      = WORKER_STATE.TO_SITE;
  // Aim at the center of the building footprint.
  const cfg = BUILDING_CFG[buildingType];
  const cx  = col + (cfg.size - 1) / 2;
  const cy  = row + (cfg.size - 1) / 2;
  const tw  = tileToWorld(cx, cy);
  _setTargetWorld(worker, tw.x, tw.y);
}

// ── Movement helper ─────────────────────────────────
// Straight-line interpolation toward target. Returns true on arrival.
// Liam's pathfinder can replace this by writing path waypoints into
// w.target and re-targeting on each waypoint reached.
function _stepToward(worker, dt){
  const w = worker.components.worker;
  if (!w.target) return true;
  const dx = w.target.x - worker.x;
  const dy = w.target.y - worker.y;
  const dist = Math.hypot(dx, dy);
  if (dist < WORKER_CFG.arriveEps){
    worker.x = w.target.x;
    worker.y = w.target.y;
    return true;
  }
  const step = WORKER_CFG.speed * (dt / 1000);
  if (step >= dist){
    worker.x = w.target.x;
    worker.y = w.target.y;
    return true;
  }
  worker.x += (dx / dist) * step;
  worker.y += (dy / dist) * step;
  return false;
}

// ── The worker system — drives every worker each tick ──────
const WorkerSystem = {
  update(dt, world){
    for (const ent of world.entities){
      if (!isWorker(ent)) continue;
      const w = ent.components.worker;
      switch (w.state){

        case WORKER_STATE.IDLE:
          break;

        case WORKER_STATE.MOVING:
          if (_stepToward(ent, dt)){
            w.state  = WORKER_STATE.IDLE;
            w.target = null;
          }
          break;

        case WORKER_STATE.TO_NODE: {
          const node = world.find(w.nodeId);
          if (!node || !isResourceNode(node) || node.components.resourceNode.depleted){
            // node died; if we have something to carry, deposit; else idle.
            commandStop(ent);
            if (w.carrying){
              const depot = nearestDepositBuilding(world, ent.x, ent.y, w.faction);
              if (depot){
                w.state = WORKER_STATE.TO_DEPOT;
                _setTargetWorld(ent, depot.x, depot.y);
                w.nodeId = null;
              }
            }
            break;
          }
          // Aim for node each frame in case it moves (it doesn't, but cheap).
          _setTargetWorld(ent, node.x, node.y);
          if (_stepToward(ent, dt)){
            w.state = WORKER_STATE.HARVESTING;
            w.timer = WORKER_CFG.harvestMs;
          }
          break;
        }

        case WORKER_STATE.HARVESTING: {
          const node = world.find(w.nodeId);
          if (!node || !isResourceNode(node) || node.components.resourceNode.depleted){
            // Bail to depot if we already gathered something, otherwise idle.
            if (w.carrying){
              const depot = nearestDepositBuilding(world, ent.x, ent.y, w.faction);
              if (depot){
                w.state = WORKER_STATE.TO_DEPOT;
                _setTargetWorld(ent, depot.x, depot.y);
              } else {
                commandStop(ent);
              }
            } else {
              commandStop(ent);
            }
            break;
          }
          w.timer -= dt;
          if (w.timer <= 0){
            const rn = node.components.resourceNode;
            const taken = harvestFromNode(node, WORKER_CFG.carryAmount);
            if (taken > 0){
              w.carrying = { resource: rn.resource, amount: taken };
              const depot = nearestDepositBuilding(world, ent.x, ent.y, w.faction);
              if (depot){
                w.state = WORKER_STATE.TO_DEPOT;
                _setTargetWorld(ent, depot.x, depot.y);
              } else {
                // No depot — sit on the resources until one's built.
                w.state = WORKER_STATE.IDLE;
              }
            } else {
              commandStop(ent);
            }
          }
          break;
        }

        case WORKER_STATE.TO_DEPOT: {
          // Re-target the nearest depot every frame in case ours dies.
          const depot = nearestDepositBuilding(world, ent.x, ent.y, w.faction);
          if (!depot){
            // No depot at all — return to a nearby idle spot, keep carrying.
            w.state  = WORKER_STATE.IDLE;
            w.target = null;
            break;
          }
          _setTargetWorld(ent, depot.x, depot.y);
          if (_stepToward(ent, dt)){
            w.state = WORKER_STATE.DEPOSITING;
            w.timer = WORKER_CFG.depositMs;
          }
          break;
        }

        case WORKER_STATE.DEPOSITING: {
          w.timer -= dt;
          if (w.timer <= 0){
            if (w.carrying){
              // Credit the player. ISO_STATE is the shared bag.
              if (window.ISO_STATE && window.ISO_STATE.resources){
                const r = w.carrying.resource;
                const cur = window.ISO_STATE.resources[r] || 0;
                window.ISO_STATE.resources[r] = cur + w.carrying.amount;
                if (typeof window.isoUpdateHud === 'function') window.isoUpdateHud();
              }
              w.carrying = null;
            }
            // Resume harvesting if our node is still alive.
            const node = w.nodeId ? world.find(w.nodeId) : null;
            if (node && isResourceNode(node) && !node.components.resourceNode.depleted){
              w.state = WORKER_STATE.TO_NODE;
              _setTargetWorld(ent, node.x, node.y);
            } else {
              // node gone; try to find another of the same type to keep working.
              const alt = nearestResourceNode(world, ent.x, ent.y);
              if (alt){
                w.nodeId = alt.id;
                w.state  = WORKER_STATE.TO_NODE;
                _setTargetWorld(ent, alt.x, alt.y);
              } else {
                commandStop(ent);
              }
            }
          }
          break;
        }

        case WORKER_STATE.TO_SITE: {
          if (_stepToward(ent, dt)){
            // Verify we can still place the building.
            if (!canPlaceBuilding(world, w.buildKind, w.buildCol, w.buildRow)){
              // Spot taken or no longer valid. Abandon.
              commandStop(ent);
              break;
            }
            // Spawn the building under construction, mark footprint.
            const b = createBuilding(w.buildKind, w.buildCol, w.buildRow, w.faction, { ready:false });
            world.add(b);
            placeBuildingFootprint(world, b);
            if (window.ISO_STATE && Array.isArray(window.ISO_STATE.buildings)){
              window.ISO_STATE.buildings.push(b);
            }
            w.buildingId = b.id;
            w.state      = WORKER_STATE.CONSTRUCTING;
          }
          break;
        }

        case WORKER_STATE.CONSTRUCTING: {
          const b = world.find(w.buildingId);
          if (!b || !isBuilding(b)){
            commandStop(ent);
            break;
          }
          const done = advanceConstruction(b, dt);
          if (done){
            w.state      = WORKER_STATE.IDLE;
            w.buildingId = null;
            w.target     = null;
          }
          break;
        }
      }
    }
  },
};

// ── Render ──────────────────────────────────────────
//
// Drone: small flat-bottomed hex + cyan dome. Tinted faction-cyan/orange
// by faction. Carry indicator: a small floating diamond above the head
// tinted by the resource color.

function _renderWorker(ctx, ent, cam){
  const w = ent.components.worker;
  const s = worldToScreen(ent.x, ent.y, cam);

  // Tint by faction
  let tint, glow;
  switch (w.faction){
    case 'prism':  tint = '#88ccff'; glow = 'rgba(0,221,255,0.4)'; break;
    case 'roboto': tint = '#aa6622'; glow = 'rgba(255,136,0,0.4)'; break;
    case 'shadow': default: tint = '#8855cc'; glow = 'rgba(153,34,255,0.4)';
  }

  // Shadow on the ground
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 4, 9, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  // Body — small iso "hex" diamond
  const bw = 9, bh = 5;
  ctx.beginPath();
  ctx.moveTo(s.x,        s.y - bh);
  ctx.lineTo(s.x + bw,   s.y);
  ctx.lineTo(s.x,        s.y + bh);
  ctx.lineTo(s.x - bw,   s.y);
  ctx.closePath();
  ctx.fillStyle = tint;
  ctx.fill();
  ctx.strokeStyle = '#020810';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dome
  ctx.beginPath();
  ctx.arc(s.x, s.y - 3, 4, Math.PI, 2 * Math.PI);
  ctx.fillStyle = _isoShadeColor(tint, 0.35);
  ctx.fill();
  ctx.stroke();

  // Carry indicator: small floating crystal above head.
  if (w.carrying){
    const rs = RESOURCE_STYLE[w.carrying.resource] || RESOURCE_STYLE.gold;
    const cy = s.y - 16;
    ctx.fillStyle = rs.glow;
    ctx.beginPath();
    ctx.ellipse(s.x, cy + 3, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s.x,     cy - 4);
    ctx.lineTo(s.x + 3, cy);
    ctx.lineTo(s.x,     cy + 3);
    ctx.lineTo(s.x - 3, cy);
    ctx.closePath();
    ctx.fillStyle = rs.primary;
    ctx.fill();
    ctx.strokeStyle = '#020810';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Harvesting animation — pulsing ring under the worker.
  if (w.state === WORKER_STATE.HARVESTING){
    const phase = (Date.now() % 800) / 800;
    ctx.beginPath();
    ctx.arc(s.x, s.y + 2, 10 + phase * 6, 0, Math.PI * 2);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2 * (1 - phase);
    ctx.globalAlpha = 1 - phase;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Selection ring (drawn brighter)
  if (window.ISO_STATE && window.ISO_STATE.selected === ent){
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 3, 13, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

window.WORKER_STATE   = WORKER_STATE;
window.WORKER_CFG     = WORKER_CFG;
window.createWorker   = createWorker;
window.commandMove    = commandMove;
window.commandHarvest = commandHarvest;
window.commandBuild   = commandBuild;
window.commandStop    = commandStop;
window.WorkerSystem   = WorkerSystem;
window.isWorker       = isWorker;
