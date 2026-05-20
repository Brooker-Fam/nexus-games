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
  // Preserve moveProgress when the immediate-next tile is the same as before —
  // periodic chase repaths kept resetting progress to 0 every 32 frames, which
  // for slow units (light_infantry @ ~0.027 tiles/tick) meant they never moved.
  const prevNext = (u.path && u.path[u.pathStep]) || null;
  const newNext = path[0];
  const sameNext = prevNext && newNext && prevNext.x === newNext.x && prevNext.y === newNext.y;
  u.path = path;
  u.pathStep = 0;
  if(!sameNext) u.moveProgress = 0;
  return true;
}

// ── Attack ───────────────────────────────────────────────────────────
function _duneStepAttack(state, u, occupancy){
  const target = _duneFindTargetById(state, u.order.targetId);
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
  const target = _duneFindTargetById(state, u.attackTargetId);
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
  // Buildings flow through DuneBuildings.damage so HP/destroy/HUD log all
  // happen via the buildings module.
  if(target.__isBuilding){
    if(window.DuneBuildings && window.DuneBuildings.damage){
      window.DuneBuildings.damage(target.buildingId, cfg.attack, attacker);
    }
    state.particles.push({
      kind: cfg.range > 1 ? 'tracer' : 'spark',
      x1: attacker.px, y1: attacker.py,
      x2: target.px,   y2: target.py,
      life: 6, maxLife: 6,
      color: attacker.owner === 'player' ? '#9bf0ff' : '#ff8866',
    });
    return;
  }
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
    const drop = _duneRefineryDropOff(u.owner) || state.dropOff[u.owner];
    if(!drop){ u.harvestState = null; u.order = { kind: 'idle' }; return; }
    // We approach the refinery footprint — "arrival" is being on a tile that's
    // edge-adjacent to any footprint tile of the refinery.
    const fw = drop.w || 1, fh = drop.h || 1;
    const fx0 = drop.x - Math.floor(fw/2), fy0 = drop.y - Math.floor(fh/2);
    let adjacentToFootprint = false;
    for(let dy = 0; dy < fh && !adjacentToFootprint; dy++){
      for(let dx = 0; dx < fw && !adjacentToFootprint; dx++){
        if(Math.max(Math.abs(u.tx - (fx0+dx)), Math.abs(u.ty - (fy0+dy))) <= 1){
          adjacentToFootprint = true;
        }
      }
    }
    if(adjacentToFootprint){
      // Deposit via the integrated economy if it's loaded; else fall back to
      // the legacy state.spice counter so this file stays runnable standalone.
      if(window.DuneEconomy && window.DuneEconomy.credit){
        const refId = drop.id != null ? drop.id : null;
        const kept = window.DuneEconomy.credit(u.owner, u.spiceLoad);
        if(refId != null && window.DuneBuildings && window.DuneBuildings.flashRefinery){
          window.DuneBuildings.flashRefinery(refId);
        }
        if(u.owner === 'player' && window.DuneState && window.DuneState.pushLog){
          if(kept < u.spiceLoad){
            window.DuneState.pushLog('Spice silo full — ' + (u.spiceLoad - kept) + ' lost.', 'warn');
          } else if(kept > 0){
            window.DuneState.pushLog('+' + kept + ' credits from refinery.', 'good');
          }
        }
      } else {
        state.spice[u.owner] = (state.spice[u.owner] || 0) + u.spiceLoad;
      }
      u.spiceLoad = 0;
      u.harvestState = 'to_spice';
      u.order = { kind: 'harvest' };
      return;
    }
    if(!u.path || u.pathStep >= u.path.length){
      // Path TO an adjacent tile of the refinery footprint, not into it.
      const adjacentTile = _duneNearestAdjacentTo(drop, u.tx, u.ty);
      const goal = adjacentTile || { x: drop.x, y: drop.y };
      if(!_duneRepathTo(state, u, goal.x, goal.y, occupancy)){
        u.order = { kind: 'idle' };
        u.harvestState = null;
        return;
      }
    }
    _duneAdvanceAlongPath(state, u, occupancy);
  }
}

// Resolve a refinery drop-off via the buildings module if present. Returns
// {x, y, id} where (x,y) is the centre tile, or null. Falls back to whatever
// state.dropOff has when buildings aren't wired in (standalone testing).
function _duneRefineryDropOff(owner){
  if(!window.DuneBuildings || !window.DuneBuildings.findRefineryNear) return null;
  // The harvester doesn't know its position here — use map centre as a stable
  // anchor so the "nearest" lookup picks the refinery closest to the action.
  const cols = window.DuneTerrain ? window.DuneTerrain.cols : 30;
  const rows = window.DuneTerrain ? window.DuneTerrain.rows : 22;
  const r = window.DuneBuildings.findRefineryNear(cols/2, rows/2, owner);
  if(!r) return null;
  return { x: Math.floor(r.x + r.w/2), y: Math.floor(r.y + r.h/2), id: r.id, w: r.w, h: r.h };
}

// Pick a tile adjacent to a footprint that's nearest the harvester's position.
function _duneNearestAdjacentTo(drop, fromX, fromY){
  const w = drop.w || 1, h = drop.h || 1;
  const x0 = drop.x - Math.floor(w/2), y0 = drop.y - Math.floor(h/2);
  let best = null, bestD = Infinity;
  for(let dy = -1; dy <= h; dy++){
    for(let dx = -1; dx <= w; dx++){
      const onEdge = dx === -1 || dy === -1 || dx === w || dy === h;
      if(!onEdge) continue;
      const tx = x0 + dx, ty = y0 + dy;
      if(!window.DuneTerrain.inBounds(tx, ty)) continue;
      if(!window.DuneTerrain.isPassable(tx, ty)) continue;
      const d = Math.abs(tx - fromX) + Math.abs(ty - fromY);
      if(d < bestD){ bestD = d; best = { x: tx, y: ty }; }
    }
  }
  return best;
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
  // Also scan enemy buildings — buildings are static targets.
  if(window.DuneBuildings && window.DuneBuildings.all){
    for(const b of window.DuneBuildings.all()){
      if(b.owner === u.owner) continue;
      const bx = b.x + Math.floor(b.w/2), by = b.y + Math.floor(b.h/2);
      const d = _duneTileDist(u.tx, u.ty, bx, by);
      if(d <= cfg.sight && d < bestD){
        best = _duneBuildingTarget(b, state.tileSize);
        bestD = d;
      }
    }
  }
  return best;
}

// Wrap a building as a target shaped like a unit so the rest of units.js
// (attack/path/fire) doesn't need separate codepaths.
function _duneBuildingTarget(b, tileSize){
  const ts = tileSize || (window.DuneState ? window.DuneState.get().tile : 24);
  const cx = (b.x + b.w/2) * ts;
  const cy = (b.y + b.h/2) * ts;
  return {
    __isBuilding: true,
    id: 'b' + b.id,            // namespaced so it never collides with unit ids
    buildingId: b.id,
    owner: b.owner,
    tx: b.x + Math.floor(b.w/2),
    ty: b.y + Math.floor(b.h/2),
    px: cx, py: cy,
    hp: b.hp, maxHp: b.hpMax,
    dead: false,
  };
}

// Find current attack target by id. Handles both unit-id and 'b<id>' building-id.
function _duneFindTargetById(state, targetId){
  if(typeof targetId === 'string' && targetId[0] === 'b'){
    const bid = parseInt(targetId.slice(1), 10);
    if(!window.DuneBuildings || !window.DuneBuildings.all) return null;
    const b = window.DuneBuildings.all().find(x => x.id === bid);
    if(!b) return null;
    return _duneBuildingTarget(b, state.tileSize);
  }
  return state.units.find(x => x.id === targetId && !x.dead) || null;
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

// ════════════════════════════════════════════════════
//  ADAPTER → window.DuneUnits  (bridges PR #98's surface)
// ════════════════════════════════════════════════════
// PR #97's internals run on integer 60fps ticks. The unified game.js calls
// tick(dt, world) with seconds — we convert that into N tick steps so the
// existing logic doesn't change. world.nearestRefinery is also honoured for
// the (rare) caller that wants to drive harvester drop-off from outside.

(function(){
  let _onSpiceDelivered = null;
  let _accFrames = 0;

  function _state(){ return window.DuneState ? window.DuneState.get() : null; }

  function init(opts){
    const S = _state();
    if(!S) return;
    _onSpiceDelivered = (opts && opts.onSpiceDelivered) || null;
    S.units = [];
    S.particles = [];
    S.selected = [];
    S.frame = 0;
    S.aiTimer = 0;
    S.tileSize = S.tile;
    // Terrain MUST be in place before this is called — units.js code reads
    // state.terrain throughout. Point it at the live DuneTerrain module.
    S.terrain = window.DuneTerrain;
    S.dropOff = {
      player: { x: Math.floor(S.cols * 0.2), y: Math.floor(S.rows * 0.5) },
      enemy:  { x: Math.floor(S.cols * 0.8), y: Math.floor(S.rows * 0.5) },
    };
    S.spice = { player: 0, enemy: 0 };
    S.unitQueues = { player: [], enemy: [] };
    _accFrames = 0;
  }

  function spawnUnit(type, tx, ty, owner){
    const S = _state(); if(!S) return null;
    // duneSpawnUnit reads from state.tileSize; ensure it's set.
    S.tileSize = S.tile;
    const u = duneSpawnUnit(S, type, owner, tx, ty);
    if(u && DUNE_UNITS[type] && DUNE_UNITS[type].harvester){
      duneIssueOrder(S, u, { kind: 'harvest' });
    }
    return u;
  }

  function allOf(owner){
    const S = _state(); if(!S) return [];
    return S.units.filter(u => !u.dead && u.owner === owner);
  }

  function removeAllOwnedBy(owner){
    const S = _state(); if(!S) return;
    S.units = S.units.filter(u => u.owner !== owner);
  }

  function selected(){
    const S = _state(); if(!S) return [];
    return S.selected.slice();
  }

  function clearSelection(){
    const S = _state(); if(!S) return;
    for(const u of S.selected) u.selected = false;
    S.selected = [];
  }

  // dt → integer 60fps frames. Carry over fractional remainder so we keep
  // simulation rate stable across variable frame times.
  function tick(dt, world){
    const S = _state(); if(!S) return;
    S.tileSize = S.tile;
    if(world && world.nearestRefinery){
      // Pass the world down via state so units.js sees the live lookup.
      S._world = world;
    }
    _accFrames += dt * 60;
    let steps = Math.floor(_accFrames);
    _accFrames -= steps;
    // Safety: don't run more than 6 ticks per frame (avoid death-spiral on tab focus).
    if(steps > 6) steps = 6;
    for(let i = 0; i < steps; i++){
      duneTickUnits(S);

      // Particle decay (PR #97 ran this in game.js's loop).
      const surviving = [];
      for(const p of S.particles){
        p.life--;
        if(p.life > 0) surviving.push(p);
      }
      S.particles = surviving;

      duneRemoveDead(S);

      // Tick unit production queues (one slot per producer building type).
      _tickUnitQueues(S);

      // Mini AI: every ~5s, idle enemy combat units pick a target.
      S.aiTimer++;
      if(S.aiTimer > 300){
        S.aiTimer = 0;
        _duneSimpleAI(S);
      }
      S.frame++;
    }
  }

  function _duneSimpleAI(state){
    for(const u of state.units){
      if(u.dead) continue;
      if(u.owner !== 'enemy') continue;
      if(DUNE_UNITS[u.type].attack <= 0) continue;
      if(u.order.kind === 'attack') continue;
      const players = state.units.filter(x => !x.dead && x.owner === 'player');
      if(players.length === 0) return;
      const target = players[Math.floor(Math.random() * players.length)];
      duneIssueOrder(state, u, { kind: 'attack', targetId: target.id, persistent: true });
    }
  }

  // ── Unit production ────────────────────────────────────────────────────
  // queue item: { type, owner, progress, total, producerId }
  function queueUnit(type, owner){
    const S = _state(); if(!S) return { ok: false, reason: 'no state' };
    const cfg = DUNE_UNITS[type];
    if(!cfg) return { ok: false, reason: 'unknown unit' };
    if(S.unitQueues[owner].length >= 3) return { ok: false, reason: 'queue full' };
    // Find a producer building owned by this side that produces this type.
    const producer = _findProducer(type, owner);
    if(!producer) return { ok: false, reason: 'no producer' };
    if(!window.DuneEconomy || !window.DuneEconomy.canAfford(owner, cfg.cost)){
      return { ok: false, reason: 'insufficient credits' };
    }
    if(!window.DuneEconomy.spend(owner, cfg.cost)){
      return { ok: false, reason: 'insufficient credits' };
    }
    S.unitQueues[owner].push({
      type, owner, progress: 0,
      total: cfg.buildTime,
      producerId: producer.id,
    });
    return { ok: true };
  }

  function _findProducer(unitType, owner){
    if(!window.DuneBuildings || !window.DuneBuildings.allOwned) return null;
    const cat = window.DuneConfig.BUILDINGS;
    for(const b of window.DuneBuildings.allOwned(owner)){
      const cfg = cat[b.type];
      if(cfg && cfg.produces && cfg.produces.includes(unitType)) return b;
    }
    return null;
  }

  function _tickUnitQueues(state){
    for(const owner of ['player', 'enemy']){
      const q = state.unitQueues[owner];
      if(!q.length) continue;
      const item = q[0];
      item.progress += 1;  // one game frame = one progress step
      if(item.progress >= item.total){
        // Find rally point near producer
        const prod = window.DuneBuildings.all().find(b => b.id === item.producerId);
        if(prod){
          const spot = _spawnSpotNear(prod, state);
          if(spot){
            const u = duneSpawnUnit(state, item.type, owner, spot.x, spot.y);
            if(owner === 'player' && window.DuneState && window.DuneState.pushLog){
              window.DuneState.pushLog(DUNE_UNITS[item.type].name + ' deployed.', 'good');
            }
          }
        }
        q.shift();
      }
    }
  }

  function _spawnSpotNear(building, state){
    const w = building.w, h = building.h;
    for(let r = 1; r <= 4; r++){
      for(let dx = -r; dx <= w + r - 1; dx++){
        for(const dy of [-r, h + r - 1]){
          const tx = building.x + dx, ty = building.y + dy;
          if(state.terrain.isPassable(tx, ty)) return { x: tx, y: ty };
        }
      }
      for(let dy = -r; dy <= h + r - 1; dy++){
        for(const dx of [-r, w + r - 1]){
          const tx = building.x + dx, ty = building.y + dy;
          if(state.terrain.isPassable(tx, ty)) return { x: tx, y: ty };
        }
      }
    }
    return null;
  }

  // Refresh dropOff anchors to use real refineries when they exist.
  function refreshDropOff(){
    const S = _state(); if(!S || !window.DuneBuildings) return;
    for(const owner of ['player', 'enemy']){
      const r = window.DuneBuildings.findRefineryNear(S.cols/2, S.rows/2, owner);
      if(r){
        S.dropOff[owner] = {
          x: Math.floor(r.x + r.w/2),
          y: Math.floor(r.y + r.h/2),
        };
      }
    }
  }

  function draw(ctx, tile){
    const S = _state(); if(!S) return;
    if(typeof drawDuneUnits === 'function'){
      drawDuneUnits(ctx, S, tile);
    }
  }

  function queues(owner){
    const S = _state(); if(!S) return [];
    return S.unitQueues[owner].slice();
  }

  function buildableUnitsFor(owner){
    if(!window.DuneBuildings || !window.DuneBuildings.allOwned) return [];
    const cat = window.DuneConfig.BUILDINGS;
    const types = new Set();
    for(const b of window.DuneBuildings.allOwned(owner)){
      const cfg = cat[b.type];
      if(!cfg || !cfg.produces) continue;
      for(const p of cfg.produces){
        if(DUNE_UNITS[p]) types.add(p);
      }
    }
    return Array.from(types);
  }

  window.DuneUnits = {
    init,
    spawnUnit,
    allOf,
    removeAllOwnedBy,
    selected,
    clearSelection,
    tick,
    draw,
    queueUnit,
    queues,
    buildableUnitsFor,
    refreshDropOff,
  };
})();
