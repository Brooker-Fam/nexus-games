// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — COMBAT
// ════════════════════════════════════════════════════
//
// Combat model (simple and StarCraft-ish):
//   - Each unit has dmg, range, cooldown, attackCdMs.
//   - When an attack is commanded:
//       components.attackTarget = the target entity
//       components.attackCdMs   = ticks down each frame
//   - CombatSystem.update(dt, world):
//       For each unit with attackTarget:
//         - drop target if dead (or hp ≤ 0)
//         - compute distance to target
//         - if out of range and not on holdPosition:
//             call IsoAPI.movement.moveTo(unit, target.x, target.y)
//         - if in range:
//             cancel movement and fire when cooldown reaches 0
//             damage(target, dmg, unit)
//             reset cooldown
//
//   damage(target, amt, source):
//     - clamp hp to 0
//     - on death: remove entity from world (with brief death FX hook)
//
//   Buildings: combat works the same — buildings can be damaged and
//   destroyed. Buildings don't shoot back in this hoglet (defenses are
//   out of scope); the AI/wins hoglet can add static-defense buildings
//   later.

(function(){

  function dist(ax, ay, bx, by){
    const dx = ax - bx, dy = ay - by;
    return Math.hypot(dx, dy);
  }

  function isDead(ent){
    return !ent || !ent.components || ent.components.hp <= 0 || ent.components._removed;
  }

  function attack(attacker, target){
    if (!attacker || !attacker.components) return;
    const c = attacker.components;
    if (c.kind !== 'unit') return;  // buildings don't attack in this hoglet
    if (!target || !target.components) return;
    if (target === attacker) return;
    if (target.components.owner === attacker.components.owner) return; // no friendly fire
    c.attackTarget = target;
    c.holdPosition = false;
  }

  function holdPosition(ent){
    if (!ent || !ent.components) return;
    ent.components.holdPosition = true;
    if (IsoAPI.movement) IsoAPI.movement.stop(ent);
  }

  function damage(target, amt, source){
    if (!target || !target.components) return;
    const c = target.components;
    if (c.hp <= 0) return;
    c.hp -= amt;
    if (c.hp <= 0){
      c.hp = 0;
      _killEntity(target);
    }
  }

  // Death — drop a brief FX entity, then mark the target for removal.
  function _killEntity(ent){
    const world = window.ISO_GAME && ISO_GAME.world;
    if (!world) return;
    ent.components._removed = true;

    // Drop a tiny non-blocking FX entity that fades over ~500ms.
    const fx = new Entity({
      type: 'fx',
      x:    ent.x,
      y:    ent.y,
      components: {
        kind:   'fx',
        ttlMs:  500,
        ageMs:  0,
        radius: (ent.components.radius || 10) * 1.5,
        color:  ent.components.kind === 'building' ? '#ff0088' : '#ffaa00',
        render: _renderDeathFx,
      },
    });
    world.add(fx);

    // Remove the dead entity at end of frame (we do it inline; safe
    // because we iterate snapshots in the combat system).
    world.remove(ent);
    // Prune from selection if it was selected.
    if (IsoAPI.selection && IsoAPI.selection._prune) IsoAPI.selection._prune();
  }

  function _renderDeathFx(ctx, ent, cam){
    const c = ent.components;
    const t = 1 - (c.ageMs / c.ttlMs);
    if (t <= 0) return;
    const s = worldToScreen(ent.x, ent.y, cam);
    const r = c.radius * (1.6 - t);   // expand
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = c.color;
    ctx.globalAlpha = t;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Per-frame combat + FX aging.
  class CombatSystem {
    update(dt, world){
      // Age & cull FX entities first.
      const toRemove = [];
      for (const e of world.entities){
        if (e.components && e.components.kind === 'fx'){
          e.components.ageMs += dt;
          if (e.components.ageMs >= e.components.ttlMs) toRemove.push(e);
        }
      }
      for (const e of toRemove) world.remove(e);

      for (const ent of world.entities){
        if (!ent.components || ent.components.kind !== 'unit') continue;
        const c = ent.components;
        if (c.hp <= 0) continue;
        if (c.attackCdMs > 0) c.attackCdMs = Math.max(0, c.attackCdMs - dt);

        let target = c.attackTarget;
        if (target && isDead(target)){
          c.attackTarget = null;
          target = null;
          c._arriveThreshold = 4;
        }
        if (!target) continue;

        const d = dist(ent.x, ent.y, target.x, target.y);
        const reach = c.range + (target.components.radius || 0);
        if (d > reach){
          if (c.holdPosition){
            // Don't move; just wait. Target may walk into range.
            c._arriveThreshold = 4;
            continue;
          }
          // Pursue. Set arrive-threshold to range so movement stops
          // exactly at firing distance.
          c._arriveThreshold = Math.max(4, reach - 2);
          if (IsoAPI.movement) IsoAPI.movement.moveTo(ent, target.x, target.y);
          continue;
        }

        // In range — stop and shoot.
        c.movement = null;
        if (c.attackCdMs <= 0){
          _muzzleFx(world, ent, target);
          damage(target, c.dmg, ent);
          c.attackCdMs = c.cooldown;
          if (isDead(target)) {
            c.attackTarget = null;
            c._arriveThreshold = 4;
          }
        }
      }
    }
  }

  function _muzzleFx(world, attacker, target){
    // Quick laser flash from attacker to target.
    const fx = new Entity({
      type: 'fx',
      x:    attacker.x,
      y:    attacker.y,
      components: {
        kind:    'fx',
        ttlMs:   140,
        ageMs:   0,
        radius:  0,
        color:   attacker.components.owner === 'player' ? '#00f5ff' : '#ff0088',
        _from:   { x: attacker.x, y: attacker.y },
        _to:     { x: target.x,   y: target.y   },
        render:  _renderTracer,
      },
    });
    world.add(fx);
  }
  function _renderTracer(ctx, ent, cam){
    const c = ent.components;
    const t = 1 - (c.ageMs / c.ttlMs);
    if (t <= 0) return;
    const a = worldToScreen(c._from.x, c._from.y, cam);
    const b = worldToScreen(c._to.x,   c._to.y,   cam);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = c.color;
    ctx.globalAlpha = Math.max(0.2, t);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Publish ──────────────────────────────────────────
  window.IsoAPI = window.IsoAPI || {};
  IsoAPI.combat = {
    attack,
    holdPosition,
    damage,
    isDead,
  };
  window.IsoCombatSystem = CombatSystem;
})();
