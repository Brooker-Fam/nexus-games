// ════════════════════════════════════════════════════
//  CITADEL OPS — AI OPPONENT
// ════════════════════════════════════════════════════
//
// Single-class AI policy. Pushed onto World.systems by spawn.js (via
// game.js) and ticks every ISO_AI_TICK_MS — NOT every frame — so the
// AI's decisions are throttled and cheap. All actions go through the
// shared command bus (isoCmd*) so the AI follows the exact same rules
// as the human player. No special-cased cheating.
//
// Behavior loop (run each tick, in this order):
//   1. PURGE   — clear bookkeeping for dead entities
//   2. GATHER  — idle workers get assigned to the nearest gold node
//   3. BUILD   — if we can afford and don't yet have each of {BARRACKS,
//                TECH}, send a worker to build it at an offset from HQ
//   4. PRODUCE — workers up to a cap from HQ; soldiers from each
//                BARRACKS up to the army cap
//   5. ATTACK  — once we have >= ISO_AI_ARMY_THRESHOLD soldiers, send
//                them on an attack-move toward the enemy HQ. Resends
//                each tick to keep them moving even if some die.
//
// Difficulty notes (casual):
//   - longer tick interval and a small "reaction delay" on attack
//   - lower worker cap (no infinite minerals/sec)
//   - one barracks → one production stream
//   - if HQ falls, AI rebuilds it once (so a small player raid doesn't
//     instantly end the game)

const ISO_AI_TICK_MS         = 1000;     // think every second
const ISO_AI_WORKER_CAP      = 6;
const ISO_AI_SOLDIER_CAP     = 14;
const ISO_AI_ARMY_THRESHOLD  = 5;        // send wave at this many soldiers
const ISO_AI_RESERVE_GOLD    = 0;        // spend everything; casual difficulty

class IsoAiOpponent {
  constructor(world, side, enemySide){
    this.world         = world;
    this.side          = side;
    this.enemy         = enemySide;
    this.elapsedMs     = 0;
    this.tickMs        = ISO_AI_TICK_MS;
    this.attackArmed   = false;          // becomes true once threshold met
    this.attackCooldown= 0;              // reaction delay before sending
    this.hqRebuildsLeft= 1;              // a second chance after early raid
  }

  update(dt /*, world */){
    if (this.side.eliminated) return;
    this.elapsedMs += dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.elapsedMs < this.tickMs) return;
    this.elapsedMs = 0;
    this._tick();
  }

  _tick(){
    const w = this.world;
    const s = this.side;

    // Snapshot what we own — cheap, but only done once per tick.
    const own = _ownBuckets(w, s);

    // 1. GATHER — every idle worker who isn't building goes to mine.
    for (const worker of own.workers){
      const ord = worker.components.order;
      if (ord.kind === 'idle' || (ord.kind === 'move' && !worker.components.movement.moving)){
        const node = isoFindNearestGoldNode(w, worker);
        if (node) isoCmdGather(worker, node);
      }
    }

    // 2. BUILD — make sure we have HQ + 1 BARRACKS + 1 TECH.
    const hasHq       = own.buildings.some(b => b.type === ISO_TYPE.HQ);
    const hasBarracks = own.buildings.some(b => b.type === ISO_TYPE.BARRACKS);
    const hasTech     = own.buildings.some(b => b.type === ISO_TYPE.TECH);

    if (!hasHq && this.hqRebuildsLeft > 0){
      const placed = this._tryBuild(own.workers, ISO_TYPE.HQ);
      if (placed) this.hqRebuildsLeft--;
    } else {
      if (!hasBarracks) this._tryBuild(own.workers, ISO_TYPE.BARRACKS);
      else if (!hasTech) this._tryBuild(own.workers, ISO_TYPE.TECH);
    }

    // 3. PRODUCE
    // Workers from HQ until cap
    const workerCount = own.workers.length + _queuedOfType(own.buildings, ISO_TYPE.WORKER);
    if (workerCount < ISO_AI_WORKER_CAP){
      const hq = own.buildings.find(b => b.type === ISO_TYPE.HQ && b.components.building.construction >= 1);
      if (hq && s.gold > ISO_STATS[ISO_TYPE.WORKER].cost + ISO_AI_RESERVE_GOLD){
        isoCmdTrain(hq, ISO_TYPE.WORKER);
      }
    }
    // Soldiers from barracks until army cap
    const soldierCount = own.soldiers.length + _queuedOfType(own.buildings, ISO_TYPE.SOLDIER);
    if (soldierCount < ISO_AI_SOLDIER_CAP){
      for (const b of own.buildings){
        if (b.type !== ISO_TYPE.BARRACKS) continue;
        if (b.components.building.construction < 1) continue;
        if (b.components.building.trainQueue.length >= 2) continue;
        if (s.gold < ISO_STATS[ISO_TYPE.SOLDIER].cost) break;
        isoCmdTrain(b, ISO_TYPE.SOLDIER);
      }
    }

    // 4. ATTACK
    if (own.soldiers.length >= ISO_AI_ARMY_THRESHOLD){
      if (!this.attackArmed){
        this.attackArmed = true;
        this.attackCooldown = 2500;     // brief delay so they group up
      }
      if (this.attackCooldown <= 0){
        this._sendAttackWave(own.soldiers);
      }
    } else if (own.soldiers.length === 0){
      this.attackArmed = false;
    }

    // After an attack wave fires, keep soldiers attack-moving as new ones
    // arrive (idle ones near rally → reissue attack-move every few ticks).
    if (this.attackArmed && this.attackCooldown <= 0){
      this._refreshAttackOrders(own.soldiers);
    }
  }

  _tryBuild(workers, type){
    const w = this.world;
    const s = this.side;
    const cost = ISO_STATS[type].cost;
    if (s.gold < cost) return false;
    // Pick an idle-ish worker (one that isn't actively building/dying)
    let chosen = null;
    for (const u of workers){
      const ord = u.components.order;
      if (ord.kind === 'build') continue;
      if (!chosen) chosen = u;
      if (ord.kind === 'idle' || ord.kind === 'move'){ chosen = u; break; }
    }
    if (!chosen) return false;

    // Find a passable empty tile near the HQ — search rings outward.
    const home = isoFindOwnHq(w, s);
    if (!home) return false;
    const cc = home.col, cr = home.row;
    for (let radius = 2; radius <= 6; radius++){
      const candidates = _ringTiles(cc, cr, radius);
      // shuffle so we don't always pick the same spot
      _shuffle(candidates);
      for (const [c, r] of candidates){
        if (!w.map.inBounds(c, r)) continue;
        if (!w.map.isPassable(c, r)) continue;
        if (_anyBuildingAt(w, c, r)) continue;
        if (isoCmdBuild(w, s, chosen, type, c, r)) return true;
      }
    }
    return false;
  }

  _sendAttackWave(soldiers){
    const w = this.world;
    // Pick the closest enemy structure as the rally target; fall back to
    // any enemy unit if no buildings remain (chase phase).
    const t = _pickAttackTarget(w, this.enemy);
    if (!t) return;
    for (const sol of soldiers){
      isoCmdAttackMove(sol, t.x, t.y);
    }
  }

  _refreshAttackOrders(soldiers){
    const t = _pickAttackTarget(this.world, this.enemy);
    if (!t) return;
    for (const sol of soldiers){
      const ord = sol.components.order;
      // Don't override a soldier actively biting an enemy
      if (ord.kind === 'attack') continue;
      isoCmdAttackMove(sol, t.x, t.y);
    }
  }
}

// ── helpers ────────────────────────────────────────
function _ownBuckets(world, side){
  const workers = [];
  const soldiers = [];
  const buildings = [];
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.dead) continue;
    if (e.side !== side) continue;
    if (e.kind === 'unit'){
      if (e.type === ISO_TYPE.WORKER) workers.push(e);
      else if (e.type === ISO_TYPE.SOLDIER) soldiers.push(e);
    } else if (e.kind === 'building'){
      buildings.push(e);
    }
  }
  return { workers, soldiers, buildings };
}

function _queuedOfType(buildings, type){
  let n = 0;
  for (const b of buildings){
    const q = b.components.building && b.components.building.trainQueue;
    if (!q) continue;
    for (const j of q){ if (j.type === type) n++; }
  }
  return n;
}

function _pickAttackTarget(world, enemy){
  // Prefer buildings (collapse the base faster). Among those, prefer HQ.
  let hq = null, otherBuilding = null, anyUnit = null;
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.dead) continue;
    if (e.side !== enemy) continue;
    if (e.kind === 'building'){
      if (e.type === ISO_TYPE.HQ) hq = e;
      else if (!otherBuilding) otherBuilding = e;
    } else if (e.kind === 'unit'){
      if (!anyUnit) anyUnit = e;
    }
  }
  return hq || otherBuilding || anyUnit;
}

function _ringTiles(cc, cr, radius){
  const out = [];
  for (let dr = -radius; dr <= radius; dr++){
    for (let dc = -radius; dc <= radius; dc++){
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
      out.push([cc + dc, cr + dr]);
    }
  }
  return out;
}

function _anyBuildingAt(world, col, row){
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.kind !== 'building' || e.dead) continue;
    if (e.col === col && e.row === row) return true;
  }
  return false;
}

function _shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

window.IsoAiOpponent        = IsoAiOpponent;
window.ISO_AI_TICK_MS       = ISO_AI_TICK_MS;
window.ISO_AI_ARMY_THRESHOLD= ISO_AI_ARMY_THRESHOLD;
