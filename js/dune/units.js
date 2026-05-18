// ════════════════════════════════════════════════════
//  DUNE — UNIT INSTANCES, ORDERS, MOVEMENT, COMBAT, HARVEST
// ════════════════════════════════════════════════════
//
// One file, one responsibility: per-tick simulation of every unit. Reads from
// the central D state object (see game.js) and the data-driven DUNE_UNITS
// config. Mutates units in place.
//
// Public API:
//
//   duneSpawnUnit(state, type, owner, tx, ty) → unit
//   duneIssueOrder(state, unit, order)        — replaces a unit's current order
//   duneTickUnits(state)                      — main per-frame entry point
//   duneRemoveDead(state)                     — sweeps dead units, drops wrecks
//
// `order` shape:
//   { kind: 'idle' }
//   { kind: 'move',    tx, ty }
//   { kind: 'attack',  targetId, persistent? }     // persistent = stay aggressive
//   { kind: 'harvest', tx?, ty? }                  // optional target spice tile
//
// Units always have a `state` field separate from the order (movement substate,
// harvester substate, etc). The order is the authoritative high-level intent;
// `state` tracks how we're currently executing it.

let _duneNextUnitId = 1;

function duneSpawnUnit(state, type, owner, tx, ty){
  const cfg = DUNE_UNITS[type];
  if(!cfg) throw new Error('Unknown unit type: ' + type);
  const ts = state.tileSize;
  const unit = {
    id: _duneNextUnitId++,
    type,
    owner,                          // 'player' | 'enemy'
    tx, ty,                         // logical tile (occupancy)
    px: tx * ts + ts / 2,           // sub-tile pixel pos (smoothed)
    py: ty * ts + ts / 2,
    facing: owner === 'player' ? 0 : Math.PI,
    hp: cfg.hp,
    maxHp: cfg.hp,
    order: { kind: 'idle' },
    path: null,
    pathStep: 0,
    moveProgress: 0,                // 0..1 between current tile and next path step
    repathCooldown: 0,
    attackCooldown: 0,
    attackTargetId: null,           // current attack victim (resolved each tick)
    harvestState: null,             // 'to_spice' | 'harvesting' | 'to_dropoff' | 'dropping'
    harvestTimer: 0,
    spiceLoad: 0,
    selected: false,
    dead: false,
  };
  state.units.push(unit);
  return unit;
}

function duneIssueOrder(state, unit, order){
  unit.order = order || { kind: 'idle' };
  unit.path = null;
  unit.pathStep = 0;
  unit.attackTargetId = null;
  // Harvester resets its sub-state on any new explicit order
  if(unit.harvestState && order.kind !== 'harvest'){
    unit.harvestState = null;
    unit.harvestTimer = 0;
  }
  if(order.kind === 'harvest' && DUNE_UNITS[unit.type].harvester){
    unit.harvestState = unit.spiceLoad >= DUNE_UNITS[unit.type].spiceCap
      ? 'to_dropoff' : 'to_spice';
  }
}

// ── Per-tick driver ──────────────────────────────────────────────────
function duneTickUnits(state){
  // Build occupancy lookup once per frame (for re-path checks + adjacency).
  const occupancy = new Map();
  for(const u of state.units){
    if(u.dead) continue;
    occupancy.set(u.tx + ',' + u.ty, u);
  }

  for(const u of state.units){
    if(u.dead) continue;
    if(u.attackCooldown > 0) u.attackCooldown--;
    if(u.repathCooldown > 0) u.repathCooldown--;

    // Combat units: auto-engage when idle
    if(u.order.kind === 'idle' && DUNE_UNITS[u.type].attack > 0){
      const enemy = _duneFindNearestEnemy(state, u);
      if(enemy){
        u.attackTargetId = enemy.id;
        // If already in range, just stand and shoot. Otherwise, chase.
        const d = _duneTileDist(u.tx, u.ty, enemy.tx, enemy.ty);
        if(d > DUNE_UNITS[u.type].range){
          _duneRepathTo(state, u, enemy.tx, enemy.ty, occupancy);
        }
      }
    }

    // Execute order
    switch(u.order.kind){
      case 'move':    _duneStepMove(state, u, occupancy); break;
      case 'attack':  _duneStepAttack(state, u, occupancy); break;
      case 'harvest': _duneStepHarvest(state, u, occupancy); break;
      case 'idle':
      default:        _duneStepIdleCombat(state, u, occupancy); break;
    }

    // Pixel interpolation toward (tx,ty). When pathing, we lerp from the
    // previous tile to the current one based on moveProgress; otherwise we
    // gently snap to the tile center.
    _duneSmoothPixels(state, u);
  }
}

// ── Pixel smoothing ──────────────────────────────────────────────────
function _duneSmoothPixels(state, u){
  const ts = state.tileSize;
  const targetX = u.tx * ts + ts / 2;
  const targetY = u.ty * ts + ts / 2;
  // 25% per-tick decay — visually smooth without lagging gameplay.
  u.px += (targetX - u.px) * 0.25;
  u.py += (targetY - u.py) * 0.25;
}

// ── Movement ─────────────────────────────────────────────────────────
function _duneStepMove(state, u, occupancy){
  if(!u.path || u.pathStep >= u.path.length){
    if(u.tx === u.order.tx && u.ty === u.order.ty){
      // arrived
      u.order = { kind: 'idle' };
      u.path = null;
      return;
    }
    if(!_duneRepathTo(state, u, u.order.tx, u.order.ty, occupancy)){
      // No path — give up and idle.
      u.order = { kind: 'idle' };
      return;
    }
  }

  _duneAdvanceAlongPath(state, u, occupancy);
}

function _duneAdvanceAlongPath(state, u, occupancy){
  const next = u.path[u.pathStep];
  if(!next) return;

  // If the next tile is now blocked by another unit, repath after a short
  // cooldown (avoid thrashing the pathfinder every frame).
  const k = next.x + ',' + next.y;
  const blocker = occupancy.get(k);
  if(blocker && blocker !== u){
    if(u.repathCooldown <= 0){
      u.repathCooldown = 30; // 0.5s
      // Try to repath toward the final goal
      const finalGoal = u.path[u.path.length - 1];
      _duneRepathTo(state, u, finalGoal.x, finalGoal.y, occupancy);
    }
    return;
  }

  // Progress toward `next`. Speed scales with terrain cost of the *destination*
  // tile (sand=1, dune=2 → half speed on dunes).
  const cfg = DUNE_UNITS[u.type];
  const cost = state.terrain.getMovementCost(next.x, next.y);
  const tilesPerTick = (cfg.speed / 60) / (isFinite(cost) ? cost : 1);
  u.moveProgress += tilesPerTick;

  // Face toward the next tile (for rendering)
  const ts = state.tileSize;
  u.facing = Math.atan2(
    (next.y * ts + ts/2) - u.py,
    (next.x * ts + ts/2) - u.px
  );

  if(u.moveProgress >= 1){
    // Commit the move: update occupancy
    occupancy.delete(u.tx + ',' + u.ty);
    u.tx = next.x;
    u.ty = next.y;
    occupancy.set(u.tx + ',' + u.ty, u);
    u.moveProgress = 0;
    u.pathStep++;
  }
}

function _duneRepathTo(state, u, tx, ty, occupancy){
  // Treat occupied tiles as blocked, except our own.
  const blocked = new Set();
  for(const [k, other] of occupancy){
    if(other !== u) blocked.add(k);
  }
  // If goal is occupied by something else, route to a nearby passable tile.
  let goalX = tx, goalY = ty;
  if(blocked.has(tx + ',' + ty) || !state.terrain.isPassable(tx, ty)){
    const alt = duneNearestPassable(state.terrain, tx, ty, 4, blocked);
    if(!alt) return false;
    goalX = alt.x; goalY = alt.y;
  }
  const path = dunePath(state.terrain, u.tx, u.ty, goalX, goalY, { blockedSet: blocked });
  if(!path){ u.path = null; return false; }
  u.path = path;
  u.pathStep = 0;
  u.moveProgress = 0;
  return true;
}

// ── Attack ───────────────────────────────────────────────────────────
function _duneStepAttack(state, u, occupancy){
  const target = state.units.find(x => x.id === u.order.targetId && !x.dead);
  if(!target){
    u.order = { kind: 'idle' };
    return;
  }
  const cfg = DUNE_UNITS[u.type];
  if(cfg.attack <= 0){
    // Non-combat unit — fall through to idle.
    u.order = { kind: 'idle' };
    return;
  }

  const d = _duneTileDist(u.tx, u.ty, target.tx, target.ty);
  if(d <= cfg.range){
    // In range — stop moving, fire.
    u.path = null;
    u.facing = Math.atan2(target.py - u.py, target.px - u.px);
    if(u.attackCooldown <= 0){
      _duneFireAt(state, u, target);
      u.attackCooldown = cfg.cooldown;
    }
  } else {
    // Out of range — chase. Repath if we don't have one or if it's stale.
    if(!u.path || u.pathStep >= u.path.length){
      _duneRepathTo(state, u, target.tx, target.ty, occupancy);
    }
    // Periodically refresh path so we follow a moving target.
    if((state.frame & 31) === 0){
      _duneRepathTo(state, u, target.tx, target.ty, occupancy);
    }
    _duneAdvanceAlongPath(state, u, occupancy);
  }
}

// While idle but auto-engaged (attackTargetId set in tick prelude), execute
// the same logic as an explicit attack order — without overwriting the order
// so the player's "selected and idle" feel is preserved.
function _duneStepIdleCombat(state, u, occupancy){
  if(!u.attackTargetId) return;
  const target = state.units.find(x => x.id === u.attackTargetId && !x.dead);
  if(!target){ u.attackTargetId = null; return; }
  const cfg = DUNE_UNITS[u.type];
  const d = _duneTileDist(u.tx, u.ty, target.tx, target.ty);
  if(d <= cfg.range){
    u.facing = Math.atan2(target.py - u.py, target.px - u.px);
    if(u.attackCooldown <= 0){
      _duneFireAt(state, u, target);
      u.attackCooldown = cfg.cooldown;
    }
  } else {
    // Don't chase indefinitely on auto-engage — only if target is within sight.
    if(d <= cfg.sight){
      if(!u.path || u.pathStep >= u.path.length || (state.frame & 31) === 0){
        _duneRepathTo(state, u, target.tx, target.ty, occupancy);
      }
      _duneAdvanceAlongPath(state, u, occupancy);
    } else {
      u.attackTargetId = null;
      u.path = null;
    }
  }
}

function _duneFireAt(state, attacker, target){
  const cfg = DUNE_UNITS[attacker.type];
  target.hp -= cfg.attack;
  // Spawn a tracer particle so the player sees the hit.
  state.particles.push({
    kind: cfg.range > 1 ? 'tracer' : 'spark',
    x1: attacker.px, y1: attacker.py,
    x2: target.px,   y2: target.py,
    life: 6, maxLife: 6,
    color: attacker.owner === 'player' ? '#9bf0ff' : '#ff8866',
  });
  if(target.hp <= 0 && !target.dead){
    target.dead = true;
    state.particles.push({
      kind: 'explosion',
      x: target.px, y: target.py,
      life: 24, maxLife: 24,
      color: '#ffaa55',
    });
  }
}

// ── Harvester ────────────────────────────────────────────────────────
function _duneStepHarvest(state, u, occupancy){
  const cfg = DUNE_UNITS[u.type];
  if(!cfg.harvester){ u.order = { kind: 'idle' }; return; }

  if(!u.harvestState){
    u.harvestState = u.spiceLoad >= cfg.spiceCap ? 'to_dropoff' : 'to_spice';
  }

  if(u.harvestState === 'to_spice'){
    // Find a target spice tile if one wasn't specified or it's gone.
    let target = u.order.tx !== undefined ? { x: u.order.tx, y: u.order.ty } : null;
    if(!target || !state.terrain.isSpice(target.x, target.y)){
      target = _duneFindNearestSpice(state, u.tx, u.ty);
      if(!target){
        // No spice anywhere — fall back to dropping off whatever we have.
        u.harvestState = u.spiceLoad > 0 ? 'to_dropoff' : null;
        if(!u.harvestState) u.order = { kind: 'idle' };
        return;
      }
      u.order = { kind: 'harvest', tx: target.x, ty: target.y };
    }

    if(u.tx === target.x && u.ty === target.y){
      u.harvestState = 'harvesting';
      u.harvestTimer = cfg.harvestTime;
      u.path = null;
      return;
    }
    if(!u.path || u.pathStep >= u.path.length){
      if(!_duneRepathTo(state, u, target.x, target.y, occupancy)){
        u.order = { kind: 'idle' };
        u.harvestState = null;
        return;
      }
    }
    _duneAdvanceAlongPath(state, u, occupancy);

  } else if(u.harvestState === 'harvesting'){
    u.harvestTimer--;
    if(u.harvestTimer <= 0){
      if(state.terrain.isSpice(u.tx, u.ty)){
        state.terrain.removeSpice(u.tx, u.ty);
        u.spiceLoad += 10;
      }
      if(u.spiceLoad >= cfg.spiceCap || !_duneAnySpiceNearby(state, u.tx, u.ty, cfg.sight)){
        u.harvestState = 'to_dropoff';
      } else {
        u.harvestState = 'to_spice';
        u.order = { kind: 'harvest' }; // re-search for next tile
      }
    }
  } else if(u.harvestState === 'to_dropoff'){
    const drop = state.dropOff[u.owner];
    if(!drop){ u.harvestState = null; u.order = { kind: 'idle' }; return; }
    if(u.tx === drop.x && u.ty === drop.y){
      // Deposit
      state.spice[u.owner] = (state.spice[u.owner] || 0) + u.spiceLoad;
      u.spiceLoad = 0;
      u.harvestState = 'to_spice';
      u.order = { kind: 'harvest' };
      return;
    }
    if(!u.path || u.pathStep >= u.path.length){
      if(!_duneRepathTo(state, u, drop.x, drop.y, occupancy)){
        // Drop-off unreachable — idle and keep cargo.
        u.order = { kind: 'idle' };
        u.harvestState = null;
        return;
      }
    }
    _duneAdvanceAlongPath(state, u, occupancy);
  }
}

// ── Death sweep ──────────────────────────────────────────────────────
function duneRemoveDead(state){
  const survivors = [];
  for(const u of state.units){
    if(u.dead){
      // Leave a wreckage tile for vehicles (slows future units, optional flavor).
      const cfg = DUNE_UNITS[u.type];
      if(cfg.role === 'vehicle' && state.terrain.getTile(u.tx, u.ty) === DUNE_TILE.SAND){
        state.terrain.setTile(u.tx, u.ty, DUNE_TILE.WRECK);
      }
      continue;
    }
    survivors.push(u);
  }
  state.units = survivors;
  // Drop any references in selection
  state.selected = state.selected.filter(u => !u.dead && state.units.includes(u));
}

// ── Helpers ──────────────────────────────────────────────────────────
function _duneTileDist(ax, ay, bx, by){
  // Chebyshev — feels right for tile-grid range checks ("within N squares").
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function _duneFindNearestEnemy(state, u){
  const cfg = DUNE_UNITS[u.type];
  let best = null, bestD = cfg.sight + 1;
  for(const other of state.units){
    if(other.dead || other === u) continue;
    if(other.owner === u.owner) continue;
    const d = _duneTileDist(u.tx, u.ty, other.tx, other.ty);
    if(d <= cfg.sight && d < bestD){ best = other; bestD = d; }
  }
  return best;
}

function _duneFindNearestSpice(state, x, y){
  const terr = state.terrain;
  // Spiral outward to a max search radius — keeps it cheap on big maps.
  const maxR = Math.max(terr.cols, terr.rows);
  for(let r = 0; r <= maxR; r++){
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        if(r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if(terr.isSpice(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

function _duneAnySpiceNearby(state, x, y, radius){
  for(let dy = -radius; dy <= radius; dy++){
    for(let dx = -radius; dx <= radius; dx++){
      if(state.terrain.isSpice(x + dx, y + dy)) return true;
    }
  }
  return false;
}
