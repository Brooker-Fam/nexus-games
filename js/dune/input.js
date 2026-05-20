// ════════════════════════════════════════════════════
//  DUNE — INPUT: SELECTION + COMMAND DISPATCH
// ════════════════════════════════════════════════════
//
// Mouse handling is decoupled from the simulation: this layer only translates
// user gestures into calls against the `duneIssueOrder()` API. A future UI
// (touch, keyboard shortcuts, scripted demos) can drive the same entry point
// without changing simulation code.
//
//   Left-click     — select unit under cursor (deselect if empty)
//   Shift + click  — add to selection
//   Right-click    — issue order to selection
//     · on enemy   → 'attack'
//     · on spice   → 'harvest' (harvesters only)
//     · otherwise  → 'move'
//
// Public entry: duneInstallInput(canvas, state)

function duneInstallInput(canvas, state){
  if(state._inputInstalled) return;
  state._inputInstalled = true;

  // Suppress browser context menu inside the canvas — right-click is a command.
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    const { tx, ty, px, py } = _duneCanvasToWorld(canvas, state, e);
    // While a building is awaiting placement, the HUD owns clicks (place /
    // cancel) — don't also try to select or order units.
    if(state.placement && state.placement.player) return;
    if(state.over) return;
    if(e.button === 0){
      _duneSelectClick(state, tx, ty, px, py, e.shiftKey);
    } else if(e.button === 2){
      _duneOrderClick(state, tx, ty);
    }
  });
}

function _duneCanvasToWorld(canvas, state, e){
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
  return {
    px: sx,
    py: sy,
    tx: Math.floor(sx / state.tileSize),
    ty: Math.floor(sy / state.tileSize),
  };
}

function _duneSelectClick(state, tx, ty, px, py, addToSelection){
  // Hit-test by pixel distance against rendered radius — feels better than
  // strict tile snapping when units are interpolating between tiles.
  let hit = null, bestD2 = Infinity;
  for(const u of state.units){
    if(u.dead) continue;
    if(u.owner !== 'player') continue; // only player units selectable
    const dx = u.px - px, dy = u.py - py;
    const r = DUNE_UNITS[u.type].radius + 3;
    const d2 = dx*dx + dy*dy;
    if(d2 <= r*r && d2 < bestD2){ hit = u; bestD2 = d2; }
  }

  if(!addToSelection){
    for(const u of state.selected) u.selected = false;
    state.selected = [];
  }
  if(hit){
    if(!hit.selected){
      hit.selected = true;
      state.selected.push(hit);
    } else if(addToSelection){
      // Shift-click on already-selected removes from selection
      hit.selected = false;
      state.selected = state.selected.filter(u => u !== hit);
    }
  }
}

function _duneOrderClick(state, tx, ty){
  if(state.selected.length === 0) return;

  // Find an enemy unit at the clicked tile (pixel-aware would be nicer; tile
  // is fine for a tutorial-feel game).
  const enemy = state.units.find(u =>
    !u.dead && u.owner !== 'player' && u.tx === tx && u.ty === ty
  );
  // Or an enemy building overlapping the clicked tile.
  let enemyBuilding = null;
  if(!enemy && window.DuneBuildings){
    for(const b of window.DuneBuildings.all()){
      if(b.owner === 'player') continue;
      if(tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h){
        enemyBuilding = b;
        break;
      }
    }
  }
  const onSpice = state.terrain.isSpice(tx, ty);

  for(const u of state.selected){
    if(enemy && DUNE_UNITS[u.type].attack > 0){
      duneIssueOrder(state, u, { kind: 'attack', targetId: enemy.id, persistent: true });
    } else if(enemyBuilding && DUNE_UNITS[u.type].attack > 0){
      duneIssueOrder(state, u, { kind: 'attack', targetId: 'b' + enemyBuilding.id, persistent: true });
    } else if(onSpice && DUNE_UNITS[u.type].harvester){
      duneIssueOrder(state, u, { kind: 'harvest', tx, ty });
    } else {
      // For move orders, only path to passable tiles. If impassable, find
      // a nearby alternative so the command always "does something".
      let mx = tx, my = ty;
      if(!state.terrain.isPassable(tx, ty)){
        const alt = duneNearestPassable(state.terrain, tx, ty, 4, null);
        if(!alt) continue;
        mx = alt.x; my = alt.y;
      }
      duneIssueOrder(state, u, { kind: 'move', tx: mx, ty: my });
    }
  }

  // Visual feedback marker
  state.particles.push({
    kind: 'cursor',
    x: tx * state.tileSize + state.tileSize / 2,
    y: ty * state.tileSize + state.tileSize / 2,
    life: 18, maxLife: 18,
    color: (enemy || enemyBuilding) ? '#ff5566' : '#9bf0ff',
  });
}
