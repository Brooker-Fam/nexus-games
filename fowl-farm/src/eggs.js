// Egg production + collection logic.
//
// Pure functions over GameState. The loop calls produceEggs(state, dt) every
// frame; the UI calls collectEggs(state) on click.

import { BIRD_TYPE_KEYS, getBirdStats } from './birds.js';
import { pendingCapFor } from './state.js';

// Convert a per-minute rate into the fractional-egg accumulation for a given
// frame delta (ms).
function ratePerMs(eggsPerMinute) {
  return eggsPerMinute / 60_000;
}

// Tick egg production forward by dt ms. Mutates state in place and returns
// a small summary of what changed (used by the UI to decide whether to redraw).
export function produceEggs(state, dt) {
  if (dt <= 0) return { changed: false };

  // Count birds per type once for the cap calculation.
  const countsByType = {};
  for (const t of BIRD_TYPE_KEYS) countsByType[t] = 0;
  for (const b of state.birds) {
    if (countsByType[b.type] == null) countsByType[b.type] = 0;
    countsByType[b.type] += 1;
  }

  let anyAdded = false;
  for (const type of BIRD_TYPE_KEYS) {
    const count = countsByType[type] || 0;
    if (count === 0) continue;
    const { eggsPerMinute } = getBirdStats(type);
    const delta = count * ratePerMs(eggsPerMinute) * dt;
    state._eggProgress[type] = (state._eggProgress[type] || 0) + delta;

    // Pull whole eggs out of the accumulator, respecting the cap.
    const whole = Math.floor(state._eggProgress[type]);
    if (whole > 0) {
      const cap = pendingCapFor(state, type);
      const room = Math.max(0, cap - state.pendingEggs[type]);
      const toAdd = Math.min(whole, room);
      if (toAdd > 0) {
        state.pendingEggs[type] += toAdd;
        anyAdded = true;
      }
      // Whether or not we hit the cap, drain the whole portion from the
      // accumulator. Excess eggs at cap are intentionally lost — collect more
      // often to avoid waste.
      state._eggProgress[type] -= whole;
    }
  }

  return { changed: anyAdded };
}

// Move pendingEggs into eggs and credit coins. Returns a summary for the UI.
export function collectEggs(state) {
  const summary = { collected: {}, coinsEarned: 0 };
  for (const type of BIRD_TYPE_KEYS) {
    const pending = state.pendingEggs[type] || 0;
    if (pending <= 0) {
      summary.collected[type] = 0;
      continue;
    }
    const value = getBirdStats(type).eggValue;
    state.eggs[type] = (state.eggs[type] || 0) + pending;
    state.resources.coins += pending * value;
    summary.coinsEarned += pending * value;
    summary.collected[type] = pending;
    state.pendingEggs[type] = 0;
  }
  return summary;
}
