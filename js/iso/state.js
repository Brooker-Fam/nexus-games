// ════════════════════════════════════════════════════
//  CITADEL OPS — PER-SIDE STATE
// ════════════════════════════════════════════════════
//
// Two sides per match: 'player' (human) and 'ai'. Each side owns:
//   factionId        — 'shadow' | 'prism' | 'roboto'
//   gold             — primary resource
//   supplyUsed       — sum of unit supply cost
//   supplyMax        — cap (HQ contributes a chunk, soldiers consume 1 each)
//   homeCol/homeRow  — spawn tile for HQ and where workers return resources
//   color/accent     — pulled from ISO_FACTIONS for rendering
//
// State is initialized by spawn.js at match start and torn down between
// matches. Nothing else owns global game state — even the AI reads/writes
// through World + Sides.

const ISO_STARTING_GOLD       = 50;
const ISO_BASE_SUPPLY         = 10;
const ISO_HQ_SUPPLY_BONUS     = 10;

class Side {
  constructor(opts){
    this.id          = opts.id;            // 'player' | 'ai'
    this.factionId   = opts.factionId;     // 'shadow' | 'prism' | 'roboto'
    this.gold        = opts.gold        != null ? opts.gold        : ISO_STARTING_GOLD;
    this.supplyUsed  = 0;
    this.supplyMax   = ISO_BASE_SUPPLY;
    this.homeCol     = opts.homeCol;
    this.homeRow     = opts.homeRow;
    this.faction     = ISO_FACTIONS[this.factionId];
    this.eliminated  = false;
  }

  canAfford(cost){ return this.gold >= cost; }
  spend(cost){
    if (this.gold < cost) return false;
    this.gold -= cost;
    return true;
  }
  earn(amount){ this.gold += amount; }
  hasSupplyFor(cost){ return this.supplyUsed + cost <= this.supplyMax; }
}

window.Side                = Side;
window.ISO_STARTING_GOLD   = ISO_STARTING_GOLD;
window.ISO_BASE_SUPPLY     = ISO_BASE_SUPPLY;
window.ISO_HQ_SUPPLY_BONUS = ISO_HQ_SUPPLY_BONUS;
