// ── SPICE WARS · STATE ──────────────────────────────────────────────────────
// Single mutable game state object, mirrors the existing RTS pattern.

(function(){
  const TILE = 24;          // pixel size of one tile

  // World coordinate is in tiles. Canvas size is derived from terrain.

  function freshState(){
    return {
      // loop
      raf: null,
      lastT: 0,
      tick: 0,
      speed: 1,
      paused: false,

      // world (set up at init time)
      tile: TILE,
      cols: 0,
      rows: 0,

      // entities
      buildings: [],         // see buildings.js for shape
      nextBuildingId: 1,

      // per-side resources
      players: {
        player: { credits: 0, used: 0, produced: 0, storage: 0, refIds: [] },
        enemy:  { credits: 0, used: 0, produced: 0, storage: 0, refIds: [] },
      },

      // build queues — per side, one slot in the demo (Dune II style)
      queues: {
        player: [],
        enemy:  [],
      },

      // ready-to-place pending item (queue has finished, awaiting placement)
      placement: {
        player: null,        // {type, footprint:{w,h}}
        enemy:  null,
      },

      // UI/input
      hover: null,           // {x, y} in tiles, or null
      log: [],

      // game over
      over: null,            // 'victory' | 'defeat' | null
    };
  }

  let S = freshState();

  function reset(){
    S = freshState();
    return S;
  }

  function get(){ return S; }

  function pushLog(msg, level){
    S.log.unshift({ msg, level: level || '', t: Date.now() });
    if(S.log.length > 30) S.log.length = 30;
  }

  window.DuneState = {
    TILE,
    get,
    reset,
    pushLog,
  };
})();
