// GameState model + localStorage persistence.
//
// The GameState shape is the single source of truth shared between the loop,
// UI, and (in follow-up hoglets) the farm view and incubator panel. Keep this
// module pure-data: no DOM, no rAF, no side effects beyond localStorage.

import { BIRD_TYPE_KEYS } from './birds.js';

export const SAVE_KEY = 'fowlFarm:v1';
export const STATE_VERSION = 1;

// Notional farm-area size used to place starting birds. The farm-view hoglet
// can keep this coordinate space or scale it for its canvas.
export const FARM_WIDTH = 600;
export const FARM_HEIGHT = 400;

// Pending-egg cap per type. Documented so the UI can warn the player and so
// the incubator hoglet can decide when collection is mandatory.
//
// Cap = max(20, birdsOfType * 5). Players with a large flock should still be
// rewarded for checking back, but we don't want infinite accumulation.
export function pendingCapFor(state, type) {
  const birds = state.birds.filter((b) => b.type === type).length;
  return Math.max(20, birds * 5);
}

let _idCounter = 1;
function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(_idCounter++).toString(36)}`;
}

function makeBird(type, x, y) {
  return { id: nextId('b'), type, x, y };
}

// Deterministic-ish scatter inside the notional farm area.
function scatter(i, total) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
  const col = i % cols;
  const row = Math.floor(i / cols);
  const cellW = FARM_WIDTH / (cols + 1);
  const cellH = FARM_HEIGHT / (cols + 1);
  return {
    x: Math.round(cellW * (col + 1)),
    y: Math.round(cellH * (row + 1)),
  };
}

export function createNewGame() {
  const starters = [
    { type: 'chicken' },
    { type: 'chicken' },
    { type: 'goose' },
  ];
  const birds = starters.map((b, i) => {
    const { x, y } = scatter(i, starters.length);
    return makeBird(b.type, x, y);
  });

  return {
    version: STATE_VERSION,
    birds,
    eggs: zeroByType(),
    pendingEggs: zeroByType(),
    incubators: [null, null], // 2 empty slots
    coopCapacity: 6,
    incubatorSlots: 2,
    incubatorSpeedMultiplier: 1,
    lastTickAt: Date.now(),
    resources: { coins: 0 },
    // Internal: fractional egg progress per bird type. Not persisted across
    // refreshes — we accept up to ~1 lost egg per type per session boundary.
    _eggProgress: zeroByType(),
  };
}

function zeroByType() {
  const out = {};
  for (const k of BIRD_TYPE_KEYS) out[k] = 0;
  return out;
}

// ---------- persistence ----------

export function saveState(state) {
  try {
    const snapshot = serialize(state);
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    console.warn('[fowl-farm] failed to save state:', err);
    return false;
  }
}

export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (err) {
    console.warn('[fowl-farm] localStorage unavailable, starting fresh:', err);
    return createNewGame();
  }
  if (!raw) return createNewGame();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[fowl-farm] corrupted save, starting fresh:', err);
    return createNewGame();
  }

  if (!parsed || parsed.version !== STATE_VERSION) {
    console.warn(
      `[fowl-farm] save version mismatch (got ${parsed && parsed.version}, expected ${STATE_VERSION}); starting fresh`,
    );
    return createNewGame();
  }

  return hydrate(parsed);
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn('[fowl-farm] failed to clear save:', err);
  }
}

// Strip transient fields before writing to disk. _eggProgress is intentionally
// dropped — v1 doesn't do offline catch-up, and we don't want a stale
// accumulator surprising the player after a long absence.
function serialize(state) {
  return {
    version: state.version,
    birds: state.birds,
    eggs: state.eggs,
    pendingEggs: state.pendingEggs,
    incubators: state.incubators,
    coopCapacity: state.coopCapacity,
    incubatorSlots: state.incubatorSlots,
    incubatorSpeedMultiplier: state.incubatorSpeedMultiplier,
    resources: state.resources,
    // lastTickAt is intentionally omitted; we reset it on load.
  };
}

function hydrate(parsed) {
  const fresh = createNewGame();
  const merged = {
    ...fresh,
    ...parsed,
    eggs: { ...fresh.eggs, ...(parsed.eggs || {}) },
    pendingEggs: { ...fresh.pendingEggs, ...(parsed.pendingEggs || {}) },
    resources: { ...fresh.resources, ...(parsed.resources || {}) },
    incubators: Array.isArray(parsed.incubators) ? parsed.incubators : fresh.incubators,
    birds: Array.isArray(parsed.birds) && parsed.birds.length ? parsed.birds : fresh.birds,
    lastTickAt: Date.now(), // v1: no offline catch-up
    _eggProgress: zeroByType(),
  };
  return merged;
}

// ---------- debounced auto-save ----------

let _saveTimer = null;
const SAVE_DEBOUNCE_MS = 5000;

export function scheduleAutoSave(state) {
  if (_saveTimer != null) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveState(state);
  }, SAVE_DEBOUNCE_MS);
}

export function flushSave(state) {
  if (_saveTimer != null) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  saveState(state);
}
