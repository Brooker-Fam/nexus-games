// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — MOUSE INPUT (SELECTION + COMMANDS)
// ════════════════════════════════════════════════════
//
// Wires the iso canvas into selection + command behaviour:
//
//   Left-click on unit            → select that unit
//   Left-click on empty           → clear selection
//   Shift + left-click            → add to selection
//   Left-drag (>threshold)        → box-select friendly units
//   Right-click on enemy unit     → issue AttackCommand to selected friendlies
//   Right-click on empty / terrain → issue MoveCommand to selected friendlies
//
// Camera edge-scroll is handled by IsoCamera (mousemove on canvas, keys on
// window). We don't touch that — only add our own mouse* listeners.
//
// Public API:
//   attachIsoInput(canvasEl)
//   detachIsoInput()

const ISO_INPUT = {
  attached:      false,
  canvas:        null,
  handlers:      null,
  dragThreshold: 6,   // px — below this, treat mousedown→up as a click
  _downBtn0:     null,
};

function _isoCanvasCoords(canvas, e){
  const rect = canvas.getBoundingClientRect();
  const scX  = canvas.width  / rect.width;
  const scY  = canvas.height / rect.height;
  return {
    sx: (e.clientX - rect.left) * scX,
    sy: (e.clientY - rect.top)  * scY,
  };
}

function attachIsoInput(canvas){
  if (ISO_INPUT.attached) return;
  if (!canvas) return;
  ISO_INPUT.canvas = canvas;

  const onMouseDown = (e) => {
    const m = _isoCanvasCoords(canvas, e);
    if (e.button === 0){
      // Begin drag-select. If it stays small on mouseup we treat as a click.
      ISO_SELECTION.dragging  = true;
      ISO_SELECTION.dragStart = { sx: m.sx, sy: m.sy };
      ISO_SELECTION.dragEnd   = { sx: m.sx, sy: m.sy };
      ISO_INPUT._downBtn0     = { sx: m.sx, sy: m.sy };
    } else if (e.button === 2){
      e.preventDefault();
    }
  };

  const onMouseMove = (e) => {
    if (!ISO_SELECTION.dragging) return;
    const m = _isoCanvasCoords(canvas, e);
    ISO_SELECTION.dragEnd = { sx: m.sx, sy: m.sy };
  };

  const onMouseUp = (e) => {
    if (!ISO_GAME.camera) return;
    const cam = ISO_GAME.camera;
    const m   = _isoCanvasCoords(canvas, e);

    if (e.button === 0 && ISO_SELECTION.dragging){
      const start = ISO_INPUT._downBtn0 || ISO_SELECTION.dragStart;
      const moved = start ? Math.hypot(m.sx - start.sx, m.sy - start.sy) : 0;
      const shift = e.shiftKey;

      if (moved < ISO_INPUT.dragThreshold){
        // Treat as click.
        const hit = getUnitAtScreen(m.sx, m.sy, cam);
        if (hit){
          if (shift) addToSelection(hit);
          else       selectUnits([hit]);
        } else if (!shift){
          clearSelection();
        }
      } else {
        // Drag-box: pick friendlies inside the screen-space rectangle.
        const a = ISO_SELECTION.dragStart;
        const b = ISO_SELECTION.dragEnd || m;
        const xLo = Math.min(a.sx, b.sx);
        const xHi = Math.max(a.sx, b.sx);
        const yLo = Math.min(a.sy, b.sy);
        const yHi = Math.max(a.sy, b.sy);
        const picked = [];
        for (let i = 0; i < ISO_UNITS.list.length; i++){
          const u = ISO_UNITS.list[i];
          if (u.state === 'dead') continue;
          if (!isFriendly(u)) continue;
          const s = worldToScreen(u.x, u.y, cam);
          if (s.x >= xLo && s.x <= xHi && s.y >= yLo && s.y <= yHi){
            picked.push(u);
          }
        }
        if (shift){
          for (let i = 0; i < picked.length; i++) addToSelection(picked[i]);
        } else {
          // Empty box clears selection — matches StarCraft behaviour.
          selectUnits(picked);
        }
      }

      ISO_SELECTION.dragging  = false;
      ISO_SELECTION.dragStart = null;
      ISO_SELECTION.dragEnd   = null;
      ISO_INPUT._downBtn0     = null;
    } else if (e.button === 2){
      e.preventDefault();
      const sel = getSelectedUnits().filter(isFriendly);
      if (!sel.length) return;
      const target = getUnitAtScreen(m.sx, m.sy, cam);
      if (target && !isFriendly(target) && target.state !== 'dead'){
        commandAttack(sel, target);
      } else {
        const w = screenToWorld(m.sx, m.sy, cam);
        commandMove(sel, w.x, w.y);
      }
    }
  };

  const onContextMenu = (e) => {
    // We use right-click for commands; suppress the browser menu.
    e.preventDefault();
  };

  const onMouseLeave = () => {
    // Cancel a stray drag if the cursor leaves the canvas without a button up.
    // Don't clear selection — just end the drag rectangle.
    if (ISO_SELECTION.dragging){
      ISO_SELECTION.dragging  = false;
      ISO_SELECTION.dragStart = null;
      ISO_SELECTION.dragEnd   = null;
      ISO_INPUT._downBtn0     = null;
    }
  };

  canvas.addEventListener('mousedown',   onMouseDown);
  canvas.addEventListener('mousemove',   onMouseMove);
  window.addEventListener('mouseup',     onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('mouseleave',  onMouseLeave);

  ISO_INPUT.handlers = { onMouseDown, onMouseMove, onMouseUp, onContextMenu, onMouseLeave };
  ISO_INPUT.attached = true;
}

function detachIsoInput(){
  if (!ISO_INPUT.attached || !ISO_INPUT.canvas) return;
  const c = ISO_INPUT.canvas;
  const h = ISO_INPUT.handlers;
  c.removeEventListener('mousedown',   h.onMouseDown);
  c.removeEventListener('mousemove',   h.onMouseMove);
  window.removeEventListener('mouseup', h.onMouseUp);
  c.removeEventListener('contextmenu', h.onContextMenu);
  c.removeEventListener('mouseleave',  h.onMouseLeave);
  ISO_INPUT.attached = false;
  ISO_INPUT.canvas   = null;
  ISO_INPUT.handlers = null;
  ISO_INPUT._downBtn0 = null;
}

window.attachIsoInput = attachIsoInput;
window.detachIsoInput = detachIsoInput;
window.ISO_INPUT      = ISO_INPUT;
