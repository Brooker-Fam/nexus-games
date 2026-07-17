// HUD: classic Doom-style status bar drawn over the engine's framebuffer.
// All drawing happens with the canvas 2D context — the real engine should
// expose its <canvas> via engine.getCanvas() so the HUD can layer on top.

import { WEAPONS } from './config.js';

const BAR_BG = '#262221';
const BAR_FG = '#b0a99f';
const ACCENT_RED = '#d23f31';
const ACCENT_BLUE = '#2f7fd6';
const ACCENT_GREEN = '#69c062';
const ACCENT_YELLOW = '#e6b800';

export function drawHud(ctx, game) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const player = game.player;
  if (!player) return;

  drawWeaponSprite(ctx, w, h, player);
  drawCenterReticle(ctx, w, h);
  drawStatusBar(ctx, w, h, game);
  drawMessage(ctx, w, h, player);

  if (player.painTimer > 0) drawPainOverlay(ctx, w, h, player.painTimer);
}

function drawStatusBar(ctx, w, h, game) {
  const barH = Math.max(54, Math.round(h * 0.13));
  const y = h - barH;

  // Bar bg with a metallic gradient.
  const grd = ctx.createLinearGradient(0, y, 0, h);
  grd.addColorStop(0, '#1a1818');
  grd.addColorStop(0.4, '#2a2624');
  grd.addColorStop(1, '#0e0c0b');
  ctx.fillStyle = grd;
  ctx.fillRect(0, y, w, barH);

  // Top divider lip.
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(0, y, w, 2);

  const p = game.player;
  const def = WEAPONS[p.weapon];

  // Layout: 5 cells across.
  const padX = 12;
  const usableW = w - padX * 2;
  const cellW = usableW / 5;
  const cy = y + barH / 2;

  drawCell(ctx, padX + cellW * 0, cy, cellW, barH, 'AMMO',
    p.ammo[def?.ammoType] ?? 0, ACCENT_YELLOW);
  drawCell(ctx, padX + cellW * 1, cy, cellW, barH, 'HEALTH',
    p.health + '%', healthColor(p.health));
  drawCell(ctx, padX + cellW * 2, cy, cellW, barH, 'ARMOR',
    p.armor + '%', ACCENT_BLUE);
  drawCell(ctx, padX + cellW * 3, cy, cellW, barH, 'KILLS', p.kills, ACCENT_GREEN);
  drawCell(ctx, padX + cellW * 4, cy, cellW, barH, 'SCORE', p.score, '#fff');

  // Mini weapon icons row.
  drawWeaponList(ctx, padX + cellW * 0, y + 6, cellW * 4, 12, p);
}

function drawCell(ctx, x, cy, w, totalH, label, value, color) {
  ctx.fillStyle = BAR_FG;
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, cy - 14);

  ctx.fillStyle = color;
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(String(value), x + w / 2, cy + 6);
}

function drawWeaponList(ctx, x, y, w, h, player) {
  const ids = Object.keys(WEAPONS);
  const slotW = w / ids.length;
  ctx.font = '9px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ids.forEach((id, i) => {
    const has = player.weapons.has(id);
    const sel = id === player.weapon;
    ctx.fillStyle = sel ? '#ffd166' : has ? '#b0a99f' : '#444';
    ctx.fillText(String(WEAPONS[id].slot || (i + 1)), x + slotW * i + slotW / 2, y);
  });
}

function healthColor(hp) {
  if (hp > 60) return ACCENT_GREEN;
  if (hp > 25) return ACCENT_YELLOW;
  return ACCENT_RED;
}

// Procedural weapon-in-hand sprite. Easy to swap for real art when Juraj
// drops asset frames — keep the call signature the same.
function drawWeaponSprite(ctx, w, h, player) {
  const def = WEAPONS[player.weapon];
  if (!def) return;
  const barH = Math.max(54, Math.round(h * 0.13));
  const bobX = Math.sin(player.bobPhase) * 6;
  const bobY = Math.abs(Math.cos(player.bobPhase)) * 4;
  const raise = player.raiseTimer > 0
    ? (player.raiseTimer / (def.raise || 0.25)) * 120
    : 0;
  const fireFlash = player.lastFireTime && (performance.now() / 1000 - player.lastFireTime) < 0.06;

  const cx = w / 2 + bobX;
  const top = h - barH - 160 + bobY + raise;

  // Body.
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(cx - 50, top + 60, 100, 100);

  // Muzzle / barrel — slightly different shape per weapon.
  ctx.fillStyle = '#222';
  if (player.weapon === 'shotgun') {
    ctx.fillRect(cx - 8, top + 10, 16, 70);
  } else if (player.weapon === 'chaingun') {
    ctx.fillRect(cx - 14, top + 30, 28, 50);
    ctx.fillRect(cx - 30, top + 90, 60, 18);
  } else {
    // pistol
    ctx.fillRect(cx - 6, top + 30, 12, 50);
  }

  if (fireFlash) {
    ctx.fillStyle = 'rgba(255, 220, 100, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, top + 10, 28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCenterReticle(ctx, w, h) {
  const cx = w / 2, cy = (h - statusBarHeight(h)) / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 2, cy);
  ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy - 2);
  ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy + 6);
  ctx.stroke();
}

function statusBarHeight(h) { return Math.max(54, Math.round(h * 0.13)); }

function drawMessage(ctx, w, h, player) {
  if (player.messageTimer <= 0 || !player.message) return;
  const alpha = Math.min(1, player.messageTimer / 0.5);
  ctx.fillStyle = `rgba(255, 220, 130, ${alpha})`;
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(player.message, w / 2, 16);
}

function drawPainOverlay(ctx, w, h, painTimer) {
  const alpha = Math.min(0.4, painTimer);
  ctx.fillStyle = `rgba(180, 20, 20, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

export function drawScreen(ctx, title, subtitle, hint) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h / 2 - 30);

  if (subtitle) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(subtitle, w / 2, h / 2 + 10);
  }
  if (hint) {
    ctx.fillStyle = '#bbb';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(hint, w / 2, h / 2 + 40);
  }
}
