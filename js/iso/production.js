// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — PRODUCTION
// ════════════════════════════════════════════════════
//
// Production-capable buildings have a ProductionQueue attached to
// their `components.queue`. Each queue item is:
//   { unitTypeId, totalMs, elapsedMs, refundCost }
//
// Flow:
//   IsoAPI.production.train(building, 'WRAITH')
//     → checks BUILDING_TYPES[...].produces contains unitTypeId
//     → checks resources.canAfford
//     → spends resources
//     → enqueues a ProductionQueue item
//   ProductionSystem.update(dt, world)
//     → for each building with a non-empty queue, advance the head
//       item by dt. On completion: spawn the unit at the building's
//       rally point and remove the item.
//
// Items can be cancelled (last-in-first-out) — refunds the cost.

(function(){

  function ProductionQueue(){
    this.items = [];   // [{ unitTypeId, totalMs, elapsedMs, refundCost }]
  }
  ProductionQueue.prototype.size    = function(){ return this.items.length; };
  ProductionQueue.prototype.peek    = function(){ return this.items[0] || null; };
  ProductionQueue.prototype.enqueue = function(item){ this.items.push(item); };
  ProductionQueue.prototype.pop     = function(){ return this.items.shift(); };

  function _ensureQueue(building){
    if (!building.components.queue) building.components.queue = new ProductionQueue();
    return building.components.queue;
  }

  function canTrain(building, unitTypeId){
    if (!building || !building.components) return false;
    const c = building.components;
    if (c.kind !== 'building') return false;
    if (c.hp <= 0) return false;
    if (!c.produces || c.produces.indexOf(unitTypeId) === -1) return false;
    const unit = IsoAPI.UNIT_TYPES[unitTypeId];
    if (!unit) return false;
    return IsoAPI.resources.canAfford(c.owner, unit.cost);
  }

  function train(building, unitTypeId){
    if (!building || !building.components) return false;
    const c = building.components;
    if (c.kind !== 'building') return false;
    if (c.hp <= 0) return false;
    if (!c.produces || c.produces.indexOf(unitTypeId) === -1){
      console.warn('[iso/production] building', c.buildingTypeId, 'cannot train', unitTypeId);
      return false;
    }
    const unit = IsoAPI.UNIT_TYPES[unitTypeId];
    if (!unit) return false;
    if (!IsoAPI.resources.spend(c.owner, unit.cost)) return false;

    const q = _ensureQueue(building);
    q.enqueue({
      unitTypeId,
      totalMs:    unit.buildTime,
      elapsedMs:  0,
      refundCost: Object.assign({}, unit.cost),
    });
    return true;
  }

  function cancelLast(building){
    if (!building || !building.components) return false;
    const q = building.components.queue;
    if (!q || q.items.length === 0) return false;
    const item = q.items.pop();
    // Refund. If the head item was already partly built, we still
    // refund the full cost — generous for the player, matches StarCraft.
    IsoAPI.resources.add(building.components.owner, item.refundCost);
    return true;
  }

  // Per-frame: advance the active build at each production building.
  class ProductionSystem {
    update(dt, world){
      const buildings = IsoAPI.buildings.all(world);
      for (const b of buildings){
        const c = b.components;
        if (c.hp <= 0){
          // Drop the queue; refund nothing — building was destroyed.
          c.queue = null;
          continue;
        }
        const q = c.queue;
        if (!q || q.items.length === 0) continue;
        const head = q.items[0];
        head.elapsedMs += dt;
        if (head.elapsedMs >= head.totalMs){
          q.items.shift();
          _spawnUnit(world, b, head.unitTypeId);
        }
      }
    }
  }

  function _spawnUnit(world, building, unitTypeId){
    const c = building.components;
    let spawnTile = IsoAPI.buildings.findAdjacentPassableTile(world, building);
    let wx, wy;
    if (spawnTile){
      const p = tileToWorld(spawnTile.col, spawnTile.row);
      wx = p.x; wy = p.y;
    } else {
      // Fallback: just at the building center (visual overlap, but
      // avoids losing the unit entirely).
      wx = building.x; wy = building.y;
    }
    const unit = IsoAPI.units.create(world, {
      typeId: unitTypeId,
      owner:  c.owner,
      x: wx, y: wy,
    });

    // If the building has a rally point, send the new unit there.
    if (unit && c.rallyPoint && IsoAPI.movement){
      IsoAPI.movement.moveTo(unit, c.rallyPoint.x, c.rallyPoint.y);
    }
    return unit;
  }

  // ── Publish ──────────────────────────────────────────
  window.IsoAPI = window.IsoAPI || {};
  IsoAPI.production = {
    canTrain,
    train,
    cancelLast,
    ProductionQueue,
  };
  window.IsoProductionSystem = ProductionSystem;
})();
