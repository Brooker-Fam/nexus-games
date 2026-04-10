// Homestead Wars — Seeded PRNG (Mulberry32)
let _hwSeed = 1;
function hwRandSeed(seed){ _hwSeed = seed | 0; }
function hwRand(){
  _hwSeed |= 0;
  _hwSeed = _hwSeed + 0x6D2B79F5 | 0;
  let t = Math.imul(_hwSeed ^ _hwSeed >>> 15, 1 | _hwSeed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
