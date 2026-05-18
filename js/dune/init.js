// ── SPICE WARS · INIT ───────────────────────────────────────────────────────
// Registers the game with the shared lifecycle registry so tab switching
// triggers init() / cleanup().

(function(){
  if(typeof registerGame !== 'function') return;
  registerGame('dune', {
    init(){
      window.DuneGame.startNew();
    },
    cleanup(){
      window.DuneGame.stop();
    },
  });
})();
