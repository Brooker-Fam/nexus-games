// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — MAP & TILES
// ════════════════════════════════════════════════════
//
// Tile shape (jsdoc):
//   @typedef {Object} Tile
//   @property {number}  col
//   @property {number}  row
//   @property {string}  terrain     — one of TERRAIN.*
//   @property {boolean} passable    — derived from TERRAIN_PASSABLE
//   @property {number}  elevation   — 0 = ground, 1 = highground
//
// Other hoglets read/write tiles via GameMap.get() / set(). Don't poke
// the .tiles array directly unless you're doing a bulk operation; the
// helpers keep `passable` and `elevation` in sync with terrain.

const TERRAIN = Object.freeze({
  GROUND:     'ground',
  HIGHGROUND: 'highground',
  OBSTACLE:   'obstacle',
  WATER:      'water',
});

const TERRAIN_PASSABLE = Object.freeze({
  [TERRAIN.GROUND]:     true,
  [TERRAIN.HIGHGROUND]: true,   // walkable; pathing penalty handled later
  [TERRAIN.OBSTACLE]:   false,
  [TERRAIN.WATER]:      false,
});

const TERRAIN_ELEVATION = Object.freeze({
  [TERRAIN.GROUND]:     0,
  [TERRAIN.HIGHGROUND]: 1,
  [TERRAIN.OBSTACLE]:   0,
  [TERRAIN.WATER]:      0,
});

// Palette pulled from docs/rts-2d-theme.md §2.
const TERRAIN_STYLE = Object.freeze({
  [TERRAIN.GROUND]:     { top:'#0c2440', shade:'#061830', outline:'rgba(0,245,255,0.18)' },
  [TERRAIN.HIGHGROUND]: { top:'#1e3a5c', shade:'#112440', outline:'rgba(0,245,255,0.32)' },
  [TERRAIN.OBSTACLE]:   { top:'#2a1040', shade:'#1a0828', outline:'rgba(136,0,255,0.50)' },
  [TERRAIN.WATER]:      { top:'#042033', shade:'#021420', outline:'rgba(0,136,255,0.40)' },
});

class GameMap {
  constructor(cols, rows){
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Array(cols * rows);
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        this.tiles[r * cols + c] = {
          col: c,
          row: r,
          terrain: TERRAIN.GROUND,
          passable: TERRAIN_PASSABLE[TERRAIN.GROUND],
          elevation: TERRAIN_ELEVATION[TERRAIN.GROUND],
        };
      }
    }
  }

  inBounds(col, row){
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  get(col, row){
    if (!this.inBounds(col, row)) return null;
    return this.tiles[row * this.cols + col];
  }

  set(col, row, terrain){
    if (!this.inBounds(col, row)) return;
    const t = this.tiles[row * this.cols + col];
    t.terrain   = terrain;
    t.passable  = TERRAIN_PASSABLE[terrain];
    t.elevation = TERRAIN_ELEVATION[terrain];
  }

  isPassable(col, row){
    const t = this.get(col, row);
    return !!(t && t.passable);
  }

  // Pixel bounding box of the entire tile grid in world-space.
  // Used by IsoCamera to clamp panning.
  worldBounds(){
    const halfW = ISO_TILE_W / 2;
    const halfH = ISO_TILE_H / 2;
    return {
      minX: -((this.rows - 1) * halfW) - halfW,
      maxX:  ((this.cols - 1) * halfW) + halfW,
      minY: -halfH,
      maxY:  ((this.cols + this.rows - 2) * halfH) + halfH,
    };
  }
  pixelWidth(){ const b = this.worldBounds(); return b.maxX - b.minX; }
  pixelHeight(){ const b = this.worldBounds(); return b.maxY - b.minY; }
}

// ── Demo map generator ──────────────────────────────
// Placeholder programmer-art map. Later hoglets can ignore this and load
// their own. Deterministic via a small LCG so the foundation always looks
// the same on first load.
function generateDemoMap(cols, rows){
  const map = new GameMap(cols, rows);

  // Tiny seeded RNG (LCG) — deterministic between sessions for stable
  // visual review. If you want randomness, pass your own seed later.
  let seed = 0xC17ADE1; // CITADEL ;)
  function rand(){
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  }

  // 1. Scatter highground "plateaus" — circular blobs.
  const plateauCount = Math.max(3, Math.floor((cols * rows) / 220));
  for (let i = 0; i < plateauCount; i++){
    const cx = Math.floor(rand() * cols);
    const cy = Math.floor(rand() * rows);
    const radius = 2 + Math.floor(rand() * 3);
    for (let r = -radius; r <= radius; r++){
      for (let c = -radius; c <= radius; c++){
        if (c*c + r*r <= radius*radius){
          map.set(cx + c, cy + r, TERRAIN.HIGHGROUND);
        }
      }
    }
  }

  // 2. Drop obstacle "rocks" — small clusters scattered around.
  const obstacleCount = Math.max(6, Math.floor((cols * rows) / 90));
  for (let i = 0; i < obstacleCount; i++){
    const cx = Math.floor(rand() * cols);
    const cy = Math.floor(rand() * rows);
    const size = 1 + Math.floor(rand() * 2);
    for (let r = 0; r < size; r++){
      for (let c = 0; c < size; c++){
        if (rand() > 0.3){
          map.set(cx + c, cy + r, TERRAIN.OBSTACLE);
        }
      }
    }
  }

  // 3. A diagonal water channel near one edge — visual variety.
  const channelRow = Math.floor(rows * 0.75);
  for (let c = Math.floor(cols * 0.1); c < Math.floor(cols * 0.4); c++){
    const wobble = Math.floor((rand() - 0.5) * 2);
    map.set(c, channelRow + wobble, TERRAIN.WATER);
    map.set(c, channelRow + wobble + 1, TERRAIN.WATER);
  }

  // 4. Clear a starting pocket near the top-left corner so units can spawn.
  for (let r = 0; r < 5; r++){
    for (let c = 0; c < 5; c++){
      map.set(c, r, TERRAIN.GROUND);
    }
  }

  return map;
}

// Vanilla-JS globals.
window.TERRAIN          = TERRAIN;
window.TERRAIN_PASSABLE = TERRAIN_PASSABLE;
window.TERRAIN_STYLE    = TERRAIN_STYLE;
window.GameMap          = GameMap;
window.generateDemoMap  = generateDemoMap;
