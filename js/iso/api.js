// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — CROSS-HOGLET API CONTRACT
// ════════════════════════════════════════════════════
//
// This file is owned by hoglet #4 (production/combat/HUD) but contains
// the shared contract that Liam (units/selection/pathfinding) and
// George (resources/buildings) will plug their real implementations
// into. The defaults here are functional stubs so the game is playable
// for acceptance review before the others land.
//
// Contract surface lives on `window.IsoAPI`:
//
//   IsoAPI.UNIT_TYPES        — stat tables keyed by id
//   IsoAPI.BUILDING_TYPES    — stat tables keyed by id
//   IsoAPI.FACTIONS          — { player, enemy } with color/name
//
//   IsoAPI.resources         — George's territory.
//     .init(owner, gold, oil)
//     .get(owner) → {gold, oil}
//     .canAfford(owner, cost) → bool
//     .spend(owner, cost) → bool   // returns true if successful
//     .add(owner, gain)
//
//   IsoAPI.units             — Liam's territory.
//     .create(world, {typeId, owner, x, y}) → Entity
//     .all(world) → Entity[]
//     .isAlive(ent) → bool
//
//   IsoAPI.buildings         — George's territory.
//     .create(world, {typeId, owner, col, row}) → Entity
//     .all(world) → Entity[]
//     .findAdjacentPassableTile(world, building) → {col, row} | null
//
//   IsoAPI.selection         — Liam's territory.
//     .get() → Entity[]
//     .set(entities)
//     .add(entities)
//     .clear()
//     .onChange(cb) / .offChange(cb)
//     .pickAt(world, sx, sy, cam) → Entity | null
//
//   IsoAPI.movement          — Liam's territory.
//     .moveTo(ent, x, y)
//     .stop(ent)
//
//   IsoAPI.combat            — Mine (this hoglet).
//     .attack(attacker, target)         // sets attackTarget
//     .holdPosition(ent)
//     .damage(target, amount, source)
//     .isDead(ent) → bool
//
//   IsoAPI.production        — Mine (this hoglet).
//     .canTrain(building, unitTypeId) → bool
//     .train(building, unitTypeId) → bool
//     .cancelLast(building)
//
// Owner ids are strings: 'player' and 'enemy' for now. AI hoglet may
// extend with multiple enemy slots later.

(function(){
  // ── Factions (player vs enemy color treatment) ─────
  // Pulled from docs/rts-2d-theme.md §2 faction palette.
  const FACTIONS = {
    player: {
      id:     'player',
      name:   'PRISM ARMADA',
      color:  '#00ddff',   // primary
      accent: '#aaffff',
      worker: '#88ccff',
    },
    enemy: {
      id:     'enemy',
      name:   'SHADOW ARMADA',
      color:  '#9922ff',
      accent: '#dd88ff',
      worker: '#8855cc',
    },
  };

  // ── Unit stat tables ───────────────────────────────
  // Theme-consistent names from the Citadel of Zharoth universe.
  // See docs/rts-2d-theme.md §1.
  const UNIT_TYPES = {
    DRONE: {
      id:       'DRONE',
      name:     'DRONE',
      role:     'worker',
      cost:     { gold: 50,  oil: 0  },
      buildTime: 4000,        // ms
      hp:       40,
      dmg:      4,
      range:    20,           // attack range in world px
      cooldown: 1200,         // ms between hits
      speed:    70,           // world px / sec
      vision:   8,            // tiles
      radius:   7,            // visual half-size in world px
      supply:   1,
      desc:     'Light worker. Gathers and builds.',
    },
    WRAITH: {
      id:       'WRAITH',
      name:     'WRAITH',
      role:     'combat',
      cost:     { gold: 75,  oil: 0  },
      buildTime: 7000,
      hp:       60,
      dmg:      9,
      range:    32,
      cooldown: 900,
      speed:    95,
      vision:   9,
      radius:   8,
      supply:   1,
      desc:     'Fast strike infantry.',
    },
    TITAN: {
      id:       'TITAN',
      name:     'TITAN',
      role:     'combat',
      cost:     { gold: 150, oil: 50 },
      buildTime: 12000,
      hp:       180,
      dmg:      22,
      range:    36,
      cooldown: 1500,
      speed:    55,
      vision:   10,
      radius:   12,
      supply:   3,
      desc:     'Heavy assault platform.',
    },
  };

  // ── Building stat tables ───────────────────────────
  const BUILDING_TYPES = {
    CITADEL: {
      id:       'CITADEL',
      name:     'CITADEL',
      cost:     { gold: 400, oil: 0 },
      buildTime: 15000,
      hp:       1000,
      tileFootprint: { w: 3, h: 3 },
      radius:   34,             // half-size in world px (visual + click)
      produces: ['DRONE'],
      desc:     'Command hub. Trains Drones.',
    },
    CRUCIBLE: {
      id:       'CRUCIBLE',
      name:     'CRUCIBLE',
      cost:     { gold: 200, oil: 0 },
      buildTime: 12000,
      hp:       600,
      tileFootprint: { w: 2, h: 2 },
      radius:   26,
      produces: ['WRAITH', 'TITAN'],
      desc:     'Combat foundry. Trains Wraiths and Titans.',
    },
  };

  // ── Resources (George stub) ────────────────────────
  // Tiny owner→{gold,oil} bank. Will be replaced by George's full
  // resource implementation; the surface below is the contract.
  function makeResourceBank(){
    const banks = Object.create(null);
    return {
      init(owner, gold = 0, oil = 0){
        banks[owner] = { gold, oil };
      },
      get(owner){
        return banks[owner] || (banks[owner] = { gold: 0, oil: 0 });
      },
      canAfford(owner, cost){
        const b = banks[owner] || { gold: 0, oil: 0 };
        return b.gold >= (cost.gold || 0) && b.oil >= (cost.oil || 0);
      },
      spend(owner, cost){
        if (!this.canAfford(owner, cost)) return false;
        const b = banks[owner];
        b.gold -= (cost.gold || 0);
        b.oil  -= (cost.oil  || 0);
        return true;
      },
      add(owner, gain){
        const b = banks[owner] || (banks[owner] = { gold: 0, oil: 0 });
        b.gold += (gain.gold || 0);
        b.oil  += (gain.oil  || 0);
      },
    };
  }

  // ── Wire into namespace ────────────────────────────
  window.IsoAPI = window.IsoAPI || {};
  window.IsoAPI.FACTIONS       = FACTIONS;
  window.IsoAPI.UNIT_TYPES     = UNIT_TYPES;
  window.IsoAPI.BUILDING_TYPES = BUILDING_TYPES;
  window.IsoAPI.resources      = makeResourceBank();

  // Slots that downstream files attach to. Defined as null here so a
  // missing/late impl produces an obvious console warning instead of
  // a silent undefined dereference.
  window.IsoAPI.units      = window.IsoAPI.units      || null;
  window.IsoAPI.buildings  = window.IsoAPI.buildings  || null;
  window.IsoAPI.selection  = window.IsoAPI.selection  || null;
  window.IsoAPI.movement   = window.IsoAPI.movement   || null;
  window.IsoAPI.combat     = window.IsoAPI.combat     || null;
  window.IsoAPI.production = window.IsoAPI.production || null;
})();
