// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — BUILDINGS
// ════════════════════════════════════════════════════
//
// Three building types live here (per the P1 user story). Hoglet #4
// (production/combat) plugs unit-spawn logic into `produceUnit`, and
// hoglet #5 (AI) reads/writes via the public helpers below.
//
//   NEXUS    — HQ, 3×3, resource deposit point. One starts on the map.
//   FORGE    — production building, 3×3. produceUnit() stub here.
//   ARCANUM  — tech/upgrade building, 2×2. Placeholder visual only.
//
// Buildings have HP, occupy a footprint of tiles (marked in
// world.occupancy via setBuildingFootprint), and go through a
// CONSTRUCTING → READY state with a progress bar drawn over them.
//
// Public API (window globals):
//   BUILDING            — { NEXUS, FORGE, ARCANUM } string constants
//   BUILDING_CFG        — table of size / hp / build-time / cost / color
//   createBuilding(type, col, row, faction, opts?) → Entity
//   canPlaceBuilding(world, type, col, row)        → boolean
//   placeBuildingFootprint(world, building)        — marks occupancy
//   clearBuildingFootprint(world, building)        — unmarks occupancy
//   damageBuilding(building, amount)               → boolean alive
//   destroyBuilding(world, building)               — removes & unmarks
//   produceUnit(building, unitType)                — stub for hoglet #4
//   isBuilding(ent)                                → boolean
//   isDepositBuilding(ent)                         → boolean
//   nearestDepositBuilding(world, x, y, faction?)  → Entity | null
//   findBuildingAtTile(world, col, row)            → Entity | null

const BUILDING = Object.freeze({
  NEXUS:   'nexus',
  FORGE:   'forge',
  ARCANUM: 'arcanum',
});

// Note on color: Phillip's theme defines per-faction primary/accent colors.
// We default to the neon-cyan family here; the per-building tint is applied
// on top using the faction palette in render. Hoglet #4 can swap these for
// faction-specific buildings later.
const BUILDING_CFG = Object.freeze({
  nexus: {
    label:        'NEXUS',
    size:         3,
    maxHp:        1500,
    buildTimeMs:  15000,
    cost:         { gold: 400, oil: 0 },
    isDeposit:    true,
    isProduction: false,
    isTech:       false,
    primary:      '#9922ff',
    accent:       '#dd88ff',
  },
  forge: {
    label:        'FORGE',
    size:         3,
    maxHp:        900,
    buildTimeMs:  10000,
    cost:         { gold: 200, oil: 50 },
    isDeposit:    false,
    isProduction: true,
    isTech:       false,
    produces:     ['warrior', 'gunbot'],
    primary:      '#ff8800',
    accent:       '#ffcc44',
  },
  arcanum: {
    label:        'ARCANUM',
    size:         2,
    maxHp:        700,
    buildTimeMs:  8000,
    cost:         { gold: 150, oil: 100 },
    isDeposit:    false,
    isProduction: false,
    isTech:       true,
    primary:      '#00ddff',
    accent:       '#aaffff',
  },
});

function isBuilding(ent){
  return !!(ent && ent.type === 'building');
}
function isDepositBuilding(ent){
  if (!isBuilding(ent)) return false;
  const b = ent.components.building;
  return !!(b && b.ready && BUILDING_CFG[b.kind] && BUILDING_CFG[b.kind].isDeposit);
}

// Create a building. If `opts.ready` is true the building is spawned
// fully constructed (used for the starting NEXUS); otherwise it spawns
// at 0% progress and a worker needs to call advanceConstruction().
function createBuilding(type, col, row, faction, opts){
  opts = opts || {};
  const cfg = BUILDING_CFG[type];
  if (!cfg) throw new Error('Unknown building type: ' + type);

  // World-space center: the footprint sits at (col..col+size-1, row..row+size-1).
  const cx = col + (cfg.size - 1) / 2;
  const cy = row + (cfg.size - 1) / 2;
  const center = tileToWorld(cx, cy);

  const ready = !!opts.ready;
  const ent = new Entity({
    type: 'building',
    x: center.x,
    y: center.y,
    components: {
      building: {
        kind:        type,
        faction:     faction || 'shadow',
        col:         col,
        row:         row,
        size:        cfg.size,
        hp:          ready ? cfg.maxHp : Math.floor(cfg.maxHp * 0.1),
        maxHp:       cfg.maxHp,
        ready:       ready,
        progress:    ready ? 1 : 0,
        buildTimeMs: cfg.buildTimeMs,
        // hoglet #4 plugs into this — see produceUnit() below.
        productionQueue: [],
      },
      render: _renderBuilding,
    },
  });
  return ent;
}

// Pure tile-level placement check. Does NOT consider buildings being
// dragged into a worker's path — that's the caller's job. Conditions:
//   - all footprint tiles must exist and be passable GROUND
//   - no footprint tile may be marked occupied in world.occupancy
//   - no resource node may sit on a footprint tile
function canPlaceBuilding(world, type, col, row){
  const cfg = BUILDING_CFG[type];
  if (!cfg) return false;
  for (let dr = 0; dr < cfg.size; dr++){
    for (let dc = 0; dc < cfg.size; dc++){
      const c = col + dc;
      const r = row + dr;
      if (!world.map.inBounds(c, r)) return false;
      const tile = world.map.get(c, r);
      if (!tile || !tile.passable) return false;
      // Buildings sit on flat GROUND only — no high ground.
      if (tile.terrain !== TERRAIN.GROUND) return false;
      if (isTileOccupied(world, c, r)) return false;
    }
  }
  return true;
}

// Occupancy grid lives on world.occupancy (Uint32Array of entity ids).
// 0 = free, otherwise = blocking entity id. Initialized lazily.
function _ensureOccupancy(world){
  if (world.occupancy) return;
  world.occupancy = new Uint32Array(world.map.cols * world.map.rows);
}
function isTileOccupied(world, col, row){
  _ensureOccupancy(world);
  if (!world.map.inBounds(col, row)) return true;
  return world.occupancy[row * world.map.cols + col] !== 0;
}
function occupantAt(world, col, row){
  _ensureOccupancy(world);
  if (!world.map.inBounds(col, row)) return null;
  const id = world.occupancy[row * world.map.cols + col];
  return id ? world.find(id) || null : null;
}
function placeBuildingFootprint(world, building){
  _ensureOccupancy(world);
  const b = building.components.building;
  for (let dr = 0; dr < b.size; dr++){
    for (let dc = 0; dc < b.size; dc++){
      const c = b.col + dc;
      const r = b.row + dr;
      if (world.map.inBounds(c, r)){
        world.occupancy[r * world.map.cols + c] = building.id;
      }
    }
  }
}
function clearBuildingFootprint(world, building){
  _ensureOccupancy(world);
  const b = building.components.building;
  for (let dr = 0; dr < b.size; dr++){
    for (let dc = 0; dc < b.size; dc++){
      const c = b.col + dc;
      const r = b.row + dr;
      if (world.map.inBounds(c, r)){
        if (world.occupancy[r * world.map.cols + c] === building.id){
          world.occupancy[r * world.map.cols + c] = 0;
        }
      }
    }
  }
}

// Advance construction progress by `dt` ms. Returns true if just completed.
function advanceConstruction(building, dt){
  const b = building.components.building;
  if (b.ready) return false;
  const cfg = BUILDING_CFG[b.kind];
  b.progress += dt / cfg.buildTimeMs;
  b.hp       += (cfg.maxHp - Math.floor(cfg.maxHp * 0.1)) * (dt / cfg.buildTimeMs);
  if (b.hp > cfg.maxHp) b.hp = cfg.maxHp;
  if (b.progress >= 1){
    b.progress = 1;
    b.hp       = cfg.maxHp;
    b.ready    = true;
    return true;
  }
  return false;
}

function damageBuilding(building, amount){
  const b = building.components.building;
  b.hp -= amount;
  if (b.hp <= 0){ b.hp = 0; return false; }
  return true;
}

function destroyBuilding(world, building){
  clearBuildingFootprint(world, building);
  world.remove(building);
}

// Stub for hoglet #4. Production buildings should queue and spawn units
// near their footprint. We just stash the unit type and bump a counter;
// hoglet #4 replaces this body or wraps it with a real spawner.
function produceUnit(building, unitType){
  const b = building.components.building;
  if (!b.ready) return false;
  const cfg = BUILDING_CFG[b.kind];
  if (!cfg.isProduction) return false;
  b.productionQueue.push({ unitType: unitType, queuedAt: Date.now() });
  return true;
}

function findBuildingAtTile(world, col, row){
  const ent = occupantAt(world, col, row);
  return isBuilding(ent) ? ent : null;
}

function nearestDepositBuilding(world, x, y, faction){
  let best = null;
  let bestD2 = Infinity;
  for (const e of world.entities){
    if (!isDepositBuilding(e)) continue;
    const b = e.components.building;
    if (faction && b.faction !== faction) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2){ bestD2 = d2; best = e; }
  }
  return best;
}

// ── Render ──────────────────────────────────────────
//
// Buildings render as a square block sitting in iso space: footprint
// outline below, a chunky 3D-ish body, a faction-colored cap, an HP
// bar, and (while constructing) a translucent progress overlay with
// a yellow construction bar.

function _renderBuilding(ctx, ent, cam){
  const b = ent.components.building;
  const cfg = BUILDING_CFG[b.kind];

  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  const sz = b.size;

  // Compute footprint screen corners (back/right/front/left tile centers,
  // then offset to the diamond vertex furthest from the building center).
  const bw = tileToWorld(b.col,              b.row             );
  const rw = tileToWorld(b.col + sz - 1,     b.row             );
  const lw = tileToWorld(b.col,              b.row + sz - 1    );
  const fw = tileToWorld(b.col + sz - 1,     b.row + sz - 1    );
  const back  = worldToScreen(bw.x, bw.y, cam);
  const right = worldToScreen(rw.x, rw.y, cam);
  const left  = worldToScreen(lw.x, lw.y, cam);
  const front = worldToScreen(fw.x, fw.y, cam);

  const topX    = back.x,        topY    = back.y  - hh;
  const rightX  = right.x + hw,  rightY  = right.y;
  const bottomX = front.x,       bottomY = front.y + hh;
  const leftX   = left.x  - hw,  leftY   = left.y;

  // Wireframe footprint (lighter when constructing).
  ctx.beginPath();
  ctx.moveTo(topX,    topY);
  ctx.lineTo(rightX,  rightY);
  ctx.lineTo(bottomX, bottomY);
  ctx.lineTo(leftX,   leftY);
  ctx.closePath();
  ctx.strokeStyle = b.ready ? cfg.primary : 'rgba(255,221,68,0.7)';
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.fillStyle   = b.ready ? 'rgba(2,8,16,0.55)' : 'rgba(2,8,16,0.30)';
  ctx.fill();

  // Building body — only fully rendered when ready. Otherwise we
  // draw a fractional body height scaling with progress, like a
  // building "growing" out of the ground.
  const bodyH = (12 + sz * 14) * (b.ready ? 1 : Math.max(0.05, b.progress));
  const capY  = topY - bodyH;

  // Left wall
  ctx.beginPath();
  ctx.moveTo(leftX,   leftY);
  ctx.lineTo(bottomX, bottomY);
  ctx.lineTo(bottomX, bottomY - bodyH);
  ctx.lineTo(leftX,   leftY   - bodyH);
  ctx.closePath();
  ctx.fillStyle = _isoShadeColor(cfg.primary, -0.55);
  ctx.fill();
  ctx.strokeStyle = 'rgba(2,8,16,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Right wall
  ctx.beginPath();
  ctx.moveTo(rightX,  rightY);
  ctx.lineTo(bottomX, bottomY);
  ctx.lineTo(bottomX, bottomY - bodyH);
  ctx.lineTo(rightX,  rightY  - bodyH);
  ctx.closePath();
  ctx.fillStyle = _isoShadeColor(cfg.primary, -0.35);
  ctx.fill();
  ctx.stroke();

  // Roof diamond
  ctx.beginPath();
  ctx.moveTo(topX,    topY    - bodyH);
  ctx.lineTo(rightX,  rightY  - bodyH);
  ctx.lineTo(bottomX, bottomY - bodyH);
  ctx.lineTo(leftX,   leftY   - bodyH);
  ctx.closePath();
  ctx.fillStyle = b.ready ? cfg.primary : _isoShadeColor(cfg.primary, -0.20);
  ctx.fill();
  ctx.strokeStyle = cfg.accent;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Tech accent: a small lit core on the roof when ready.
  if (b.ready){
    const coreX = (topX + bottomX) / 2;
    const coreY = (topY + bottomY) / 2 - bodyH;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 4 + (b.kind === 'arcanum' ? 2 : 0), 0, Math.PI * 2);
    ctx.fillStyle = cfg.accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(coreX, coreY, 8 + (b.kind === 'arcanum' ? 3 : 0), 0, Math.PI * 2);
    ctx.strokeStyle = cfg.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // HP bar (only when damaged or under construction).
  const hpFrac = b.hp / cfg.maxHp;
  if (b.ready && hpFrac < 1 - 1e-3){
    _drawBar(ctx, (topX + bottomX) / 2 - 30, capY - 10, 60, 5, hpFrac,
             hpFrac > 0.5 ? '#00ff88' : hpFrac > 0.25 ? '#ffcc44' : '#ff0088',
             'rgba(0,0,0,0.55)');
  }

  // Construction progress overlay.
  if (!b.ready){
    _drawBar(ctx, (topX + bottomX) / 2 - 36, capY - 14, 72, 6, b.progress,
             '#ffcc44', 'rgba(0,0,0,0.65)');
    // Tag label
    ctx.font          = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign     = 'center';
    ctx.fillStyle     = '#ffcc44';
    ctx.fillText('BUILDING ' + Math.floor(b.progress * 100) + '%',
                 (topX + bottomX) / 2, capY - 20);
  }
}

function _drawBar(ctx, x, y, w, h, frac, fill, bg){
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, w * frac), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

window.BUILDING                = BUILDING;
window.BUILDING_CFG            = BUILDING_CFG;
window.createBuilding          = createBuilding;
window.canPlaceBuilding        = canPlaceBuilding;
window.placeBuildingFootprint  = placeBuildingFootprint;
window.clearBuildingFootprint  = clearBuildingFootprint;
window.advanceConstruction     = advanceConstruction;
window.damageBuilding          = damageBuilding;
window.destroyBuilding         = destroyBuilding;
window.produceUnit             = produceUnit;
window.isBuilding              = isBuilding;
window.isDepositBuilding       = isDepositBuilding;
window.findBuildingAtTile      = findBuildingAtTile;
window.nearestDepositBuilding  = nearestDepositBuilding;
window.isTileOccupied          = isTileOccupied;
window.occupantAt              = occupantAt;
