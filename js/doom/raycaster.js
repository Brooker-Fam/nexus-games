// ── NEXUS DOOM · RAYCASTER ──
// Classic Wolfenstein/Doom-style 2.5D renderer.
//
// Wall pass: per-column DDA grid traversal, textured strip, distance-shaded.
// Floor/ceiling: solid colors (cheap; textured floor is a future enhancement).
// Sprite pass: camera-space transform, per-column z-buffer test.
//
// ── Map schema ────────────────────────────────────────────────────────────
// /**
//  * @typedef {Object} DoomMap
//  * @property {number}   width    Grid width in tiles.
//  * @property {number}   height   Grid height in tiles.
//  * @property {number[]} tiles    Row-major. 0 = empty, >0 = wall texture id.
//  * @property {{x:number, y:number, angle:number}[]} spawnPoints
//  *                              Where the player (and optionally entities)
//  *                              can spawn. World units = 1 per tile; the
//  *                              centre of tile (i,j) is at (i+0.5, j+0.5).
//  * @property {[number,number,number]?} floorColor  Optional RGB 0–255.
//  * @property {[number,number,number]?} ceilColor   Optional RGB 0–255.
//  */
//
// ── Entity schema ─────────────────────────────────────────────────────────
// /**
//  * @typedef {Object} DoomEntity
//  * @property {number} x           World x (tiles).
//  * @property {number} y           World y (tiles).
//  * @property {number} angle       Facing angle, radians. Renderer ignores it
//  *                                today (sprites are billboarded) but the
//  *                                gameplay layer is free to use it for AI.
//  * @property {number} sprite      Texture id for the billboard.
//  * @property {string} state       Free-form state tag ('idle','dying',...).
//  * @property {number} [scale]     Display scale, default 1.0.
//  * @property {number} [vOffset]   Vertical world offset (tiles), default 0.
//  *                                Positive = floats higher (lower screen y).
//  * @property {boolean} [dead]     If truthy, renderer skips it. Engine will
//  *                                also drop it from its internal list once
//  *                                the gameplay layer flags it.
//  * @property {(dt:number)=>void} [update] Per-tick AI callback. Optional —
//  *                                the engine calls it at the fixed timestep.
//  */
//
// Public surface (window.DoomRaycaster.create):
//   const rc = DoomRaycaster.create(canvas);
//   rc.setMap(map);
//   rc.setPlayer({ x, y, angle });
//   rc.render(entities);          // entities = DoomEntity[]
//   rc.castRay(angle) → { dist, tileX, tileY, side }   // helper for hitscan
//   rc.tileAt(x, y) → number

(function (global) {
  'use strict';

  const DEFAULT_FOV = Math.PI / 3; // 60° — classic-feeling
  const DEFAULT_FLOOR = [40, 30, 30];
  const DEFAULT_CEIL  = [25, 30, 45];

  function create(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    let W = canvas.width, H = canvas.height;
    let buffer = ctx.createImageData(W, H);
    let pixels = buffer.data;
    const zBuffer = new Float32Array(W);

    let map = null;
    let player = { x: 1.5, y: 1.5, angle: 0 };
    let fov = DEFAULT_FOV;

    function _resyncCanvas() {
      if (canvas.width === W && canvas.height === H) return;
      W = canvas.width; H = canvas.height;
      buffer = ctx.createImageData(W, H);
      pixels = buffer.data;
      // can't resize a Float32Array, but we ship a single-page canvas so this
      // only fires if the host resizes us mid-game.
      if (zBuffer.length !== W) {
        // reallocate
        const z = new Float32Array(W);
        // shadow over the closure binding
        // eslint-disable-next-line no-func-assign
        renderColumnZ = z;
      }
    }
    let renderColumnZ = zBuffer;

    function setMap(m) {
      map = m;
      if (m && m.spawnPoints && m.spawnPoints.length) {
        const s = m.spawnPoints[0];
        player.x = s.x;
        player.y = s.y;
        player.angle = s.angle || 0;
      }
    }
    function setPlayer(p) {
      if (p.x != null) player.x = p.x;
      if (p.y != null) player.y = p.y;
      if (p.angle != null) player.angle = p.angle;
    }
    function getPlayer() { return player; }
    function setFov(f) { fov = f; }

    function tileAt(x, y) {
      if (!map) return 0;
      const tx = x | 0, ty = y | 0;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 1;
      return map.tiles[ty * map.width + tx] | 0;
    }

    // DDA cast for one ray direction. Returns hit info; never returns null
    // because we treat out-of-bounds as a wall.
    function castRayDir(rdx, rdy) {
      let mapX = player.x | 0;
      let mapY = player.y | 0;

      const deltaDistX = rdx === 0 ? Infinity : Math.abs(1 / rdx);
      const deltaDistY = rdy === 0 ? Infinity : Math.abs(1 / rdy);

      let stepX, sideDistX, stepY, sideDistY;
      if (rdx < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
      else         { stepX =  1; sideDistX = (mapX + 1 - player.x) * deltaDistX; }
      if (rdy < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
      else         { stepY =  1; sideDistY = (mapY + 1 - player.y) * deltaDistY; }

      let side = 0;
      let tile = 0;
      // hard cap so a degenerate map can't lock the loop
      const maxSteps = (map ? map.width + map.height : 64) * 2 + 4;
      for (let i = 0; i < maxSteps; i++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        tile = tileAt(mapX, mapY);
        if (tile > 0) break;
      }
      const perp = side === 0
        ? (sideDistX - deltaDistX)
        : (sideDistY - deltaDistY);
      // texture u coordinate
      let wallU = side === 0
        ? player.y + perp * rdy
        : player.x + perp * rdx;
      wallU -= Math.floor(wallU);
      // flip so textures don't mirror across opposite faces
      if (side === 0 && rdx > 0) wallU = 1 - wallU;
      if (side === 1 && rdy < 0) wallU = 1 - wallU;

      return {
        dist: Math.max(perp, 0.0001),
        tile,
        tileX: mapX,
        tileY: mapY,
        side,
        u: wallU,
      };
    }

    // Convenience wrapper for hitscan calls from gameplay code.
    function castRay(angle) {
      return castRayDir(Math.cos(angle), Math.sin(angle));
    }

    function _clearFrame() {
      const floor = (map && map.floorColor) || DEFAULT_FLOOR;
      const ceil  = (map && map.ceilColor)  || DEFAULT_CEIL;
      const half = (H >> 1) * W * 4;
      // ceiling
      for (let i = 0; i < half; i += 4) {
        pixels[i]     = ceil[0];
        pixels[i + 1] = ceil[1];
        pixels[i + 2] = ceil[2];
        pixels[i + 3] = 255;
      }
      // floor
      const end = W * H * 4;
      for (let i = half; i < end; i += 4) {
        pixels[i]     = floor[0];
        pixels[i + 1] = floor[1];
        pixels[i + 2] = floor[2];
        pixels[i + 3] = 255;
      }
    }

    function _renderWalls() {
      const pa = player.angle;
      const dirX = Math.cos(pa);
      const dirY = Math.sin(pa);
      const planeMag = Math.tan(fov / 2);
      const planeX = -dirY * planeMag;
      const planeY =  dirX * planeMag;

      for (let col = 0; col < W; col++) {
        // camera-plane x in [-1, 1]
        const cameraX = 2 * col / W - 1;
        const rdx = dirX + planeX * cameraX;
        const rdy = dirY + planeY * cameraX;
        const hit = castRayDir(rdx, rdy);

        // `dist` is already perpendicular (DDA accumulates along axis-aligned
        // step lengths and the cos correction is baked in), so no fish-eye fix.
        const perpDist = hit.dist;
        renderColumnZ[col] = perpDist;

        const lineHeight = (H / perpDist) | 0;
        let drawStart = (-lineHeight / 2 + H / 2) | 0;
        let drawEnd = (lineHeight / 2 + H / 2) | 0;
        const clipStart = Math.max(drawStart, 0);
        const clipEnd = Math.min(drawEnd, H - 1);

        const tex = global.DoomTextures.get(hit.tile);
        const shade = hit.side === 1 ? 0.7 : 1.0;
        const distShade = Math.max(0.25, Math.min(1, 4 / (perpDist + 0.5))) * shade;

        if (tex) {
          const tw = tex.width, th = tex.height;
          const texX = Math.min(tw - 1, Math.max(0, (hit.u * tw) | 0));
          // walk every screen row in this column, sample texY
          for (let y = clipStart; y <= clipEnd; y++) {
            const d = y * 256 - H * 128 + lineHeight * 128;
            let texY = ((d * th) / lineHeight) >> 8;
            if (texY < 0) texY = 0;
            else if (texY >= th) texY = th - 1;
            const ti = (texY * tw + texX) * 4;
            const pi = (y * W + col) * 4;
            pixels[pi]     = tex.pixels[ti]     * distShade;
            pixels[pi + 1] = tex.pixels[ti + 1] * distShade;
            pixels[pi + 2] = tex.pixels[ti + 2] * distShade;
            pixels[pi + 3] = 255;
          }
        } else {
          // flat-shaded fallback
          const r = (200 * distShade) | 0;
          const g = (80 * distShade) | 0;
          const b = (80 * distShade) | 0;
          for (let y = clipStart; y <= clipEnd; y++) {
            const pi = (y * W + col) * 4;
            pixels[pi] = r; pixels[pi + 1] = g; pixels[pi + 2] = b; pixels[pi + 3] = 255;
          }
        }
      }
    }

    // Sprites: classic Lode/Wolf transform. We compute screen X and a height
    // matching the wall projection, then per-column compare against zBuffer.
    function _renderSprites(entities) {
      if (!entities || !entities.length) return;
      const pa = player.angle;
      const dirX = Math.cos(pa);
      const dirY = Math.sin(pa);
      // camera plane is perpendicular to dir, scaled by tan(fov/2)
      const planeMag = Math.tan(fov / 2);
      const planeX = -dirY * planeMag;
      const planeY =  dirX * planeMag;
      const invDet = 1.0 / (planeX * dirY - dirX * planeY);

      // depth-sort: far first so nearer sprites overwrite (single z-buffer
      // per column already handles wall occlusion, but sprite-vs-sprite needs
      // back-to-front).
      const renderList = [];
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (!e || e.dead) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        renderList.push({ e, d2: dx * dx + dy * dy });
      }
      renderList.sort((a, b) => b.d2 - a.d2);

      for (let i = 0; i < renderList.length; i++) {
        const e = renderList[i].e;
        const dx = e.x - player.x;
        const dy = e.y - player.y;

        // transform sprite with the inverse camera matrix
        const transformX = invDet * (dirY * dx - dirX * dy);
        const transformY = invDet * (-planeY * dx + planeX * dy);
        if (transformY <= 0.001) continue; // behind camera

        const spriteScreenX = ((W / 2) * (1 + transformX / transformY)) | 0;
        const scale = e.scale || 1;
        const spriteHeight = Math.abs(((H / transformY) * scale) | 0);
        const vOffsetPixels = ((e.vOffset || 0) * (H / transformY)) | 0;

        let drawStartY = (-spriteHeight / 2 + H / 2 - vOffsetPixels) | 0;
        let drawEndY = (spriteHeight / 2 + H / 2 - vOffsetPixels) | 0;
        const clipStartY = Math.max(drawStartY, 0);
        const clipEndY = Math.min(drawEndY, H - 1);

        const spriteWidth = spriteHeight; // square sprites for now
        let drawStartX = (-spriteWidth / 2 + spriteScreenX) | 0;
        let drawEndX = (spriteWidth / 2 + spriteScreenX) | 0;
        const clipStartX = Math.max(drawStartX, 0);
        const clipEndX = Math.min(drawEndX, W - 1);

        const tex = global.DoomTextures.get(e.sprite);
        if (!tex) continue;
        const tw = tex.width, th = tex.height;
        const distShade = Math.max(0.3, Math.min(1, 4 / (transformY + 0.5)));

        for (let stripe = clipStartX; stripe <= clipEndX; stripe++) {
          if (transformY >= renderColumnZ[stripe]) continue;
          const texX = (((stripe - drawStartX) * tw) / spriteWidth) | 0;
          if (texX < 0 || texX >= tw) continue;
          for (let y = clipStartY; y <= clipEndY; y++) {
            const d = (y - drawStartY) * th;
            const texY = (d / spriteHeight) | 0;
            if (texY < 0 || texY >= th) continue;
            const ti = (texY * tw + texX) * 4;
            const a = tex.pixels[ti + 3];
            if (a < 8) continue;
            const pi = (y * W + stripe) * 4;
            pixels[pi]     = tex.pixels[ti]     * distShade;
            pixels[pi + 1] = tex.pixels[ti + 1] * distShade;
            pixels[pi + 2] = tex.pixels[ti + 2] * distShade;
            pixels[pi + 3] = 255;
          }
        }
      }
    }

    function render(entities) {
      _resyncCanvas();
      if (!map) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        return;
      }
      _clearFrame();
      _renderWalls();
      _renderSprites(entities);
      ctx.putImageData(buffer, 0, 0);
    }

    return {
      setMap,
      setPlayer,
      getPlayer,
      setFov,
      castRay,
      tileAt,
      render,
      get width()  { return W; },
      get height() { return H; },
      get zBuffer() { return renderColumnZ; },
    };
  }

  global.DoomRaycaster = { create };
})(window);
