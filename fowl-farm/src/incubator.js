// Incubator: place eggs, advance hatch timers, hatch into birds.
//
// Pure functions over GameState. Slot shape:
//   null  — empty
//   { type: 'chicken'|'goose', startedAt: ms, hatchTimeMs: ms }
//
// hatchTimeMs is snapshotted at placement time so that upgrades purchased
// mid-incubation only affect future eggs, not the one currently cooking.

import { getBirdStats, BIRD_TYPE_KEYS } from './birds.js';
import { FARM_WIDTH, FARM_HEIGHT } from './state.js';

export function effectiveHatchTimeMs(state, type) {
  const base = getBirdStats(type).hatchTimeMs;
  const mult = state.incubatorSpeedMultiplier || 1;
  return Math.max(1000, Math.round(base / mult));
}

export function findEmptySlotIndex(state) {
  for (let i = 0; i < state.incubators.length; i++) {
    if (state.incubators[i] == null) return i;
  }
  return -1;
}

// Try to place an egg of `type` in the first empty slot. Returns the slot
// index on success, or an object with `error` describing why it failed.
export function placeEgg(state, type) {
  if (!BIRD_TYPE_KEYS.includes(type)) {
    return { error: `Unknown egg type: ${type}` };
  }
  if ((state.eggs[type] || 0) <= 0) {
    return { error: `No ${type} eggs in inventory.` };
  }
  if (state.birds.length >= state.coopCapacity) {
    return { error: 'Coop is full — upgrade capacity first.' };
  }
  const slot = findEmptySlotIndex(state);
  if (slot < 0) {
    return { error: 'All incubators are full.' };
  }
  state.eggs[type] -= 1;
  state.incubators[slot] = {
    type,
    startedAt: Date.now(),
    hatchTimeMs: effectiveHatchTimeMs(state, type),
  };
  return { slot };
}

// Cancel an in-progress incubation, returning the egg to inventory. Useful
// if the player changes their mind or wants to clear a slot for a different
// type.
export function cancelIncubation(state, slotIndex) {
  const slot = state.incubators[slotIndex];
  if (!slot) return { error: 'Slot is empty.' };
  state.eggs[slot.type] = (state.eggs[slot.type] || 0) + 1;
  state.incubators[slotIndex] = null;
  return { cancelled: slot.type };
}

export function slotProgress(slot, now = Date.now()) {
  if (!slot) return 0;
  const elapsed = now - slot.startedAt;
  return Math.min(1, Math.max(0, elapsed / slot.hatchTimeMs));
}

export function slotRemainingMs(slot, now = Date.now()) {
  if (!slot) return 0;
  return Math.max(0, slot.hatchTimeMs - (now - slot.startedAt));
}

let _idCounter = 1;
function nextBirdId() {
  return `b-${Date.now().toString(36)}-${(_idCounter++).toString(36)}`;
}

// Plausible position inside the notional farm area. Avoids the very edges so
// sprites the view hoglet renders have a margin.
function pickPosition() {
  const margin = 40;
  return {
    x: Math.round(margin + Math.random() * (FARM_WIDTH - margin * 2)),
    y: Math.round(margin + Math.random() * (FARM_HEIGHT - margin * 2)),
  };
}

// Walk every incubator slot and hatch any whose timer is up. Mutates state in
// place. Returns the list of newly hatched birds (so the UI can flash a
// "🐣 hatched!" toast for each).
export function tickIncubators(state, now = Date.now()) {
  const hatched = [];
  for (let i = 0; i < state.incubators.length; i++) {
    const slot = state.incubators[i];
    if (!slot) continue;
    if (now - slot.startedAt < slot.hatchTimeMs) continue;
    if (state.birds.length >= state.coopCapacity) {
      // Coop full — keep the slot occupied. Player can cancel to recover the
      // egg, or upgrade capacity to make room.
      continue;
    }
    const { x, y } = pickPosition();
    const bird = { id: nextBirdId(), type: slot.type, x, y };
    state.birds.push(bird);
    state.incubators[i] = null;
    state.totalHatched = (state.totalHatched || 0) + 1;
    hatched.push(bird);
  }
  return hatched;
}
