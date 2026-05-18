// ════════════════════════════════════════════════════
//  DUNE — RENDERING
// ════════════════════════════════════════════════════
//
// Procedural Canvas 2D rendering. No image assets — every tile and unit is
// drawn at runtime, matching the project-wide convention (see
// docs/architecture.md). Pipeline:
//
//   drawTerrain → drawSpiceOverlay → drawDropOff → drawUnits → drawParticles → drawHUD
//
// Coordinate system: world == screen for this game. There's no scrolling
// camera yet — the map fits in the viewport. If you add one later, prepend a
// ctx.translate() in drawDune() and update input.js's screen→world transform.

function drawDune(ctx, state){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);

  _duneDrawTerrain(ctx, state);
  _duneDrawDropOff(ctx, state);
  _duneDrawUnits(ctx, state);
  _duneDrawParticles(ctx, state);
  _duneDrawHUD(ctx, state);
}

function _duneDrawTerrain(ctx, state){
  const ts = state.tileSize;
  const terr = state.terrain;
  for(let y = 0; y < terr.rows; y++){
    for(let x = 0; x < terr.cols; x++){
      const t = terr.getTile(x, y);
      ctx.fillStyle = _duneTileColor(t);
      ctx.fillRect(x * ts, y * ts, ts, ts);

      if(t === DUNE_TILE.SPICE){
        // Sparkle dots inside spice tiles to make them legible
        ctx.fillStyle = '#fff2b0';
        const cx = x * ts, cy = y * ts;
        ctx.fillRect(cx + ts*0.25, cy + ts*0.30, 2, 2);
        ctx.fillRect(cx + ts*0.65, cy + ts*0.55, 2, 2);
        ctx.fillRect(cx + ts*0.40, cy + ts*0.70, 2, 2);
      } else if(t === DUNE_TILE.MOUNTAIN){
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x*ts+2, y*ts+2, ts-4, ts-4);
      }
    }
  }
  // Faint grid
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let x = 0; x <= terr.cols; x++){
    ctx.moveTo(x*ts, 0); ctx.lineTo(x*ts, terr.rows*ts);
  }
  for(let y = 0; y <= terr.rows; y++){
    ctx.moveTo(0, y*ts); ctx.lineTo(terr.cols*ts, y*ts);
  }
  ctx.stroke();
}

function _duneTileColor(t){
  switch(t){
    case DUNE_TILE.SAND:     return '#d8b070';
    case DUNE_TILE.DUNE:     return '#b48050';
    case DUNE_TILE.ROCK:     return '#6e5a48';
    case DUNE_TILE.MOUNTAIN: return '#3a2a20';
    case DUNE_TILE.SPICE:    return '#e0a020';
    case DUNE_TILE.WRECK:    return '#503830';
    default:                 return '#d8b070';
  }
}

function _duneDrawDropOff(ctx, state){
  const ts = state.tileSize;
  for(const owner of ['player','enemy']){
    const d = state.dropOff[owner];
    if(!d) continue;
    const cx = d.x * ts + ts/2, cy = d.y * ts + ts/2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = owner === 'player' ? '#1a4f6a' : '#5a1e1e';
    ctx.fillRect(-ts*0.5, -ts*0.5, ts, ts);
    ctx.strokeStyle = owner === 'player' ? '#7fdfff' : '#ff7777';
    ctx.lineWidth = 2;
    ctx.strokeRect(-ts*0.5+1, -ts*0.5+1, ts-2, ts-2);
    ctx.fillStyle = '#ffe080';
    ctx.font = 'bold 10px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', 0, 0);
    ctx.restore();
  }
}

function _duneDrawUnits(ctx, state){
  for(const u of state.units){
    if(u.dead) continue;
    const cfg = DUNE_UNITS[u.type];
    const isPlayer = u.owner === 'player';

    ctx.save();
    ctx.translate(u.px, u.py);
    ctx.rotate(u.facing);

    // Selection ring (rendered before body so it's underneath)
    if(u.selected){
      ctx.rotate(-u.facing); // ring doesn't rotate
      ctx.strokeStyle = '#9bf0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, cfg.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(u.facing);
    }

    if(cfg.role === 'infantry'){
      _duneDrawInfantry(ctx, cfg, isPlayer);
    } else if(cfg.role === 'vehicle'){
      _duneDrawVehicle(ctx, cfg, isPlayer);
    } else if(cfg.role === 'harvester'){
      _duneDrawHarvester(ctx, cfg, isPlayer, u.spiceLoad / cfg.spiceCap);
    }
    ctx.restore();

    // HP bar (above unit, in screen space)
    if(u.hp < u.maxHp){
      const w = Math.max(16, cfg.radius * 2);
      const x = u.px - w/2;
      const y = u.py - cfg.radius - 7;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, 3);
      const pct = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = pct > 0.5 ? '#7be07b' : pct > 0.25 ? '#ffcc55' : '#ff6655';
      ctx.fillRect(x, y, w * pct, 3);
    }
  }
}

function _duneDrawInfantry(ctx, cfg, isPlayer){
  const r = cfg.radius;
  ctx.fillStyle = isPlayer ? cfg.color : _duneEnemyTint(cfg.color);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // small "gun" pip toward facing
  ctx.fillStyle = '#222';
  ctx.fillRect(r-1, -1, 4, 2);
}

function _duneDrawVehicle(ctx, cfg, isPlayer){
  const r = cfg.radius;
  ctx.fillStyle = isPlayer ? cfg.color : _duneEnemyTint(cfg.color);
  ctx.fillRect(-r, -r*0.7, r*2, r*1.4);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-r, -r*0.7, r*2, r*1.4);
  // Turret
  ctx.fillStyle = '#222';
  ctx.fillRect(-r*0.3, -r*0.35, r*0.6, r*0.7);
  // Barrel
  ctx.fillRect(r*0.2, -1.5, r*0.9, 3);
}

function _duneDrawHarvester(ctx, cfg, isPlayer, loadPct){
  const r = cfg.radius;
  ctx.fillStyle = isPlayer ? cfg.color : _duneEnemyTint(cfg.color);
  ctx.fillRect(-r*1.1, -r*0.8, r*2.2, r*1.6);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-r*1.1, -r*0.8, r*2.2, r*1.6);
  // Cargo bin
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(-r*0.8, -r*0.5, r*1.4, r*1);
  if(loadPct > 0){
    ctx.fillStyle = '#ffd060';
    const bw = r*1.4 * Math.min(1, loadPct);
    ctx.fillRect(-r*0.8, -r*0.5, bw, r*1);
  }
}

function _duneEnemyTint(color){
  // Quick desaturate-to-red for the enemy side without keeping a parallel palette.
  // Parses #rrggbb only — that's what DUNE_UNITS uses.
  if(color[0] !== '#' || color.length < 7) return '#cc5544';
  const r = parseInt(color.slice(1,3), 16);
  const g = parseInt(color.slice(3,5), 16);
  const b = parseInt(color.slice(5,7), 16);
  // Tilt toward red
  const nr = Math.min(255, Math.round(r * 0.5 + 180));
  const ng = Math.min(255, Math.round(g * 0.4 + 40));
  const nb = Math.min(255, Math.round(b * 0.4 + 40));
  return '#' + nr.toString(16).padStart(2,'0') + ng.toString(16).padStart(2,'0') + nb.toString(16).padStart(2,'0');
}

function _duneDrawParticles(ctx, state){
  for(const p of state.particles){
    const t = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, t);
    if(p.kind === 'tracer'){
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    } else if(p.kind === 'spark'){
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x2, p.y2, 3, 0, Math.PI*2);
      ctx.fill();
    } else if(p.kind === 'explosion'){
      ctx.fillStyle = p.color;
      const radius = (1 - t) * 18 + 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI*2);
      ctx.fill();
    } else if(p.kind === 'cursor'){
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      const r = (1 - t) * 14 + 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function _duneDrawHUD(ctx, state){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(8, 8, 220, 70);
  ctx.fillStyle = '#ffd060';
  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('SPICE: ' + (state.spice.player|0), 18, 16);
  ctx.fillStyle = '#9bf0ff';
  ctx.fillText('UNITS: ' + state.units.filter(u => u.owner === 'player' && !u.dead).length, 18, 36);
  ctx.fillStyle = '#ff7777';
  ctx.fillText('ENEMIES: ' + state.units.filter(u => u.owner === 'enemy' && !u.dead).length, 18, 56);
  ctx.restore();
}
