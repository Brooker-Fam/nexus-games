// ════════════════════════════════════════════════════
//  CITADEL OPS — HUD BINDINGS
// ════════════════════════════════════════════════════
//
// Tiny system that pushes per-frame numbers into the existing HUD
// elements in index.html (#iso-minerals, #iso-supply, etc) and updates
// the selection panel based on ISO_INPUT.selected.

const ISO_HUD = {
  player: null,
  ai:     null,
  _ms:    0,
};

function isoHudInit(player, ai){
  ISO_HUD.player = player;
  ISO_HUD.ai     = ai;
}

const isoHudSystem = {
  update(dt /*, world */){
    ISO_HUD._ms += dt;
    if (ISO_HUD._ms < 120) return;
    ISO_HUD._ms = 0;
    const p = ISO_HUD.player;
    if (!p) return;

    const minerals = document.getElementById('iso-minerals');
    if (minerals) minerals.textContent = String(p.gold | 0);

    // Foundation HUD has a GAS slot reserved for a future resource (e.g.
    // Roboto OIL). Leave it blank until that lands.
    const gas = document.getElementById('iso-gas');
    if (gas && gas.textContent !== '0') gas.textContent = '0';

    const supply = document.getElementById('iso-supply');
    if (supply) supply.textContent = p.supplyUsed + '/' + p.supplyMax;

    _refreshSelectionPanel();
  },
};

function _refreshSelectionPanel(){
  const info = document.querySelector('#tab-iso .iso-hud-info');
  if (!info) return;
  const sel = (window.ISO_INPUT && ISO_INPUT.selected) || [];
  if (!sel.length){
    info.textContent = 'No unit selected';
    return;
  }
  if (sel.length === 1){
    const e = sel[0];
    const name = _entLabel(e);
    if (e.kind === 'building'){
      const built = e.components.building.construction;
      const q = e.components.building.trainQueue.length;
      const status = built < 1
        ? Math.round(built * 100) + '% BUILT'
        : (q > 0 ? 'Training (' + q + ')' : 'Idle');
      info.textContent = name + ' · HP ' + Math.max(0, e.hp | 0) + '/' + e.maxHp + ' · ' + status;
    } else if (e.kind === 'unit'){
      const ord = e.components.order ? e.components.order.kind : 'idle';
      info.textContent = name + ' · HP ' + Math.max(0, e.hp | 0) + '/' + e.maxHp + ' · ' + ord.toUpperCase();
    } else if (e.kind === 'resource'){
      info.textContent = 'GOLD VEIN · ' + Math.max(0, e.remaining | 0) + ' left';
    }
  } else {
    info.textContent = sel.length + ' units selected';
  }
}

function _entLabel(e){
  const f = e.side && e.side.faction;
  if (e.kind === 'building'){
    if (e.type === ISO_TYPE.HQ)       return f ? f.hqLabel       : 'CITADEL';
    if (e.type === ISO_TYPE.BARRACKS) return f ? f.barracksLabel : 'BARRACKS';
    if (e.type === ISO_TYPE.TECH)     return f ? f.techLabel     : 'SHRINE';
  }
  if (e.kind === 'unit'){
    if (e.type === ISO_TYPE.WORKER)  return f ? f.workerLabel  : 'WORKER';
    if (e.type === ISO_TYPE.SOLDIER) return f ? f.warriorLabel : 'SOLDIER';
  }
  return e.type.toUpperCase();
}

window.ISO_HUD         = ISO_HUD;
window.isoHudInit      = isoHudInit;
window.isoHudSystem    = isoHudSystem;
