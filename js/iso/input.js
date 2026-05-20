// ════════════════════════════════════════════════════
//  CITADEL OPS — PLAYER INPUT
// ════════════════════════════════════════════════════
//
// Minimum viable player controls so the game is actually playable and
// the AI has something to fight back against. All actions route through
// the command bus (isoCmd*) — never poke entity state directly.
//
//   LEFT CLICK   — select unit/building/resource node under cursor
//   SHIFT+CLICK  — add to selection
//   CTRL+CLICK   — box-clear (deselect)
//   RIGHT CLICK  — issue context order on selected units:
//                    * enemy under cursor   → attack
//                    * gold node under cursor → gather (workers only)
//                    * empty tile            → move
//   B            — with a worker selected, enter "build BARRACKS" mode;
//                  next left-click places it
//   T            — same as B for TECH
//   ESC          — cancel build-placement mode / clear selection
//   A            — issue attack-move at cursor (selected soldiers)
//
// Selection is shown by drawing a small ring under each selected entity
// in render.js (we extend isoRender below).

const ISO_INPUT = {
  selected:        [],
  buildMode:       null,        // null | { type, costPaid:false }
  hoverTile:       { col: -1, row: -1 },
  hoverScreen:     { sx: -1, sy: -1 },
  attached:        false,
  _handlers:       null,
  player:          null,
};

function isoInputAttach(canvas, player){
  if (ISO_INPUT.attached) return;
  ISO_INPUT.player = player;

  const onMouseMove = (e) => {
    const { sx, sy } = _toCanvas(canvas, e);
    ISO_INPUT.hoverScreen.sx = sx;
    ISO_INPUT.hoverScreen.sy = sy;
    const t = screenToTile(sx, sy, ISO_GAME.camera);
    ISO_INPUT.hoverTile.col = t.col;
    ISO_INPUT.hoverTile.row = t.row;
  };

  const onMouseDown = (e) => {
    if (!_isoActive()) return;
    if (e.button === 0){
      _onLeftClick(canvas, e);
      e.preventDefault();
    } else if (e.button === 2){
      _onRightClick(canvas, e);
      e.preventDefault();
    }
  };
  const onContextMenu = (e) => { if (_isoActive()) e.preventDefault(); };

  const onKey = (e) => {
    if (!_isoActive()) return;
    switch (e.key){
      case 'b': case 'B':
        if (_hasSelectedWorker()) ISO_INPUT.buildMode = { type: ISO_TYPE.BARRACKS };
        break;
      case 't': case 'T':
        if (_hasSelectedWorker()) ISO_INPUT.buildMode = { type: ISO_TYPE.TECH };
        break;
      case 'a': case 'A':
        _attackMoveAtCursor();
        break;
      case 's': case 'S':
        // Stop is bound to 'S' in many RTSs, but WASD pans the camera.
        // Use 'X' instead to avoid conflict.
        break;
      case 'x': case 'X':
        for (const u of ISO_INPUT.selected){ isoCmdStop(u); }
        break;
      case 'Escape':
        ISO_INPUT.buildMode = null;
        ISO_INPUT.selected.length = 0;
        break;
    }
  };

  canvas.addEventListener('mousemove',   onMouseMove);
  canvas.addEventListener('mousedown',   onMouseDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown',     onKey);

  ISO_INPUT._handlers = { onMouseMove, onMouseDown, onContextMenu, onKey, canvas };
  ISO_INPUT.attached = true;
}

function isoInputDetach(){
  if (!ISO_INPUT.attached) return;
  const h = ISO_INPUT._handlers;
  h.canvas.removeEventListener('mousemove',   h.onMouseMove);
  h.canvas.removeEventListener('mousedown',   h.onMouseDown);
  h.canvas.removeEventListener('contextmenu', h.onContextMenu);
  window.removeEventListener('keydown',       h.onKey);
  ISO_INPUT._handlers = null;
  ISO_INPUT.attached  = false;
  ISO_INPUT.selected.length = 0;
  ISO_INPUT.buildMode = null;
  ISO_INPUT.player    = null;
}

// ── click handlers ─────────────────────────────────
function _onLeftClick(canvas, e){
  const { sx, sy } = _toCanvas(canvas, e);
  const world = ISO_GAME.world;
  const cam   = ISO_GAME.camera;
  const wpos  = screenToWorld(sx, sy, cam);

  // Build-placement mode: place the building at the hovered tile.
  if (ISO_INPUT.buildMode){
    const t = screenToTile(sx, sy, cam);
    const worker = ISO_INPUT.selected.find(u => u.type === ISO_TYPE.WORKER && !u.dead);
    if (!worker){ ISO_INPUT.buildMode = null; return; }
    const ok = isoCmdBuild(world, ISO_INPUT.player, worker, ISO_INPUT.buildMode.type, t.col, t.row);
    if (ok){ ISO_INPUT.buildMode = null; }
    return;
  }

  // Pick nearest entity (small radius) — units win over buildings on ties.
  const hit = _pickEntityAtWorld(world, wpos.x, wpos.y);
  if (!hit){
    if (!e.shiftKey) ISO_INPUT.selected.length = 0;
    return;
  }
  if (e.ctrlKey){
    const idx = ISO_INPUT.selected.indexOf(hit);
    if (idx >= 0) ISO_INPUT.selected.splice(idx, 1);
    return;
  }
  if (!e.shiftKey) ISO_INPUT.selected.length = 0;
  if (!ISO_INPUT.selected.includes(hit)) ISO_INPUT.selected.push(hit);

  // Double-click semantics could go here later. Skip for now.
}

function _onRightClick(canvas, e){
  const world = ISO_GAME.world;
  const cam   = ISO_GAME.camera;
  const { sx, sy } = _toCanvas(canvas, e);
  const wpos = screenToWorld(sx, sy, cam);
  const target = _pickEntityAtWorld(world, wpos.x, wpos.y);

  // Filter to player-controlled units only — don't issue orders to AI's
  // stuff or to neutral resources.
  const mine = ISO_INPUT.selected.filter(u => u.kind === 'unit' && u.side === ISO_INPUT.player && !u.dead);
  if (!mine.length) return;

  for (const u of mine){
    if (target && target.side && target.side !== u.side && (target.kind === 'unit' || target.kind === 'building')){
      isoCmdAttack(u, target);
    } else if (target && target.kind === 'resource' && u.type === ISO_TYPE.WORKER){
      isoCmdGather(u, target);
    } else {
      isoCmdMove(u, wpos.x, wpos.y);
    }
  }
}

function _attackMoveAtCursor(){
  const cam = ISO_GAME.camera;
  const { sx, sy } = ISO_INPUT.hoverScreen;
  if (sx < 0 || sy < 0) return;
  const wpos = screenToWorld(sx, sy, cam);
  for (const u of ISO_INPUT.selected){
    if (u.kind !== 'unit' || u.side !== ISO_INPUT.player) continue;
    isoCmdAttackMove(u, wpos.x, wpos.y);
  }
}

function _hasSelectedWorker(){
  return ISO_INPUT.selected.some(u => u.type === ISO_TYPE.WORKER && !u.dead && u.side === ISO_INPUT.player);
}

function _pickEntityAtWorld(world, wx, wy){
  // Smallest selection radius wins
  const items = [];
  for (let i = 0; i < world.entities.length; i++){
    const e = world.entities[i];
    if (e.dead) continue;
    const r = e.kind === 'building' ? 28 : (e.kind === 'resource' ? 12 : 10);
    const d = Math.hypot(e.x - wx, e.y - wy);
    if (d <= r){
      items.push({ e, d, kindPriority: e.kind === 'unit' ? 0 : (e.kind === 'resource' ? 2 : 1) });
    }
  }
  if (!items.length) return null;
  items.sort((a, b) => (a.kindPriority - b.kindPriority) || (a.d - b.d));
  return items[0].e;
}

function _toCanvas(canvas, e){
  const rect = canvas.getBoundingClientRect();
  const scX = canvas.width  / rect.width;
  const scY = canvas.height / rect.height;
  return { sx: (e.clientX - rect.left) * scX, sy: (e.clientY - rect.top) * scY };
}

function _isoActive(){
  const tab = document.getElementById('tab-iso');
  return !!(tab && tab.classList.contains('active'));
}

// ── overlay drawing (selection ring + build ghost) ─
// Called after drawWorld(); the foundation's isoRender doesn't call this
// directly, so game.js installs an overridden isoRender that does.
function isoDrawSelectionOverlay(ctx, world, cam){
  for (const e of ISO_INPUT.selected){
    if (e.dead) continue;
    const s = worldToScreen(e.x, e.y, cam);
    const r = e.kind === 'building' ? 26 : 10;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + (e.kind === 'building' ? 0 : 4), r, r / 2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Build ghost
  if (ISO_INPUT.buildMode){
    const t = ISO_INPUT.hoverTile;
    if (t.col < 0) return;
    const wpos = tileToWorld(t.col, t.row);
    const s = worldToScreen(wpos.x, wpos.y, cam);
    const valid = isoCanBuild(world, ISO_INPUT.player, ISO_INPUT.buildMode.type, t.col, t.row);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(s.x,           s.y - 18);
    ctx.lineTo(s.x + 22,      s.y);
    ctx.lineTo(s.x,           s.y + 18);
    ctx.lineTo(s.x - 22,      s.y);
    ctx.closePath();
    ctx.fillStyle = valid ? '#00ff88' : '#ff0066';
    ctx.fill();
    ctx.strokeStyle = valid ? '#00ff88' : '#ff0066';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

window.ISO_INPUT             = ISO_INPUT;
window.isoInputAttach        = isoInputAttach;
window.isoInputDetach        = isoInputDetach;
window.isoDrawSelectionOverlay = isoDrawSelectionOverlay;
