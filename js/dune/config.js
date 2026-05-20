// ── SPICE WARS · BUILDING TYPES ─────────────────────────────────────────────
// Data-driven building catalog. `produces` lists what becomes available when
// this structure is owned + powered. `prereq` is the set of buildings needed
// before this one can be queued.

(function(){
  const BUILDINGS = {
    construction_yard: {
      key: 'construction_yard',
      name: 'Construction Yard',
      short: 'CY',
      footprint: { w: 2, h: 2 },
      hp: 1200,
      cost: 0,             // not buildable directly
      buildTime: 0,
      power: 0,            // self-powered (Dune II convention) so first build is brisk
      produces: ['concrete', 'wind_trap', 'refinery', 'silo', 'barracks', 'outpost', 'light_factory', 'heavy_factory'],
      prereq: [],
      color: '#d4844a',
      buildable: false,    // can't queue another CY
    },
    concrete: {
      key: 'concrete',
      name: 'Concrete Slab',
      short: 'CN',
      footprint: { w: 1, h: 1 },
      hp: 200,
      cost: 50,
      buildTime: 4,
      power: 0,
      produces: [],
      prereq: ['construction_yard'],
      color: '#9a9a9a',
      allowAnyTerrain: true, // can also place on sand to claim ground
    },
    wind_trap: {
      key: 'wind_trap',
      name: 'Wind Trap',
      short: 'WT',
      footprint: { w: 2, h: 2 },
      hp: 200,
      cost: 150,
      buildTime: 6,
      power: 100,             // produces
      produces: [],
      prereq: ['construction_yard'],
      color: '#5e89c2',
    },
    refinery: {
      key: 'refinery',
      name: 'Refinery',
      short: 'RF',
      footprint: { w: 3, h: 2 },
      hp: 800,
      cost: 400,
      buildTime: 12,
      power: -30,
      produces: [],
      prereq: ['construction_yard', 'wind_trap'],
      color: '#a86530',
      storageBonus: 1000,
      spawnsOnComplete: { unit: 'harvester' },
    },
    silo: {
      key: 'silo',
      name: 'Spice Silo',
      short: 'SI',
      footprint: { w: 1, h: 1 },
      hp: 300,
      cost: 150,
      buildTime: 6,
      power: -5,
      produces: [],
      prereq: ['refinery'],
      color: '#7a7269',
      storageBonus: 1000,
    },
    barracks: {
      key: 'barracks',
      name: 'Barracks',
      short: 'BK',
      footprint: { w: 2, h: 2 },
      hp: 400,
      cost: 300,
      buildTime: 10,
      power: -10,
      produces: ['light_infantry', 'trooper'],
      prereq: ['construction_yard'],
      color: '#8a6b3a',
      producesUnits: true,
    },
    outpost: {
      key: 'outpost',
      name: 'Outpost',
      short: 'OP',
      footprint: { w: 1, h: 1 },
      hp: 500,
      cost: 200,
      buildTime: 8,
      power: -10,
      produces: [],
      prereq: ['construction_yard', 'refinery'],
      color: '#6e8d6c',
    },
    light_factory: {
      key: 'light_factory',
      name: 'Light Factory',
      short: 'LF',
      footprint: { w: 2, h: 2 },
      hp: 500,
      cost: 500,
      buildTime: 14,
      power: -20,
      produces: ['trike', 'quad'],
      prereq: ['refinery', 'outpost'],
      color: '#9c5050',
      producesUnits: true,
    },
    heavy_factory: {
      key: 'heavy_factory',
      name: 'Heavy Factory',
      short: 'HF',
      footprint: { w: 3, h: 2 },
      hp: 600,
      cost: 800,
      buildTime: 20,
      power: -30,
      produces: ['harvester', 'combat_tank'],
      prereq: ['light_factory'],
      color: '#6e3a3a',
      producesUnits: true,
    },
  };

  const BUILD_ORDER = [
    'concrete', 'wind_trap', 'refinery', 'silo',
    'barracks', 'outpost', 'light_factory', 'heavy_factory',
  ];

  // Starting credits / state per side.
  const STARTING = {
    player: { credits: 1500 },
    enemy:  { credits: 1500 },
  };

  // Storage starts at this base, refineries/silos add their storageBonus.
  // Tuned so STARTING.credits fits without clamping.
  const BASE_STORAGE = 2000;

  // Build speed when power is insufficient (fraction of normal).
  const LOW_POWER_BUILD_SCALE = 0.4;

  window.DuneConfig = {
    BUILDINGS,
    BUILD_ORDER,
    STARTING,
    BASE_STORAGE,
    LOW_POWER_BUILD_SCALE,
  };
})();
