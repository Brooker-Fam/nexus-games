// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — ECONOMY + INPUT + WIRING
// ════════════════════════════════════════════════════
//
// This module is the glue between Phillip's foundation (world / camera /
// render) and the resource/building/worker modules. It owns:
//
//   - ISO_STATE: the shared player-side game state object that hoglet
//     #4 (production/combat) and hoglet #5 (AI) read and write.
//   - isoSetupWorld(world): runs once per tab activation. Spawns the
//     starting NEXUS + worker squad, scatters resource nodes, and
//     pushes WorkerSystem onto world.systems.
//   - isoUpdateHud(): live HUD update for gold/oil counters.
//   - Minimal input handlers (left-click to select, right-click to
//     command). Hoglet #2 (Liam) owns the real selection/command
//     dispatcher; when his code lands these handlers should be replaced.
//   - Build-menu UI (three buttons: NEXUS / FORGE / ARCANUM). Clicking
//     a button puts us in placement mode; the next left-click on a
//     valid tile commands the selected worker to build there.
//
// Lifecycle: we re-register the iso game so init() calls Phillip's
// isoStart() and then our isoSetupWorld(world); cleanup() reverses.
//
// Public API (window globals):
//   ISO_STATE
//   isoSetupWorld(world)
//   isoTeardown()
//   isoUpdateHud()
//   isoEnterBuildMode(buildingType)
//   isoExitBuildMode()

const ISO_STARTING_RESOURCES = { gold: 200, oil: 50 };
const ISO_STARTING_WORKERS   = 4;
const ISO_PLAYER_FACTION     = 'shadow';

const ISO_STATE = {
  resources:  Object.assign({}, ISO_STARTING_RESOURCES),
  buildings:  [],
  workers:    [],
  nodes:      [],
  selected:   null,
  buildMode:  null,   // null or 'nexus'|'forge'|'arcanum'
  hover:      { col: -1, row: -1 },
  // Faction of the player (for now). Hoglet #4/#5 can flip this for AI.
  faction:    ISO_PLAYER_FACTION,
};

// Track event listeners so we can detach on cleanup.
let _isoListeners = null;

// ── Setup ───────────────────────────────────────────

function isoSetupWorld(world){
  if (!world) return;

  // Reset state (the tab can be re-entered).
  ISO_STATE.resources = Object.assign({}, ISO_STARTING_RESOURCES);
  ISO_STATE.buildings.length = 0;
  ISO_STATE.workers.length   = 0;
  ISO_STATE.nodes.length     = 0;
  ISO_STATE.selected         = null;
  ISO_STATE.buildMode        = null;

  // Push the worker AI system.
  world.systems.push(WorkerSystem);

  // Place the starting NEXUS in the clear corner pocket (cols 1..3, rows 1..3).
  const hq = createBuilding(BUILDING.NEXUS, 1, 1, ISO_STATE.faction, { ready:true });
  world.add(hq);
  placeBuildingFootprint(world, hq);
  ISO_STATE.buildings.push(hq);

  // Spawn starting workers near the HQ, on tiles within the cleared
  // 5×5 corner pocket but outside the HQ's (1..3, 1..3) footprint.
  const workerSpots = [
    { col: 4, row: 1 },
    { col: 4, row: 2 },
    { col: 1, row: 4 },
    { col: 2, row: 4 },
  ];
  for (let i = 0; i < ISO_STARTING_WORKERS; i++){
    const spot = workerSpots[i % workerSpots.length];
    const wkr = createWorker(spot.col, spot.row, ISO_STATE.faction);
    world.add(wkr);
    ISO_STATE.workers.push(wkr);
  }

  // Scatter resource nodes. Two clusters of gold (the main economy)
  // and a smaller patch of oil further out.
  _spawnNodeCluster(world, 8,  3,  RESOURCE.GOLD, 5);
  _spawnNodeCluster(world, 10, 12, RESOURCE.GOLD, 5);
  _spawnNodeCluster(world, 17, 7,  RESOURCE.OIL,  3);
  _spawnNodeCluster(world, 4,  14, RESOURCE.OIL,  2);

  // Update HUD with starting values.
  isoUpdateHud();

  // Wire up input + build menu.
  _attachInput();
  _ensureBuildMenu();
}

function _spawnNodeCluster(world, col, row, resource, count){
  // Lay nodes in a small ring around (col, row), skipping non-passable
  // tiles and tiles already occupied.
  const offsets = [
    [0,0],[1,0],[-1,0],[0,1],[0,-1],
    [1,1],[-1,1],[1,-1],[-1,-1],
    [2,0],[-2,0],[0,2],[0,-2],
  ];
  let placed = 0;
  for (const [dc, dr] of offsets){
    if (placed >= count) break;
    const c = col + dc;
    const r = row + dr;
    if (!world.map.inBounds(c, r)) continue;
    if (!world.map.isPassable(c, r)) continue;
    if (isTileOccupied(world, c, r)) continue;
    const node = createResourceNode(c, r, resource);
    world.add(node);
    ISO_STATE.nodes.push(node);
    // Mark the node's tile occupied so buildings/workers don't stack on it.
    placeBuildingFootprint(world, _shimSingleTile(node, c, r));
    placed++;
  }
}

// Buildings-only occupancy uses placeBuildingFootprint, which expects
// the entity to have components.building. For resource nodes we want a
// single-tile claim; this little shim wraps the node in a temporary
// building-like object just for the footprint marker. (We don't add
// this object to the world.)
function _shimSingleTile(node, col, row){
  return {
    id: node.id,
    components: { building: { col: col, row: row, size: 1 } },
  };
}

function isoTeardown(){
  _detachInput();
  _removeBuildMenu();
  // Keep ISO_STATE intact for dev-tool inspection; isoSetupWorld resets it.
}

// ── HUD ─────────────────────────────────────────────

function isoUpdateHud(){
  const goldEl   = document.getElementById('iso-gold');
  const oilEl    = document.getElementById('iso-oil');
  const supplyEl = document.getElementById('iso-supply');
  if (goldEl) goldEl.textContent = ISO_STATE.resources.gold | 0;
  if (oilEl)  oilEl.textContent  = ISO_STATE.resources.oil  | 0;
  if (supplyEl){
    const used = ISO_STATE.workers.length;
    const cap  = ISO_STATE.buildings.filter(b => isDepositBuilding(b)).length * 10;
    supplyEl.textContent = used + '/' + cap;
  }
}

// ── Build menu ──────────────────────────────────────

function _ensureBuildMenu(){
  const cmdGrid = document.querySelector('#tab-iso .iso-hud-cmd-grid');
  if (!cmdGrid) return;
  // Skip if already built (idempotent across tab re-entries).
  if (cmdGrid.dataset.isoBuildMenuReady === '1') return;

  cmdGrid.innerHTML = '';
  cmdGrid.dataset.isoBuildMenuReady = '1';

  const buttons = [
    { kind: BUILDING.NEXUS,   label: 'NEXUS',   key: 'B' },
    { kind: BUILDING.FORGE,   label: 'FORGE',   key: 'F' },
    { kind: BUILDING.ARCANUM, label: 'ARCANUM', key: 'A' },
    { kind: '__cancel',       label: 'CANCEL',  key: 'Esc' },
    { kind: '__stop',         label: 'STOP',    key: 'S' },
    { kind: '__rally',        label: 'GATHER',  key: 'G' },
  ];

  for (const btnCfg of buttons){
    const cfg  = BUILDING_CFG[btnCfg.kind];
    const slot = document.createElement('button');
    slot.type  = 'button';
    slot.className = 'iso-cmd-slot iso-cmd-btn';
    slot.dataset.kind = btnCfg.kind;
    let costText = '';
    if (cfg){
      const c = cfg.cost;
      costText = (c.gold ? c.gold + 'G ' : '') + (c.oil ? c.oil + 'O' : '');
    }
    slot.innerHTML =
      '<div class="iso-cmd-key">' + btnCfg.key + '</div>' +
      '<div class="iso-cmd-label">' + btnCfg.label + '</div>' +
      (costText ? '<div class="iso-cmd-cost">' + costText + '</div>' : '');
    slot.style.pointerEvents = 'auto';
    slot.addEventListener('click', () => _onBuildMenuClick(btnCfg.kind));
    cmdGrid.appendChild(slot);
  }
  // Make the HUD pointer-events-aware (it's set to none at the container).
  cmdGrid.style.pointerEvents = 'auto';
}

function _removeBuildMenu(){
  const cmdGrid = document.querySelector('#tab-iso .iso-hud-cmd-grid');
  if (!cmdGrid) return;
  // Restore placeholder slots so it doesn't look broken if the tab
  // re-loads via cleanup → init.
  cmdGrid.innerHTML = '';
  for (let i = 0; i < 9; i++){
    const s = document.createElement('div');
    s.className = 'iso-cmd-slot';
    cmdGrid.appendChild(s);
  }
  cmdGrid.dataset.isoBuildMenuReady = '';
}

function _onBuildMenuClick(kind){
  if (kind === '__cancel'){ isoExitBuildMode(); return; }
  if (kind === '__stop'){
    if (ISO_STATE.selected && isWorker(ISO_STATE.selected)){
      commandStop(ISO_STATE.selected);
    }
    return;
  }
  if (kind === '__rally'){
    // Find a nearby gold node and send the selected worker there.
    const sel = ISO_STATE.selected;
    if (sel && isWorker(sel)){
      const node = nearestResourceNode(ISO_GAME.world, sel.x, sel.y);
      if (node) commandHarvest(sel, node);
    }
    return;
  }
  // Enter build mode for that kind, but only if a worker is selected.
  if (!ISO_STATE.selected || !isWorker(ISO_STATE.selected)){
    _flashHint('Select a worker first');
    return;
  }
  const cfg = BUILDING_CFG[kind];
  if (!cfg) return;
  if (ISO_STATE.resources.gold < cfg.cost.gold || ISO_STATE.resources.oil < cfg.cost.oil){
    _flashHint('Not enough resources');
    return;
  }
  isoEnterBuildMode(kind);
}

function isoEnterBuildMode(buildingType){
  ISO_STATE.buildMode = buildingType;
  _setHintText('PLACE ' + (BUILDING_CFG[buildingType].label) + ' — LEFT-CLICK A TILE · ESC TO CANCEL');
  _updateBuildBtnStates();
}

function isoExitBuildMode(){
  ISO_STATE.buildMode = null;
  _setHintText('LEFT-CLICK WORKER · RIGHT-CLICK TO COMMAND · PAN WITH WASD / EDGES');
  _updateBuildBtnStates();
}

function _updateBuildBtnStates(){
  const cmd = document.querySelector('#tab-iso .iso-hud-cmd-grid');
  if (!cmd) return;
  cmd.querySelectorAll('.iso-cmd-btn').forEach(btn => {
    if (btn.dataset.kind === ISO_STATE.buildMode){
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

let _hintTimer = null;
function _flashHint(text){
  _setHintText(text);
  if (_hintTimer) clearTimeout(_hintTimer);
  _hintTimer = setTimeout(() => {
    _setHintText(ISO_STATE.buildMode
      ? 'PLACE ' + BUILDING_CFG[ISO_STATE.buildMode].label + ' — LEFT-CLICK A TILE · ESC TO CANCEL'
      : 'LEFT-CLICK WORKER · RIGHT-CLICK TO COMMAND · PAN WITH WASD / EDGES');
  }, 1600);
}
function _setHintText(text){
  const hint = document.querySelector('#tab-iso .iso-hint');
  if (!hint) return;
  hint.innerHTML = text;
}

// ── Input ───────────────────────────────────────────

function _attachInput(){
  if (_isoListeners) return;
  const canvas = ISO_GAME.canvas;
  if (!canvas) return;

  const getMouseScreen = (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
    return { sx, sy };
  };

  const onContextMenu = (e) => { e.preventDefault(); };

  const onMouseMove = (e) => {
    const { sx, sy } = getMouseScreen(e);
    const tile = screenToTile(sx, sy, ISO_GAME.camera);
    ISO_STATE.hover.col = tile.col;
    ISO_STATE.hover.row = tile.row;
  };

  const onMouseDown = (e) => {
    if (!ISO_GAME.world) return;
    const { sx, sy } = getMouseScreen(e);
    const world = ISO_GAME.world;
    const cam   = ISO_GAME.camera;
    const tile  = screenToTile(sx, sy, cam);

    if (e.button === 0){
      // LEFT click
      if (ISO_STATE.buildMode){
        _tryBuildAt(tile.col, tile.row);
        return;
      }
      // Select unit-or-building at click point.
      const picked = _pickEntityAt(world, sx, sy, cam);
      ISO_STATE.selected = picked;
      _refreshSelectionPanel();
      return;
    }
    if (e.button === 2){
      // RIGHT click — dispatch a command for the selected worker.
      e.preventDefault();
      const sel = ISO_STATE.selected;
      if (!sel || !isWorker(sel)) return;

      // Resource node under cursor?
      const node = _pickEntityAt(world, sx, sy, cam, (ent) => isResourceNode(ent));
      if (node){
        commandHarvest(sel, node);
        return;
      }
      // Building under cursor → if it's our deposit, dump and resume harvest.
      const bld = _pickEntityAt(world, sx, sy, cam, (ent) => isBuilding(ent));
      if (bld){
        if (isDepositBuilding(bld) && sel.components.worker.carrying){
          sel.components.worker.state = WORKER_STATE.TO_DEPOT;
        } else {
          commandMove(sel, tile.col, tile.row);
        }
        return;
      }
      // Empty terrain → move there.
      if (world.map.isPassable(tile.col, tile.row)){
        commandMove(sel, tile.col, tile.row);
      }
    }
  };

  const onKeyDown = (e) => {
    if (!_isoTabActive()) return;
    if (e.key === 'Escape')      isoExitBuildMode();
    else if (e.key === 'b' || e.key === 'B') _onBuildMenuClick(BUILDING.NEXUS);
    else if (e.key === 'f' || e.key === 'F') _onBuildMenuClick(BUILDING.FORGE);
    else if (e.key === 'a' || e.key === 'A') _onBuildMenuClick(BUILDING.ARCANUM);
    else if (e.key === 'g' || e.key === 'G') _onBuildMenuClick('__rally');
  };

  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('mousemove',   onMouseMove);
  canvas.addEventListener('mousedown',   onMouseDown);
  window.addEventListener('keydown',     onKeyDown);

  _isoListeners = { canvas, onContextMenu, onMouseMove, onMouseDown, onKeyDown };
  _setHintText('LEFT-CLICK WORKER · RIGHT-CLICK TO COMMAND · PAN WITH WASD / EDGES');
}

function _detachInput(){
  if (!_isoListeners) return;
  const { canvas, onContextMenu, onMouseMove, onMouseDown, onKeyDown } = _isoListeners;
  canvas.removeEventListener('contextmenu', onContextMenu);
  canvas.removeEventListener('mousemove',   onMouseMove);
  canvas.removeEventListener('mousedown',   onMouseDown);
  window.removeEventListener('keydown',     onKeyDown);
  _isoListeners = null;
}

function _isoTabActive(){
  const tab = document.getElementById('tab-iso');
  return !!(tab && tab.classList.contains('active'));
}

// Pick the topmost entity within a small screen radius.
function _pickEntityAt(world, sx, sy, cam, filter){
  const PICK_R2 = 18 * 18;
  let best = null;
  let bestDepth = -Infinity;
  for (const e of world.entities){
    if (filter && !filter(e)) continue;
    const s = worldToScreen(e.x, e.y, cam);
    const dx = sx - s.x;
    // For buildings, allow a larger pick radius (their visual sits above center).
    const radiusBoost = isBuilding(e) ? 30 : 0;
    const dy = sy - s.y + radiusBoost / 2;
    const d2 = dx*dx + dy*dy;
    const limit = isBuilding(e) ? 60 * 60 : (isResourceNode(e) ? 22 * 22 : PICK_R2);
    if (d2 > limit) continue;
    // Prefer the entity with the highest iso-depth (front-most).
    const t = worldToTile(e.x, e.y);
    const depth = t.col + t.row + (isBuilding(e) ? 0 : 0.5);
    if (depth > bestDepth){ best = e; bestDepth = depth; }
  }
  return best;
}

function _tryBuildAt(col, row){
  const sel = ISO_STATE.selected;
  if (!sel || !isWorker(sel)){
    _flashHint('Select a worker first');
    return;
  }
  const kind = ISO_STATE.buildMode;
  const cfg  = BUILDING_CFG[kind];
  if (!cfg) return;
  if (!canPlaceBuilding(ISO_GAME.world, kind, col, row)){
    _flashHint('Cannot place there');
    return;
  }
  if (ISO_STATE.resources.gold < cfg.cost.gold || ISO_STATE.resources.oil < cfg.cost.oil){
    _flashHint('Not enough resources');
    return;
  }
  // Deduct cost up-front.
  ISO_STATE.resources.gold -= cfg.cost.gold;
  ISO_STATE.resources.oil  -= cfg.cost.oil;
  isoUpdateHud();
  commandBuild(sel, kind, col, row);
  isoExitBuildMode();
}

function _refreshSelectionPanel(){
  const info = document.querySelector('#tab-iso .iso-hud-info');
  if (!info) return;
  const sel = ISO_STATE.selected;
  if (!sel){ info.textContent = 'No unit selected'; return; }
  if (isWorker(sel)){
    const w = sel.components.worker;
    let line = 'DRONE · ' + (w.faction.toUpperCase()) + ' · ' + w.state.toUpperCase();
    if (w.carrying) line += ' · CARRYING ' + w.carrying.amount + ' ' + w.carrying.resource.toUpperCase();
    info.textContent = line;
  } else if (isBuilding(sel)){
    const b = sel.components.building;
    const cfg = BUILDING_CFG[b.kind];
    info.textContent = cfg.label + ' · ' + Math.round(b.hp) + '/' + cfg.maxHp + ' HP' +
                       (b.ready ? '' : ' · BUILDING ' + Math.floor(b.progress * 100) + '%');
  } else if (isResourceNode(sel)){
    const rn = sel.components.resourceNode;
    info.textContent = (RESOURCE_STYLE[rn.resource].label) + ' NODE · ' + rn.amount + '/' + rn.maxAmount;
  } else {
    info.textContent = sel.type.toUpperCase();
  }
}

// ── Build placement preview render system ──────────
//
// A tiny system that runs AFTER WorkerSystem to:
//   - refresh the selection panel each frame (so worker state stays live)
//   - draw a placement preview when in buildMode

const HudRefreshSystem = {
  update(_dt, _world){ _refreshSelectionPanel(); },
};

// We hook into the render pipeline by wrapping isoRender so we can
// overlay the build-placement preview after the world is drawn.
(function wrapIsoRender(){
  const baseRender = window.isoRender;
  window.isoRender = function(ctx, world, cam){
    baseRender(ctx, world, cam);

    if (ISO_STATE.buildMode){
      _drawBuildPlacementPreview(ctx, world, cam);
    }
  };
})();

function _drawBuildPlacementPreview(ctx, world, cam){
  const kind = ISO_STATE.buildMode;
  const cfg  = BUILDING_CFG[kind];
  if (!cfg) return;
  const { col, row } = ISO_STATE.hover;
  if (col < 0 || row < 0) return;

  const ok = canPlaceBuilding(world, kind, col, row);
  const tint = ok ? 'rgba(0,255,136,0.35)' : 'rgba(255,0,136,0.35)';
  const edge = ok ? '#00ff88'              : '#ff0088';

  // Draw each footprint tile as a translucent diamond.
  for (let dr = 0; dr < cfg.size; dr++){
    for (let dc = 0; dc < cfg.size; dc++){
      const c = col + dc;
      const r = row + dr;
      const w = tileToWorld(c, r);
      const s = worldToScreen(w.x, w.y, cam);
      _isoDiamondPath(ctx, s.x, s.y, ISO_TILE_W/2, ISO_TILE_H/2);
      ctx.fillStyle   = tint;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }
}

// ── Wire into Phillip's lifecycle by re-registering 'iso'. ──
//
// We rely on game.js having already called registerGame('iso', ...);
// our load order in index.html puts economy.js after game.js so this
// overwrites it with a wrapped version.

(function wrapIsoLifecycle(){
  if (typeof registerGame !== 'function' || typeof isoStart !== 'function'){
    console.warn('[iso/economy] foundation lifecycle not present; skipping wrap');
    return;
  }
  registerGame('iso', {
    init(){
      isoStart();
      // After isoStart runs, ISO_GAME.world is populated.
      isoSetupWorld(ISO_GAME.world);
      // Push the HUD refresh system at the end of the system list.
      if (ISO_GAME.world && ISO_GAME.world.systems.indexOf(HudRefreshSystem) === -1){
        ISO_GAME.world.systems.push(HudRefreshSystem);
      }
    },
    cleanup(){
      isoTeardown();
      isoStop();
    },
  });
})();

window.ISO_STATE          = ISO_STATE;
window.isoSetupWorld      = isoSetupWorld;
window.isoTeardown        = isoTeardown;
window.isoUpdateHud       = isoUpdateHud;
window.isoEnterBuildMode  = isoEnterBuildMode;
window.isoExitBuildMode   = isoExitBuildMode;
