// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — FOG OF WAR
// ════════════════════════════════════════════════════
//
// Three visibility states per tile, mirroring the GameMap dimensions:
//   0 = UNEXPLORED — never seen; terrain + entities all hidden
//   1 = EXPLORED   — was seen previously; terrain dimmed, enemies hidden
//   2 = VISIBLE    — a friendly entity is currently within vision range
//
// Public API (added to the foundation contract — see docs/rts-2d-theme.md):
//
//   FOG                — { UNEXPLORED, EXPLORED, VISIBLE } numeric consts
//   class FogOfWar
//     new FogOfWar(map)              — empty grid sized to the map
//     .update(dt, world)             — system-style; recomputes vision
//     .recompute(world)              — force a recompute now
//     .stateAt(col, row) → 0|1|2
//     .isVisible(col, row) → boolean
//     .isExplored(col, row) → boolean (includes VISIBLE)
//     .isVisibleWorld(wx, wy) → boolean
//     .markDirty()                   — force a recompute on next tick
//     .setFriendlyPredicate(fn)      — override what counts as "friendly"
//     .setRecomputeInterval(ms)      — default 100ms (10 Hz)
//
// "Friendly" convention (other hoglets — please follow):
//   entity.components.faction === world.playerFaction
//     → friendly
//   entity.components.owner === 'player'
//     → friendly (legacy fallback when faction is not set)
//   anything else
//     → enemy (filtered out unless on a VISIBLE tile)
//
// Vision sources:
//   entity.components.visionRange  (in tiles; integer or float)
//   entity.components.visionShape  optional 'circle' (default) | 'diamond'
//
// Rendering integration (the foundation wrapping):
//   isoRender(ctx, world, cam) is wrapped to:
//     1. clear background
//     2. drawIsoMap
//     3. drawWorld  (now filters entities with .components.hidden === true)
//     4. drawFogOverlay  (this file)
//   The fog system flags enemy entities on non-VISIBLE tiles as
//   .components.hidden = true so they are skipped by drawWorld.
//
// Demo entities: until the units / structures hoglets land their own
// spawning, we drop a small friendly + enemy set in so the fog system is
// actually observable when the tab loads. See _fogDemoSpawn().

const FOG = Object.freeze({
  UNEXPLORED: 0,
  EXPLORED:   1,
  VISIBLE:    2,
});

// Fill style for tiles in each non-visible state. VISIBLE tiles draw no
// overlay. Numbers chosen to match docs/rts-2d-theme.md §1 (terrain stays
// readable on dimmed tiles, fully opaque on unexplored).
const FOG_STYLE = Object.freeze({
  unexploredFill: 'rgba(2, 8, 16, 1.00)',   // matches --bg-deep
  exploredFill:   'rgba(2, 8, 16, 0.60)',   // 60% dim
});

class FogOfWar {
  constructor(map){
    this.map  = map;
    this.cols = map.cols;
    this.rows = map.rows;
    this.grid = new Uint8Array(this.cols * this.rows);
    this._recomputeIntervalMs = 100;
    this._sinceRecompute      = Infinity;   // force first-tick recompute
    this._friendlyPredicate   = null;       // null = use default convention
  }

  // ── Configuration ──────────────────────────────────
  setFriendlyPredicate(fn){ this._friendlyPredicate = fn; }
  setRecomputeInterval(ms){ this._recomputeIntervalMs = Math.max(0, ms|0); }
  markDirty(){ this._sinceRecompute = Infinity; }

  // ── Queries ────────────────────────────────────────
  stateAt(col, row){
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return FOG.UNEXPLORED;
    return this.grid[row * this.cols + col];
  }
  isVisible(col, row){  return this.stateAt(col, row) === FOG.VISIBLE; }
  isExplored(col, row){ return this.stateAt(col, row) !== FOG.UNEXPLORED; }

  isVisibleWorld(wx, wy){
    const t = worldToTile(wx, wy);
    return this.isVisible(t.col, t.row);
  }

  // ── System interface ───────────────────────────────
  // Called by World.update() each frame. Throttles to recomputeInterval.
  update(dt, world){
    this._sinceRecompute += dt;
    if (this._sinceRecompute < this._recomputeIntervalMs) return;
    this._sinceRecompute = 0;
    this.recompute(world);
  }

  recompute(world){
    const g = this.grid;
    // 1. Demote every currently-VISIBLE tile to EXPLORED. The re-mark
    //    pass below promotes anything still in vision back to VISIBLE.
    for (let i = 0; i < g.length; i++){
      if (g[i] === FOG.VISIBLE) g[i] = FOG.EXPLORED;
    }

    // 2. Walk friendly entities, mark vision footprints.
    const ents = world.entities;
    for (let i = 0; i < ents.length; i++){
      const e = ents[i];
      if (!this._isFriendly(e, world)) continue;
      const range = (e.components && e.components.visionRange) || 0;
      if (range <= 0) continue;
      const t = worldToTile(e.x, e.y);
      const shape = (e.components && e.components.visionShape) || 'circle';
      this._revealShape(t.col, t.row, range, shape);
    }

    // 3. Flag enemy entities on non-VISIBLE tiles as hidden. drawWorld
    //    (wrapped below) skips entities with .components.hidden === true.
    for (let i = 0; i < ents.length; i++){
      const e = ents[i];
      if (!e.components) e.components = {};
      if (this._isFriendly(e, world)){
        e.components.hidden = false;
        continue;
      }
      const t = worldToTile(e.x, e.y);
      e.components.hidden = !this.isVisible(t.col, t.row);
    }
  }

  // ── Internals ──────────────────────────────────────
  _isFriendly(entity, world){
    if (this._friendlyPredicate) return !!this._friendlyPredicate(entity, world);
    const c = entity.components || {};
    if (world && world.playerFaction && c.faction){
      return c.faction === world.playerFaction;
    }
    if (c.owner != null) return c.owner === 'player';
    // Fail-open: an entity with no owner/faction is treated as friendly so
    // placeholder entities from collaborators don't vanish into the fog.
    return true;
  }

  // Mark tiles inside a vision footprint as VISIBLE.
  // shape: 'circle' (Euclidean) or 'diamond' (Manhattan / iso-aligned).
  // Plumbed for future LOS expansion — replace this with a raycast.
  _revealShape(col, row, range, shape){
    const r = range;
    const minC = Math.max(0, Math.floor(col - r));
    const maxC = Math.min(this.cols - 1, Math.ceil(col + r));
    const minR = Math.max(0, Math.floor(row - r));
    const maxR = Math.min(this.rows - 1, Math.ceil(row + r));
    const r2 = r * r;
    for (let rr = minR; rr <= maxR; rr++){
      for (let cc = minC; cc <= maxC; cc++){
        const dc = cc - col;
        const dr = rr - row;
        const inside = (shape === 'diamond')
          ? (Math.abs(dc) + Math.abs(dr) <= r)
          : (dc*dc + dr*dr <= r2);
        if (inside){
          this.grid[rr * this.cols + cc] = FOG.VISIBLE;
        }
      }
    }
  }
}

// ──────────────────────────────────────────────────────
//  RENDER OVERLAY
// ──────────────────────────────────────────────────────

function _fillIsoDiamond(ctx, x, y, fill){
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  ctx.beginPath();
  ctx.moveTo(x,      y - hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x,      y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Paint a translucent (or opaque) diamond over every tile that isn't
// currently in the VISIBLE state. Same tile-culling math as drawIsoMap.
function drawFogOverlay(ctx, world, cam, fog){
  if (!fog) return;
  const map = world.map;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  const corners = [
    screenToTile(0, 0, cam),
    screenToTile(W, 0, cam),
    screenToTile(0, H, cam),
    screenToTile(W, H, cam),
  ];
  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  for (const c of corners){
    if (c.col < minCol) minCol = c.col;
    if (c.col > maxCol) maxCol = c.col;
    if (c.row < minRow) minRow = c.row;
    if (c.row > maxRow) maxRow = c.row;
  }
  minCol = Math.max(0, minCol - 2);
  minRow = Math.max(0, minRow - 2);
  maxCol = Math.min(map.cols - 1, maxCol + 2);
  maxRow = Math.min(map.rows - 1, maxRow + 2);

  for (let r = minRow; r <= maxRow; r++){
    for (let c = minCol; c <= maxCol; c++){
      const state = fog.stateAt(c, r);
      if (state === FOG.VISIBLE) continue;
      const w = tileToWorld(c, r);
      const s = worldToScreen(w.x, w.y, cam);
      const fill = (state === FOG.UNEXPLORED) ? FOG_STYLE.unexploredFill : FOG_STYLE.exploredFill;
      _fillIsoDiamond(ctx, s.x, s.y, fill);
    }
  }
}

// ──────────────────────────────────────────────────────
//  FOUNDATION INTEGRATION
// ──────────────────────────────────────────────────────

// drawWorld wrapper: filter entities flagged hidden by the fog system.
// Other hoglets that wrap drawWorld should preserve this filter.
const _origDrawWorld = window.drawWorld;
window.drawWorld = function fogAwareDrawWorld(ctx, world, cam){
  if (!world.entities.length) return;
  const visible = world.entities.filter(e => !(e.components && e.components.hidden));
  if (!visible.length) return;
  const swap = world.entities;
  world.entities = visible;
  try { _origDrawWorld(ctx, world, cam); }
  finally { world.entities = swap; }
};

// isoRender wrapper: paint the fog overlay after entities.
const _origIsoRender = window.isoRender;
window.isoRender = function fogAwareIsoRender(ctx, world, cam){
  _origIsoRender(ctx, world, cam);
  if (world && world._fog){
    drawFogOverlay(ctx, world, cam, world._fog);
  }
};

// ──────────────────────────────────────────────────────
//  INSTALLER — called by game.js after isoSpawnMatch
// ──────────────────────────────────────────────────────
//
// Integration with Christian's entity model:
//   ent.side?.id === 'player'  → friendly
//   ent.kind === 'building'    → wide stationary vision
//   ent.kind === 'unit'        → per-type vision range
function isoInstallFog(world, playerSide){
  if (!world || world._fog) return world && world._fog;
  const fog = new FogOfWar(world.map);
  fog.setFriendlyPredicate((ent) => {
    if (!ent || !ent.side) return false;
    return ent.side === playerSide || ent.side.id === 'player';
  });
  // Christian's entities don't carry visionRange themselves — derive one.
  const origRecompute = fog.recompute.bind(fog);
  fog.recompute = function(w){
    const ents = w.entities;
    for (let i = 0; i < ents.length; i++){
      const e = ents[i];
      if (!e.components) e.components = {};
      if (e.components.visionRange != null) continue;
      if (e.kind === 'building'){
        e.components.visionRange = e.type === ISO_TYPE.HQ ? 9 : 6;
        e.components.visionShape = 'circle';
      } else if (e.kind === 'unit'){
        e.components.visionRange = e.type === ISO_TYPE.WORKER ? 5 : 7;
      }
    }
    origRecompute(w);
  };
  world._fog = fog;
  world.systems.push(fog);
  fog.recompute(world);
  return fog;
}

// ──────────────────────────────────────────────────────
//  Vanilla-JS globals (matches the rest of the iso/ files).
// ──────────────────────────────────────────────────────
window.FOG             = FOG;
window.FOG_STYLE       = FOG_STYLE;
window.FogOfWar        = FogOfWar;
window.drawFogOverlay  = drawFogOverlay;
window.isoInstallFog   = isoInstallFog;
