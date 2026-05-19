/**
 * Tiny deterministic RNG helpers for reproducible tests and games.
 */

/**
 * @typedef {() => number} Rng
 */

/**
 * @param {string | number | undefined} seed
 * @returns {Rng}
 */
export function createSeededRng(seed = Date.now()){
  let state = hashSeed(String(seed));
  return function rng(){
    // Mulberry32
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string} seed
 * @returns {number}
 */
function hashSeed(seed){
  let h = 2166136261;
  for(let i = 0; i < seed.length; i++){
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
