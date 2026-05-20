// ── SPICE WARS · ECONOMY ────────────────────────────────────────────────────
// Per-side credits + power tracking. Power is a supply: producers contribute
// positive, consumers contribute negative; when net is < 0 the side's build
// speed drops to LOW_POWER_BUILD_SCALE.
//
// Public surface (called by buildings.js + game.js):
//   Economy.recalcPower(owner)           → recompute power totals from buildings
//   Economy.powerOf(owner)               → { produced, used, ok }
//   Economy.canAfford(owner, cost)       → bool
//   Economy.spend(owner, amount)         → bool (false if broke)
//   Economy.credit(owner, amount)        → clamp to storage, returns amount kept
//   Economy.recalcStorage(owner)         → recompute storage cap from buildings
//   Economy.snapshot(owner)              → {credits, storage, power...} for HUD

(function(){
  function getSide(owner){
    return window.DuneState.get().players[owner];
  }

  function allOwned(owner){
    const buildings = window.DuneState.get().buildings;
    return buildings.filter(b => b.owner === owner && b.state === 'built');
  }

  function recalcPower(owner){
    const side = getSide(owner);
    let produced = 0, used = 0;
    for(const b of allOwned(owner)){
      const cfg = window.DuneConfig.BUILDINGS[b.type];
      if(!cfg) continue;
      if(cfg.power > 0) produced += cfg.power;
      else if(cfg.power < 0) used += -cfg.power;
    }
    side.produced = produced;
    side.used = used;
    return { produced, used, ok: produced >= used };
  }

  function powerOf(owner){
    const side = getSide(owner);
    return { produced: side.produced, used: side.used, ok: side.produced >= side.used };
  }

  function recalcStorage(owner){
    const side = getSide(owner);
    let storage = window.DuneConfig.BASE_STORAGE;
    for(const b of allOwned(owner)){
      const cfg = window.DuneConfig.BUILDINGS[b.type];
      if(cfg && cfg.storageBonus) storage += cfg.storageBonus;
    }
    side.storage = storage;
    // Clamp existing credits to new storage (silos destroyed → spice lost).
    if(side.credits > storage) side.credits = storage;
    return storage;
  }

  function canAfford(owner, amount){
    return getSide(owner).credits >= amount;
  }

  function spend(owner, amount){
    const side = getSide(owner);
    if(side.credits < amount) return false;
    side.credits -= amount;
    return true;
  }

  function credit(owner, amount){
    const side = getSide(owner);
    const cap = side.storage;
    const room = Math.max(0, cap - side.credits);
    const kept = Math.min(room, amount);
    side.credits += kept;
    return kept;
  }

  function snapshot(owner){
    const side = getSide(owner);
    return {
      credits: side.credits,
      storage: side.storage,
      produced: side.produced,
      used: side.used,
      ok: side.produced >= side.used,
    };
  }

  window.DuneEconomy = {
    recalcPower,
    powerOf,
    recalcStorage,
    canAfford,
    spend,
    credit,
    snapshot,
  };
})();
