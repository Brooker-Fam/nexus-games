// Upgrade definitions + purchase logic.
//
// Each upgrade has:
//   - key             : identifier matching state.upgrades.<key>
//   - label, describe : UI strings
//   - costAt(level)   : coins required to buy the next level
//   - apply(state)    : mutate state to bump the level + derived value
//   - maxLevel        : optional cap

export const UPGRADES = {
  coopCapacity: {
    key: 'coopCapacity',
    label: 'Coop Capacity',
    describe: (state) =>
      `Make room for ${COOP_PER_LEVEL} more birds (current cap: ${state.coopCapacity}).`,
    costAt(level) {
      return Math.round(50 * Math.pow(1.7, level));
    },
    apply(state) {
      state.upgrades.coopCapacity = (state.upgrades.coopCapacity || 0) + 1;
      state.coopCapacity += COOP_PER_LEVEL;
    },
    maxLevel: Infinity,
  },
  incubatorSpeed: {
    key: 'incubatorSpeed',
    label: 'Incubator Speed',
    describe: (state) => {
      const pct = Math.round((state.incubatorSpeedMultiplier - 1) * 100);
      return `Hatch 10% faster (current bonus: +${pct}%).`;
    },
    costAt(level) {
      return Math.round(75 * Math.pow(1.8, level));
    },
    apply(state) {
      state.upgrades.incubatorSpeed = (state.upgrades.incubatorSpeed || 0) + 1;
      // Each level multiplies the speed by 1.10, so hatch time gets divided
      // by the multiplier. Compounding makes later levels feel meaningful.
      state.incubatorSpeedMultiplier = +(state.incubatorSpeedMultiplier * 1.1).toFixed(4);
    },
    maxLevel: 20,
  },
};

const COOP_PER_LEVEL = 2;

export const UPGRADE_KEYS = Object.keys(UPGRADES);

export function levelOf(state, key) {
  return (state.upgrades && state.upgrades[key]) || 0;
}

export function nextCost(state, key) {
  return UPGRADES[key].costAt(levelOf(state, key));
}

export function canAfford(state, key) {
  const level = levelOf(state, key);
  const max = UPGRADES[key].maxLevel ?? Infinity;
  if (level >= max) return false;
  return (state.resources.coins || 0) >= nextCost(state, key);
}

export function purchase(state, key) {
  if (!UPGRADES[key]) return { error: `Unknown upgrade: ${key}` };
  if (!canAfford(state, key)) return { error: 'Not enough coins.' };
  const cost = nextCost(state, key);
  state.resources.coins -= cost;
  UPGRADES[key].apply(state);
  return { ok: true, cost, key };
}
