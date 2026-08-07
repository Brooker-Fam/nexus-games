// Bird type definitions for Fowl Farm.
//
// Tuned for the foundation hoglet. Chickens are cheap, fast layers; geese are
// slow but yield much more valuable eggs. The view and incubator hoglets will
// read these stats for sprite sizing/hatch timers/upgrade costs, so keep the
// keys stable.

export const BIRD_TYPES = {
  chicken: {
    type: 'chicken',
    label: 'Chicken',
    eggsPerMinute: 1.0,
    hatchTimeMs: 20_000,
    eggValue: 1,
  },
  goose: {
    type: 'goose',
    label: 'Goose',
    eggsPerMinute: 0.4,
    hatchTimeMs: 60_000,
    eggValue: 5,
  },
};

export const BIRD_TYPE_KEYS = Object.keys(BIRD_TYPES);

export function getBirdStats(type) {
  const stats = BIRD_TYPES[type];
  if (!stats) throw new Error(`Unknown bird type: ${type}`);
  return stats;
}
