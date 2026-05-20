// ── SPICE WARS · TERRAIN ────────────────────────────────────────────────────
// Unified terrain module. Replaces three earlier shims:
//   • PR #96 tiles.js / map.js / mapgen.js  (string tile names, fog, scrolling)
//   • PR #97 terrain.js  (numeric tile IDs, A* contract)
//   • PR #98 stubs/terrain.js  (rock/sand/spice + occupancy)
//
// One shape, one contract — used by buildings.js, units.js, pathfinding.js,
// rendering.js. Tiles are strings (human-readable, JSON-safe). Public surface
// covers BOTH the PR #97 sim contract (isPassable / getMovementCost / setTile)
// AND the PR #98 builder contract (isBuildable / markOccupied / consumeSpice).

(function(){
  const COLS = 32;
  const ROWS = 22;

  // Tile constants — strings for human-readable map dumps. Symbol names match
  // PR #97's units.js (uses DUNE_TILE.SAND / SPICE / MOUNTAIN / WRECK).
  const TILE = {
    SAND:     'sand',
    ROCK:     'rock',
    MOUNTAIN: 'mountain',
    SPICE:    'spice',
    WRECK:    'wreck',
  };

  // Per-tile properties. Movement cost is the A* edge cost; Infinity = blocked.
  const PROPS = {
    sand:     { color: '#c89b5c', passable: true,  cost: 1,        buildable: false },
    rock:     { color: '#5a5044', passable: true,  cost: 1,        buildable: true  },
    mountain: { color: '#3a2a20', passable: false, cost: Infinity, buildable: false },
    spice:    { color: '#c89b5c', passable: true,  cost: 1,        buildable: false },
    wreck:    { color: '#503830', passable: true,  cost: 2,        buildable: false },
  };

  const grid     = [];   // [y][x] → tile string
  const spice    = [];   // [y][x] → 0..100 remaining density (only meaningful on 'spice' tiles)
  const occupied = [];   // [y][x] → building id, or 0 if free

  function inBounds(x, y){
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  function seed(){
    grid.length = 0;
    spice.length = 0;
    occupied.length = 0;
    for(let y = 0; y < ROWS; y++){
      const row = [], spRow = [], occRow = [];
      for(let x = 0; x < COLS; x++){
        // Player plate (left) and enemy plate (right) — solid rock to build on.
        const inLeftPlate  = x >=  2 && x <= 10 && y >=  3 && y <= 18;
        const inRightPlate = x >= 21 && x <= 29 && y >=  3 && y <= 18;
        let t = (inLeftPlate || inRightPlate) ? TILE.ROCK : TILE.SAND;

        // A few mountain blocks in the central corridor to make A* matter.
        const mountainSpots = [
          [15, 5], [16, 5], [16, 16], [15, 16], [13, 10], [18, 12],
        ];
        if(mountainSpots.some(p => p[0] === x && p[1] === y)){
          t = TILE.MOUNTAIN;
        }

        // Spice fields scattered through the corridor — a few small patches.
        const spiceSpots = [
          [13, 7],  [14, 7],  [15, 8],
          [17, 9],  [18, 9],  [19, 10],
          [13, 14], [14, 14], [15, 13],
          [17, 15], [18, 15], [19, 14],
        ];
        const isSpice = t === TILE.SAND && spiceSpots.some(p => p[0] === x && p[1] === y);
        if(isSpice) t = TILE.SPICE;

        row.push(t);
        spRow.push(t === TILE.SPICE ? 100 : 0);
        occRow.push(0);
      }
      grid.push(row);
      spice.push(spRow);
      occupied.push(occRow);
    }
  }

  // ── Generic queries ──────────────────────────────────────────────────────
  function tileAt(x, y){
    if(!inBounds(x, y)) return null;
    return grid[y][x];
  }
  function isRock(x, y){     return tileAt(x, y) === TILE.ROCK; }
  function isSpiceTile(x, y){ return tileAt(x, y) === TILE.SPICE && spice[y][x] > 0; }
  function isMountain(x, y){ return tileAt(x, y) === TILE.MOUNTAIN; }

  // Pathfinding (PR #97) contract — accepts any tile coord, returns blocked
  // for OOB and mountains, also blocked when a building footprint occupies it.
  function isPassable(x, y){
    if(!inBounds(x, y)) return false;
    const t = grid[y][x];
    if(!PROPS[t].passable) return false;
    if(occupied[y][x] !== 0) return false;   // buildings block pathing
    return true;
  }
  function getMovementCost(x, y){
    if(!inBounds(x, y)) return Infinity;
    const t = grid[y][x];
    if(!PROPS[t].passable) return Infinity;
    return PROPS[t].cost;
  }

  // ── Mutating (units + buildings) ─────────────────────────────────────────
  function setTile(x, y, tile){
    if(!inBounds(x, y)) return;
    grid[y][x] = tile;
    // Setting to anything other than spice clears spice density.
    if(tile !== TILE.SPICE) spice[y][x] = 0;
  }
  // PR #97 alias
  function removeSpice(x, y){
    if(!inBounds(x, y)) return;
    if(grid[y][x] === TILE.SPICE){
      spice[y][x] = 0;
      grid[y][x] = TILE.SAND;
    }
  }
  // PR #98-style partial consume — returns amount actually removed.
  function consumeSpice(x, y, amount){
    if(!inBounds(x, y) || grid[y][x] !== TILE.SPICE) return 0;
    const take = Math.min(amount, spice[y][x]);
    spice[y][x] -= take;
    if(spice[y][x] <= 0) grid[y][x] = TILE.SAND;
    return take;
  }

  // ── Buildings ────────────────────────────────────────────────────────────
  function isOccupied(x, y){
    if(!inBounds(x, y)) return true;
    return occupied[y][x] !== 0;
  }
  function isBuildable(x, y, w, h, opts){
    opts = opts || {};
    const allowAnyTerrain = !!opts.allowAnyTerrain;
    for(let dy = 0; dy < h; dy++){
      for(let dx = 0; dx < w; dx++){
        const tx = x + dx, ty = y + dy;
        if(!inBounds(tx, ty)) return false;
        if(isOccupied(tx, ty)) return false;
        if(isMountain(tx, ty)) return false;
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

  // ── Spice lookup ─────────────────────────────────────────────────────────
  function findNearestSpice(fx, fy){
    let best = null, bestD = Infinity;
    for(let y = 0; y < ROWS; y++){
      for(let x = 0; x < COLS; x++){
        if(grid[y][x] !== TILE.SPICE || spice[y][x] <= 0) continue;
        const d = Math.abs(x - fx) + Math.abs(y - fy);
        if(d < bestD){ bestD = d; best = { x, y }; }
      }
    }
    return best;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function draw(ctx, tile){
    for(let y = 0; y < ROWS; y++){
      for(let x = 0; x < COLS; x++){
        const t = grid[y][x];
        const props = PROPS[t];
        const px = x * tile, py = y * tile;
        ctx.fillStyle = props.color;
        ctx.fillRect(px, py, tile, tile);

        if(t === TILE.MOUNTAIN){
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(px + 3, py + 3, tile - 6, tile - 6);
        } else if(t === TILE.SPICE){
          // Density-modulated spice glow
          ctx.fillStyle = '#d96c2e';
          const d = spice[y][x] / 100;
          ctx.globalAlpha = 0.35 + 0.55 * d;
          ctx.beginPath();
          ctx.arc(px + tile/2, py + tile/2, tile * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if(t === TILE.ROCK){
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(px + 1, py + 1, tile - 2, 2);
        } else if(t === TILE.WRECK){
          ctx.fillStyle = '#2a1a14';
          ctx.fillRect(px + tile*0.2, py + tile*0.2, tile*0.6, tile*0.6);
        }
        // Faint grid
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

  // ── Public surface ───────────────────────────────────────────────────────
  window.DuneTerrain = {
    init,
    get cols(){ return COLS; },
    get rows(){ return ROWS; },
    // generic queries
    tileAt,
    inBounds,
    isRock,
    isMountain,
    isPassable,
    isSpice: isSpiceTile,
    // PR #97 contract
    getTile: tileAt,
    setTile,
    getMovementCost,
    removeSpice,
    // building support
    isOccupied,
    isBuildable,
    markOccupied,
    clearOccupied,
    // spice flow
    findNearestSpice,
    consumeSpice,
    // render
    draw,
  };

  // Legacy globals so PR #97's units.js + pathfinding.js compile without edits.
  window.DUNE_TILE = TILE;
})();
