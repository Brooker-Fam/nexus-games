// ── SPICE WARS · GAME LOOP ──────────────────────────────────────────────────
// Orchestrates ticks, integrates terrain/units stubs, runs win/lose checks,
// and wires the spice-delivery callback into the economy.

(function(){
  const canvasId = 'duneCanvas';
  let canvas = null;

  function world(){
    return {
      nearestRefinery: (x, y, owner) => window.DuneBuildings.findRefineryNear(x, y, owner),
    };
  }

  function onSpiceDelivered(owner, amount, refineryId){
    const kept = window.DuneEconomy.credit(owner, amount);
    window.DuneBuildings.flashRefinery(refineryId);
    if(owner === 'player'){
      if(kept < amount){
        window.DuneState.pushLog('Spice silo full — ' + (amount - kept) + ' lost.', 'warn');
      } else {
        window.DuneState.pushLog('+' + kept + ' credits from refinery.', 'good');
      }
    }
  }

  function seedWorld(){
    const S = window.DuneState.reset();
    S.tile = window.DuneState.TILE;
    window.DuneTerrain.init({});
    S.cols = window.DuneTerrain.cols;
    S.rows = window.DuneTerrain.rows;

    window.DuneUnits.init({ onSpiceDelivered });

    // Starting credits
    S.players.player.credits = window.DuneConfig.STARTING.player.credits;
    S.players.enemy.credits  = window.DuneConfig.STARTING.enemy.credits;
    window.DuneEconomy.recalcStorage('player');
    window.DuneEconomy.recalcStorage('enemy');

    // Place starting Construction Yards
    window.DuneBuildings.add('construction_yard', 4, 9, 'player', { builtImmediately: true });
    window.DuneBuildings.add('construction_yard', 24, 9, 'enemy',  { builtImmediately: true });

    // Give the enemy something to destroy for win condition (also give it a CY).
    window.DuneBuildings.add('wind_trap', 27, 14, 'enemy', { builtImmediately: true });
    window.DuneBuildings.add('refinery',  21, 14, 'enemy', { builtImmediately: true });

    window.DuneState.pushLog('Welcome, Commander. Build Wind Traps for power, a Refinery for credits.');
  }

  function startNew(){
    stop();
    seedWorld();
    window.DuneHud.build();
    window.DuneHud.setStatus('Place buildings on rock. Wind Traps power the base.');
    canvas = document.getElementById(canvasId);
    // Resize canvas to match terrain dimensions
    const S = window.DuneState.get();
    canvas.width  = S.cols * S.tile;
    canvas.height = S.rows * S.tile;
    S.lastT = performance.now();
    loop(S.lastT);
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

      // Decay refinery flash markers
      for(const b of S.buildings){
        if(b.flashUntil > 0) b.flashUntil = Math.max(0, b.flashUntil - dtRaw);
      }

      // Periodic econ recompute is cheap and forgiving.
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
