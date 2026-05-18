// ════════════════════════════════════════════════════
//  DUNE — PROCEDURAL MAP GENERATOR
// ════════════════════════════════════════════════════
// Builds an Arrakis-style map: a sandy basin dotted with rocky outcrops
// (buildable plateaus), dune drifts (slow movement), spice fields in the
// open sand, the occasional spice_blow, and mountains as the impassable
// frame. Deterministic given a seed so two clients in a future multiplayer
// session can produce identical maps from the same seed.

// Tiny seeded RNG (mulberry32). Returns float in [0, 1).
function _duneMakeRng(seed){
  let s = (seed | 0) || 0xCAFEFACE;
  return function(){
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function duneGenerateMap(opts){
  const cfg = Object.assign({
    width: 64,
    height: 64,
    seed: Math.floor(Math.random() * 1e9),
    rockOutcrops: 6,       // major buildable plateaus
    rockMinR: 2,
    rockMaxR: 5,
    duneBands: 3,          // sinusoidal dune drifts
    spiceFields: 6,        // small clumps of harvestable spice
    spiceBlows: 3,         // dense high-yield clumps
    mountainBorder: 2,     // thickness of impassable edge
    name: null,
  }, opts || {});

  const W = cfg.width, H = cfg.height;
  const rng = _duneMakeRng(cfg.seed);
  const tiles = new Array(W * H).fill(DUNE_TILE.SAND);
  const set = (x, y, t) => { if(x >= 0 && y >= 0 && x < W && y < H) tiles[y*W+x] = t; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? tiles[y*W+x] : null;

  const blob = (cx, cy, r, t) => {
    const r2 = r*r;
    for(let y = cy-r; y <= cy+r; y++){
      for(let x = cx-r; x <= cx+r; x++){
        const dx = x - cx, dy = y - cy;
        // soft edge: tiles right at the radius drop out ~30% of the time
        const d2 = dx*dx + dy*dy;
        if(d2 <= r2 && (d2 < r2 * 0.7 || rng() > 0.3)) set(x, y, t);
      }
    }
  };

  const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

  // 1. Mountain frame — chunky border so the playable area has a hard edge.
  for(let y = 0; y < H; y++){
    for(let x = 0; x < W; x++){
      const edgeDist = Math.min(x, y, W-1-x, H-1-y);
      if(edgeDist < cfg.mountainBorder) set(x, y, DUNE_TILE.MOUNTAIN);
    }
  }

  // 2. Scattered mountain spurs jutting in from the edges.
  const spurs = Math.max(2, Math.floor((W + H) / 32));
  for(let i = 0; i < spurs; i++){
    const side = i % 4;
    let cx, cy;
    if(side === 0){ cx = randInt(4, W-5); cy = randInt(cfg.mountainBorder, cfg.mountainBorder + 3); }
    else if(side === 1){ cx = randInt(4, W-5); cy = randInt(H - cfg.mountainBorder - 4, H - cfg.mountainBorder - 1); }
    else if(side === 2){ cx = randInt(cfg.mountainBorder, cfg.mountainBorder + 3); cy = randInt(4, H-5); }
    else { cx = randInt(W - cfg.mountainBorder - 4, W - cfg.mountainBorder - 1); cy = randInt(4, H-5); }
    blob(cx, cy, randInt(1, 3), DUNE_TILE.MOUNTAIN);
  }

  // 3. Rocky outcrops — placed away from each other so each becomes a real base option.
  const placedRocks = [];
  const minSep = Math.max(6, Math.min(W, H) / cfg.rockOutcrops);
  let attempts = 0;
  while(placedRocks.length < cfg.rockOutcrops && attempts < cfg.rockOutcrops * 30){
    attempts++;
    const r = randInt(cfg.rockMinR, cfg.rockMaxR);
    const cx = randInt(r + cfg.mountainBorder + 1, W - r - cfg.mountainBorder - 2);
    const cy = randInt(r + cfg.mountainBorder + 1, H - r - cfg.mountainBorder - 2);
    let ok = true;
    for(const p of placedRocks){
      const dx = p.cx - cx, dy = p.cy - cy;
      if(Math.sqrt(dx*dx + dy*dy) < minSep) { ok = false; break; }
    }
    if(!ok) continue;
    blob(cx, cy, r, DUNE_TILE.ROCK);
    // dense core so the centre is reliably buildable
    blob(cx, cy, Math.max(1, r - 2), DUNE_TILE.ROCK);
    placedRocks.push({ cx, cy, r });
  }

  // 4. Dune bands — slow-movement drifts running across the map.
  for(let b = 0; b < cfg.duneBands; b++){
    const baseY = randInt(8, H - 8);
    const amp = randInt(1, 3);
    const freq = 0.15 + rng() * 0.2;
    const phase = rng() * Math.PI * 2;
    const thick = randInt(1, 2);
    for(let x = cfg.mountainBorder + 1; x < W - cfg.mountainBorder - 1; x++){
      const y = baseY + Math.round(Math.sin(x * freq + phase) * amp);
      for(let dy = 0; dy < thick; dy++){
        // only paint over sand — don't overwrite rock or mountain
        if(get(x, y+dy) === DUNE_TILE.SAND) set(x, y+dy, DUNE_TILE.DUNE);
      }
    }
  }

  // 5. Spice fields — small clumps, only on open sand.
  for(let i = 0; i < cfg.spiceFields; i++){
    const cx = randInt(4, W-5);
    const cy = randInt(4, H-5);
    if(get(cx, cy) !== DUNE_TILE.SAND) continue;
    const r = randInt(2, 3);
    for(let y = cy-r; y <= cy+r; y++){
      for(let x = cx-r; x <= cx+r; x++){
        const dx = x-cx, dy = y-cy;
        if(dx*dx + dy*dy <= r*r && get(x, y) === DUNE_TILE.SAND && rng() > 0.25){
          set(x, y, DUNE_TILE.SPICE);
        }
      }
    }
  }

  // 6. Spice blows — dense high-yield patches, also only on sand.
  for(let i = 0; i < cfg.spiceBlows; i++){
    const cx = randInt(6, W-7);
    const cy = randInt(6, H-7);
    if(get(cx, cy) !== DUNE_TILE.SAND && get(cx, cy) !== DUNE_TILE.SPICE) continue;
    const r = randInt(1, 2);
    for(let y = cy-r; y <= cy+r; y++){
      for(let x = cx-r; x <= cx+r; x++){
        const dx = x-cx, dy = y-cy;
        const t = get(x, y);
        if(dx*dx + dy*dy <= r*r && (t === DUNE_TILE.SAND || t === DUNE_TILE.SPICE)){
          set(x, y, DUNE_TILE.SPICE_BLOW);
        }
      }
    }
  }

  return new DuneMap({
    width: W, height: H, tiles,
    name: cfg.name || ('arrakis-seed-'+cfg.seed),
  });
}
