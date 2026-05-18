// ── SPICE WARS · TERRAIN STUB ───────────────────────────────────────────────
//
// Minimal terrain API used by the buildings/economy/HUD module. The
// "terrain/map" hoglet is expected to land a real implementation that exposes
// the SAME global as `window.DuneTerrain`. As long as the surface below stays
// stable, the buildings module integrates with no further changes.
//
// Contract (read by buildings.js, rendering.js, units.js stub):
//   DuneTerrain.init({cols, rows})            → seed terrain (idempotent)
//   DuneTerrain.cols / .rows                  → grid dimensions in tiles
//   DuneTerrain.tileAt(x, y)                  → 'rock' | 'sand' | 'spice' | null
//   DuneTerrain.isRock(x, y)                  → bool — buildings can place here
//   DuneTerrain.isBuildable(x, y, w, h, opts) → bool — every tile rock & free
//   DuneTerrain.markOccupied(x, y, w, h, id)  → reserve footprint
//   DuneTerrain.clearOccupied(x, y, w, h)     → release footprint (on destroy)
//   DuneTerrain.findNearestSpice(x, y)        → {x,y} or null  (Harvester uses)
//   DuneTerrain.consumeSpice(x, y, amount)    → number actually taken
//   DuneTerrain.draw(ctx, tile)               → render terrain layer
// ────────────────────────────────────────────────────────────────────────────

(function(){
  const COLS = 30;
  const ROWS = 22;

  const grid = [];           // [y][x] → 'rock' | 'sand' | 'spice'
  const spice = [];          // [y][x] → remaining spice density (0..100)
  const occupied = [];       // [y][x] → building id or 0

  function seed(){
    grid.length = 0;
    spice.length = 0;
    occupied.length = 0;
    for(let y = 0; y < ROWS; y++){
      const row = [];
      const spRow = [];
      const occRow = [];
      for(let x = 0; x < COLS; x++){
        // Deterministic plate of rock down the player (left) and enemy (right)
        // sides with a sand corridor in the middle; spice scattered on sand.
        const inLeftPlate  = x >= 1  && x <= 9  && y >= 4  && y <= 17;
        const inRightPlate = x >= 20 && x <= 28 && y >= 4  && y <= 17;
        const isRockBand   = inLeftPlate || inRightPlate;
        let t = isRockBand ? 'rock' : 'sand';
        let density = 0;
        if(t === 'sand' && (
          (x === 14 && y === 8)  || (x === 15 && y === 8)  ||
          (x === 14 && y === 13) || (x === 15 && y === 13) ||
          (x === 16 && y === 11) || (x === 13 && y === 10)
        )){
          t = 'spice';
          density = 100;
        }
        row.push(t);
        spRow.push(density);
        occRow.push(0);
      }
      grid.push(row);
      spice.push(spRow);
      occupied.push(occRow);
    }
  }

  function inBounds(x, y){
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  function tileAt(x, y){
    if(!inBounds(x, y)) return null;
    return grid[y][x];
  }

  function isRock(x, y){
    return tileAt(x, y) === 'rock';
  }

  function isOccupied(x, y){
    if(!inBounds(x, y)) return true;
    return occupied[y][x] !== 0;
  }

  function isBuildable(x, y, w, h, opts){
    opts = opts || {};
    const allowAnyTerrain = !!opts.allowAnyTerrain; // e.g. concrete slab
    for(let dy = 0; dy < h; dy++){
      for(let dx = 0; dx < w; dx++){
        const tx = x + dx, ty = y + dy;
        if(!inBounds(tx, ty)) return false;
        if(isOccupied(tx, ty)) return false;
        if(!allowAnyTerrain && !isRock(tx, ty)) return false;
      }
    }
    return true;
  }

  function markOccupied(x, y, w, h, id){
    for(let dy = 0; dy < h; dy++){
      for(let dx = 0; dx < w; dx++){
        if(inBounds(x + dx, y + dy)) occupied[y + dy][x + dx] = id || 1;
      }
    }
  }

  function clearOccupied(x, y, w, h){
    for(let dy = 0; dy < h; dy++){
      for(let dx = 0; dx < w; dx++){
        if(inBounds(x + dx, y + dy)) occupied[y + dy][x + dx] = 0;
      }
    }
  }

  function findNearestSpice(fx, fy){
    let best = null, bestD = Infinity;
    for(let y = 0; y < ROWS; y++){
      for(let x = 0; x < COLS; x++){
        if(grid[y][x] !== 'spice' || spice[y][x] <= 0) continue;
        const d = Math.abs(x - fx) + Math.abs(y - fy);
        if(d < bestD){ bestD = d; best = {x, y}; }
      }
    }
    return best;
  }

  function consumeSpice(x, y, amount){
    if(!inBounds(x, y) || grid[y][x] !== 'spice') return 0;
    const take = Math.min(amount, spice[y][x]);
    spice[y][x] -= take;
    if(spice[y][x] <= 0) grid[y][x] = 'sand';
    return take;
  }

  function draw(ctx, tile){
    for(let y = 0; y < ROWS; y++){
      for(let x = 0; x < COLS; x++){
        const t = grid[y][x];
        const px = x * tile, py = y * tile;
        if(t === 'rock'){
          ctx.fillStyle = '#5a5044';
          ctx.fillRect(px, py, tile, tile);
          // subtle inner highlight
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(px + 1, py + 1, tile - 2, 2);
        } else if(t === 'spice'){
          ctx.fillStyle = '#c89b5c';
          ctx.fillRect(px, py, tile, tile);
          ctx.fillStyle = '#d96c2e';
          const d = spice[y][x] / 100;
          ctx.globalAlpha = 0.35 + 0.55 * d;
          ctx.beginPath();
          ctx.arc(px + tile/2, py + tile/2, tile * 0.35, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = '#c89b5c';
          ctx.fillRect(px, py, tile, tile);
        }
        // grid line
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
      }
    }
  }

  function init(opts){
    seed();
    if(opts && opts.onReady) opts.onReady();
  }

  window.DuneTerrain = {
    init,
    get cols(){ return COLS; },
    get rows(){ return ROWS; },
    tileAt,
    isRock,
    isOccupied,
    isBuildable,
    markOccupied,
    clearOccupied,
    findNearestSpice,
    consumeSpice,
    draw,
    __stub: true,
  };
})();
