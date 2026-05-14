// ── NEXUS DOOM · HUD ──
// Status bar, weapon viewmodel, face portrait, damage vignette, screen
// shake. Renders to a second canvas overlaid on top of the game canvas
// so the engine renderer can keep writing ImageData unconditionally.
//
// Also installs the procedural sprites that combat.js references by id
// (pickups, enemies, projectile) so the engine has something to draw.

(function (global) {
  'use strict';

  // ── Sprite installers ───────────────────────────────────────────────────
  function _installSprites() {
    if (!global.DoomTextures) return;
    const dt = global.DoomTextures;
    // Helpers
    function ellipse(x, y, cx, cy, rx, ry) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }

    // Ammo: 200 clip (bullets), 201 shells, 202 rocket, 203 cells
    if (!dt.has(200)) dt.addProcedural(200, 64, 64, (x, y) => {
      if (x < 14 || x > 50 || y < 22 || y > 42) return [0, 0, 0, 0];
      const stripe = ((x - 14) % 12) < 8;
      return stripe ? [220, 200, 60, 255] : [60, 40, 20, 255];
    });
    if (!dt.has(201)) dt.addProcedural(201, 64, 64, (x, y) => {
      if (x < 14 || x > 50 || y < 24 || y > 42) return [0, 0, 0, 0];
      const col = ((x - 14) / 12) | 0;
      const r = ((x - 14) % 12) - 6;
      const within = r > -5 && r < 5;
      if (!within) return [0, 0, 0, 0];
      const top = y < 30;
      return top ? [220, 220, 220, 255] : [200, 30, 30, 255];
    });
    if (!dt.has(202)) dt.addProcedural(202, 64, 64, (x, y) => {
      const cx = 32, cy = 32;
      if (!ellipse(x, y, cx, cy, 22, 8)) return [0, 0, 0, 0];
      const nose = x > 48;
      const tail = x < 16;
      if (nose) return [220, 90, 40, 255];
      if (tail) return [255, 220, 90, 255];
      return [220, 220, 220, 255];
    });
    if (!dt.has(203)) dt.addProcedural(203, 64, 64, (x, y) => {
      if (x < 18 || x > 46 || y < 22 || y > 42) return [0, 0, 0, 0];
      const lx = (x - 18) % 8, ly = (y - 22) % 6;
      if (lx < 1 || ly < 1) return [40, 60, 80, 255];
      const glow = Math.sin((x + y) * 0.4) * 60;
      return [60 + glow * 0.3, 180 + glow * 0.4, 220, 255];
    });

    // Health: 210 stimpack (small), 211 medkit (big white box with red cross)
    if (!dt.has(210)) dt.addProcedural(210, 64, 64, (x, y) => {
      const cx = 32, cy = 32;
      if (Math.abs(x - cx) > 16 || Math.abs(y - cy) > 6) return [0, 0, 0, 0];
      const tip = Math.abs(x - cx) > 13;
      return tip ? [180, 180, 200, 255] : [220, 90, 90, 255];
    });
    if (!dt.has(211)) dt.addProcedural(211, 64, 64, (x, y) => {
      if (x < 14 || x > 50 || y < 16 || y > 50) return [0, 0, 0, 0];
      const inH = (y > 28 && y < 38);
      const inV = (x > 27 && x < 37);
      const border = x < 16 || x > 48 || y < 18 || y > 48;
      if (border) return [180, 60, 60, 255];
      if (inH || inV) return [220, 40, 40, 255];
      return [240, 240, 240, 255];
    });

    // Armor: 220 green, 221 blue
    if (!dt.has(220)) dt.addProcedural(220, 64, 64, (x, y) => {
      const cx = 32, cy = 32;
      if (!ellipse(x, y, cx, cy, 18, 22)) return [0, 0, 0, 0];
      const pl = ((x + y) % 8) < 4;
      return pl ? [60, 180, 80, 255] : [40, 130, 60, 255];
    });
    if (!dt.has(221)) dt.addProcedural(221, 64, 64, (x, y) => {
      const cx = 32, cy = 32;
      if (!ellipse(x, y, cx, cy, 18, 22)) return [0, 0, 0, 0];
      const pl = ((x + y) % 8) < 4;
      return pl ? [80, 130, 220, 255] : [50, 90, 180, 255];
    });

    // Weapon pickups: 250 shotgun, 251 chaingun, 252 rocket launcher
    if (!dt.has(250)) dt.addProcedural(250, 64, 64, (x, y) => {
      if (x < 8 || x > 56 || y < 26 || y > 38) return [0, 0, 0, 0];
      const barrel = y > 28 && y < 36 && x < 50;
      const stock = x > 40;
      if (stock) return [80, 50, 30, 255];
      if (barrel) return [150, 150, 160, 255];
      return [60, 40, 30, 255];
    });
    if (!dt.has(251)) dt.addProcedural(251, 64, 64, (x, y) => {
      if (x < 6 || x > 58 || y < 26 || y > 40) return [0, 0, 0, 0];
      const body = x > 22 && x < 50;
      const barrels = x < 22;
      if (barrels) {
        const ry = (y - 28) % 4;
        return ry < 2 ? [180, 180, 190, 255] : [40, 40, 50, 255];
      }
      if (body) return [70, 70, 80, 255];
      return [50, 50, 60, 255];
    });
    if (!dt.has(252)) dt.addProcedural(252, 64, 64, (x, y) => {
      if (x < 8 || x > 56 || y < 28 || y > 38) return [0, 0, 0, 0];
      return [60, 60, 70, 255];
    });

    // Enemies: 230 zombie (green), 231 imp (brown), 232 demon (red)
    function bodySprite(palette) {
      return (x, y) => {
        const cx = x - 32, cy = y - 32;
        const r = Math.sqrt(cx * cx + cy * cy);
        if (r > 28) return [0, 0, 0, 0];
        if (r > 24) return palette.outline;
        if (cy < -8 && r < 12) return palette.head;
        if (cy >= -8 && cy < 14 && Math.abs(cx) < 14) return palette.body;
        if (Math.abs(cy) < 4 && Math.abs(cx) < 22) return palette.arm;
        return palette.dark;
      };
    }
    if (!dt.has(230)) dt.addProcedural(230, 64, 64, bodySprite({
      head: [200, 200, 180, 255],
      body: [80, 140, 80, 255],
      arm:  [70, 120, 70, 255],
      dark: [30, 60, 30, 255],
      outline: [10, 30, 10, 255],
    }));
    if (!dt.has(231)) dt.addProcedural(231, 64, 64, bodySprite({
      head: [180, 110, 70, 255],
      body: [150, 80, 40, 255],
      arm:  [130, 70, 30, 255],
      dark: [60, 30, 10, 255],
      outline: [40, 20, 10, 255],
    }));
    if (!dt.has(232)) dt.addProcedural(232, 64, 64, bodySprite({
      head: [200, 100, 100, 255],
      body: [180, 40, 40, 255],
      arm:  [150, 30, 30, 255],
      dark: [80, 10, 10, 255],
      outline: [40, 0, 0, 255],
    }));

    // 240 rocket projectile
    if (!dt.has(240)) dt.addProcedural(240, 64, 64, (x, y) => {
      const cx = 32, cy = 32;
      if (!ellipse(x, y, cx, cy, 22, 7)) return [0, 0, 0, 0];
      const nose = x > 48;
      const flame = x < 14;
      if (flame) {
        const f = (Math.random() < 0.5);
        return f ? [255, 200, 60, 255] : [255, 80, 30, 255];
      }
      if (nose) return [200, 60, 40, 255];
      return [180, 180, 180, 255];
    });
  }

  // ── HUD state ───────────────────────────────────────────────────────────
  let hudCanvas = null;
  let hudCtx = null;
  let gameCanvas = null;
  let wrap = null;
  let raf = null;
  let active = false;
  let prevTime = 0;
  let bobX = 0, bobY = 0;
  let lastShakeX = 0, lastShakeY = 0;
  let faceFrame = 0;
  let faceLookTimer = 0;
  let faceLookOffset = 0;

  // ── Public init / cleanup ───────────────────────────────────────────────
  function init() {
    _installSprites();
    hudCanvas = document.getElementById('doomHudCanvas');
    gameCanvas = document.getElementById('doomCanvas');
    wrap = document.querySelector('.doom-canvas-wrap');
    if (!hudCanvas || !gameCanvas) return;
    // Match HUD canvas size to the game canvas.
    hudCanvas.width = gameCanvas.width;
    hudCanvas.height = gameCanvas.height;
    hudCtx = hudCanvas.getContext('2d');
    active = true;
    prevTime = performance.now();
    if (!raf) raf = requestAnimationFrame(_loop);
  }
  function cleanup() {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (wrap) wrap.style.transform = '';
  }

  function _loop(now) {
    if (!active) return;
    const dt = Math.min(0.1, (now - prevTime) / 1000);
    prevTime = now;
    _draw(dt);
    raf = requestAnimationFrame(_loop);
  }

  // ── Drawing ─────────────────────────────────────────────────────────────
  function _draw(dt) {
    if (!hudCtx || !gameCanvas) return;
    const W = hudCanvas.width, H = hudCanvas.height;
    hudCtx.clearRect(0, 0, W, H);

    const ws = global.DoomWeapons && global.DoomWeapons.state;
    const player = global.DoomCombat && global.DoomCombat.player;

    // 1) Screen shake — applied to the wrap (moves both canvases together).
    if (wrap && player && player.shakeAmp > 0) {
      const amp = player.shakeAmp * (player.shakeTime / 0.28);
      const sx = (Math.random() - 0.5) * amp * 2;
      const sy = (Math.random() - 0.5) * amp * 2;
      lastShakeX = sx; lastShakeY = sy;
      wrap.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    } else if (wrap && (lastShakeX !== 0 || lastShakeY !== 0)) {
      lastShakeX = 0; lastShakeY = 0;
      wrap.style.transform = '';
    }

    // 2) Weapon viewmodel (always above the game, below HUD bar / vignette).
    if (ws) _drawViewmodel(W, H, dt);

    // 3) Damage vignette (red wash + corner darkening).
    if (player && (player.hurtFlash > 0 || player.dead)) {
      _drawVignette(W, H, player.dead ? 1 : player.hurtFlash);
    }

    // 4) Crosshair (cheap centred dot).
    _drawCrosshair(W, H);

    // 5) Pickup message banner.
    if (player && player.pickupMsg) {
      _drawPickupMsg(W, H, player.pickupMsg, player.pickupMsgTime);
    }

    // 6) Status bar at the bottom.
    if (ws && player) _drawStatusBar(W, H, ws, player);

    // 7) Death overlay.
    if (player && player.dead) _drawDeath(W, H);
  }

  function _drawCrosshair(W, H) {
    const cx = (W / 2) | 0, cy = (H / 2) | 0;
    hudCtx.fillStyle = 'rgba(255, 80, 90, 0.85)';
    hudCtx.fillRect(cx - 1, cy - 6, 2, 4);
    hudCtx.fillRect(cx - 1, cy + 2, 2, 4);
    hudCtx.fillRect(cx - 6, cy - 1, 4, 2);
    hudCtx.fillRect(cx + 2, cy - 1, 4, 2);
  }

  function _drawVignette(W, H, intensity) {
    const i = Math.min(1, intensity);
    // Red wash
    hudCtx.fillStyle = `rgba(220, 30, 30, ${0.18 * i})`;
    hudCtx.fillRect(0, 0, W, H);
    // Corner darkening
    const grad = hudCtx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(80,0,0,${0.55 * i})`);
    hudCtx.fillStyle = grad;
    hudCtx.fillRect(0, 0, W, H);
  }

  function _drawPickupMsg(W, H, text, ttl) {
    const a = Math.min(1, ttl / 1.6);
    hudCtx.save();
    hudCtx.globalAlpha = a;
    hudCtx.font = 'bold 16px Orbitron, monospace';
    hudCtx.textAlign = 'center';
    hudCtx.fillStyle = '#ffd86b';
    hudCtx.strokeStyle = 'rgba(0,0,0,0.7)';
    hudCtx.lineWidth = 3;
    hudCtx.strokeText(text, W / 2, 40);
    hudCtx.fillText(text, W / 2, 40);
    hudCtx.restore();
  }

  function _drawDeath(W, H) {
    hudCtx.fillStyle = 'rgba(40,0,0,0.5)';
    hudCtx.fillRect(0, 0, W, H);
    hudCtx.font = 'bold 56px Orbitron, sans-serif';
    hudCtx.textAlign = 'center';
    hudCtx.fillStyle = '#ff3a4a';
    hudCtx.fillText('YOU DIED', W / 2, H / 2 - 20);
    hudCtx.font = '14px Orbitron, monospace';
    hudCtx.fillStyle = '#ffaaaa';
    hudCtx.fillText('Press R to restart', W / 2, H / 2 + 14);
  }

  // ── Viewmodel ───────────────────────────────────────────────────────────
  function _drawViewmodel(W, H, dt) {
    const ws = global.DoomWeapons.state;
    const w = global.DoomWeapons.WEAPONS[ws.current];
    if (!w) return;
    const moving = !!(global._doomInputState && global._doomInputState.movingFlag);
    ws.bobPhase += dt * (moving ? 8 : 2);
    const targetAmp = moving ? 1 : 0.25;
    ws.bobAmp += (targetAmp - ws.bobAmp) * 0.1;

    const bx = Math.sin(ws.bobPhase) * 8 * ws.bobAmp;
    const by = Math.abs(Math.cos(ws.bobPhase)) * 6 * ws.bobAmp;
    bobX = bx; bobY = by;

    let lowerY = 0;
    if (ws.lowering) {
      const t = 1 - ws.switchTimer / (w.switchTime || 0.2);
      lowerY = t * 140;
    } else if (ws.raising) {
      const t = ws.switchTimer / (w.switchTime || 0.2);
      lowerY = t * 140;
    }

    const cx = W / 2 + bx;
    const cy = H + 8 + by + lowerY;

    const fireKick = ws.cooldown > 0 ? Math.min(1, ws.cooldown / w.fireRate) : 0;
    const yK = fireKick * 14;

    // Draw weapon shape based on id.
    _drawWeaponShape(ws.current, cx, cy - yK, w);

    // Muzzle flash overlay while fireFlash > 0.
    if (ws.fireFlash > 0 && ws.current !== 'fist') {
      _drawMuzzleFlash(cx, cy - yK, ws.current, ws.fireFlash);
    }
  }

  function _drawWeaponShape(id, cx, cy, w) {
    const ctx = hudCtx;
    ctx.save();
    ctx.translate(cx, cy);
    const c = w.view.color, a = w.view.accent;
    if (id === 'fist') {
      // Right-side gloved fist.
      ctx.translate(80, -10);
      ctx.fillStyle = c;
      _roundRect(ctx, -50, -50, 100, 80, 16, true, false);
      ctx.fillStyle = a;
      ctx.fillRect(-30, 10, 60, 12); // wrist band
      ctx.fillStyle = '#1f1f25';
      // knuckle pips
      [[-30, -20], [-10, -28], [10, -28], [30, -20]].forEach(([px, py]) => {
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      });
    } else if (id === 'pistol') {
      ctx.fillStyle = '#1d1d22';
      _roundRect(ctx, -16, -110, 32, 60, 4, true, false); // barrel
      ctx.fillStyle = c;
      _roundRect(ctx, -32, -56, 64, 86, 6, true, false);  // grip housing
      ctx.fillStyle = a;
      ctx.fillRect(-24, -50, 48, 8);
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(-4, -110, 8, 8); // muzzle hole
    } else if (id === 'shotgun') {
      ctx.fillStyle = '#15131a';
      _roundRect(ctx, -24, -150, 48, 110, 4, true, false); // barrel(s)
      ctx.fillStyle = a;
      ctx.fillRect(-22, -148, 12, 106);
      ctx.fillRect(10, -148, 12, 106);
      ctx.fillStyle = c;
      _roundRect(ctx, -34, -40, 68, 80, 6, true, false);   // stock
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(-30, -28, 60, 8);
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(-18, -150, 8, 8);
      ctx.fillRect(10, -150, 8, 8);
    } else if (id === 'chaingun') {
      ctx.fillStyle = c;
      _roundRect(ctx, -52, -130, 104, 50, 8, true, false); // housing
      ctx.fillStyle = a;
      // 4 rotating barrels
      const rot = (performance.now() * 0.04) % (Math.PI * 2);
      for (let i = 0; i < 4; i++) {
        const ang = rot + i * Math.PI / 2;
        const bx2 = Math.cos(ang) * 14;
        const by2 = Math.sin(ang) * 8 - 140;
        ctx.beginPath(); ctx.arc(bx2, by2, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath(); ctx.arc(0, -140, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      _roundRect(ctx, -22, -68, 44, 96, 4, true, false); // grip
    } else if (id === 'rocketLauncher') {
      ctx.fillStyle = c;
      _roundRect(ctx, -30, -150, 60, 130, 8, true, false); // tube
      ctx.fillStyle = a;
      ctx.fillRect(-26, -50, 52, 12);
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath(); ctx.arc(0, -150, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      _roundRect(ctx, -18, -22, 36, 60, 4, true, false); // grip
    }
    ctx.restore();
  }

  function _drawMuzzleFlash(cx, cy, id, ttl) {
    const ctx = hudCtx;
    const a = Math.min(1, ttl / 0.08);
    let mx = cx, my = cy - 130;
    if (id === 'shotgun') { my = cy - 160; }
    if (id === 'chaingun') { my = cy - 145; }
    if (id === 'rocketLauncher') { my = cy - 160; }
    const grad = ctx.createRadialGradient(mx, my, 2, mx, my, 38);
    grad.addColorStop(0, `rgba(255,240,120,${0.95 * a})`);
    grad.addColorStop(0.5, `rgba(255,160,40,${0.6 * a})`);
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(mx - 40, my - 40, 80, 80);
  }

  function _roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // ── Status bar ──────────────────────────────────────────────────────────
  function _drawStatusBar(W, H, ws, player) {
    const ctx = hudCtx;
    const barH = 84;
    const y0 = H - barH;
    // Background
    const grad = ctx.createLinearGradient(0, y0, 0, H);
    grad.addColorStop(0, 'rgba(8, 4, 14, 0.92)');
    grad.addColorStop(1, 'rgba(2, 0, 4, 0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, W, barH);
    ctx.fillStyle = 'rgba(255, 0, 136, 0.55)';
    ctx.fillRect(0, y0, W, 2);

    // Left block: HEALTH + ARMOR
    _statBox(ctx, 14, y0 + 12, 'HEALTH', player.hp + '%', player.hp < 30 ? '#ff5a5a' : '#7cffd4');
    _statBox(ctx, 14, y0 + 46, 'ARMOR',
      (player.armor | 0) + (player.armorClass === 2 ? ' BLU' : ''),
      player.armorClass === 2 ? '#7ab4ff' : '#7cff8a');

    // Right block: AMMO
    const w = global.DoomWeapons.WEAPONS[ws.current];
    const ammoLabel = w.ammoType ? w.ammoType.toUpperCase() : 'MELEE';
    const ammoVal = w.ammoType ? String(ws.ammo[w.ammoType]) : '∞';
    _statBox(ctx, W - 130, y0 + 12, ammoLabel, ammoVal, '#ffd86b');
    // small list of all ammo
    ctx.font = '10px Orbitron, monospace';
    ctx.textAlign = 'right';
    let ay = y0 + 50;
    const ammoColors = { clip: '#ffd86b', shells: '#ff9a4d', rockets: '#ff6b6b', cells: '#7ec8ff' };
    for (const t of ['clip', 'shells', 'rockets', 'cells']) {
      ctx.fillStyle = ammoColors[t];
      ctx.fillText(t.slice(0, 4).toUpperCase() + ' ' + ws.ammo[t] + '/' + ws.maxAmmo[t], W - 14, ay);
      ay += 12;
    }

    // Center: face portrait + weapon slots
    _drawFace(W / 2 - 26, y0 + 8, 52, player);
    _drawWeaponSlots(W, y0 + barH - 24, ws);

    // Score / kills
    ctx.textAlign = 'left';
    ctx.font = '10px Orbitron, monospace';
    ctx.fillStyle = '#9a9aff';
    ctx.fillText('SCORE ' + player.score, 160, y0 + 22);
    ctx.fillText('KILLS ' + player.kills, 160, y0 + 38);
  }

  function _statBox(ctx, x, y, label, value, valueColor) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 1);
    ctx.font = 'bold 22px Orbitron, monospace';
    ctx.fillStyle = valueColor;
    ctx.fillText(value, x, y + 22);
  }

  function _drawWeaponSlots(W, y, ws) {
    const ctx = hudCtx;
    const slots = [1, 2, 3, 4, 5];
    const baseX = W / 2 - (slots.length * 26) / 2;
    for (let i = 0; i < slots.length; i++) {
      const id = global.DoomWeapons.SLOTS[slots[i]];
      const owned = ws.owned[id];
      const cur = ws.current === id;
      const x = baseX + i * 26;
      ctx.fillStyle = cur ? 'rgba(255,0,136,0.6)' : (owned ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)');
      ctx.fillRect(x, y, 22, 16);
      ctx.fillStyle = cur ? '#fff' : (owned ? '#bbb' : '#444');
      ctx.font = 'bold 10px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(slots[i]), x + 11, y + 11);
    }
  }

  // ── Face portrait ───────────────────────────────────────────────────────
  // Programmatic 5-frame face (calm → hurt → bloody → dead) based on HP.
  function _drawFace(x, y, size, player) {
    const ctx = hudCtx;
    // Pick frame by hp%
    const pct = player.dead ? -1 : (player.hp / player.maxHp);
    let frame = 0;
    if (pct < 0) frame = 4;
    else if (pct >= 0.8) frame = 0;
    else if (pct >= 0.6) frame = 1;
    else if (pct >= 0.4) frame = 2;
    else if (pct >= 0.2) frame = 3;
    else frame = 4;
    if (player.facePainTimer > 0 && !player.dead) frame = Math.max(frame, 2);

    // Face panel background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = 'rgba(255,0,136,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Head
    const cx = x + size / 2, cy = y + size / 2 + 2;
    const skin = ['#f5c08a', '#e3a06a', '#d18852', '#b86840', '#3d1c14'][frame];
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.35, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#3a1d0a';
    ctx.beginPath();
    ctx.ellipse(cx, cy - size * 0.25, size * 0.36, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    if (frame >= 4) {
      // Dead — X eyes + frown
      ctx.strokeStyle = '#400';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4); ctx.lineTo(cx - 4, cy);
      ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx + 8, cy - 4); ctx.lineTo(cx + 4, cy);
      ctx.stroke();
      ctx.strokeStyle = '#600';
      ctx.beginPath();
      ctx.arc(cx, cy + 9, 4, Math.PI, 0, true);
      ctx.stroke();
    } else {
      // Eye look offset (refreshes every 0.7s, never while in pain).
      faceLookTimer -= 1 / 60;
      if (faceLookTimer <= 0 && player.facePainTimer <= 0) {
        faceLookTimer = 0.6 + Math.random() * 0.8;
        faceLookOffset = (Math.random() * 2 - 1) * 1.2;
      }
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 9, cy - 5, 5, 4);
      ctx.fillRect(cx + 4, cy - 5, 5, 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - 8 + faceLookOffset, cy - 4, 2, 2);
      ctx.fillRect(cx + 5 + faceLookOffset, cy - 4, 2, 2);

      // Mouth
      ctx.strokeStyle = '#400';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (frame === 0) {
        ctx.moveTo(cx - 6, cy + 8); ctx.lineTo(cx + 6, cy + 8);
      } else if (frame === 1) {
        ctx.moveTo(cx - 6, cy + 7); ctx.lineTo(cx + 6, cy + 9);
      } else if (frame === 2) {
        ctx.arc(cx, cy + 10, 4, Math.PI, 0, true);
      } else {
        ctx.moveTo(cx - 8, cy + 11); ctx.lineTo(cx + 8, cy + 6);
      }
      ctx.stroke();

      // Blood splatters for frames 2-3
      if (frame >= 2) {
        ctx.fillStyle = '#a00';
        ctx.fillRect(cx - 11 + Math.random() * 2, cy - 8, 2, 2);
        ctx.fillRect(cx + 7, cy + 2, 2, 3);
        ctx.fillRect(cx - 4, cy - 12, 2, 2);
      }
      if (frame === 3) {
        ctx.fillStyle = '#c00';
        ctx.fillRect(cx - 8, cy + 3, 14, 1);
      }
    }
  }

  global.DoomHud = { init, cleanup };
})(window);
