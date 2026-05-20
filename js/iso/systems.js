// ════════════════════════════════════════════════════
//  CITADEL OPS — SIMULATION SYSTEMS
// ════════════════════════════════════════════════════
//
// Per-frame systems pushed onto World.systems by spawn.js. Each is a
// dumb function with .update(dt, world). All game logic that isn't
// AI-policy goes here: movement, combat, mining, building progress,
// production queues, cleanup.

function _dist(ax, ay, bx, by){ return Math.hypot(ax - bx, ay - by); }

// ── Movement ────────────────────────────────────────
const isoMovementSystem = {
  update(dt, world){
    const dtSec = dt / 1000;
    for (let i = 0; i < world.entities.length; i++){
      const e = world.entities[i];
      if (e.kind !== 'unit' || e.dead) continue;
      const mov = e.components.movement;
      const unit = e.components.unit;
      if (!mov.moving) continue;
      const dx = mov.targetX - e.x;
      const dy = mov.targetY - e.y;
      const d  = Math.hypot(dx, dy);
      if (d < 1){ mov.moving = false; continue; }
      const step = unit.speed * dtSec;
      if (step >= d){
        e.x = mov.targetX;
        e.y = mov.targetY;
        mov.moving = false;
      } else {
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
      }
    }
  },
};

// ── Order resolution: keep movement.target in sync with current order ─
function _moveTo(e, x, y){
  const mov = e.components.movement;
  mov.targetX = x;
  mov.targetY = y;
  mov.moving  = true;
}

const isoOrderSystem = {
  update(dt, world){
    const ents = world.entities;
    for (let i = 0; i < ents.length; i++){
      const e = ents[i];
      if (e.kind !== 'unit' || e.dead) continue;
      const ord  = e.components.order;
      const unit = e.components.unit;
      if (!ord) continue;

      // resolve target ref each frame so dead/stale targets clear cleanly
      let target = null;
      if (ord.targetId != null){
        target = world.find(ord.targetId);
        if (!target || target.dead) target = null;
      }

      switch (ord.kind){
        case 'idle': {
          // Auto-acquire nearby enemy for soldiers
          if (e.type === ISO_TYPE.SOLDIER){
            const en = _findNearestEnemy(world, e, 90);
            if (en){ isoCmdAttack(e, en); }
          }
          // Idle workers drift back to mining the nearest gold node.
          // Casual quality-of-life — players (and AI fallbacks) don't
          // need to micro every worker to keep the economy running.
          if (e.type === ISO_TYPE.WORKER){
            const node = _findNearestGoldNode(world, e);
            if (node) isoCmdGather(e, node);
          }
          break;
        }
        case 'move': {
          if (!e.components.movement.moving){ isoCmdStop(e); }
          break;
        }
        case 'attack_move': {
          // along the path, if any enemy is near, attack it
          const en = _findNearestEnemy(world, e, 100);
          if (en){ isoCmdAttack(e, en); break; }
          if (!e.components.movement.moving){ isoCmdStop(e); }
          break;
        }
        case 'attack': {
          if (!target){ isoCmdStop(e); break; }
          const d = _dist(e.x, e.y, target.x, target.y);
          if (d > unit.rng){
            _moveTo(e, target.x, target.y);
          } else {
            e.components.movement.moving = false;
            // fire if cooled down
            if (unit.cooldown <= 0){
              target.hp -= unit.dmg;
              unit.cooldown = unit.cooldownMs;
              if (target.hp <= 0){
                target.hp = 0;
                target.dead = true;
              }
            }
          }
          break;
        }
        case 'gather': {
          _runGather(world, e, target, dt);
          break;
        }
        case 'build': {
          if (!target){ isoCmdStop(e); break; }
          const d = _dist(e.x, e.y, target.x, target.y);
          if (d > 24){
            _moveTo(e, target.x, target.y);
          } else {
            e.components.movement.moving = false;
            // contribute build progress
            const b = target.components.building;
            b.construction += dt / b.buildTimeMs;
            if (b.construction >= 1){
              b.construction = 1;
              isoCmdStop(e);
            }
          }
          break;
        }
      }

      if (unit.cooldown > 0) unit.cooldown -= dt;
    }
  },
};

function _runGather(world, w, node, dt){
  const ord = w.components.order;
  // Need to find an HQ for drop-off if we don't have one yet
  if (!ord.homeBuildingId){
    const hq = _findOwnHq(world, w.side);
    if (hq) ord.homeBuildingId = hq.id;
  }

  // No node? try the nearest one
  if (!node){
    const fresh = _findNearestGoldNode(world, w);
    if (fresh){
      ord.targetId = fresh.id;
      ord.state    = 'to_resource';
    } else {
      isoCmdStop(w);
      return;
    }
  }
  if (ord.state === 'to_resource'){
    const n = world.find(ord.targetId);
    if (!n || n.dead || n.remaining <= 0){
      ord.targetId = null;
      ord.state    = 'to_resource';
      return;
    }
    const d = _dist(w.x, w.y, n.x, n.y);
    if (d > 18){
      _moveTo(w, n.x, n.y);
    } else {
      w.components.movement.moving = false;
      ord.state = 'mining';
      ord.mineTimer = 0;
    }
  } else if (ord.state === 'mining'){
    const n = world.find(ord.targetId);
    if (!n || n.dead || n.remaining <= 0){ ord.state = 'to_resource'; return; }
    ord.mineTimer = (ord.mineTimer || 0) + dt;
    // Use real dt instead — we don't have it here, so the systems loop
    // calls this per-frame; the per-frame tickAmount keeps the gather
    // rate steady-ish. Simpler: every ~1500ms, transfer.
    if (ord.mineTimer >= 1500){
      const amt = Math.min(8, n.remaining);
      n.remaining -= amt;
      ord.cargoGold = amt;
      ord.mineTimer = 0;
      if (n.remaining <= 0){ n.dead = true; }
      ord.state = 'to_hq';
    }
  } else if (ord.state === 'to_hq'){
    const hq = world.find(ord.homeBuildingId);
    if (!hq || hq.dead){
      const fresh = _findOwnHq(world, w.side);
      if (fresh){ ord.homeBuildingId = fresh.id; }
      else { isoCmdStop(w); return; }
    }
    const home = world.find(ord.homeBuildingId);
    const d = _dist(w.x, w.y, home.x, home.y);
    if (d > 26){
      _moveTo(w, home.x, home.y);
    } else {
      w.side.earn(ord.cargoGold);
      ord.cargoGold = 0;
      ord.state = 'to_resource';
      // refresh node target if depleted
      const n = world.find(ord.targetId);
      if (!n || n.dead || n.remaining <= 0) ord.targetId = null;
    }
  }
}

function _findOwnHq(world, side){
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.kind === 'building' && e.type === ISO_TYPE.HQ && e.side === side && !e.dead && e.components.building.construction >= 1){
      return e;
    }
  }
  // Fallback to any completed building (worker can drop off anywhere)
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.kind === 'building' && e.side === side && !e.dead && e.components.building.construction >= 1){
      return e;
    }
  }
  return null;
}

function _findNearestEnemy(world, e, maxR){
  let best = null, bestD = maxR;
  for (let i = 0; i < world.entities.length; i++){
    const o = world.entities[i];
    if (o === e || o.dead) continue;
    if (!o.side || o.side === e.side) continue;
    if (o.kind === 'resource') continue;
    const d = _dist(e.x, e.y, o.x, o.y);
    if (d < bestD){ best = o; bestD = d; }
  }
  return best;
}

function _findNearestGoldNode(world, w){
  let best = null, bestD = Infinity;
  for (let i = 0; i < world.entities.length; i++){
    const o = world.entities[i];
    if (o.kind !== 'resource' || o.dead || o.remaining <= 0) continue;
    const d = _dist(w.x, w.y, o.x, o.y);
    if (d < bestD){ best = o; bestD = d; }
  }
  return best;
}

// ── Production queues ───────────────────────────────
const isoProductionSystem = {
  update(dt, world){
    for (let i = 0; i < world.entities.length; i++){
      const b = world.entities[i];
      if (b.kind !== 'building' || b.dead) continue;
      const bc = b.components.building;
      if (bc.construction < 1) continue;
      if (!bc.trainQueue.length) continue;
      const job = bc.trainQueue[0];
      job.elapsedMs += dt;
      if (job.elapsedMs >= job.timeMs){
        bc.trainQueue.shift();
        // spawn near the building, then move to rally
        const spawn = _spawnSpotNear(world, b);
        const u = isoMakeUnit(world, b.side, job.type, spawn.x, spawn.y);
        const rallyW = tileToWorld(bc.rallyCol, bc.rallyRow);
        isoCmdMove(u, rallyW.x, rallyW.y);
      }
    }
  },
};

function _spawnSpotNear(world, b){
  // offset to a free direction; cheap polar spread
  const r = 28 + Math.random() * 8;
  const t = Math.random() * Math.PI * 2;
  return { x: b.x + Math.cos(t) * r, y: b.y + Math.sin(t) * r };
}

// ── Building construction tick (independent of worker proximity) ────
// If a worker is actively building, the order system advances progress.
// We do nothing here, but keep the slot for later (auto-completion etc).
const isoConstructionSystem = {
  update(dt, world){
    // intentionally empty — worker order handles it. Kept as an extension
    // point so other hoglets (auto-build, repair) plug in here.
  },
};

// ── Cleanup ─────────────────────────────────────────
const isoCleanupSystem = {
  update(dt, world){
    for (let i = world.entities.length - 1; i >= 0; i--){
      const e = world.entities[i];
      if (!e.dead) continue;
      // refund supply
      if (e.kind === 'unit' && e.side){
        const st = ISO_STATS[e.type];
        if (st && st.supply){ e.side.supplyUsed = Math.max(0, e.side.supplyUsed - st.supply); }
      }
      if (e.kind === 'building' && e.side){
        const st = ISO_STATS[e.type];
        if (st && st.supply){ e.side.supplyMax = Math.max(0, e.side.supplyMax - st.supply); }
      }
      world.entities.splice(i, 1);
    }
  },
};

window.isoMovementSystem     = isoMovementSystem;
window.isoOrderSystem        = isoOrderSystem;
window.isoProductionSystem   = isoProductionSystem;
window.isoConstructionSystem = isoConstructionSystem;
window.isoCleanupSystem      = isoCleanupSystem;
window.isoFindNearestEnemy   = _findNearestEnemy;
window.isoFindNearestGoldNode= _findNearestGoldNode;
window.isoFindOwnHq          = _findOwnHq;
