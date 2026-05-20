// ── SPICE WARS · RENDERING ──────────────────────────────────────────────────
// Canvas draw orchestration. Pure render — never mutates game state.
// Replaces the three earlier rendering files. Pipeline:
//   terrain → buildings → units+particles → placement preview → overlays

(function(){
  function draw(canvas){
    const ctx = canvas.getContext('2d');
    const S = window.DuneState.get();
    const tile = S.tile;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Terrain (sand / rock / spice / mountain / wreck)
    window.DuneTerrain.draw(ctx, tile);

    // 2. Drop-off anchors (only when no real refineries exist yet)
    drawDropOffMarkers(ctx, S, tile);

    // 3. Buildings
    for(const b of S.buildings){
      drawBuilding(ctx, b, tile);
    }

    // 4. Units + particles (delegated to drawDuneUnits from units-rendering glue)
    if(typeof drawDuneUnits === 'function'){
      drawDuneUnits(ctx, S, tile);
    }
    drawParticles(ctx, S, tile);

    // 5. Placement preview
    drawPreview(ctx, S, tile);
  }

  function drawDropOffMarkers(ctx, S, tile){
    // Only render markers for sides that don't yet have a refinery — once one
    // exists the harvesters route to it, and the marker becomes noise.
    for(const owner of ['player', 'enemy']){
      if(!window.DuneBuildings) continue;
      const r = window.DuneBuildings.findRefineryNear(S.cols/2, S.rows/2, owner);
      if(r) continue;
      const d = S.dropOff && S.dropOff[owner];
      if(!d) continue;
      const cx = d.x * tile + tile/2, cy = d.y * tile + tile/2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = owner === 'player' ? '#4ec0ff' : '#ff5a5a';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(-tile*0.45, -tile*0.45, tile*0.9, tile*0.9);
      ctx.restore();
    }
  }

  function drawBuilding(ctx, b, tile){
    const cfg = window.DuneConfig.BUILDINGS[b.type];
    if(!cfg) return;
    const px = b.x * tile, py = b.y * tile;
    const w = b.w * tile, h = b.h * tile;

    ctx.fillStyle = cfg.color;
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 2, py + h - 6, w - 4, 4);
    ctx.strokeStyle = b.owner === 'player' ? '#4ec0ff' : '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.floor(tile * 0.5) + 'px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.short, px + w/2, py + h/2);

    if(b.flashUntil && b.flashUntil > 0){
      ctx.fillStyle = 'rgba(217,108,46,' + Math.min(0.6, b.flashUntil) + ')';
      ctx.fillRect(px, py, w, h);
    }

    if(b.hp < b.hpMax){
      const barW = w - 6;
      const pct = b.hp / b.hpMax;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(px + 3, py + 3, barW, 3);
      ctx.fillStyle = pct > 0.5 ? '#3fd97a' : pct > 0.25 ? '#f0c14a' : '#ff5a5a';
      ctx.fillRect(px + 3, py + 3, barW * pct, 3);
    }
  }

  function drawParticles(ctx, S, tile){
    for(const p of S.particles || []){
      const a = p.life / (p.maxLife || p.life);
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = p.color || '#fff';
      ctx.fillStyle   = p.color || '#fff';
      if(p.kind === 'tracer'){
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if(p.kind === 'spark'){
        ctx.fillRect(p.x2 - 2, p.y2 - 2, 4, 4);
      } else if(p.kind === 'explosion'){
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.maxLife - p.life) * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      } else if(p.kind === 'cursor'){
        ctx.lineWidth = 2;
        const r = (p.maxLife - p.life) * 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPreview(ctx, S, tile){
    const pending = S.placement && S.placement.player;
    if(!pending || !S.hover) return;
    const cfg = window.DuneConfig.BUILDINGS[pending.type];
    const x = S.hover.x, y = S.hover.y;
    const ok = window.DuneBuildings.canPlaceAt(pending.type, x, y);

    for(let dy = 0; dy < pending.footprint.h; dy++){
      for(let dx = 0; dx < pending.footprint.w; dx++){
        const tx = x + dx, ty = y + dy;
        const px = tx * tile, py = ty * tile;
        const tileOk = window.DuneTerrain.tileAt(tx, ty) &&
          !window.DuneTerrain.isOccupied(tx, ty) &&
          (cfg.allowAnyTerrain || window.DuneTerrain.isRock(tx, ty));
        ctx.fillStyle = tileOk ? 'rgba(0,255,136,0.35)' : 'rgba(255,90,90,0.45)';
        ctx.fillRect(px, py, tile, tile);
      }
    }
    ctx.strokeStyle = ok ? '#00ff88' : '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      x * tile + 1, y * tile + 1,
      pending.footprint.w * tile - 2,
      pending.footprint.h * tile - 2
    );
  }

  window.DuneRendering = { draw };
})();

// ── UNIT RENDERING ──────────────────────────────────────────────────────────
// Lives at module scope so the units module can call drawDuneUnits without an
// import. Pulled out of the original PR #97 rendering.js — pure draw, no sim.
function drawDuneUnits(ctx, state, tile){
  if(!state || !state.units) return;
  for(const u of state.units){
    if(u.dead) continue;
    const cfg = (typeof DUNE_UNITS !== 'undefined' && DUNE_UNITS[u.type]) || null;
    if(!cfg) continue;
    const cx = u.px, cy = u.py;
    const r = cfg.radius || 5;
    const isPlayer = u.owner === 'player';

    // Selection ring
    if(u.selected){
      ctx.strokeStyle = '#9bf0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Body
    ctx.fillStyle = cfg.color || (isPlayer ? '#9bf0ff' : '#ff8866');
    if(cfg.role === 'vehicle' || cfg.role === 'harvester'){
      // Rectangular vehicle silhouette
      const w = r * 1.6, h = r * 1.1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(u.facing || 0);
      ctx.fillRect(-w/2, -h/2, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-w*0.2, -h*0.4, w*0.4, h*0.8);
      ctx.restore();
    } else {
      // Infantry — circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Owner ring
    ctx.strokeStyle = isPlayer ? '#4ec0ff' : '#ff5a5a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Spice load (harvester)
    if(cfg.harvester && u.spiceLoad > 0 && cfg.spiceCap){
      const w = r * 1.8, h = 2;
      const x = cx - w/2, y = cy + r + 3;
      ctx.fillStyle = '#d96c2e';
      ctx.fillRect(x, y, w * (u.spiceLoad / cfg.spiceCap), h);
    }

    // HP bar
    if(u.hp < u.maxHp){
      const w = r * 2;
      const x = cx - w/2, y = cy - r - 5;
      const pct = u.hp / u.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = pct > 0.5 ? '#3fd97a' : pct > 0.25 ? '#f0c14a' : '#ff5a5a';
      ctx.fillRect(x, y, w * pct, 2);
    }
  }
}
