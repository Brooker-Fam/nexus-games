// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — UNITS
// ════════════════════════════════════════════════════
//
// Unit data model + spawn / despawn API. Units are foundation Entity
// instances with extra fields slapped directly on the entity (composition
// via .components is reserved for the render hook).
//
//   id, type:'unit', x, y          — from Entity
//   unitType                       — key into UNIT_TYPES
//   owner                          — faction id ('shadow' | 'prism' | 'roboto')
//   hp, maxHp, attack, attackRange — stats
//   attackCooldown                 — ms between auto-attacks
//   speed                          — world px / sec
//   visionRange                    — tiles (informational; fog hoglet uses this)
//   radius                         — visual + click hit-test radius in px
//   state                          — 'idle' | 'moving' | 'attacking' | 'dead'
//   facing                         — radians, derived from movement
//   path                           — [{x,y}, ...] world-space waypoints
//   pathIndex
//   moveTarget                     — {x,y} world goal (informational)
//   attackTarget                   — Entity target for attack
//   lastAttackMs, lastPathMs       — cooldown trackers (world.timeMs based)
//   attackFlashMs, hitFlashMs      — visual flash timers
//   attackLineMs, attackLineTo     — brief tracer to last attack target
//
// Public API (window.*):
//   spawnUnit(type, col, row, owner) → Entity | null
//   despawnUnit(unit)
//   getUnitAtScreen(sx, sy, cam)   → Entity | null
//   getFriendlyUnits(owner)        → Entity[]
//   ISO_FACTIONS, UNIT_TYPES, ISO_UNITS

// Faction palette — matches Deep Space Ops FACTION_CFG (see theme doc §2).
const ISO_FACTIONS = Object.freeze({
  shadow: { primary: '#9922ff', accent: '#dd88ff', worker: '#8855cc', warrior: '#cc88ff', name: 'SHADOW ARMADA' },
  prism:  { primary: '#00ddff', accent: '#aaffff', worker: '#88ccff', warrior: '#ffffff', name: 'PRISM ARMADA' },
  roboto: { primary: '#ff8800', accent: '#ffcc44', worker: '#aa6622', warrior: '#ff9933', name: 'ROBOTO ARMADA' },
});

// Placeholder roster. The production hoglet expands this. Stats are tuned
// so combat resolves in a handful of attacks — easier to validate the
// stub during smoke tests.
const UNIT_TYPES = Object.freeze({
  worker: {
    name: 'WORKER',
    maxHp: 40,
    attack: 4,
    attackRange: 1,
    attackCooldown: 1300,
    speed: 70,
    visionRange: 6,
    radius: 9,
  },
  warrior: {
    name: 'WARRIOR',
    maxHp: 100,
    attack: 14,
    attackRange: 1,
    attackCooldown: 900,
    speed: 95,
    visionRange: 8,
    radius: 11,
  },
});

const ISO_UNITS = {
  list:  [],         // active units, append-order
  byId:  new Map(),
};

function spawnUnit(type, col, row, owner){
  const def = UNIT_TYPES[type];
  if (!def){ console.warn('[iso] unknown unit type:', type); return null; }
  if (!ISO_GAME.world){ console.warn('[iso] spawnUnit before isoStart'); return null; }

  const map = ISO_GAME.world.map;
  if (!map.inBounds(col, row)){
    console.warn('[iso] spawnUnit out of bounds', col, row); return null;
  }

  // Snap to nearest passable tile if requested tile is blocked.
  let spawnCol = col, spawnRow = row;
  if (!map.isPassable(col, row)){
    const snap = nearestPassableTile(map, col, row, 6);
    if (!snap){ console.warn('[iso] no passable spawn near', col, row); return null; }
    spawnCol = snap.col; spawnRow = snap.row;
  }

  const w = tileToWorld(spawnCol, spawnRow);
  const ent = new Entity({ type: 'unit', x: w.x, y: w.y });
  ent.unitType        = type;
  ent.owner           = owner || 'shadow';
  ent.hp              = def.maxHp;
  ent.maxHp           = def.maxHp;
  ent.attack          = def.attack;
  ent.attackRange     = def.attackRange;
  ent.attackCooldown  = def.attackCooldown;
  ent.speed           = def.speed;
  ent.visionRange     = def.visionRange;
  ent.radius          = def.radius;
  ent.state           = 'idle';
  ent.facing          = 0;
  ent.path            = null;
  ent.pathIndex       = 0;
  ent.moveTarget      = null;
  ent.attackTarget    = null;
  ent.lastAttackMs    = -Infinity;
  ent.lastPathMs      = -Infinity;
  ent.attackFlashMs   = 0;
  ent.hitFlashMs      = 0;
  ent.attackLineMs    = 0;
  ent.attackLineTo    = null;
  ent.isUnit          = true;
  ent.components.render = drawUnit;

  ISO_GAME.world.add(ent);
  ISO_UNITS.list.push(ent);
  ISO_UNITS.byId.set(ent.id, ent);
  return ent;
}

function despawnUnit(unit){
  if (!unit) return;
  unit.state = 'dead';
  if (ISO_GAME.world) ISO_GAME.world.remove(unit);
  const i = ISO_UNITS.list.indexOf(unit);
  if (i >= 0) ISO_UNITS.list.splice(i, 1);
  ISO_UNITS.byId.delete(unit.id);
  // Drop from any current selection.
  if (typeof clearUnitFromSelection === 'function') clearUnitFromSelection(unit);
}

// Hit-test against unit screen-space center. Returns the top-most (highest
// iso depth) unit under the cursor, or null.
function getUnitAtScreen(sx, sy, cam){
  let best = null;
  let bestDepth = -Infinity;
  for (let i = 0; i < ISO_UNITS.list.length; i++){
    const u = ISO_UNITS.list[i];
    if (u.state === 'dead') continue;
    const s = worldToScreen(u.x, u.y, cam);
    const dx = sx - s.x;
    const dy = sy - s.y;
    const rPad = u.radius + 3;
    if (dx * dx + dy * dy <= rPad * rPad){
      const t = worldToTile(u.x, u.y);
      const depth = t.col + t.row;
      if (depth > bestDepth){
        best = u;
        bestDepth = depth;
      }
    }
  }
  return best;
}

function getFriendlyUnits(owner){
  return ISO_UNITS.list.filter(u => u.owner === owner && u.state !== 'dead');
}

function resetUnitRegistry(){
  ISO_UNITS.list.length = 0;
  ISO_UNITS.byId.clear();
}

window.ISO_FACTIONS       = ISO_FACTIONS;
window.UNIT_TYPES         = UNIT_TYPES;
window.ISO_UNITS          = ISO_UNITS;
window.spawnUnit          = spawnUnit;
window.despawnUnit        = despawnUnit;
window.getUnitAtScreen    = getUnitAtScreen;
window.getFriendlyUnits   = getFriendlyUnits;
window.resetUnitRegistry  = resetUnitRegistry;
