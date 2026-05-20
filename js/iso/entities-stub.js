// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — UNITS, BUILDINGS, SELECTION, MOVEMENT
// ════════════════════════════════════════════════════
//
// ⚠ STUB FILE — Liam (units/selection/pathfinding) and George
// (buildings) own this scope. Their PRs will replace the impls
// below with proper pathfinding, group selection, formations,
// build-on-tiles, etc.
//
// We keep this file functional so the production / combat / HUD
// hoglet's work can be reviewed end-to-end before they land.
//
// API surface — see js/iso/api.js for the contract.

(function(){

  // ── Helpers ──────────────────────────────────────────
  function dist(ax, ay, bx, by){
    const dx = ax - bx, dy = ay - by;
    return Math.hypot(dx, dy);
  }
  function tileForEntity(ent){
    return worldToTile(ent.x, ent.y);
  }

  // ── Unit factory ─────────────────────────────────────
  // Creates a unit entity. Stats are copied from UNIT_TYPES so each
  // unit has its own mutable hp / cooldown state.
  function createUnit(world, opts){
    const t = IsoAPI.UNIT_TYPES[opts.typeId];
    if (!t){ console.warn('[iso] Unknown unit type', opts.typeId); return null; }
    const owner = opts.owner || 'player';
    const ent = new Entity({
      type: 'unit',
      x:    opts.x || 0,
      y:    opts.y || 0,
      components: {
        kind:        'unit',
        unitTypeId:  t.id,
        owner:       owner,
        hp:          t.hp,
        maxHp:       t.hp,
        dmg:         t.dmg,
        range:       t.range,
        cooldown:    t.cooldown,
        speed:       t.speed,
        vision:      t.vision,
        radius:      t.radius,
        supply:      t.supply,
        attackCdMs:  0,             // ticks down each frame
        movement:    null,          // {destX, destY}
        attackTarget: null,         // Entity ref
        holdPosition: false,
        render:      _renderUnit,
      },
    });
    world.add(ent);
    return ent;
  }

  function _renderUnit(ctx, ent, cam){
    const c = ent.components;
    const type = IsoAPI.UNIT_TYPES[c.unitTypeId];
    const fac  = IsoAPI.FACTIONS[c.owner] || IsoAPI.FACTIONS.player;
    const s = worldToScreen(ent.x, ent.y, cam);
    const r = c.radius;

    // Drop-shadow ellipse for ground contact.
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.5, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    // Body — diamond for combat units, hex for workers.
    ctx.beginPath();
    if (type && type.role === 'worker'){
      // hexagon-ish
      for (let i = 0; i < 6; i++){
        const a = Math.PI/2 + i * Math.PI/3;
        const x = s.x + Math.cos(a) * r;
        const y = s.y + Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    } else {
      // diamond
      ctx.moveTo(s.x,     s.y - r);
      ctx.lineTo(s.x + r, s.y);
      ctx.lineTo(s.x,     s.y + r);
      ctx.lineTo(s.x - r, s.y);
    }
    ctx.closePath();
    ctx.fillStyle = c.owner === 'player' ? fac.color : fac.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c.owner === 'player' ? '#ffffff' : fac.accent;
    ctx.stroke();

    // Type-letter glyph for legibility.
    ctx.fillStyle = '#020810';
    ctx.font = 'bold 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = (type && type.name[0]) || '?';
    ctx.fillText(glyph, s.x, s.y);

    _drawSelectionAndHp(ctx, ent, s, r);
  }

  function _drawSelectionAndHp(ctx, ent, s, r){
    const c = ent.components;
    const selected = !!c._selected;
    if (selected){
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + r * 0.45, r * 1.15, r * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = c.owner === 'player' ? '#00ff88' : '#ff0088';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // HP bar (only if damaged or selected).
    if (c.hp < c.maxHp || selected){
      const w = Math.max(20, r * 2.2);
      const h = 3;
      const bx = s.x - w/2;
      const by = s.y - r - 7;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, w, h);
      const frac = Math.max(0, c.hp / c.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#00ff88' : (frac > 0.25 ? '#ffaa00' : '#ff0088');
      ctx.fillRect(bx, by, w * frac, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, w, h);
    }
  }

  // ── Building factory ─────────────────────────────────
  function createBuilding(world, opts){
    const t = IsoAPI.BUILDING_TYPES[opts.typeId];
    if (!t){ console.warn('[iso] Unknown building type', opts.typeId); return null; }
    const owner = opts.owner || 'player';
    const col = opts.col, row = opts.row;
    const center = tileToWorld(col, row);
    const ent = new Entity({
      type: 'building',
      x:    center.x,
      y:    center.y,
      components: {
        kind:        'building',
        buildingTypeId: t.id,
        owner:       owner,
        col:         col,
        row:         row,
        footprint:   t.tileFootprint,
        radius:      t.radius,
        hp:          t.hp,
        maxHp:       t.hp,
        produces:    t.produces.slice(),
        queue:       null,        // ProductionQueue (attached by production.js)
        rallyPoint:  null,        // {x, y} world-space; null = default adjacent
        render:      _renderBuilding,
      },
    });
    world.add(ent);
    // Mark the footprint tiles as occupied for pathing later (Liam).
    // For now we just stash on the building.
    return ent;
  }

  function _renderBuilding(ctx, ent, cam){
    const c = ent.components;
    const fac = IsoAPI.FACTIONS[c.owner] || IsoAPI.FACTIONS.player;
    const type = IsoAPI.BUILDING_TYPES[c.buildingTypeId];
    const s = worldToScreen(ent.x, ent.y, cam);
    const r = c.radius;

    // Shadow base.
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.45, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();

    // Isometric box: a "footprint" diamond at the base, then a vertical
    // prism on top. Keeps the programmer-art clean.
    const hw = r;
    const hh = r * 0.55;
    const tall = r * 1.1;

    // base diamond
    ctx.beginPath();
    ctx.moveTo(s.x,        s.y - hh);
    ctx.lineTo(s.x + hw,   s.y);
    ctx.lineTo(s.x,        s.y + hh);
    ctx.lineTo(s.x - hw,   s.y);
    ctx.closePath();
    ctx.fillStyle = fac.color;
    ctx.fill();
    ctx.strokeStyle = fac.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // top "roof" diamond, lifted by `tall`
    ctx.beginPath();
    ctx.moveTo(s.x,        s.y - hh - tall);
    ctx.lineTo(s.x + hw,   s.y - tall);
    ctx.lineTo(s.x,        s.y + hh - tall);
    ctx.lineTo(s.x - hw,   s.y - tall);
    ctx.closePath();
    // brighter top
    ctx.fillStyle = _lighten(fac.color, 0.18);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // left wall
    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y);
    ctx.lineTo(s.x,      s.y + hh);
    ctx.lineTo(s.x,      s.y + hh - tall);
    ctx.lineTo(s.x - hw, s.y - tall);
    ctx.closePath();
    ctx.fillStyle = _darken(fac.color, 0.35);
    ctx.fill();
    ctx.strokeStyle = fac.accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    // right wall
    ctx.beginPath();
    ctx.moveTo(s.x + hw, s.y);
    ctx.lineTo(s.x,      s.y + hh);
    ctx.lineTo(s.x,      s.y + hh - tall);
    ctx.lineTo(s.x + hw, s.y - tall);
    ctx.closePath();
    ctx.fillStyle = _darken(fac.color, 0.2);
    ctx.fill();
    ctx.strokeStyle = fac.accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label on top of building.
    ctx.fillStyle = '#020810';
    ctx.font = 'bold 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((type && type.name[0]) || 'B', s.x, s.y - tall);

    // Selection ring + HP.
    const selected = !!c._selected;
    if (selected){
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + hh * 0.6, hw * 1.2, hh * 1.2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = c.owner === 'player' ? '#00ff88' : '#ff0088';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (c.hp < c.maxHp || selected){
      const w = Math.max(40, hw * 2.2);
      const h = 4;
      const bx = s.x - w/2;
      const by = s.y - hh - tall - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, w, h);
      const frac = Math.max(0, c.hp / c.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#00ff88' : (frac > 0.25 ? '#ffaa00' : '#ff0088');
      ctx.fillRect(bx, by, w * frac, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, w, h);
    }

    // Production progress bar — drawn by HUD code via building.queue
    // hook, but we also paint a small bar over the building for clarity.
    if (c.queue && c.queue.items && c.queue.items.length > 0){
      const item = c.queue.items[0];
      const frac = item.elapsedMs / item.totalMs;
      const w = Math.max(40, hw * 2);
      const h = 3;
      const bx = s.x - w/2;
      const by = s.y + hh + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = '#00f5ff';
      ctx.fillRect(bx, by, w * frac, h);
      ctx.strokeStyle = 'rgba(0,245,255,0.6)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, w, h);
    }
  }

  function _lighten(hex, amt){
    const c = _hex(hex);
    return _rgb(
      Math.min(255, Math.round(c.r + (255 - c.r) * amt)),
      Math.min(255, Math.round(c.g + (255 - c.g) * amt)),
      Math.min(255, Math.round(c.b + (255 - c.b) * amt))
    );
  }
  function _darken(hex, amt){
    const c = _hex(hex);
    return _rgb(
      Math.max(0, Math.round(c.r * (1 - amt))),
      Math.max(0, Math.round(c.g * (1 - amt))),
      Math.max(0, Math.round(c.b * (1 - amt)))
    );
  }
  function _hex(s){
    s = s.replace('#','');
    if (s.length === 3) s = s.split('').map(c=>c+c).join('');
    return { r: parseInt(s.slice(0,2),16), g: parseInt(s.slice(2,4),16), b: parseInt(s.slice(4,6),16) };
  }
  function _rgb(r,g,b){
    return '#' + [r,g,b].map(n => n.toString(16).padStart(2,'0')).join('');
  }

  // Returns a passable tile adjacent to the building's footprint
  // (used for spawn points and default rally).
  function findAdjacentPassableTile(world, building){
    const c = building.components;
    const fp = c.footprint || { w: 1, h: 1 };
    const baseCol = c.col, baseRow = c.row;
    // Footprint is centered on (col, row). Scan tiles in a ring just
    // outside the footprint, prefer the south-east neighbour.
    const half = Math.ceil(Math.max(fp.w, fp.h) / 2);
    const candidates = [];
    for (let dr = -half; dr <= half; dr++){
      for (let dc = -half; dc <= half; dc++){
        // skip the interior of the footprint
        if (Math.abs(dr) < half && Math.abs(dc) < half) continue;
        candidates.push({ col: baseCol + dc, row: baseRow + dr });
      }
    }
    // Prefer south-east (col+, row+) — it's more visible on the iso view.
    candidates.sort((a, b) => {
      const sa = (a.col - baseCol) + (a.row - baseRow);
      const sb = (b.col - baseCol) + (b.row - baseRow);
      return sb - sa;
    });
    for (const { col, row } of candidates){
      if (world.map.isPassable(col, row)) return { col, row };
    }
    return null;
  }

  // ── Units / buildings registry helpers ──────────────
  const units = {
    create: createUnit,
    all(world){ return world.entities.filter(e => e.components && e.components.kind === 'unit'); },
    isAlive(ent){ return ent && ent.components && ent.components.hp > 0; },
  };
  const buildings = {
    create: createBuilding,
    all(world){ return world.entities.filter(e => e.components && e.components.kind === 'building'); },
    findAdjacentPassableTile,
  };

  // ── Movement (stub) ──────────────────────────────────
  // Liam will replace with grid/A* pathfinding. For now: straight-line
  // toward destination, capped by speed * dt. No obstacle avoidance.
  const movement = {
    moveTo(ent, x, y){
      if (!ent || !ent.components) return;
      ent.components.movement = { destX: x, destY: y };
      ent.components.holdPosition = false;
    },
    stop(ent){
      if (!ent || !ent.components) return;
      ent.components.movement = null;
      ent.components.attackTarget = null;
    },
  };

  class MovementSystem {
    update(dt, world){
      const dtSec = dt / 1000;
      for (const ent of world.entities){
        if (!ent.components || ent.components.kind !== 'unit') continue;
        const c = ent.components;
        if (c.hp <= 0) continue;
        const m = c.movement;
        if (!m) continue;
        const dx = m.destX - ent.x;
        const dy = m.destY - ent.y;
        const d = Math.hypot(dx, dy);
        // Arrival threshold: range or 4 px, whichever larger. This lets
        // attack-move stop at firing distance.
        const arrive = c._arriveThreshold != null ? c._arriveThreshold : 4;
        if (d <= arrive){
          c.movement = null;
          continue;
        }
        const step = Math.min(d, c.speed * dtSec);
        ent.x += (dx / d) * step;
        ent.y += (dy / d) * step;
      }
    }
  }

  // ── Selection (stub) ─────────────────────────────────
  // Simple single/multi entity selection with a pubsub change event.
  const selection = (function(){
    let sel = [];
    const subs = [];
    function emit(){
      // tag entities with _selected so renderers can highlight them
      // without crawling the selection list every frame.
      for (const e of (window.ISO_GAME && ISO_GAME.world ? ISO_GAME.world.entities : [])){
        if (e.components) e.components._selected = false;
      }
      for (const e of sel){
        if (e.components) e.components._selected = true;
      }
      for (const cb of subs) try { cb(sel); } catch(err){ console.error(err); }
    }
    return {
      get(){ return sel.slice(); },
      set(entities){
        sel = (entities || []).filter(e => e && e.components && e.components.hp > 0);
        emit();
      },
      add(entities){
        for (const e of entities || []){
          if (sel.indexOf(e) === -1) sel.push(e);
        }
        emit();
      },
      clear(){ sel = []; emit(); },
      onChange(cb){ subs.push(cb); },
      offChange(cb){ const i = subs.indexOf(cb); if (i !== -1) subs.splice(i, 1); },
      // Hit-test world entities at a screen point. Returns the topmost
      // entity (front-most in draw order) under the cursor.
      pickAt(world, sx, sy, cam){
        const w = screenToWorld(sx, sy, cam);
        // Iterate in reverse draw order: later entries draw on top, so
        // we want the *deepest* (largest col+row, then y) first.
        const sorted = world.entities.slice().sort((a, b) => {
          const ta = worldToTile(a.x, a.y), tb = worldToTile(b.x, b.y);
          const da = ta.col + ta.row, db = tb.col + tb.row;
          return (db - da) || (b.y - a.y);
        });
        for (const e of sorted){
          if (!e.components || e.components.hp <= 0) continue;
          const r = e.components.radius || 8;
          if (dist(w.x, w.y, e.x, e.y) <= r + 2) return e;
        }
        return null;
      },
      // Pruning helper — drop dead entities from selection.
      _prune(){
        const before = sel.length;
        sel = sel.filter(e => e && e.components && e.components.hp > 0);
        if (sel.length !== before) emit();
      },
    };
  })();

  // ── Publish ──────────────────────────────────────────
  window.IsoAPI = window.IsoAPI || {};
  IsoAPI.units      = units;
  IsoAPI.buildings  = buildings;
  IsoAPI.movement   = movement;
  IsoAPI.selection  = selection;
  window.IsoMovementSystem = MovementSystem;
})();
