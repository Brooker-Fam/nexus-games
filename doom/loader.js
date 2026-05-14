// Doom-style level & asset loader.
// Engine-facing API. Format details: see doom/README.md.

const LEVELS_INDEX = [
  { id: 'e1m1', name: 'E1M1: Hangar Echo',    file: 'levels/e1m1.json' },
  { id: 'e1m2', name: 'E1M2: Refinery Pit',   file: 'levels/e1m2.json' },
  { id: 'e1m3', name: 'E1M3: Command Spire',  file: 'levels/e1m3.json' }
];

// Default sprite name and blocking flag per thing type. Engine reads these
// after normalisation so level authors don't have to repeat themselves.
export const THING_DEFAULTS = {
  player_start:        { sprite: null,                 blocking: false, solid: false },
  exit:                { sprite: 'exit_pad',           blocking: false, solid: false },

  enemy_zombie:        { sprite: 'enemy_zombie',       blocking: true,  solid: true, hp: 20 },
  enemy_imp:           { sprite: 'enemy_imp',          blocking: true,  solid: true, hp: 30 },
  enemy_demon:         { sprite: 'enemy_demon',        blocking: true,  solid: true, hp: 60 },

  pickup_health:       { sprite: 'pickup_health',      blocking: false, solid: false, amount: 25 },
  pickup_armor:        { sprite: 'pickup_armor',       blocking: false, solid: false, amount: 50 },
  pickup_ammo:         { sprite: 'pickup_ammo',        blocking: false, solid: false, amount: 20 },
  pickup_shells:       { sprite: 'pickup_shells',      blocking: false, solid: false, amount: 8 },
  pickup_key_red:      { sprite: 'pickup_key_red',     blocking: false, solid: false, key: 'red' },
  pickup_key_blue:     { sprite: 'pickup_key_blue',    blocking: false, solid: false, key: 'blue' },
  pickup_key_yellow:   { sprite: 'pickup_key_yellow',  blocking: false, solid: false, key: 'yellow' },

  weapon_shotgun:      { sprite: 'pickup_shotgun',     blocking: false, solid: false, weapon: 'shotgun' },

  decoration_barrel:   { sprite: 'decoration_barrel',  blocking: true,  solid: true },
  decoration_lamp:     { sprite: 'decoration_lamp',    blocking: false, solid: false, light: 0.9 },
  decoration_pillar:   { sprite: 'decoration_pillar',  blocking: true,  solid: true },
  decoration_corpse:   { sprite: 'decoration_corpse',  blocking: false, solid: false }
};

const TEXTURE_NAMES = [
  'wall_tech', 'wall_panel', 'wall_brick', 'wall_blood', 'wall_exit',
  'door_steel', 'door_red', 'door_blue', 'door_yellow',
  'floor_tile', 'floor_concrete', 'floor_blood',
  'ceiling_gray', 'ceiling_dark'
];

const SPRITE_NAMES = [
  'enemy_zombie', 'enemy_imp', 'enemy_demon',
  'pickup_health', 'pickup_armor', 'pickup_ammo', 'pickup_shells',
  'pickup_key_red', 'pickup_key_blue', 'pickup_key_yellow',
  'pickup_shotgun',
  'decoration_barrel', 'decoration_lamp', 'decoration_pillar', 'decoration_corpse',
  'exit_pad'
];

const WEAPON_NAMES = ['pistol', 'shotgun'];

// Path the loader prepends to all asset URLs. Override with setBasePath()
// if the game is mounted at a sub-route.
let basePath = new URL('./', import.meta.url).pathname;

export function setBasePath(path) {
  basePath = path.endsWith('/') ? path : path + '/';
}

function joinPath(...parts) {
  return parts.join('/').replace(/\/+/g, '/');
}

export async function listLevels() {
  return LEVELS_INDEX.map(l => ({ ...l }));
}

export async function loadAssetManifest() {
  const textures = {};
  for (const n of TEXTURE_NAMES) textures[n] = joinPath(basePath, 'assets/textures', n + '.png');
  const sprites = {};
  for (const n of SPRITE_NAMES)  sprites[n]  = joinPath(basePath, 'assets/sprites',  n + '.png');
  const weapons = {};
  for (const n of WEAPON_NAMES)  weapons[n]  = joinPath(basePath, 'assets/weapons',  n + '.png');
  return { textures, sprites, weapons };
}

export async function loadLevel(id) {
  const entry = LEVELS_INDEX.find(l => l.id === id);
  if (!entry) throw new Error(`Unknown level id: ${id}`);
  const url = joinPath(basePath, entry.file);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const raw = await res.json();
  const v = validateLevel(raw);
  if (!v.ok) throw new Error(`Invalid level ${id}: ${v.errors.join('; ')}`);
  return normaliseLevel(raw, id);
}

export function validateLevel(level) {
  const errors = [];
  const warnings = [];
  if (!level || typeof level !== 'object') {
    return { ok: false, errors: ['level is not an object'], warnings };
  }
  if (typeof level.width !== 'number' || level.width <= 0)  errors.push('width must be a positive number');
  if (typeof level.height !== 'number' || level.height <= 0) errors.push('height must be a positive number');
  if (!Array.isArray(level.cells)) errors.push('cells must be a 2D array');
  else if (level.cells.length !== level.height) errors.push(`cells has ${level.cells.length} rows, expected ${level.height}`);
  else {
    for (let y = 0; y < level.cells.length; y++) {
      const row = level.cells[y];
      if (!Array.isArray(row) || row.length !== level.width) {
        errors.push(`cells row ${y} has length ${row && row.length}, expected ${level.width}`);
        break;
      }
    }
  }
  if (!level.wallTextures || typeof level.wallTextures !== 'object') {
    warnings.push('wallTextures is missing — engine will use a default skin');
  }
  if (!Array.isArray(level.things)) errors.push('things must be an array');
  else {
    const starts = level.things.filter(t => t && t.type === 'player_start');
    if (starts.length === 0) errors.push('no player_start thing found');
    if (starts.length > 1)   warnings.push(`${starts.length} player_start things — first one wins`);
  }
  if (!level.floor || !level.floor.texture)     warnings.push('floor.texture missing — using default');
  if (!level.ceiling || !level.ceiling.texture) warnings.push('ceiling.texture missing — using default');

  return { ok: errors.length === 0, errors, warnings };
}

function normaliseLevel(level, id) {
  const things = (level.things || []).map(t => {
    const defaults = THING_DEFAULTS[t.type] || { sprite: null, blocking: false, solid: false };
    return {
      ...defaults,
      ...t,
      sprite: t.sprite ?? defaults.sprite,
      blocking: t.blocking ?? defaults.blocking,
      angle: t.angle ?? 0
    };
  });
  const playerStart = things.find(t => t.type === 'player_start') || { x: 1.5, y: 1.5, angle: 0 };
  const exit        = things.find(t => t.type === 'exit') || null;

  return {
    id,
    name: level.name || id,
    description: level.description || '',
    width: level.width,
    height: level.height,
    tileset: level.tileset || 'tech',
    floor:   level.floor   || { texture: 'floor_tile',   light: 0.5 },
    ceiling: level.ceiling || { texture: 'ceiling_gray', light: 0.4 },
    cells: level.cells,
    wallTextures: level.wallTextures || { '1': 'wall_tech' },
    doors: level.doors || [],
    things,
    playerStart: { x: playerStart.x, y: playerStart.y, angle: playerStart.angle || 0 },
    exit
  };
}

// Convenience: tile lookup with bounds check.
export function tileAt(level, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= level.width || cy >= level.height) return -1;
  return level.cells[cy][cx];
}

// Convenience: is this cell blocking (wall or closed door)?
export function isBlocking(level, x, y) {
  const t = tileAt(level, x, y);
  if (t < 0) return true;          // out of bounds
  if (t === 0) return false;        // air
  return true;                      // any positive id is a wall/door
}
