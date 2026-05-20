// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — INTEGRATION / BOOT
// ════════════════════════════════════════════════════
//
// Wires production, combat, HUD, and basic input into the foundation
// game loop. Strategy:
//
//   1. After the foundation registers its 'iso' game, we re-register
//      with an init() that calls the foundation's isoStart() and then
//      mounts our systems + entities + input.
//   2. Cleanup detaches our canvas listeners and then calls isoStop().
//
// Why re-register instead of touching game.js directly: keeps the
// foundation file untouched and makes diffs reviewable.

(function(){

  let _canvasHandlers = null;

  function _seedWorld(){
    const world = ISO_GAME.world;
    if (!world){ console.warn('[iso] world missing in seed'); return; }

    // Resource banks.
    IsoAPI.resources.init('player', 600, 0);
    IsoAPI.resources.init('enemy',  600, 0);

    // Player starting Citadel + Crucible in the top-left starting
    // pocket (the demo map clears a 5x5 GROUND patch there).
    const playerCitadel = IsoAPI.buildings.create(world, {
      typeId: 'CITADEL', owner: 'player', col: 4, row: 4,
    });
    IsoAPI.buildings.create(world, {
      typeId: 'CRUCIBLE', owner: 'player', col: 7, row: 3,
    });

    // A starting Drone so the player has something to play with.
    {
      const t = tileToWorld(2, 6);
      IsoAPI.units.create(world, { typeId: 'DRONE', owner: 'player', x: t.x, y: t.y });
    }

    // Enemy outpost on the far side of the map. We scan inward from
    // (cols-5, rows-5) for a GROUND tile; if the demo generator
    // happened to place obstacles there, we fall back gracefully.
    const map = world.map;
    let placed = false;
    outer: for (let r = map.rows - 5; r > map.rows - 12; r--){
      for (let c = map.cols - 5; c > map.cols - 12; c--){
        if (map.isPassable(c, r) && map.isPassable(c+2, r+2)){
          // Clear a 4x4 patch to give the enemy room.
          for (let dr = 0; dr < 4; dr++){
            for (let dc = 0; dc < 4; dc++){
              if (map.get(c + dc, r + dr) && !map.isPassable(c + dc, r + dr)){
                map.set(c + dc, r + dr, TERRAIN.GROUND);
              }
            }
          }
          IsoAPI.buildings.create(world, {
            typeId: 'CRUCIBLE', owner: 'enemy', col: c + 1, row: r + 1,
          });
          // Two enemy combat units nearby so the player has things to
          // shoot at without waiting for AI.
          {
            const t = tileToWorld(c + 3, r + 3);
            IsoAPI.units.create(world, { typeId: 'WRAITH', owner: 'enemy', x: t.x, y: t.y });
          }
          {
            const t = tileToWorld(c + 4, r + 2);
            IsoAPI.units.create(world, { typeId: 'WRAITH', owner: 'enemy', x: t.x, y: t.y });
          }
          placed = true;
          break outer;
        }
      }
    }
    if (!placed){
      console.warn('[iso] could not find a spot for the enemy outpost');
    }

    // Center camera on the player base for a nice opening view.
    if (ISO_GAME.camera){
      const ctr = tileToWorld(5, 5);
      ISO_GAME.camera.x = ctr.x - ISO_GAME.camera.viewportW / 2;
      ISO_GAME.camera.y = ctr.y - ISO_GAME.camera.viewportH / 2;
      ISO_GAME.camera.clamp();
    }
  }

  function _mountSystems(){
    const world = ISO_GAME.world;
    // Movement (Liam will eventually replace) → Production → Combat → HUD.
    world.systems.push(new IsoMovementSystem());
    world.systems.push(new IsoProductionSystem());
    world.systems.push(new IsoCombatSystem());
    world.systems.push(new IsoHudSystem());
  }

  // ── Canvas input handlers ───────────────────────────
  // Left-click selects (or empty-space deselect).
  // Right-click commands: move to ground, or attack if over enemy.
  function _attachInput(){
    const canvas = ISO_GAME.canvas;
    if (!canvas) return;
    if (_canvasHandlers) return;

    function canvasToScreen(e){
      const rect = canvas.getBoundingClientRect();
      const scX = canvas.width  / rect.width;
      const scY = canvas.height / rect.height;
      return {
        sx: (e.clientX - rect.left) * scX,
        sy: (e.clientY - rect.top)  * scY,
      };
    }

    function onMouseDown(e){
      if (e.button !== 0) return;            // left-click
      e.preventDefault();
      const { sx, sy } = canvasToScreen(e);
      const world = ISO_GAME.world;
      const cam = ISO_GAME.camera;

      // Mode shim (from HUD MOVE/ATTACK buttons).
      const mode = window.ISO_INPUT_MODE;
      if (mode === 'move' || mode === 'attack'){
        const sel = IsoAPI.selection.get().filter(en => en.components && en.components.owner === 'player' && en.components.kind === 'unit');
        if (mode === 'move'){
          const w = screenToWorld(sx, sy, cam);
          for (const u of sel){
            IsoAPI.movement.moveTo(u, w.x, w.y);
            u.components.attackTarget = null;
            u.components.holdPosition = false;
          }
        } else if (mode === 'attack'){
          const target = IsoAPI.selection.pickAt(world, sx, sy, cam);
          if (target && target.components.owner !== 'player'){
            for (const u of sel) IsoAPI.combat.attack(u, target);
          } else {
            const w = screenToWorld(sx, sy, cam);
            for (const u of sel){
              IsoAPI.movement.moveTo(u, w.x, w.y);
              u.components.attackTarget = null;
            }
          }
        }
        window.ISO_INPUT_MODE = null;
        return;
      }

      const picked = IsoAPI.selection.pickAt(world, sx, sy, cam);
      if (picked){
        if (e.shiftKey) IsoAPI.selection.add([picked]);
        else            IsoAPI.selection.set([picked]);
      } else {
        if (!e.shiftKey) IsoAPI.selection.clear();
      }
    }

    function onContextMenu(e){
      e.preventDefault();
      const { sx, sy } = canvasToScreen(e);
      const world = ISO_GAME.world;
      const cam = ISO_GAME.camera;

      const sel = IsoAPI.selection.get().filter(en => en.components && en.components.owner === 'player');
      if (sel.length === 0) return;

      const picked = IsoAPI.selection.pickAt(world, sx, sy, cam);
      if (picked && picked.components.owner !== 'player'){
        // Attack-command. Only units attack.
        for (const u of sel){
          if (u.components.kind === 'unit') IsoAPI.combat.attack(u, picked);
        }
        IsoHud && IsoHud.flashHint && IsoHud.flashHint('Attacking ' + (IsoAPI.UNIT_TYPES[picked.components.unitTypeId] && IsoAPI.UNIT_TYPES[picked.components.unitTypeId].name || 'target') + '…');
      } else if (picked && picked.components.owner === 'player'){
        // Right-clicking a friendly: if exactly one production building
        // is in selection, set rally point. Otherwise treat as move.
        const wp = screenToWorld(sx, sy, cam);
        for (const u of sel){
          if (u.components.kind === 'unit') IsoAPI.movement.moveTo(u, wp.x, wp.y);
        }
      } else {
        // Empty ground click — move or set rally.
        const wp = screenToWorld(sx, sy, cam);
        let didAnything = false;
        for (const u of sel){
          if (u.components.kind === 'unit'){
            IsoAPI.movement.moveTo(u, wp.x, wp.y);
            u.components.attackTarget = null;
            u.components.holdPosition = false;
            didAnything = true;
          } else if (u.components.kind === 'building'){
            u.components.rallyPoint = { x: wp.x, y: wp.y };
            didAnything = true;
          }
        }
        if (didAnything) IsoHud && IsoHud.flashHint && IsoHud.flashHint('Order issued');
      }
    }

    canvas.addEventListener('mousedown',   onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    _canvasHandlers = { onMouseDown, onContextMenu };
  }
  function _detachInput(){
    if (!_canvasHandlers || !ISO_GAME.canvas) { _canvasHandlers = null; return; }
    ISO_GAME.canvas.removeEventListener('mousedown',   _canvasHandlers.onMouseDown);
    ISO_GAME.canvas.removeEventListener('contextmenu', _canvasHandlers.onContextMenu);
    _canvasHandlers = null;
  }

  function _updateHudHintForGameplay(){
    const el = document.querySelector('#tab-iso .iso-hint');
    if (!el) return;
    el.innerHTML = 'LEFT-CLICK SELECT · <kbd>SHIFT</kbd> ADD · RIGHT-CLICK MOVE/ATTACK · <kbd>WASD</kbd> PAN';
    window.ISO_HUD_DEFAULT_HINT = el.innerHTML;
  }

  // ── Re-register the iso lifecycle to include our setup ─────
  registerGame('iso', {
    init(){
      // Foundation start rebuilds canvas/world/camera/raf every call,
      // so we seed and mount fresh systems each time the tab opens.
      isoStart();
      _seedWorld();
      _mountSystems();
      _attachInput();
      IsoHud.bind();
      _updateHudHintForGameplay();
    },
    cleanup(){
      _detachInput();
      IsoHud.unbind();
      isoStop();
    },
  });
})();
