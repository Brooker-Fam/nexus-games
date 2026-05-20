// ── SPICE WARS · BUILDINGS ──────────────────────────────────────────────────
// Placement, build queue, lifecycle, prerequisites, damage/destruction.
//
// Public surface used by hud.js, game.js, rendering.js:
//   Buildings.add(type, x, y, owner, {builtImmediately})  → instance or null
//   Buildings.tryQueue(type, owner)                       → bool
//   Buildings.tickQueues(dt)                              → advance build queues
//   Buildings.placePending(type, x, y, owner)             → drop a ready item
//   Buildings.cancelPending(owner)
//   Buildings.canPlaceAt(type, x, y)
//   Buildings.canQueue(type, owner)                       → { ok, reason }
//   Buildings.optionsFor(owner)                           → [{type, cfg, ok, reason}]
//   Buildings.damage(id, amount, attacker)                → handle hits
//   Buildings.findRefineryNear(x, y, owner)               → {id, x, y, w, h}
//   Buildings.flashRefinery(id)                           → trigger visual ping
//   Buildings.all() / allOwned(owner)

(function(){
  function S(){ return window.DuneState.get(); }
  function CFG(){ return window.DuneConfig.BUILDINGS; }

  function allOwned(owner, opts){
    const all = S().buildings;
    if(opts && opts.includePending){
      return all.filter(b => b.owner === owner);
    }
    return all.filter(b => b.owner === owner && b.state === 'built');
  }

  function ownedTypes(owner){
    const set = new Set();
    for(const b of allOwned(owner)) set.add(b.type);
    return set;
  }

  function prereqMet(type, owner){
    const cfg = CFG()[type];
    if(!cfg) return false;
    const have = ownedTypes(owner);
    return cfg.prereq.every(p => have.has(p));
  }

  function canQueue(type, owner){
    const cfg = CFG()[type];
    if(!cfg)         return { ok: false, reason: 'unknown structure' };
    if(!cfg.buildable && cfg.buildable !== undefined && cfg.buildable === false) {
      return { ok: false, reason: 'not buildable' };
    }
    if(!prereqMet(type, owner)) return { ok: false, reason: 'requires ' + cfg.prereq.join(' + ') };
    if(!window.DuneEconomy.canAfford(owner, cfg.cost)) return { ok: false, reason: 'insufficient credits' };
    if(S().queues[owner].length >= 1) return { ok: false, reason: 'queue full' };
    if(S().placement[owner]) return { ok: false, reason: 'awaiting placement' };
    return { ok: true };
  }

  function tryQueue(type, owner){
    const c = canQueue(type, owner);
    if(!c.ok) return c;
    const cfg = CFG()[type];
    if(!window.DuneEconomy.spend(owner, cfg.cost)){
      return { ok: false, reason: 'insufficient credits' };
    }
    S().queues[owner].push({
      type,
      progress: 0,
      total: cfg.buildTime,
      paused: false,
    });
    return { ok: true };
  }

  function tickQueues(dt){
    for(const owner of Object.keys(S().queues)){
      const q = S().queues[owner];
      if(!q.length) continue;
      const item = q[0];
      const power = window.DuneEconomy.powerOf(owner);
      const scale = power.ok ? 1 : window.DuneConfig.LOW_POWER_BUILD_SCALE;
      item.paused = !power.ok;
      item.progress += dt * scale;
      if(item.progress >= item.total){
        item.progress = item.total;
        // Move to placement.pending; queue is cleared on placePending().
        if(!S().placement[owner]){
          const cfg = CFG()[item.type];
          S().placement[owner] = {
            type: item.type,
            footprint: { w: cfg.footprint.w, h: cfg.footprint.h },
          };
          q.shift();
          if(owner === 'player'){
            window.DuneState.pushLog(cfg.name + ' construction complete — place it.', 'good');
          }
        }
      }
    }
  }

  function canPlaceAt(type, x, y){
    const cfg = CFG()[type];
    if(!cfg) return false;
    return window.DuneTerrain.isBuildable(x, y, cfg.footprint.w, cfg.footprint.h, {
      allowAnyTerrain: !!cfg.allowAnyTerrain,
    });
  }

  function placePending(type, x, y, owner){
    const pending = S().placement[owner];
    if(!pending || pending.type !== type) return { ok: false, reason: 'no pending' };
    if(!canPlaceAt(type, x, y)) return { ok: false, reason: 'invalid tile' };
    const b = add(type, x, y, owner, { builtImmediately: true });
    if(!b) return { ok: false, reason: 'place failed' };
    S().placement[owner] = null;
    return { ok: true, building: b };
  }

  function cancelPending(owner){
    S().placement[owner] = null;
  }

  function add(type, x, y, owner, opts){
    opts = opts || {};
    const cfg = CFG()[type];
    if(!cfg) return null;
    const w = cfg.footprint.w, h = cfg.footprint.h;
    if(!window.DuneTerrain.isBuildable(x, y, w, h, { allowAnyTerrain: !!cfg.allowAnyTerrain })) return null;
    const id = S().nextBuildingId++;
    const b = {
      id, type, owner,
      x, y, w, h,
      hp: cfg.hp,
      hpMax: cfg.hp,
      state: opts.builtImmediately ? 'built' : 'placed',
      flashUntil: 0,
    };
    S().buildings.push(b);
    window.DuneTerrain.markOccupied(x, y, w, h, id);
    window.DuneEconomy.recalcPower(owner);
    window.DuneEconomy.recalcStorage(owner);
    // Auto-spawn benefit (refinery → free harvester).
    if(cfg.spawnsOnComplete && cfg.spawnsOnComplete.unit && window.DuneUnits){
      const sx = x + w + 1, sy = y;
      window.DuneUnits.spawnUnit(cfg.spawnsOnComplete.unit, sx, sy, owner);
      window.DuneState.pushLog('Free harvester deployed.', 'good');
    }
    if(opts.builtImmediately && owner === 'player'){
      window.DuneState.pushLog(cfg.name + ' deployed.', 'good');
    }
    return b;
  }

  function damage(id, amount, attacker){
    const b = S().buildings.find(b => b.id === id);
    if(!b) return;
    b.hp -= amount;
    if(b.hp <= 0) destroy(b);
  }

  function destroy(b){
    window.DuneTerrain.clearOccupied(b.x, b.y, b.w, b.h);
    S().buildings = S().buildings.filter(x => x.id !== b.id);
    window.DuneEconomy.recalcPower(b.owner);
    window.DuneEconomy.recalcStorage(b.owner);
    const cfg = CFG()[b.type];
    const tag = (b.owner === 'player' ? 'OUR' : 'ENEMY') + ' ' + cfg.name.toUpperCase();
    window.DuneState.pushLog(tag + ' destroyed.', b.owner === 'player' ? 'bad' : 'good');
  }

  function findRefineryNear(x, y, owner){
    let best = null, bestD = Infinity;
    for(const b of S().buildings){
      if(b.owner !== owner || b.type !== 'refinery' || b.state !== 'built') continue;
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      const d = Math.abs(cx - x) + Math.abs(cy - y);
      if(d < bestD){ bestD = d; best = b; }
    }
    if(!best) return null;
    return { id: best.id, x: best.x, y: best.y, w: best.w, h: best.h };
  }

  function flashRefinery(id){
    const b = S().buildings.find(b => b.id === id);
    if(b) b.flashUntil = (S().tick || 0) + 0.6;   // seconds, decremented by game loop
  }

  function optionsFor(owner){
    const out = [];
    for(const key of window.DuneConfig.BUILD_ORDER){
      const cfg = CFG()[key];
      if(!cfg) continue;
      const c = canQueue(key, owner);
      out.push({ type: key, cfg, ok: c.ok, reason: c.reason });
    }
    return out;
  }

  // Win/lose: lose if you have no construction yard AND no unit-producing
  // building. Win if enemy owns zero buildings.
  function checkWinLose(){
    const me = allOwned('player');
    const them = allOwned('enemy');
    const hasCY = me.some(b => b.type === 'construction_yard');
    const hasProducer = me.some(b => CFG()[b.type] && CFG()[b.type].producesUnits);
    if(them.length === 0) return 'victory';
    if(!hasCY && !hasProducer) return 'defeat';
    return null;
  }

  window.DuneBuildings = {
    add,
    tryQueue,
    tickQueues,
    canQueue,
    canPlaceAt,
    placePending,
    cancelPending,
    damage,
    findRefineryNear,
    flashRefinery,
    optionsFor,
    allOwned,
    all: () => S().buildings.slice(),
    checkWinLose,
  };
})();
