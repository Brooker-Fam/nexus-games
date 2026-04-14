// ── SEEDED PRNG (Mulberry32) ──
// Deterministic random for lockstep multiplayer.
// Simulation code uses rtsRand(). Rendering can use Math.random().

let _rtsSeed = 1;
function rtsRandSeed(seed){ _rtsSeed = seed | 0; }
function rtsRand(){
  _rtsSeed |= 0;
  _rtsSeed = _rtsSeed + 0x6D2B79F5 | 0;
  let t = Math.imul(_rtsSeed ^ _rtsSeed >>> 15, 1 | _rtsSeed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

//# sourceMappingURL=rng.js.map
