// ════════════════════════════════════════════════════
//  DUNE — TERRAIN TYPES
// ════════════════════════════════════════════════════
// Public string constants so map JSON stays human-readable.
// Other modules (units, buildings, combat) consume DUNE_TILE and
// DUNE_TILE_PROPS. Don't change the string values without updating
// existing map data.

const DUNE_TILE = {
  SAND:       'sand',
  DUNE:       'dune',
  ROCK:       'rock',
  MOUNTAIN:   'mountain',
  SPICE:      'spice',
  SPICE_BLOW: 'spice_blow',
};

const DUNE_TILE_LIST = [
  DUNE_TILE.SAND, DUNE_TILE.DUNE, DUNE_TILE.ROCK,
  DUNE_TILE.MOUNTAIN, DUNE_TILE.SPICE, DUNE_TILE.SPICE_BLOW,
];

// Per-terrain properties.
//   color       — base fill for the tile (also used by minimap)
//   passable    — can ground units enter the tile at all
//   speedMult   — movement-speed multiplier on this tile (1.0 = normal)
//   buildable   — can a structure be placed here
//   spiceYield  — units of spice a harvester can pull per visit (0 = none)
//   accent      — secondary color for subtle texture stippling
const DUNE_TILE_PROPS = {
  sand:       { color:'#d8a55a', accent:'#c89549', passable:true,  speedMult:1.0, buildable:false, spiceYield:0 },
  dune:       { color:'#b8853a', accent:'#a87530', passable:true,  speedMult:0.55, buildable:false, spiceYield:0 },
  rock:       { color:'#6e5a44', accent:'#5a4838', passable:true,  speedMult:1.0, buildable:true,  spiceYield:0 },
  mountain:   { color:'#3a2a1a', accent:'#241810', passable:false, speedMult:0.0, buildable:false, spiceYield:0 },
  spice:      { color:'#e8b94a', accent:'#f5cf66', passable:true,  speedMult:0.85, buildable:false, spiceYield:1 },
  spice_blow: { color:'#ff9e2b', accent:'#ffc24a', passable:true,  speedMult:0.75, buildable:false, spiceYield:3 },
};

function duneTileProps(terrain){
  return DUNE_TILE_PROPS[terrain] || DUNE_TILE_PROPS.sand;
}

function duneIsPassable(terrain){ return duneTileProps(terrain).passable; }
function duneIsBuildable(terrain){ return duneTileProps(terrain).buildable; }
function duneSpeedMult(terrain){ return duneTileProps(terrain).speedMult; }
