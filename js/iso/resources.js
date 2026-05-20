// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — RESOURCE NODES
// ════════════════════════════════════════════════════
//
// Two resource types per docs/rts-2d-theme.md §1:
//   GOLD — primary, every faction (Citadel's mineral veins)
//   OIL  — secondary (Aether wells; canonically Roboto-only, but in
//          the surface campaign all factions can extract it)
//
// A ResourceNode is a stationary Entity that:
//   - sits centered on a single tile (col,row)
//   - holds an `amount` that decrements when a worker harvests it
//   - blocks tile occupancy (workers can stand adjacent, not on it)
//   - draws as a stylized prism in the resource's neon color
//
// Public API (window globals):
//   RESOURCE           — { GOLD, OIL } string constants
//   RESOURCE_STYLE     — { [type]: { primary, accent, glow, label } }
//   createResourceNode(col, row, resource, amount?) → Entity
//   nearestResourceNode(world, x, y, type?)         → Entity | null
//   harvestFromNode(node, takeAmount)               → number actually taken
//   isResourceNode(ent)                             → boolean

const RESOURCE = Object.freeze({ GOLD:'gold', OIL:'oil' });

const RESOURCE_STYLE = Object.freeze({
  gold: { primary:'#ffcc44', accent:'#ffe07a', glow:'rgba(255,204,68,0.45)', label:'GOLD' },
  oil:  { primary:'#00ddff', accent:'#aaffff', glow:'rgba(0,221,255,0.45)',  label:'OIL'  },
});

const NODE_DEFAULT_AMOUNT = {
  gold: 1500,
  oil:  750,
};

function isResourceNode(ent){
  return !!(ent && ent.type === 'resource_node');
}

function createResourceNode(col, row, resource, amount){
  const w = tileToWorld(col, row);
  const maxAmount = (amount != null) ? amount : NODE_DEFAULT_AMOUNT[resource] || 1000;
  const node = new Entity({
    type: 'resource_node',
    x: w.x,
    y: w.y,
    components: {
      resourceNode: {
        resource: resource,
        amount: maxAmount,
        maxAmount: maxAmount,
        col: col,
        row: row,
        depleted: false,
        // Cosmetic wobble offset so adjacent nodes don't render identically.
        seed: (col * 73856093) ^ (row * 19349663),
      },
      render: _renderResourceNode,
    },
  });
  return node;
}

// Returns the actual amount removed (clamped to remaining supply).
function harvestFromNode(node, takeAmount){
  const rn = node && node.components && node.components.resourceNode;
  if (!rn || rn.depleted) return 0;
  const taken = Math.min(takeAmount, rn.amount);
  rn.amount -= taken;
  if (rn.amount <= 0){
    rn.amount = 0;
    rn.depleted = true;
  }
  return taken;
}

function nearestResourceNode(world, x, y, type){
  let best = null;
  let bestD2 = Infinity;
  for (const e of world.entities){
    if (!isResourceNode(e)) continue;
    const rn = e.components.resourceNode;
    if (rn.depleted) continue;
    if (type && rn.resource !== type) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2){ bestD2 = d2; best = e; }
  }
  return best;
}

// ── Render ──────────────────────────────────────────
//
// Programmer-art crystal: a tall prism with stacked diamond facets,
// faint glow ring under it, and a subtle wobble per node seed.

function _renderResourceNode(ctx, ent, cam){
  const rn = ent.components.resourceNode;
  const style = RESOURCE_STYLE[rn.resource] || RESOURCE_STYLE.gold;
  const s = worldToScreen(ent.x, ent.y, cam);

  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;

  // Supply ratio shrinks the crystal as it depletes (visual feedback).
  const ratio = rn.maxAmount > 0 ? (rn.amount / rn.maxAmount) : 0;
  const sizeScale = 0.55 + ratio * 0.35;   // 0.55..0.90
  const halfW = hw * sizeScale * 0.5;
  const halfH = hh * sizeScale * 0.5;

  const tall = 20 + ratio * 18;            // crystal height in px

  // Ground glow halo
  ctx.fillStyle = style.glow;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 2, halfW * 1.4, halfH * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Base (bottom diamond, sitting on the tile)
  _diamondPath(ctx, s.x, s.y, halfW, halfH);
  ctx.fillStyle = style.primary;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#020810';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Vertical prism walls (left & right faces)
  ctx.beginPath();
  ctx.moveTo(s.x - halfW, s.y);
  ctx.lineTo(s.x,         s.y + halfH);
  ctx.lineTo(s.x,         s.y + halfH - tall);
  ctx.lineTo(s.x - halfW, s.y - tall);
  ctx.closePath();
  ctx.fillStyle = _shadeColor(style.primary, -0.35);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(s.x + halfW, s.y);
  ctx.lineTo(s.x,         s.y + halfH);
  ctx.lineTo(s.x,         s.y + halfH - tall);
  ctx.lineTo(s.x + halfW, s.y - tall);
  ctx.closePath();
  ctx.fillStyle = _shadeColor(style.primary, -0.55);
  ctx.fill();

  // Top diamond (the brightly lit face)
  _diamondPath(ctx, s.x, s.y - tall, halfW, halfH);
  ctx.fillStyle = style.accent;
  ctx.fill();
  ctx.strokeStyle = '#020810';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner accent line — a faint sparkle on the top face.
  ctx.beginPath();
  ctx.moveTo(s.x - halfW * 0.45, s.y - tall);
  ctx.lineTo(s.x + halfW * 0.45, s.y - tall);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Depleted overlay (greyed out + cross)
  if (rn.depleted){
    ctx.fillStyle = 'rgba(2,8,16,0.5)';
    _diamondPath(ctx, s.x, s.y - tall * 0.5, halfW * 1.1, halfH * 1.1 + tall * 0.5);
    ctx.fill();
  }
}

function _diamondPath(ctx, cx, cy, halfW, halfH){
  ctx.beginPath();
  ctx.moveTo(cx,         cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx,         cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

// Lighten (+) / darken (-) a hex color by a 0..1 amount.
function _shadeColor(hex, amount){
  let h = hex.replace('#','');
  if (h.length === 3) h = h.split('').map(c => c+c).join('');
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >>  8) & 0xff;
  let b =  num        & 0xff;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

window.RESOURCE            = RESOURCE;
window.RESOURCE_STYLE      = RESOURCE_STYLE;
window.createResourceNode  = createResourceNode;
window.nearestResourceNode = nearestResourceNode;
window.harvestFromNode     = harvestFromNode;
window.isResourceNode      = isResourceNode;
// Also export the shade helper for buildings/workers to keep one color util.
window._isoShadeColor      = _shadeColor;
window._isoDiamondPath     = _diamondPath;
