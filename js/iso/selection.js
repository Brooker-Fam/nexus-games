// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — SELECTION
// ════════════════════════════════════════════════════
//
// Selection state for the local player. Other hoglets (AI, HUD, command
// panel) interact via the public API instead of poking ISO_SELECTION
// directly — keeps the HUD update centralised.
//
// Public API:
//   getSelectedUnits()        → Entity[]
//   selectUnits(unitList)
//   addToSelection(unit)
//   clearSelection()
//   clearUnitFromSelection(unit)
//   isSelected(unit)          → boolean
//   isFriendly(unit)          → boolean (vs ISO_SELECTION.playerOwner)
//   setLocalPlayer(owner)     → set which faction "friendly" means

const ISO_SELECTION = {
  units:       new Set(),

  // Drag-select state — input.js writes, render reads.
  dragging:    false,
  dragStart:   null,   // { sx, sy }
  dragEnd:     null,

  // Faction id treated as "the local player" — friendly/enemy hit-tests
  // resolve against this. AI hoglet can override via setLocalPlayer().
  playerOwner: 'shadow',
};

function selectUnits(units){
  ISO_SELECTION.units.clear();
  if (units){
    for (let i = 0; i < units.length; i++){
      if (units[i] && units[i].state !== 'dead') ISO_SELECTION.units.add(units[i]);
    }
  }
  _renderSelectionHud();
}

function addToSelection(unit){
  if (!unit || unit.state === 'dead') return;
  ISO_SELECTION.units.add(unit);
  _renderSelectionHud();
}

function clearSelection(){
  if (ISO_SELECTION.units.size === 0) return;
  ISO_SELECTION.units.clear();
  _renderSelectionHud();
}

function clearUnitFromSelection(unit){
  if (!unit) return;
  if (ISO_SELECTION.units.delete(unit)) _renderSelectionHud();
}

function getSelectedUnits(){
  const out = [];
  for (const u of ISO_SELECTION.units){
    if (u && u.state !== 'dead') out.push(u);
  }
  return out;
}

function isSelected(unit){
  return ISO_SELECTION.units.has(unit);
}

function isFriendly(unit){
  return !!(unit && unit.owner === ISO_SELECTION.playerOwner);
}

function setLocalPlayer(owner){
  ISO_SELECTION.playerOwner = owner;
  _renderSelectionHud();
}

// Update the placeholder HUD selection panel. Production hoglet will
// replace this with a real portrait + multi-unit grid; this keeps the
// existing DOM structure useful in the meantime.
function _renderSelectionHud(){
  const info = document.querySelector('#tab-iso .iso-hud-info');
  if (!info) return;
  const units = getSelectedUnits();
  if (units.length === 0){
    info.textContent = 'No unit selected';
    return;
  }
  if (units.length === 1){
    const u = units[0];
    const def = UNIT_TYPES[u.unitType] || { name: u.unitType };
    const fac = ISO_FACTIONS[u.owner] || { name: u.owner };
    info.textContent = `${def.name} · ${fac.name} · HP ${Math.ceil(u.hp)}/${u.maxHp}`;
    return;
  }
  info.textContent = `${units.length} UNITS SELECTED`;
}

window.ISO_SELECTION          = ISO_SELECTION;
window.selectUnits            = selectUnits;
window.addToSelection         = addToSelection;
window.clearSelection         = clearSelection;
window.clearUnitFromSelection = clearUnitFromSelection;
window.getSelectedUnits       = getSelectedUnits;
window.isSelected             = isSelected;
window.isFriendly             = isFriendly;
window.setLocalPlayer         = setLocalPlayer;
