// ── SPICE WARS · UNITS STUB ─────────────────────────────────────────────────
//
// Minimal units API used by the buildings/economy/HUD module. The
// "units/combat" hoglet is expected to ship a real implementation that exposes
// the same global `window.DuneUnits`. We model a single Harvester here so the
// spice loop can be demonstrated end-to-end before that work lands.
//
// Contract (what buildings.js / game.js depend on):
//   DuneUnits.init({onSpiceDelivered})         → reset, register callbacks
//   DuneUnits.spawnUnit(type, x, y, owner)     → {id, ...} or null
//   DuneUnits.allOf(owner)                     → array of unit instances
//   DuneUnits.removeAllOwnedBy(owner)          → wipe (used on reset)
//   DuneUnits.tick(dt, world)                  → step simulation
//   DuneUnits.draw(ctx, tile)                  → render
//
// `onSpiceDelivered(owner, amount, refineryId)` fires when a Harvester
// completes a drop-off. Buildings/economy use this to credit the owner and
// trigger the refinery animation. Refineries are queried via the world hook
// `world.nearestRefinery(x, y, owner) → {id, x, y, w, h} | null` which the
// game module supplies. Keeping the dependency one-way (units → world) means
// the real units hoglet can replace this file without touching buildings.js.
// ────────────────────────────────────────────────────────────────────────────

(function(){
  const UNIT_TYPES = {
    harvester: {
      name: 'Harvester',
      color: '#d4a55a',
      speed: 2.2,            // tiles per second
      capacity: 100,         // spice carried
      harvestTime: 4,        // seconds parked on spice
    },
  };

  let unitsById = new Map();
  let nextId = 1;
  let cbSpiceDelivered = null;

  function init(opts){
    unitsById = new Map();
    nextId = 1;
    cbSpiceDelivered = (opts && opts.onSpiceDelivered) || null;
  }

  function spawnUnit(type, tx, ty, owner){
    const cfg = UNIT_TYPES[type];
    if(!cfg) return null;
    const u = {
      id: nextId++,
      type, owner,
      x: tx + 0.5, y: ty + 0.5,    // tile-centre coords
      tx, ty,
      target: null,
      goal: 'idle',                 // 'idle'|'to_spice'|'harvesting'|'to_refinery'|'unloading'
      spice: 0,
      cooldown: 0,
      cfg,
    };
    unitsById.set(u.id, u);
    return u;
  }

  function allOf(owner){
    const list = [];
    for(const u of unitsById.values()) if(u.owner === owner) list.push(u);
    return list;
  }

  function removeAllOwnedBy(owner){
    for(const [id, u] of unitsById){
      if(u.owner === owner) unitsById.delete(id);
    }
  }

  function moveToward(u, tx, ty, dt){
    const dx = tx - u.x, dy = ty - u.y;
    const dist = Math.hypot(dx, dy);
    const step = u.cfg.speed * dt;
    if(dist <= step){
      u.x = tx; u.y = ty;
      u.tx = Math.floor(tx); u.ty = Math.floor(ty);
      return true;
    }
    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
    u.tx = Math.floor(u.x); u.ty = Math.floor(u.y);
    return false;
  }

  function stepHarvester(u, dt, world){
    const T = window.DuneTerrain;
    // Idle: pick a goal
    if(u.goal === 'idle'){
      if(u.spice >= u.cfg.capacity){
        u.goal = 'to_refinery';
      } else {
        const sp = T.findNearestSpice(u.tx, u.ty);
        if(sp){ u.target = sp; u.goal = 'to_spice'; }
        else u.cooldown = 1.5;       // no spice — wait a beat
      }
    }

    if(u.cooldown > 0){ u.cooldown -= dt; return; }

    if(u.goal === 'to_spice' && u.target){
      const arrived = moveToward(u, u.target.x + 0.5, u.target.y + 0.5, dt);
      if(arrived){ u.goal = 'harvesting'; u.cooldown = u.cfg.harvestTime; }
    } else if(u.goal === 'harvesting'){
      // After cooldown elapsed we get here with cooldown <= 0
      const got = T.consumeSpice(u.target.x, u.target.y, u.cfg.capacity);
      u.spice += got;
      if(u.spice >= u.cfg.capacity || got === 0) u.goal = 'to_refinery';
      else { u.goal = 'idle'; }      // tile depleted partway, try next
    } else if(u.goal === 'to_refinery'){
      const r = world.nearestRefinery ? world.nearestRefinery(u.tx, u.ty, u.owner) : null;
      if(!r){ u.cooldown = 2; return; }   // no refinery — wait
      const tx = r.x + (r.w / 2), ty = r.y + (r.h / 2);
      const arrived = moveToward(u, tx, ty, dt);
      if(arrived){
        if(cbSpiceDelivered) cbSpiceDelivered(u.owner, u.spice, r.id);
        u.spice = 0;
        u.goal = 'idle';
        u.cooldown = 0.4;
      }
    }
  }

  function tick(dt, world){
    for(const u of unitsById.values()){
      if(u.type === 'harvester') stepHarvester(u, dt, world);
    }
  }

  function draw(ctx, tile){
    for(const u of unitsById.values()){
      const cx = u.x * tile, cy = u.y * tile;
      ctx.fillStyle = u.cfg.color;
      ctx.fillRect(cx - tile*0.4, cy - tile*0.3, tile*0.8, tile*0.6);
      // load indicator
      if(u.spice > 0){
        ctx.fillStyle = '#d96c2e';
        const w = (tile*0.7) * (u.spice / u.cfg.capacity);
        ctx.fillRect(cx - tile*0.35, cy - tile*0.05, w, tile*0.1);
      }
      // owner ring
      ctx.strokeStyle = u.owner === 'player' ? '#4ec0ff' : '#ff5a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - tile*0.4, cy - tile*0.3, tile*0.8, tile*0.6);
    }
  }

  window.DuneUnits = {
    UNIT_TYPES,
    init,
    spawnUnit,
    allOf,
    removeAllOwnedBy,
    tick,
    draw,
    __stub: true,
  };
})();
