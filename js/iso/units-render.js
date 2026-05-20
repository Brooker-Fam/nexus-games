// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — UNIT RENDERING
// ════════════════════════════════════════════════════
//
// Drawing hooks for unit entities. spawnUnit() sets
// `entity.components.render = drawUnit` so foundation's drawWorld() picks
// these up. Drag-select rectangle is drawn separately as a screen-space
// overlay after the world render (wired by iso-init.js).
//
// Placeholder visuals — colored shapes per faction. The production hoglet
// can swap drawUnit for higher-fidelity sprites; just keep selection
// rings + HP bars or wire those into the new draw too.

function drawUnit(ctx, ent, cam){
  if (ent.state === 'dead') return;
  const s   = worldToScreen(ent.x, ent.y, cam);
  const fac = ISO_FACTIONS[ent.owner] || ISO_FACTIONS.shadow;
  const r   = ent.radius || 10;
  const hit = ent.hitFlashMs > 0;
  const atk = ent.attackFlashMs > 0;

  // Ground shadow ellipse.
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + r * 0.6, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Selection ring beneath the body — friendly = faction accent (cyan
  // for prism, lavender for shadow), enemy = neon-pink so it reads as
  // "highlighted enemy" rather than ours.
  if (isSelected(ent)){
    ctx.strokeStyle = isFriendly(ent) ? fac.accent : '#ff0088';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + r * 0.55, r * 1.15, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Body fill — flashes on hit / attack for feedback.
  const bodyFill = hit ? '#ff66aa' : (atk ? '#ffffff' : fac.primary);
  ctx.fillStyle   = bodyFill;
  ctx.strokeStyle = fac.accent;
  ctx.lineWidth   = 1.5;

  if (ent.unitType === 'worker'){
    // Diamond worker
    ctx.beginPath();
    ctx.moveTo(s.x,            s.y - r);
    ctx.lineTo(s.x + r * 0.85, s.y);
    ctx.lineTo(s.x,            s.y + r * 0.9);
    ctx.lineTo(s.x - r * 0.85, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner highlight quad — fake depth.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(s.x,            s.y - r * 0.45);
    ctx.lineTo(s.x + r * 0.4,  s.y);
    ctx.lineTo(s.x,            s.y + r * 0.05);
    ctx.lineTo(s.x - r * 0.4,  s.y);
    ctx.closePath();
    ctx.fill();
  } else {
    // Warrior — flattened hexagon with a directional weapon nub.
    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++){
      const a  = (i / sides) * Math.PI * 2 + Math.PI / 6;
      const px = s.x + Math.cos(a) * r;
      const py = s.y + Math.sin(a) * r * 0.85;
      if (i === 0) ctx.moveTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Facing nub.
    const f  = ent.facing || 0;
    const fx = Math.cos(f);
    const fy = Math.sin(f);
    ctx.fillStyle = fac.accent;
    ctx.beginPath();
    ctx.arc(s.x + fx * r * 0.85, s.y + fy * r * 0.7, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // Attack tracer (brief line to last target).
  if (ent.attackLineMs > 0 && ent.attackLineTo){
    const t = worldToScreen(ent.attackLineTo.x, ent.attackLineTo.y, cam);
    ctx.strokeStyle = 'rgba(255,238,136,0.85)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }

  // HP bar only when damaged — top of the sprite.
  if (ent.hp < ent.maxHp){
    const w = r * 2.4;
    const h = 3;
    const x = s.x - w / 2;
    const y = s.y - r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const pct = Math.max(0, ent.hp / ent.maxHp);
    let color = '#00ff88';
    if (pct <= 0.3)      color = '#ff0088';
    else if (pct <= 0.6) color = '#ffcc44';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * pct, h);
  }
}

// Drag-select rectangle — screen-space overlay drawn after the world.
function drawDragSelectBox(ctx){
  if (!ISO_SELECTION.dragging) return;
  const a = ISO_SELECTION.dragStart;
  const b = ISO_SELECTION.dragEnd;
  if (!a || !b) return;
  const x = Math.min(a.sx, b.sx);
  const y = Math.min(a.sy, b.sy);
  const w = Math.abs(a.sx - b.sx);
  const h = Math.abs(a.sy - b.sy);
  if (w < 2 && h < 2) return;
  ctx.save();
  ctx.fillStyle   = 'rgba(0,245,255,0.08)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,245,255,0.85)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.restore();
}

window.drawUnit          = drawUnit;
window.drawDragSelectBox = drawDragSelectBox;
