// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — RENDERER
// ════════════════════════════════════════════════════
//
// Rendering choice: raw HTML5 Canvas 2D context.
//
// Why not PixiJS / Phaser?
//   1. The rest of the repo is vanilla JS with zero build step and no
//      npm runtime dependencies (see package.json + docs/architecture.md).
//   2. Adding a 100–300 KB library for a foundation-level scaffold would
//      double the site's payload and force a CDN load on first paint.
//   3. Canvas 2D is plenty fast for a 32x32 / 48x48 isometric tile grid
//      with thousands of entities; Deep Space Ops already drives ~1200px
//      side-scroll battles via Canvas 2D without issue.
//   4. The repo already has procedural-art conventions (TD towers, RTS
//      units) that this tab can match without learning a new API.
//
// If later hoglets find Canvas 2D insufficient (e.g. shaders, batched
// sprites at scale), revisit the choice then. Don't preempt.
//
// Drawing order (back-to-front):
//   1. clear canvas
//   2. tile grid — sorted by (col + row) ascending so back tiles draw
//      first and front tiles draw last
//   3. entities — sorted by (col + row) of their containing tile, then
//      by world-y as a tiebreaker, so a unit on tile (5,5) draws on top
//      of a tile (4,4) hill but behind a unit on (6,6)

function _drawIsoDiamond(ctx, screenX, screenY, style){
  // screenX/Y is the CENTER of the diamond.
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  ctx.beginPath();
  ctx.moveTo(screenX,        screenY - hh);    // top
  ctx.lineTo(screenX + hw,   screenY);          // right
  ctx.lineTo(screenX,        screenY + hh);    // bottom
  ctx.lineTo(screenX - hw,   screenY);          // left
  ctx.closePath();

  // Subtle vertical gradient — top half slightly brighter than bottom
  // for fake depth without a real lighting pass.
  const grad = ctx.createLinearGradient(screenX, screenY - hh, screenX, screenY + hh);
  grad.addColorStop(0, style.top);
  grad.addColorStop(1, style.shade);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth   = 1;
  ctx.strokeStyle = style.outline;
  ctx.stroke();
}

// Highlight the top-left edge of a tile (subtle highlight to fake light).
function _drawIsoEdgeHighlight(ctx, screenX, screenY){
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  ctx.beginPath();
  ctx.moveTo(screenX - hw, screenY);
  ctx.lineTo(screenX,      screenY - hh);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth   = 1;
  ctx.stroke();
}

// Draw the entire tilemap, culling tiles outside the visible canvas.
function drawIsoMap(ctx, world, cam){
  const map = world.map;
  const W   = ctx.canvas.width;
  const H   = ctx.canvas.height;

  // Compute visible tile range by inverting the corners of the screen.
  // Pad by 2 tiles so partial-tile edges aren't clipped.
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

  // Back-to-front iteration: smaller (col + row) is further from camera.
  // For each diagonal d = col + row, draw all tiles on that diagonal.
  for (let d = minCol + minRow; d <= maxCol + maxRow; d++){
    // For diagonal d: col ranges from max(minCol, d - maxRow) to min(maxCol, d - minRow)
    const cLo = Math.max(minCol, d - maxRow);
    const cHi = Math.min(maxCol, d - minRow);
    for (let c = cLo; c <= cHi; c++){
      const r = d - c;
      const tile = map.get(c, r);
      if (!tile) continue;
      const w = tileToWorld(c, r);
      const s = worldToScreen(w.x, w.y, cam);
      const style = TERRAIN_STYLE[tile.terrain] || TERRAIN_STYLE[TERRAIN.GROUND];
      const lift = tile.elevation > 0 ? 5 : 0;

      // Cliff strip under elevated tiles — a darker quad bridging the
      // lifted diamond down to the ground-level diamond shape.
      if (lift > 0){
        const hw = ISO_TILE_W / 2;
        const hh = ISO_TILE_H / 2;
        ctx.beginPath();
        ctx.moveTo(s.x - hw, s.y);
        ctx.lineTo(s.x,      s.y + hh);
        ctx.lineTo(s.x + hw, s.y);
        ctx.lineTo(s.x + hw, s.y - lift);
        ctx.lineTo(s.x,      s.y + hh - lift);
        ctx.lineTo(s.x - hw, s.y - lift);
        ctx.closePath();
        ctx.fillStyle = style.shade;
        ctx.fill();
      }

      _drawIsoDiamond(ctx, s.x, s.y - lift, style);
      _drawIsoEdgeHighlight(ctx, s.x, s.y - lift);
    }
  }
}

// Entities: sort by depth (col + row, world-y tiebreaker) and draw.
// In this foundation hoglet, entities don't have a default sprite — we
// just draw a small magenta diamond for any entity that exists, so a
// hoglet adding units can immediately see something on screen even
// before they write their own render logic. Override by setting
// entity.components.render = (ctx, ent, cam) => { ... }.
function drawWorld(ctx, world, cam){
  if (!world.entities.length) return;
  const items = world.entities.map(e => {
    const t = worldToTile(e.x, e.y);
    return { e, depth: t.col + t.row, y: e.y };
  });
  items.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
  for (const { e } of items){
    if (e.components && typeof e.components.render === 'function'){
      e.components.render(ctx, e, cam);
      continue;
    }
    const s = worldToScreen(e.x, e.y, cam);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fillStyle   = '#ff00aa';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }
}

// Full-frame render. Other hoglets can override at this level too:
//   isoRender = function(ctx, world, cam) { ... custom ... };
function isoRender(ctx, world, cam){
  // Background — deep space.
  ctx.fillStyle = '#020810';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  drawIsoMap(ctx, world, cam);
  drawWorld(ctx, world, cam);
}

window.isoRender   = isoRender;
window.drawIsoMap  = drawIsoMap;
window.drawWorld   = drawWorld;
