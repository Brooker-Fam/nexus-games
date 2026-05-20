// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — MOVEMENT & COMBAT SYSTEMS
// ════════════════════════════════════════════════════
//
// Two systems pushed onto World.systems by iso-init.js:
//
//   MovementSystem  — integrates path waypoints into unit positions.
//   CombatSystem    — when a unit has an attackTarget, closes distance,
//                     deals damage on cooldown, removes corpses.
//
// Public command API (also called by input.js, AI hoglet, and future
// HUD buttons):
//
//   commandMove(units, worldX, worldY)
//       → all units pathfind to (worldX, worldY) in world-space px.
//   commandAttack(units, target)
//       → all units chase + attack `target` (an Entity / unit).
//   commandStop(units)
//       → cancel current orders, units idle in place.
//
// All three are idempotent and safe to call with empty arrays.

class MovementSystem {
  update(dt, world){
    const dtSec = dt / 1000;
    const list = ISO_UNITS.list;
    for (let i = 0; i < list.length; i++){
      const u = list[i];
      if (u.state === 'dead') continue;
      if (!u.path || u.pathIndex >= u.path.length) continue;

      let remaining = u.speed * dtSec;
      // Walk through as many waypoints as fit in this frame (in case dt is
      // huge — e.g. after returning from a backgrounded tab).
      while (remaining > 0 && u.path && u.pathIndex < u.path.length){
        const wp = u.path[u.pathIndex];
        const dx = wp.x - u.x;
        const dy = wp.y - u.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= remaining){
          u.x = wp.x;
          u.y = wp.y;
          u.pathIndex++;
          remaining -= dist;
          if (u.pathIndex >= u.path.length){
            u.path = null;
            u.moveTarget = null;
            // Stay in 'attacking' if we still have a target; combat system
            // will engage / re-path if out of range.
            if (u.state === 'moving') u.state = u.attackTarget ? 'attacking' : 'idle';
          }
        } else {
          u.x += (dx / dist) * remaining;
          u.y += (dy / dist) * remaining;
          u.facing = Math.atan2(dy, dx);
          remaining = 0;
        }
      }
    }
  }
}

class CombatSystem {
  update(dt, world){
    // Snapshot — despawnUnit() splices ISO_UNITS.list mid-iteration when a
    // target dies. Iterating the snapshot keeps each attacker visited once.
    const snapshot = ISO_UNITS.list.slice();
    for (let i = 0; i < snapshot.length; i++){
      const u = snapshot[i];
      if (!u || u.state === 'dead') continue;

      if (u.attackFlashMs > 0) u.attackFlashMs = Math.max(0, u.attackFlashMs - dt);
      if (u.hitFlashMs    > 0) u.hitFlashMs    = Math.max(0, u.hitFlashMs    - dt);
      if (u.attackLineMs  > 0) u.attackLineMs  = Math.max(0, u.attackLineMs  - dt);

      const t = u.attackTarget;
      if (!t) continue;

      if (t.state === 'dead' || t.hp <= 0){
        u.attackTarget = null;
        if (u.state === 'attacking') u.state = 'idle';
        continue;
      }

      const ut = worldToTile(u.x, u.y);
      const tt = worldToTile(t.x, t.y);
      const cheby = Math.max(Math.abs(ut.col - tt.col), Math.abs(ut.row - tt.row));

      if (cheby <= u.attackRange){
        // In range — face target, stop walking, attack on cooldown.
        u.path = null;
        u.pathIndex = 0;
        u.state = 'attacking';
        u.facing = Math.atan2(t.y - u.y, t.x - u.x);

        const now = world.timeMs;
        if (now - u.lastAttackMs >= u.attackCooldown){
          u.lastAttackMs   = now;
          t.hp            -= u.attack;
          u.attackFlashMs  = 180;
          t.hitFlashMs     = 220;
          u.attackLineMs   = 140;
          u.attackLineTo   = { x: t.x, y: t.y };

          if (t.hp <= 0){
            despawnUnit(t);
            u.attackTarget = null;
            if (u.state === 'attacking') u.state = 'idle';
          }
        }
      } else {
        // Out of range — pursue.
        const now = world.timeMs;
        const stale = (now - u.lastPathMs) > 300;
        const lastWp = u.path && u.path.length ? u.path[u.path.length - 1] : null;
        const goalDrifted = !lastWp || (() => {
          const gt = worldToTile(lastWp.x, lastWp.y);
          return Math.max(Math.abs(gt.col - tt.col), Math.abs(gt.row - tt.row)) > 1;
        })();
        if (!u.path || (stale && goalDrifted)){
          _setUnitPathToTile(u, world.map, tt.col, tt.row);
          u.lastPathMs = now;
        }
        if (u.path) u.state = 'moving';
      }
    }
  }
}

// Internal — convert a tile path to world-space waypoints and attach.
function _setUnitPathToTile(unit, map, goalCol, goalRow){
  const sw = worldToTile(unit.x, unit.y);
  if (sw.col === goalCol && sw.row === goalRow){
    unit.path = null;
    return;
  }
  const tiles = findPath(map, sw.col, sw.row, goalCol, goalRow);
  if (!tiles || tiles.length === 0){
    unit.path = null;
    return;
  }
  const waypoints = new Array(tiles.length);
  for (let i = 0; i < tiles.length; i++){
    const w = tileToWorld(tiles[i].col, tiles[i].row);
    waypoints[i] = { x: w.x, y: w.y };
  }
  unit.path = waypoints;
  unit.pathIndex = 0;
}

// ── Public commands ─────────────────────────────────

function commandMove(units, worldX, worldY){
  if (!units || !units.length) return;
  if (!ISO_GAME.world) return;
  const map = ISO_GAME.world.map;
  const goal = worldToTile(worldX, worldY);

  // If goal tile is impassable, snap once here so every unit shares the
  // same fallback (otherwise they each pick a slightly different tile).
  let gc = goal.col, gr = goal.row;
  if (!map.isPassable(gc, gr)){
    const snap = nearestPassableTile(map, gc, gr, 8);
    if (!snap) return;
    gc = snap.col; gr = snap.row;
  }

  for (let i = 0; i < units.length; i++){
    const u = units[i];
    if (!u || u.state === 'dead') continue;
    u.attackTarget = null;
    u.moveTarget   = { x: worldX, y: worldY };
    _setUnitPathToTile(u, map, gc, gr);
    u.state        = u.path ? 'moving' : 'idle';
    u.lastPathMs   = ISO_GAME.world.timeMs;
  }
}

function commandAttack(units, target){
  if (!units || !units.length || !target) return;
  if (target.state === 'dead' || target.hp <= 0) return;
  for (let i = 0; i < units.length; i++){
    const u = units[i];
    if (!u || u.state === 'dead' || u === target) continue;
    u.attackTarget = target;
    u.moveTarget   = null;
    u.path         = null;
    u.pathIndex    = 0;
    u.state        = 'attacking';
    u.lastPathMs   = -Infinity;   // force re-path on next combat tick
  }
}

function commandStop(units){
  if (!units || !units.length) return;
  for (let i = 0; i < units.length; i++){
    const u = units[i];
    if (!u || u.state === 'dead') continue;
    u.path = null;
    u.pathIndex = 0;
    u.moveTarget = null;
    u.attackTarget = null;
    u.state = 'idle';
  }
}

window.MovementSystem    = MovementSystem;
window.CombatSystem      = CombatSystem;
window.commandMove       = commandMove;
window.commandAttack     = commandAttack;
window.commandStop       = commandStop;
window._setUnitPathToTile = _setUnitPathToTile;
