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

// Re-register the iso game so we can install the FogOfWar system on
// start and (until other hoglets land entity spawning) seed demo
// friendlies + enemies. registerGame() just overwrites the entry; the
// old init/cleanup are equivalent to plain isoStart()/isoStop().
registerGame('iso', {
  init(){
    isoStart();
    const w = ISO_GAME && ISO_GAME.world;
    if (!w || w._fog) return;
    if (!w.playerFaction) w.playerFaction = 'prism';
    const fog = new FogOfWar(w.map);
    w._fog = fog;
    w.systems.push(fog);
    if (w.entities.length === 0) _fogDemoSpawn(w);
    fog.recompute(w);
  },
  cleanup(){ isoStop(); },
});

// ──────────────────────────────────────────────────────
//  DEMO ENTITIES
// ──────────────────────────────────────────────────────
//
// Visible until the units / structures hoglets land their own spawning.
// Once any entity is added at start, this is skipped (see init() above).

function _fogDemoSpawn(world){
  // Friendly HQ (Prism armada) — large vision, near spawn pocket.
  const hqTile = tileToWorld(2, 2);
  world.add(new Entity({
    type: 'hq',
    x: hqTile.x, y: hqTile.y,
    components: {
      faction: 'prism',
      owner: 'player',
      visionRange: 8,
      render: _drawDemoStructure,
      _label: 'HQ',
    },
  }));

  // Friendly scout — smaller vision, a bit out into the field.
  const scoutTile = tileToWorld(4, 4);
  world.add(new Entity({
    type: 'scout',
    x: scoutTile.x, y: scoutTile.y,
    components: {
      faction: 'prism',
      owner: 'player',
      visionRange: 5,
      render: _drawDemoUnit,
    },
  }));

  // Enemy units far away — should be hidden behind unexplored fog.
  const e1 = tileToWorld(28, 30);
  world.add(new Entity({
    type: 'enemy',
    x: e1.x, y: e1.y,
    components: {
      faction: 'shadow',
      owner: 'ai',
      visionRange: 0,
      render: _drawDemoEnemy,
    },
  }));
  const e2 = tileToWorld(35, 18);
  world.add(new Entity({
    type: 'enemy',
    x: e2.x, y: e2.y,
    components: {
      faction: 'shadow',
      owner: 'ai',
      visionRange: 0,
      render: _drawDemoEnemy,
    },
  }));

  // Click-to-move on the friendly scout so the demo is interactive:
  // moving the scout into unexplored territory clears the fog.
  _wireDemoScoutMovement(world);
}

function _drawDemoStructure(ctx, ent, cam){
  const s = worldToScreen(ent.x, ent.y, cam);
  ctx.save();
  ctx.fillStyle   = '#00ddff';
  ctx.strokeStyle = '#aaffff';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.rect(s.x - 12, s.y - 16, 24, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#020810';
  ctx.font      = '700 9px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HQ', s.x, s.y - 2);
  ctx.restore();
}

function _drawDemoUnit(ctx, ent, cam){
  const s = worldToScreen(ent.x, ent.y, cam);
  ctx.save();
  ctx.fillStyle   = '#88ccff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function _drawDemoEnemy(ctx, ent, cam){
  const s = worldToScreen(ent.x, ent.y, cam);
  ctx.save();
  ctx.fillStyle   = '#9922ff';
  ctx.strokeStyle = '#dd88ff';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Minimal click-to-move so reviewers can drive the scout around and
// watch fog clear. Once the units / pathfinding hoglets land, they'll
// own input and this can be deleted.
function _wireDemoScoutMovement(world){
  const canvas = document.getElementById('iso-canvas');
  if (!canvas || canvas._fogDemoWired) return;
  canvas._fogDemoWired = true;
  canvas.addEventListener('click', (e) => {
    if (!ISO_GAME.running) return;
    const w2 = ISO_GAME.world;
    if (!w2) return;
    const scout = w2.entities.find(en => en.type === 'scout');
    if (!scout) return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const { col, row } = screenToTile(sx, sy, ISO_GAME.camera);
    if (!w2.map.inBounds(col, row)) return;
    if (!w2.map.isPassable(col, row)) return;
    const p = tileToWorld(col, row);
    scout.x = p.x;
    scout.y = p.y;
    if (w2._fog) w2._fog.markDirty();
  });
}

// ──────────────────────────────────────────────────────
//  Vanilla-JS globals (matches the rest of the iso/ files).
// ──────────────────────────────────────────────────────
window.FOG             = FOG;
window.FOG_STYLE       = FOG_STYLE;
window.FogOfWar        = FogOfWar;
window.drawFogOverlay  = drawFogOverlay;
