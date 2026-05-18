// ════════════════════════════════════════════════════
//  DUNE — TERRAIN INTERFACE
// ════════════════════════════════════════════════════
//
// This file defines the contract the units/pathfinding/combat code expects
// from the terrain system. The terrain hoglet will replace the body of
// `createDuneTerrain()` with a real procedural map. The exported shape
// (functions and tile constants) is the integration point — keep it stable.
//
// Public API:
//   createDuneTerrain(cols, rows[, seed])  → terrain
//
// A terrain instance must expose:
//   cols, rows                              — grid dimensions (tiles)
//   isPassable(tx, ty)         → boolean   — can a ground unit enter this tile?
//   getMovementCost(tx, ty)    → number    — A* cost; Infinity = blocked
//   getTile(tx, ty)            → tile id   — see DUNE_TILE
//   setTile(tx, ty, tileId)    → void      — mutating setter (used by harvester)
//   isSpice(tx, ty)            → boolean
//   removeSpice(tx, ty)        → void
//   inBounds(tx, ty)           → boolean
//
// Tile IDs are exported as DUNE_TILE.* so renderer + harvester logic can
// share constants with whatever generator lands later.

const DUNE_TILE = {
  SAND:     0,   // open, cheap
  DUNE:     1,   // passable but slow (drifty sand)
  ROCK:     2,   // passable, no slowdown (good for building, future use)
  MOUNTAIN: 3,   // impassable (cliffs / large rocks)
  SPICE:    4,   // harvestable spice patch; passable
  WRECK:    5,   // burnt-out unit; passable but slow
};

// Per-tile movement cost (1 = baseline). Infinity = blocked.
const DUNE_TILE_COST = {
  [DUNE_TILE.SAND]:     1,
  [DUNE_TILE.DUNE]:     2,
  [DUNE_TILE.ROCK]:     1,
  [DUNE_TILE.MOUNTAIN]: Infinity,
  [DUNE_TILE.SPICE]:    1,
  [DUNE_TILE.WRECK]:    2,
};

// Tiny seeded PRNG (mulberry32) — deterministic per-seed maps. Standalone so
// the placeholder generator doesn't depend on the RTS rng module.
function _duneRng(seed){
  let s = (seed|0) || 1;
  return function(){
    s = (s + 0x6D2B79F5)|0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── PLACEHOLDER GENERATOR ─────────────────────────────────────────────
// The real terrain hoglet will replace this. The contract is what matters.
function createDuneTerrain(cols, rows, seed){
  const rng = _duneRng(seed === undefined ? 1337 : seed);
  const tiles = new Uint8Array(cols * rows); // default SAND (0)

  const idx = (x, y) => y * cols + x;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;

  // Sprinkle a few impassable mountain blobs (avoid edges so spawn areas stay clear)
  const mountainBlobs = 6 + Math.floor(rng() * 4);
  for(let i = 0; i < mountainBlobs; i++){
    const cx = 4 + Math.floor(rng() * (cols - 8));
    const cy = 3 + Math.floor(rng() * (rows - 6));
    const radius = 1 + Math.floor(rng() * 3);
    for(let y = cy - radius; y <= cy + radius; y++){
      for(let x = cx - radius; x <= cx + radius; x++){
        if(!inBounds(x, y)) continue;
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if(d2 <= radius * radius && rng() > 0.25){
          tiles[idx(x, y)] = DUNE_TILE.MOUNTAIN;
        }
      }
    }
  }

  // A drifty dune band across the middle (slow terrain)
  for(let y = 0; y < rows; y++){
    for(let x = 0; x < cols; x++){
      if(tiles[idx(x, y)] !== DUNE_TILE.SAND) continue;
      const wave = Math.sin(x * 0.35 + y * 0.18) + rng() * 0.4;
      if(wave > 1.0) tiles[idx(x, y)] = DUNE_TILE.DUNE;
    }
  }

  // Spice patches — clustered, never on mountains
  const spicePatches = 5 + Math.floor(rng() * 4);
  for(let i = 0; i < spicePatches; i++){
    const cx = 3 + Math.floor(rng() * (cols - 6));
    const cy = 3 + Math.floor(rng() * (rows - 6));
    const radius = 1 + Math.floor(rng() * 3);
    for(let y = cy - radius; y <= cy + radius; y++){
      for(let x = cx - radius; x <= cx + radius; x++){
        if(!inBounds(x, y)) continue;
        if(tiles[idx(x, y)] === DUNE_TILE.MOUNTAIN) continue;
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if(d2 <= radius * radius && rng() > 0.35){
          tiles[idx(x, y)] = DUNE_TILE.SPICE;
        }
      }
    }
  }

  // Carve guaranteed clear spawn zones in the two corners
  const clearZone = (x0, y0) => {
    for(let y = y0; y < y0 + 4; y++){
      for(let x = x0; x < x0 + 5; x++){
        if(inBounds(x, y)) tiles[idx(x, y)] = DUNE_TILE.SAND;
      }
    }
  };
  clearZone(1, 1);
  clearZone(cols - 6, rows - 5);

  return {
    cols, rows,
    inBounds,
    getTile(x, y){ return inBounds(x, y) ? tiles[idx(x, y)] : DUNE_TILE.MOUNTAIN; },
    setTile(x, y, t){ if(inBounds(x, y)) tiles[idx(x, y)] = t; },
    isPassable(x, y){
      if(!inBounds(x, y)) return false;
      return DUNE_TILE_COST[tiles[idx(x, y)]] !== Infinity;
    },
    getMovementCost(x, y){
      if(!inBounds(x, y)) return Infinity;
      return DUNE_TILE_COST[tiles[idx(x, y)]];
    },
    isSpice(x, y){ return inBounds(x, y) && tiles[idx(x, y)] === DUNE_TILE.SPICE; },
    removeSpice(x, y){
      if(inBounds(x, y) && tiles[idx(x, y)] === DUNE_TILE.SPICE){
        tiles[idx(x, y)] = DUNE_TILE.SAND;
      }
    },
  };
}
