// ── SPICE WARS · GAME LOOP ──────────────────────────────────────────────────
// Unified orchestrator. Replaces the three earlier game.js variants. Owns:
//   • world seeding (terrain + starting buildings + harvester)
//   • the RAF loop
//   • dt-based ticks into DuneBuildings, DuneUnits, DuneEconomy
//   • win/lose detection
//   • registerGame lifecycle (one place — js/dune/init.js was kept for parity
//     with PR #98 but we register here too in case load order shifts).

(function(){
  const canvasId = 'duneCanvas';
  let canvas = null;

  function world(){
    return {
      nearestRefinery: (x, y, owner) => window.DuneBuildings.findRefineryNear(x, y, owner),
    };
  }

  function seedWorld(){
    const S = window.DuneState.reset();
    S.tile = window.DuneState.TILE;
    window.DuneTerrain.init({});
    S.cols = window.DuneTerrain.cols;
    S.rows = window.DuneTerrain.rows;

    // Units module is initialised BEFORE buildings, so when buildings spawn
    // a free harvester on completion the units state exists.
    window.DuneUnits.init({});

    // Starting credits
    S.players.player.credits = window.DuneConfig.STARTING.player.credits;
    S.players.enemy.credits  = window.DuneConfig.STARTING.enemy.credits;
    window.DuneEconomy.recalcStorage('player');
    window.DuneEconomy.recalcStorage('enemy');

    // Starting bases: a construction yard + wind trap + refinery for each side.
    // The refinery spawns its own harvester via its config (spawnsOnComplete).
    window.DuneBuildings.add('construction_yard',  4, 9,  'player', { builtImmediately: true });
    window.DuneBuildings.add('wind_trap',          3, 12, 'player', { builtImmediately: true });
    window.DuneBuildings.add('refinery',           6, 12, 'player', { builtImmediately: true });

    window.DuneBuildings.add('construction_yard', 26, 9,  'enemy',  { builtImmediately: true });
    window.DuneBuildings.add('wind_trap',         28, 12, 'enemy',  { builtImmediately: true });
    window.DuneBuildings.add('refinery',          22, 12, 'enemy',  { builtImmediately: true });

    // Give each side one combat unit so the smoke-test reaches "combat" quickly.
    window.DuneUnits.spawnUnit('light_infantry', 3, 4,  'player');
    window.DuneUnits.spawnUnit('light_infantry', 9, 17, 'player');
    window.DuneUnits.spawnUnit('light_infantry', 28, 4,  'enemy');
    window.DuneUnits.spawnUnit('light_infantry', 22, 17, 'enemy');

    // Refresh drop-off anchors to the real refineries we just placed.
    window.DuneUnits.refreshDropOff();

    window.DuneState.pushLog('Welcome, Commander. Harvest spice, build forces, destroy the enemy base.');
  }

  function startNew(){
    stop();
    seedWorld();
    window.DuneHud.build();
    window.DuneHud.setStatus('Right-click to give orders. Build on rock. Destroy the red base to win.');
    canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const S = window.DuneState.get();
    canvas.width  = S.cols * S.tile;
    canvas.height = S.rows * S.tile;

    if(typeof duneInstallInput === 'function'){
      duneInstallInput(canvas, S);
    }

    S.lastT = performance.now();
    loop(S.lastT);

    if(window.posthog){
      window.posthog.capture('dune_game_started', { mode: 'integrated' });
    }
  }

  function stop(){
    const S = window.DuneState.get();
    if(S.raf){ cancelAnimationFrame(S.raf); S.raf = null; }
  }

  function loop(t){
    const S = window.DuneState.get();
    if(!canvas) return;
    const dtRaw = Math.min(0.1, (t - S.lastT) / 1000);
    const dt = dtRaw * S.speed;
    S.lastT = t;
    S.tick += dt;

    if(!S.over){
      window.DuneBuildings.tickQueues(dt);
      window.DuneUnits.tick(dt, world());

      // Refinery flash markers decay (set by units.js on spice delivery).
      for(const b of S.buildings){
        if(b.flashUntil > 0) b.flashUntil = Math.max(0, b.flashUntil - dtRaw);
      }

      // Cheap, idempotent.
      window.DuneEconomy.recalcPower('player');
      window.DuneEconomy.recalcPower('enemy');

      const result = window.DuneBuildings.checkWinLose();
      if(result){
        S.over = result;
        if(window.posthog){
          window.posthog.capture('dune_game_ended', { outcome: result });
        }
      }
    }

    window.DuneRendering.draw(canvas);
    window.DuneHud.update();

    S.raf = requestAnimationFrame(loop);
  }

  window.DuneGame = {
    startNew,
    stop,
  };
})();
