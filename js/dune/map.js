// ════════════════════════════════════════════════════
//  DUNE — MAP DATA STRUCTURE
// ════════════════════════════════════════════════════
// A DuneMap is a width×height grid of terrain string IDs (see tiles.js).
// Tiles are stored row-major in a flat array, so map.tiles[y * width + x].
// Maps are plain JSON-serializable data — pass them across the network,
// save to localStorage, or hand-author by hand.
//
// Construction paths:
//   new DuneMap({ width, height, tiles, name? })   — explicit
//   DuneMap.fromJSON(obj)                           — parse JSON payload
//   duneLoadMap(name | jsonObj)                     — convenience loader
//   duneCreateTestMap()                             — bundled 64×64 demo
//   duneGenerateMap({ width, height, seed, ... })   — procedural Arrakis

class DuneMap {
  constructor({ width, height, tiles, name }){
    if(!Number.isFinite(width) || width <= 0) throw new Error('DuneMap: width must be > 0');
    if(!Number.isFinite(height) || height <= 0) throw new Error('DuneMap: height must be > 0');
    if(tiles && tiles.length !== width * height){
      throw new Error('DuneMap: tiles length ('+tiles.length+') != width*height ('+(width*height)+')');
    }
    this.width  = width;
    this.height = height;
    this.name   = name || 'unnamed';
    this.tiles  = tiles || new Array(width * height).fill(DUNE_TILE.SAND);
  }

  inBounds(tx, ty){
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  get(tx, ty){
    if(!this.inBounds(tx, ty)) return DUNE_TILE.MOUNTAIN; // off-map reads behave as impassable
    return this.tiles[ty * this.width + tx];
  }

  set(tx, ty, terrain){
    if(!this.inBounds(tx, ty)) return;
    this.tiles[ty * this.width + tx] = terrain;
  }

  // Returns a plain object safe to JSON.stringify.
  toJSON(){
    return { name: this.name, width: this.width, height: this.height, tiles: this.tiles.slice() };
  }

  static fromJSON(obj){
    if(!obj || typeof obj !== 'object') throw new Error('DuneMap.fromJSON: expected object');
    return new DuneMap({
      name:   obj.name,
      width:  obj.width,
      height: obj.height,
      tiles:  Array.isArray(obj.tiles) ? obj.tiles.slice() : null,
    });
  }
}

// ── LOADER ──
// Accepts either a registered map name (string) or a JSON object.
// Map registry lives on window.DUNE_MAPS so test maps and future
// hand-authored maps can be dropped in without touching this file.
const DUNE_MAPS = {};

function duneRegisterMap(name, jsonData){
  DUNE_MAPS[name] = jsonData;
}

function duneLoadMap(source){
  if(typeof source === 'string'){
    const data = DUNE_MAPS[source];
    if(!data) throw new Error('duneLoadMap: unknown map "'+source+'"');
    return DuneMap.fromJSON(data);
  }
  return DuneMap.fromJSON(source);
}

// ── HAND-AUTHORED TEST MAP (64×64) ──
// A canonical Arrakis-style layout: two rock plateaus separated by an open
// sandy basin, mountain ranges along the north/south edges, dune bands cutting
// across the basin, spice fields tucked into the sand, and a couple of
// spice_blows near the centre. Mixes every terrain type so renderers,
// pathfinding, and harvester logic all have something to chew on.
function duneCreateTestMap(){
  const W = 64, H = 64;
  const tiles = new Array(W * H).fill(DUNE_TILE.SAND);
  const set = (x, y, t) => { if(x>=0 && y>=0 && x<W && y<H) tiles[y*W+x] = t; };
  const rect = (x0, y0, x1, y1, t) => {
    for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) set(x, y, t);
  };
  const blob = (cx, cy, r, t) => {
    for(let y = cy-r; y <= cy+r; y++){
      for(let x = cx-r; x <= cx+r; x++){
        const dx = x - cx, dy = y - cy;
        if(dx*dx + dy*dy <= r*r) set(x, y, t);
      }
    }
  };

  // mountain ranges along the top and bottom edges (impassable border)
  rect(0,  0,  W-1, 1,   DUNE_TILE.MOUNTAIN);
  rect(0,  H-2, W-1, H-1, DUNE_TILE.MOUNTAIN);
  // jagged mountain spurs poking into the playfield
  blob(10, 4,  3, DUNE_TILE.MOUNTAIN);
  blob(W-12, 4, 3, DUNE_TILE.MOUNTAIN);
  blob(20, H-6, 3, DUNE_TILE.MOUNTAIN);
  blob(W-22, H-5, 2, DUNE_TILE.MOUNTAIN);

  // two main rock plateaus — buildable bases for two players
  blob(14, 16, 5, DUNE_TILE.ROCK);
  blob(14, 16, 3, DUNE_TILE.ROCK);  // denser core
  blob(W-15, H-17, 5, DUNE_TILE.ROCK);
  blob(W-15, H-17, 3, DUNE_TILE.ROCK);
  // smaller contested rocky outcrops near the middle
  blob(32, 32, 3, DUNE_TILE.ROCK);
  blob(44, 22, 2, DUNE_TILE.ROCK);
  blob(20, 44, 2, DUNE_TILE.ROCK);

  // dune bands across the basin (slow-movement strips)
  for(let x = 6; x < W-6; x++){
    const y = 28 + Math.floor(Math.sin(x*0.25) * 2);
    set(x, y, DUNE_TILE.DUNE);
    set(x, y+1, DUNE_TILE.DUNE);
  }
  for(let x = 6; x < W-6; x++){
    const y = 40 + Math.floor(Math.cos(x*0.22) * 2);
    set(x, y, DUNE_TILE.DUNE);
  }

  // spice fields tucked into open sand
  blob(28, 12, 3, DUNE_TILE.SPICE);
  blob(38, 50, 3, DUNE_TILE.SPICE);
  blob(50, 38, 2, DUNE_TILE.SPICE);
  blob(12, 36, 2, DUNE_TILE.SPICE);

  // spice blows near the centre — high-yield, contested
  set(31, 31, DUNE_TILE.SPICE_BLOW);
  set(32, 31, DUNE_TILE.SPICE_BLOW);
  set(31, 32, DUNE_TILE.SPICE_BLOW);
  set(33, 33, DUNE_TILE.SPICE_BLOW);

  return new DuneMap({ width: W, height: H, tiles, name: 'test-arrakis-64' });
}

// Register the canonical test map under a stable name so other modules
// can load it via `duneLoadMap('test-arrakis-64')`.
duneRegisterMap('test-arrakis-64', duneCreateTestMap().toJSON());
