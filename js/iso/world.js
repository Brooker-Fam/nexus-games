// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — ENTITY & WORLD
// ════════════════════════════════════════════════════
//
// Extension points for follow-up hoglets:
//
//   Entity   — minimal base. Wrap or extend; prefer composition over
//              deep inheritance. The .components bag is a free-form
//              place to attach hp, movement, owner, weapon, etc.
//
//   World    — the single game-state container. Holds the map and all
//              entities. Has a `systems` array; push your update logic
//              there as `{ update(dt, world) }` and it'll run every
//              frame in array order.

let _entityIdCounter = 1;

class Entity {
  constructor(opts){
    opts = opts || {};
    this.id   = opts.id   != null ? opts.id   : _entityIdCounter++;
    this.type = opts.type || 'entity';
    this.x    = opts.x    || 0;  // world-space px (use coords.js to convert)
    this.y    = opts.y    || 0;
    this.components = Object.assign({}, opts.components);
  }
}

class World {
  constructor(map){
    this.map      = map;
    this.entities = [];
    this.systems  = [];     // push { update(dt, world) } objects
    this.tick     = 0;      // integer counter, +1 per update()
    this.timeMs   = 0;      // accumulated elapsed ms (for animations)
  }

  add(entity){
    this.entities.push(entity);
    return entity;
  }
  remove(entity){
    const i = this.entities.indexOf(entity);
    if (i !== -1) this.entities.splice(i, 1);
  }
  find(id){
    return this.entities.find(e => e.id === id);
  }

  // Per-tick simulation. The render loop calls this with a wall-clock
  // delta in ms. Systems are responsible for their own internal
  // accumulators if they need fixed-step updates.
  update(dt){
    this.tick++;
    this.timeMs += dt;
    for (let i = 0; i < this.systems.length; i++){
      const sys = this.systems[i];
      if (sys && typeof sys.update === 'function'){
        sys.update(dt, this);
      }
    }
  }
}

window.Entity = Entity;
window.World  = World;
