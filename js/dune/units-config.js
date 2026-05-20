// ════════════════════════════════════════════════════
//  DUNE — UNIT DATA MODEL
// ════════════════════════════════════════════════════
//
// Data-driven unit roster. To add a new unit type, drop another entry into
// DUNE_UNITS — everything (spawning, rendering, combat, AI) reads from this
// map. Fields:
//
//   name        — display name
//   hp          — starting + max hit points
//   attack      — damage per hit (0 = non-combat)
//   range       — attack range in TILES (1 = adjacent / melee)
//   speed       — tiles per second at base movement cost
//   cost        — spice cost to produce (used by buildings layer when wired up)
//   buildTime   — ticks to produce at 60fps
//   sight       — sight radius in tiles (used for auto-engage scans)
//   cooldown    — ticks between attacks
//   role        — 'infantry' | 'vehicle' | 'harvester'
//   color       — base palette colour (player / enemy versions derive from this)
//   radius      — pixel radius used for rendering and selection hit-tests
//   harvester   — if true, can harvest spice
//   spiceCap    — max spice carried per trip (harvester only)
//   harvestTime — ticks to extract one spice tile (harvester only)
//
// `range = 1` means melee (must be in adjacent tile to attack). Ranges > 1
// allow firing across passable AND impassable terrain (line-of-sight is not
// modelled — keep this game readable).

const DUNE_UNITS = {
  light_infantry: {
    name: 'Light Infantry',
    hp: 25,
    attack: 3,
    range: 1,
    speed: 1.6,
    cost: 60,
    buildTime: 360,
    sight: 5,
    cooldown: 22,
    role: 'infantry',
    color: '#d8d8c8',
    radius: 5,
  },
  trooper: {
    name: 'Trooper',
    hp: 35,
    attack: 6,
    range: 3,
    speed: 1.4,
    cost: 100,
    buildTime: 540,
    sight: 6,
    cooldown: 34,
    role: 'infantry',
    color: '#b890ff',
    radius: 5,
  },
  trike: {
    name: 'Trike',
    hp: 55,
    attack: 5,
    range: 4,
    speed: 3.0,
    cost: 150,
    buildTime: 540,
    sight: 7,
    cooldown: 20,
    role: 'vehicle',
    color: '#ffcc66',
    radius: 7,
  },
  quad: {
    name: 'Quad',
    hp: 120,
    attack: 9,
    range: 3,
    speed: 2.1,
    cost: 200,
    buildTime: 720,
    sight: 6,
    cooldown: 26,
    role: 'vehicle',
    color: '#ff9a3c',
    radius: 8,
  },
  combat_tank: {
    name: 'Combat Tank',
    hp: 300,
    attack: 26,
    range: 5,
    speed: 1.2,
    cost: 300,
    buildTime: 1080,
    sight: 6,
    cooldown: 60,
    role: 'vehicle',
    color: '#7ce0ff',
    radius: 10,
  },
  harvester: {
    name: 'Harvester',
    hp: 600,
    attack: 0,
    range: 0,
    speed: 0.8,
    cost: 300,
    buildTime: 1500,
    sight: 3,
    cooldown: 0,
    role: 'harvester',
    color: '#f0c060',
    radius: 11,
    harvester: true,
    spiceCap: 50,
    harvestTime: 120,   // 2s @ 60fps to extract one tile
  },
};

// Convenience helpers — kept near the data so consumers don't have to know
// the field names.
function duneUnitStat(type, field){
  const cfg = DUNE_UNITS[type];
  return cfg ? cfg[field] : undefined;
}
function duneUnitTypes(){ return Object.keys(DUNE_UNITS); }
