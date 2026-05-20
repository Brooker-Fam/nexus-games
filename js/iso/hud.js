// ════════════════════════════════════════════════════
//  CITADEL OPS (2.5D RTS) — HUD / COMMAND PANEL
// ════════════════════════════════════════════════════
//
// Updates the DOM HUD frame that the foundation hoglet stubbed out in
// index.html. Three areas:
//
//   1. Top-bar resource counters (#iso-minerals → GOLD, #iso-gas → OIL).
//   2. Selection panel (bottom-center) — portrait + name + HP.
//      Multi-select shows a grid of unit icons.
//   3. Command panel (bottom-right) — contextual buttons:
//        - Units selected:        MOVE | STOP | ATTACK | HOLD
//        - Production building:   TRAIN_<unit> ... + ⓘ
//
// The HUD runs an update on every animation tick to keep counters
// and HP bars live. It also subscribes to selection changes for
// instant re-render of the panel layout.

(function(){

  const HUD = {
    el: {
      gold:        null,
      oil:         null,
      supply:      null,
      portrait:    null,
      info:        null,
      cmdGrid:     null,
      // Game-over slot (reserved for the AI/win-loss hoglet).
      gameOver:    null,
    },
    _bound: false,
  };

  function _query(){
    HUD.el.gold     = document.getElementById('iso-minerals');
    HUD.el.oil      = document.getElementById('iso-gas');
    HUD.el.supply   = document.getElementById('iso-supply');
    HUD.el.portrait = document.querySelector('.iso-hud-portrait');
    HUD.el.info     = document.querySelector('.iso-hud-info');
    HUD.el.cmdGrid  = document.querySelector('.iso-hud-cmd-grid');
    HUD.el.gameOver = document.getElementById('iso-gameover');
    // Rename labels to lore-correct GOLD / OIL.
    const labels = document.querySelectorAll('#tab-iso .stat-label');
    if (labels && labels.length >= 3){
      labels[0].textContent = 'GOLD';
      labels[1].textContent = 'OIL';
      labels[2].textContent = 'SUPPLY';
    }
  }

  // ── Resource counters ────────────────────────────────
  function _updateResources(){
    if (!IsoAPI || !IsoAPI.resources) return;
    const b = IsoAPI.resources.get('player');
    if (HUD.el.gold)   HUD.el.gold.textContent   = b.gold | 0;
    if (HUD.el.oil)    HUD.el.oil.textContent    = b.oil  | 0;
    if (HUD.el.supply){
      // Supply = sum of unit.supply for player-owned units.
      const world = window.ISO_GAME && ISO_GAME.world;
      let supply = 0;
      if (world){
        for (const e of world.entities){
          if (e.components && e.components.kind === 'unit' && e.components.owner === 'player' && e.components.hp > 0){
            supply += e.components.supply || 1;
          }
        }
      }
      HUD.el.supply.textContent = supply;
    }
  }

  // ── Selection panel ──────────────────────────────────
  function _renderSelection(){
    if (!HUD.el.portrait || !HUD.el.info) return;
    const sel = IsoAPI.selection ? IsoAPI.selection.get() : [];

    // Clear portrait area.
    HUD.el.portrait.innerHTML = '';

    if (sel.length === 0){
      HUD.el.info.textContent = 'No unit selected';
      HUD.el.portrait.classList.remove('iso-portrait-grid');
      return;
    }

    if (sel.length === 1){
      const ent = sel[0];
      const c = ent.components;
      HUD.el.portrait.classList.remove('iso-portrait-grid');
      const isUnit = c.kind === 'unit';
      const type = isUnit ? IsoAPI.UNIT_TYPES[c.unitTypeId] : IsoAPI.BUILDING_TYPES[c.buildingTypeId];
      const fac  = IsoAPI.FACTIONS[c.owner];
      const portrait = document.createElement('div');
      portrait.className = 'iso-portrait-single';
      portrait.innerHTML = [
        '<div class="iso-portrait-art" style="background:',
        'radial-gradient(ellipse 60% 50% at 50% 40%, ', _alpha(fac.color, 0.45), ' 0%, transparent 70%),',
        '#060e1a;">',
          '<div class="iso-portrait-glyph" style="color:', fac.color, ';">',
            (type && type.name[0]) || '?',
          '</div>',
        '</div>',
        '<div class="iso-portrait-meta">',
          '<div class="iso-portrait-name">', (type && type.name) || (isUnit ? 'UNIT' : 'BUILDING'), '</div>',
          '<div class="iso-portrait-fac" style="color:', fac.color, ';">', fac.name, '</div>',
          '<div class="iso-hp-row">',
            '<div class="iso-hp-bar"><div class="iso-hp-fill" id="iso-hp-fill"></div></div>',
            '<div class="iso-hp-text" id="iso-hp-text"></div>',
          '</div>',
        '</div>',
      ].join('');
      HUD.el.portrait.appendChild(portrait);
      _updateSingleHp(ent);
      HUD.el.info.textContent = type ? (type.desc || '') : '';
      return;
    }

    // Multi-select grid.
    HUD.el.portrait.classList.add('iso-portrait-grid');
    const grid = document.createElement('div');
    grid.className = 'iso-portrait-multi';
    for (const ent of sel.slice(0, 12)){
      const c = ent.components;
      const type = c.kind === 'unit' ? IsoAPI.UNIT_TYPES[c.unitTypeId] : IsoAPI.BUILDING_TYPES[c.buildingTypeId];
      const fac  = IsoAPI.FACTIONS[c.owner];
      const cell = document.createElement('div');
      cell.className = 'iso-portrait-cell';
      cell.style.borderColor = fac.color;
      cell.innerHTML = [
        '<div class="iso-portrait-cell-glyph" style="color:', fac.color, ';">',
        (type && type.name[0]) || '?',
        '</div>',
        '<div class="iso-mini-hp"><div class="iso-mini-hp-fill" style="width:',
        (c.hp / c.maxHp * 100) | 0, '%;background:', _hpColor(c.hp/c.maxHp), ';"></div></div>',
      ].join('');
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        IsoAPI.selection.set([ent]);
      });
      grid.appendChild(cell);
    }
    HUD.el.portrait.appendChild(grid);
    HUD.el.info.textContent = sel.length + ' UNITS SELECTED';
  }

  function _updateSingleHp(ent){
    const fill = document.getElementById('iso-hp-fill');
    const text = document.getElementById('iso-hp-text');
    if (!fill || !text) return;
    const c = ent.components;
    const frac = Math.max(0, c.hp / c.maxHp);
    fill.style.width = (frac * 100) + '%';
    fill.style.background = _hpColor(frac);
    text.textContent = (c.hp | 0) + ' / ' + (c.maxHp | 0);
  }

  // ── Command panel ────────────────────────────────────
  function _renderCommands(){
    if (!HUD.el.cmdGrid) return;
    HUD.el.cmdGrid.innerHTML = '';
    const sel = IsoAPI.selection ? IsoAPI.selection.get() : [];

    // Filter to player-owned entities for command purposes.
    const own = sel.filter(e => e.components && e.components.owner === 'player');
    if (own.length === 0){
      // Show 9 empty slots like the foundation.
      for (let i = 0; i < 9; i++){
        const slot = document.createElement('div');
        slot.className = 'iso-cmd-slot';
        HUD.el.cmdGrid.appendChild(slot);
      }
      return;
    }

    // Decide layout:
    //   - if any selected entity is a unit, show movement commands.
    //   - if exactly one production building selected, show train buttons.
    //   - if both (mixed), prefer unit commands (no production from mixed sel).
    const hasUnit = own.some(e => e.components.kind === 'unit');
    const onlyBuilding = !hasUnit && own.length === 1 && own[0].components.kind === 'building';

    if (onlyBuilding){
      _renderBuildingCommands(own[0]);
    } else if (hasUnit){
      _renderUnitCommands(own.filter(e => e.components.kind === 'unit'));
    } else {
      // Multi-building selection — no commands for now.
      for (let i = 0; i < 9; i++){
        const slot = document.createElement('div');
        slot.className = 'iso-cmd-slot';
        HUD.el.cmdGrid.appendChild(slot);
      }
    }
  }

  function _renderUnitCommands(units){
    const cmds = [
      { id:'move',    label:'MOVE',   hint:'Right-click ground' },
      { id:'stop',    label:'STOP',   hint:'Halt' },
      { id:'attack',  label:'ATTACK', hint:'Right-click target' },
      { id:'hold',    label:'HOLD',   hint:'Hold position' },
    ];
    for (const cmd of cmds){
      const btn = _slotButton(cmd.label, cmd.hint, null);
      btn.addEventListener('click', () => _runUnitCommand(cmd.id, units));
      HUD.el.cmdGrid.appendChild(btn);
    }
    // Pad to 9.
    while (HUD.el.cmdGrid.children.length < 9){
      const s = document.createElement('div');
      s.className = 'iso-cmd-slot';
      HUD.el.cmdGrid.appendChild(s);
    }
  }

  function _runUnitCommand(id, units){
    if (id === 'stop'){
      for (const u of units) IsoAPI.movement.stop(u);
    } else if (id === 'hold'){
      for (const u of units) IsoAPI.combat.holdPosition(u);
    } else if (id === 'move' || id === 'attack'){
      // Toggle a one-shot mouse mode. The selection-input handler
      // listens for this.
      window.ISO_INPUT_MODE = id;
      _flashHint(id === 'move' ? 'Click ground to MOVE' : 'Click target to ATTACK');
    }
  }

  function _renderBuildingCommands(building){
    const c = building.components;
    const produces = c.produces || [];
    for (const unitId of produces){
      const unit = IsoAPI.UNIT_TYPES[unitId];
      if (!unit) continue;
      const costStr = _costLabel(unit.cost);
      const afford = IsoAPI.resources.canAfford(c.owner, unit.cost);
      const btn = _slotButton('TRAIN ' + unit.name, costStr, unit.name[0]);
      if (!afford) btn.classList.add('iso-cmd-unaffordable');
      btn.addEventListener('click', () => {
        const ok = IsoAPI.production.train(building, unitId);
        if (ok){
          _flashHint('Training ' + unit.name + '…');
          _renderSelection();
          _renderCommands();
        } else {
          _flashHint('Cannot train ' + unit.name);
        }
      });
      HUD.el.cmdGrid.appendChild(btn);
    }
    // Cancel button if there's a queue.
    if (c.queue && c.queue.items.length > 0){
      const cancel = _slotButton('CANCEL', 'Last in queue', '✕');
      cancel.classList.add('iso-cmd-cancel');
      cancel.addEventListener('click', () => {
        IsoAPI.production.cancelLast(building);
        _renderSelection();
        _renderCommands();
      });
      HUD.el.cmdGrid.appendChild(cancel);
    }
    while (HUD.el.cmdGrid.children.length < 9){
      const s = document.createElement('div');
      s.className = 'iso-cmd-slot';
      HUD.el.cmdGrid.appendChild(s);
    }
  }

  function _slotButton(label, hint, glyph){
    const slot = document.createElement('button');
    slot.className = 'iso-cmd-slot iso-cmd-btn';
    slot.type = 'button';
    slot.innerHTML = [
      glyph ? '<div class="iso-cmd-glyph">' + glyph + '</div>' : '',
      '<div class="iso-cmd-label">', label, '</div>',
      hint ? '<div class="iso-cmd-hint">' + hint + '</div>' : '',
    ].join('');
    return slot;
  }

  function _costLabel(cost){
    const parts = [];
    if (cost.gold) parts.push(cost.gold + 'g');
    if (cost.oil)  parts.push(cost.oil  + 'o');
    return parts.join(' ');
  }

  function _hpColor(frac){
    if (frac > 0.5)  return '#00ff88';
    if (frac > 0.25) return '#ffaa00';
    return '#ff0088';
  }

  function _alpha(hex, a){
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16);
    const g = parseInt(c.slice(2,4),16);
    const b = parseInt(c.slice(4,6),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // ── Hint banner (replaces the foundation "FOUNDATION SCAFFOLD" hint) ──
  let _hintTimer = null;
  function _flashHint(msg){
    const el = document.querySelector('#tab-iso .iso-hint');
    if (!el) return;
    el.innerHTML = msg;
    el.classList.add('iso-hint-flash');
    if (_hintTimer) clearTimeout(_hintTimer);
    _hintTimer = setTimeout(() => {
      el.classList.remove('iso-hint-flash');
      el.innerHTML = window.ISO_HUD_DEFAULT_HINT || el.innerHTML;
    }, 1500);
  }

  // ── Per-frame HUD update ─────────────────────────────
  // This is mounted as a system on world.systems so it runs every tick.
  class HudSystem {
    update(/* dt, world */){
      _updateResources();
      // Single-select HP live update.
      if (IsoAPI.selection){
        const sel = IsoAPI.selection.get();
        if (sel.length === 1) _updateSingleHp(sel[0]);
        else if (sel.length > 1) {
          // Update mini HP bars in the multi-select grid.
          const cells = HUD.el.portrait && HUD.el.portrait.querySelectorAll('.iso-mini-hp-fill');
          if (cells){
            sel.slice(0, cells.length).forEach((ent, i) => {
              const frac = Math.max(0, ent.components.hp / ent.components.maxHp);
              cells[i].style.width = (frac * 100) + '%';
              cells[i].style.background = _hpColor(frac);
            });
          }
        }
      }
    }
  }

  function bind(){
    if (HUD._bound) return;
    _query();
    if (IsoAPI.selection){
      IsoAPI.selection.onChange(() => {
        _renderSelection();
        _renderCommands();
      });
    }
    // First paint.
    _renderSelection();
    _renderCommands();
    _updateResources();

    // Save the default hint string so the flash can restore it.
    const hintEl = document.querySelector('#tab-iso .iso-hint');
    if (hintEl) window.ISO_HUD_DEFAULT_HINT = hintEl.innerHTML;

    HUD._bound = true;
  }
  function unbind(){
    HUD._bound = false;
  }

  // ── Publish ──────────────────────────────────────────
  window.IsoHud = {
    bind,
    unbind,
    flashHint: _flashHint,
    _refresh(){ _renderSelection(); _renderCommands(); _updateResources(); },
  };
  window.IsoHudSystem = HudSystem;
})();
