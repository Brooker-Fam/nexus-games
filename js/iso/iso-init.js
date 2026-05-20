// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — UNITS / SELECTION INIT
// ════════════════════════════════════════════════════
//
// Glue that wires the units, selection, pathfinding, combat, and input
// modules into the foundation's lifecycle without modifying game.js.
//
// Strategy: wrap window.isoStart / isoStop, then re-register the tab
// with game-registry so the lifecycle picks up our wrappers. Idempotent
// — tab switching repeatedly is safe.

(function(){
  if (typeof window.isoStart !== 'function'){
    console.warn('[iso] iso-init.js loaded before foundation game.js — skipping');
    return;
  }

  const _origIsoStart  = window.isoStart;
  const _origIsoStop   = window.isoStop;
  const _origIsoRender = window.isoRender;

  // Wrap render once — needs the drag-box overlay above the world.
  window.isoRender = function(ctx, world, cam){
    _origIsoRender(ctx, world, cam);
    if (typeof drawDragSelectBox === 'function') drawDragSelectBox(ctx);
  };

  window.isoStart = function(){
    if (ISO_GAME.running) return;
    _origIsoStart();
    if (!ISO_GAME.world || !ISO_GAME.canvas) return;
    _setupGameplay();
    attachIsoInput(ISO_GAME.canvas);
  };

  window.isoStop = function(){
    detachIsoInput();
    _origIsoStop();
    _resetGameplay();
  };

  // Re-register with the wrapped functions. registerGame() overwrites
  // the previous 'iso' entry, so the lifecycle now calls our wrappers.
  if (typeof registerGame === 'function'){
    registerGame('iso', {
      init(){ window.isoStart(); },
      cleanup(){ window.isoStop(); },
    });
  }

  function _setupGameplay(){
    const world = ISO_GAME.world;
    // Movement before combat so attack cooldowns see settled positions.
    world.systems.push(new MovementSystem());
    world.systems.push(new CombatSystem());

    // Reset any stale selection/registry from a prior session.
    resetUnitRegistry();
    if (typeof clearSelection === 'function') clearSelection();

    _spawnDemoUnits(world);
  }

  function _resetGameplay(){
    if (typeof clearSelection === 'function') clearSelection();
    resetUnitRegistry();
    if (ISO_SELECTION){
      ISO_SELECTION.dragging  = false;
      ISO_SELECTION.dragStart = null;
      ISO_SELECTION.dragEnd   = null;
    }
  }

  // Smoke-test population: a Shadow squad in the cleared top-left pocket
  // (generateDemoMap guarantees 0..4 × 0..4 is GROUND), and a Prism garrison
  // roughly mid-map so the player can box-select, walk over, and engage.
  function _spawnDemoUnits(world){
    const map = world.map;

    // Friendly Shadow squad.
    spawnUnit('worker',  1, 1, 'shadow');
    spawnUnit('worker',  2, 1, 'shadow');
    spawnUnit('worker',  3, 2, 'shadow');
    spawnUnit('warrior', 1, 3, 'shadow');
    spawnUnit('warrior', 3, 3, 'shadow');

    // Enemy Prism garrison — pick passable tiles deeper in the map.
    const enemySpots = [
      [Math.floor(map.cols * 0.6), Math.floor(map.rows * 0.6)],
      [Math.floor(map.cols * 0.65), Math.floor(map.rows * 0.6)],
      [Math.floor(map.cols * 0.6), Math.floor(map.rows * 0.65)],
      [Math.floor(map.cols * 0.55), Math.floor(map.rows * 0.7)],
    ];
    for (let i = 0; i < enemySpots.length; i++){
      const [c, r] = enemySpots[i];
      const p = nearestPassableTile(map, c, r, 10);
      if (p){
        const type = i === 0 ? 'worker' : 'warrior';
        spawnUnit(type, p.col, p.row, 'prism');
      }
    }
  }
})();
