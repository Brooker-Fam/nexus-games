export function normalizeSeed(seed = Date.now()) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;

  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRng(seed) {
  const nextSeed = (normalizeSeed(seed) + 0x6d2b79f5) >>> 0;
  let value = nextSeed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

  return {
    seed: nextSeed,
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
  };
}

export function createRng(seed = Date.now()) {
  let currentSeed = normalizeSeed(seed);

  return function rng() {
    const next = nextRng(currentSeed);
    currentSeed = next.seed;
    return next.value;
  };
}
