// ════════════════════════════════════════════════════
//  DUNE — TILE / FOG RENDERING
// ════════════════════════════════════════════════════
// Draws the map onto a 2D canvas context with the camera applied.
// Renderer only owns pixels — it never mutates map or fog state.
//
// Each tile is a filled square plus a subtle accent stipple so they're
// distinguishable without sprites. Tiles outside the viewport are skipped
// via duneVisibleTileRange().

function duneDrawMap(ctx, map, fog, cam){
  const TS = DUNE_TILE_SIZE;

  // Letterbox the area beyond the map (when the map is smaller than the canvas).
  ctx.fillStyle = '#020610';
  ctx.fillRect(0, 0, cam.viewW, cam.viewH);

  const range = duneVisibleTileRange(cam, map.width, map.height);

  for(let ty = range.y0; ty <= range.y1; ty++){
    for(let tx = range.x0; tx <= range.x1; tx++){
      const fogState = fog ? fog.get(tx, ty) : DUNE_FOG.VISIBLE;
      const sx = (tx * TS) - cam.x;
      const sy = (ty * TS) - cam.y;

      if(fogState === DUNE_FOG.UNEXPLORED){
        ctx.fillStyle = '#000';
        ctx.fillRect(sx, sy, TS, TS);
        continue;
      }

      const terrain = map.get(tx, ty);
      const props   = duneTileProps(terrain);

      ctx.fillStyle = props.color;
      ctx.fillRect(sx, sy, TS, TS);

      // accent texture — single offset rect, cheap but legible
      ctx.fillStyle = props.accent;
      switch(terrain){
        case DUNE_TILE.DUNE:
          // diagonal stripe
          ctx.fillRect(sx + 2, sy + TS/2 - 2, TS - 4, 3);
          break;
        case DUNE_TILE.ROCK:
          // dimpled corners
          ctx.fillRect(sx + 3,        sy + 3,        4, 4);
          ctx.fillRect(sx + TS - 7,   sy + TS - 7,   4, 4);
          break;
        case DUNE_TILE.MOUNTAIN:
          // jagged peak triangle
          ctx.beginPath();
          ctx.moveTo(sx + TS/2, sy + 3);
          ctx.lineTo(sx + 4, sy + TS - 4);
          ctx.lineTo(sx + TS - 4, sy + TS - 4);
          ctx.closePath();
          ctx.fill();
          break;
        case DUNE_TILE.SPICE:
          ctx.fillRect(sx + TS/2 - 2, sy + TS/2 - 2, 4, 4);
          break;
        case DUNE_TILE.SPICE_BLOW:
          ctx.fillRect(sx + 4,        sy + 4,        TS - 8, TS - 8);
          ctx.fillStyle = '#fff3c4';
          ctx.fillRect(sx + TS/2 - 2, sy + TS/2 - 2, 4, 4);
          break;
        // sand: no accent, base colour is sufficient
      }

      if(fogState === DUNE_FOG.EXPLORED){
        // Dim explored-but-not-visible tiles. Drawn after the tile so the
        // base colour still bleeds through enough to hint at terrain type.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(sx, sy, TS, TS);
      }
    }
  }

  // 1px grid (very faint) — helps visually count tiles during dev.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let tx = range.x0; tx <= range.x1 + 1; tx++){
    const sx = Math.round(tx * TS - cam.x) + 0.5;
    ctx.moveTo(sx, range.y0 * TS - cam.y);
    ctx.lineTo(sx, (range.y1 + 1) * TS - cam.y);
  }
  for(let ty = range.y0; ty <= range.y1 + 1; ty++){
    const sy = Math.round(ty * TS - cam.y) + 0.5;
    ctx.moveTo(range.x0 * TS - cam.x, sy);
    ctx.lineTo((range.x1 + 1) * TS - cam.x, sy);
  }
  ctx.stroke();
}

// Optional minimap renderer — draws the whole map into a small rect.
// Other systems can call this to add unit/structure pips on top.
function duneDrawMinimap(ctx, map, fog, x, y, w, h){
  const sx = w / map.width;
  const sy = h / map.height;

  ctx.fillStyle = '#020610';
  ctx.fillRect(x, y, w, h);

  for(let ty = 0; ty < map.height; ty++){
    for(let tx = 0; tx < map.width; tx++){
      const fs = fog ? fog.get(tx, ty) : DUNE_FOG.VISIBLE;
      if(fs === DUNE_FOG.UNEXPLORED){ continue; }
      const props = duneTileProps(map.get(tx, ty));
      ctx.fillStyle = props.color;
      ctx.fillRect(x + tx * sx, y + ty * sy, Math.ceil(sx), Math.ceil(sy));
      if(fs === DUNE_FOG.EXPLORED){
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + tx * sx, y + ty * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
  }

  // viewport rectangle
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.7)';
  ctx.lineWidth = 1;
}
