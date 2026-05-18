// ── SPICE WARS · RENDERING ──────────────────────────────────────────────────
// Canvas draw orchestration. Pure render — never mutates game state.

(function(){
  function draw(canvas){
    const ctx = canvas.getContext('2d');
    const S = window.DuneState.get();
    const tile = S.tile;

    // 1. Terrain
    window.DuneTerrain.draw(ctx, tile);

    // 2. Buildings
    for(const b of S.buildings){
      drawBuilding(ctx, b, tile);
    }

    // 3. Units
    if(window.DuneUnits) window.DuneUnits.draw(ctx, tile);

    // 4. Placement preview
    drawPreview(ctx, S, tile);
  }

  function drawBuilding(ctx, b, tile){
    const cfg = window.DuneConfig.BUILDINGS[b.type];
    if(!cfg) return;
    const px = b.x * tile, py = b.y * tile;
    const w = b.w * tile, h = b.h * tile;

    // Body
    ctx.fillStyle = cfg.color;
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4);
    // Darker inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 2, py + h - 6, w - 4, 4);
    // Owner border
    ctx.strokeStyle = b.owner === 'player' ? '#4ec0ff' : '#ff5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.floor(tile * 0.5) + 'px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.short, px + w/2, py + h/2);

    // Refinery flash on spice delivery
    if(b.flashUntil && b.flashUntil > 0){
      ctx.fillStyle = 'rgba(217,108,46,' + Math.min(0.6, b.flashUntil) + ')';
      ctx.fillRect(px, py, w, h);
    }

    // HP bar
    if(b.hp < b.hpMax){
      const barW = w - 6;
      const pct = b.hp / b.hpMax;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(px + 3, py + 3, barW, 3);
      ctx.fillStyle = pct > 0.5 ? '#3fd97a' : pct > 0.25 ? '#f0c14a' : '#ff5a5a';
      ctx.fillRect(px + 3, py + 3, barW * pct, 3);
    }
  }

  function drawPreview(ctx, S, tile){
    const pending = S.placement.player;
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
    // Outline
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
