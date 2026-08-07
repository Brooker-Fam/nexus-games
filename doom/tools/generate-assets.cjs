#!/usr/bin/env node
// Procedural pixel-art generator for the Doom-style game.
// Emits CC0 PNG files into doom/assets/{textures,sprites,weapons}.
// Pure-Node, no third-party deps. Deterministic — same SEED -> same pixels.

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SEED = 0xC0DEFEED;

// -------------- tiny PNG encoder ---------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // 8-bit channels
  ihdr[9] = 6;   // RGBA
  // 10..12 are compression / filter / interlace; all default 0.

  const stride = width * 4;
  const scan = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    scan[y * (stride + 1)] = 0;  // filter: none
    rgba.copy(scan, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idata = zlib.deflateSync(scan, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idata),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// -------------- canvas wrapper -----------------------------------------------

class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.buf = Buffer.alloc(w * h * 4);  // RGBA, transparent
  }
  set(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.buf[i] = r; this.buf[i+1] = g; this.buf[i+2] = b; this.buf[i+3] = a;
  }
  fill(r, g, b, a = 255) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, r, g, b, a);
  }
  rect(x, y, w, h, r, g, b, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, r, g, b, a);
  }
  line(x1, y1, x2, y2, r, g, b, a = 255) {
    let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      this.set(x, y, r, g, b, a);
      if (x === x2 && y === y2) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
    }
  }
  circle(cx, cy, rad, r, g, b, a = 255) {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      if (x*x + y*y <= rad*rad) this.set(cx + x, cy + y, r, g, b, a);
    }
  }
  writePNG(file) {
    fs.writeFileSync(file, encodePNG(this.w, this.h, this.buf));
  }
}

// -------------- deterministic RNG (mulberry32) -------------------------------

function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rand, base, range) {
  return Math.max(0, Math.min(255, Math.floor(base + (rand() - 0.5) * range)));
}

// -------------- texture recipes ----------------------------------------------

function texTech() {
  // Gray panel with rivets and a horizontal seam.
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xA1);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 95, 18);
    p.set(x, y, v, v, v + 4);
  }
  // bevel highlight at top, shadow at bottom of each 16-tall panel
  for (let panel = 0; panel < 4; panel++) {
    const y0 = panel * 16;
    for (let x = 0; x < 64; x++) p.set(x, y0,     140, 140, 145);
    for (let x = 0; x < 64; x++) p.set(x, y0 + 1, 120, 120, 125);
    for (let x = 0; x < 64; x++) p.set(x, y0 + 15, 55, 55, 60);
  }
  // rivets
  for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
    const cx = 8 + px * 16, cy = 8 + py * 16;
    p.set(cx, cy, 200, 200, 200);
    p.set(cx + 1, cy, 60, 60, 60);
    p.set(cx, cy + 1, 60, 60, 60);
  }
  return p;
}

function texPanel() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xA2);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 70, 14);
    p.set(x, y, v - 5, v, v + 10);
  }
  // vertical seams
  for (let col = 0; col < 4; col++) {
    const x0 = col * 16;
    for (let y = 0; y < 64; y++) { p.set(x0, y, 40, 45, 55); p.set(x0 + 15, y, 30, 35, 45); }
  }
  // horizontal bars
  for (let y = 30; y <= 33; y++) for (let x = 0; x < 64; x++) {
    p.set(x, y, 95, 100, 115);
  }
  return p;
}

function texBrick() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xA3);
  // mortar background
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 60, 10);
    p.set(x, y, v, v - 5, v - 10);
  }
  // bricks, alternating rows offset by 16
  for (let row = 0; row < 8; row++) {
    const y0 = row * 8;
    const offset = (row % 2) * 16;
    for (let col = 0; col < 2; col++) {
      const x0 = col * 32 + offset;
      for (let y = y0 + 1; y < y0 + 7; y++) for (let x = x0 + 1; x < x0 + 31; x++) {
        const xx = ((x % 64) + 64) % 64;
        const v = jitter(r, 110, 22);
        p.set(xx, y, v + 20, v - 10, v - 30);
      }
    }
  }
  return p;
}

function texBlood() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xA4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 60, 22);
    p.set(x, y, v + 60, v - 30, v - 30);
  }
  // dripping streaks
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * 64);
    const len = 10 + Math.floor(r() * 30);
    const y0 = Math.floor(r() * 20);
    for (let y = y0; y < y0 + len && y < 64; y++) {
      p.set(x, y, 110, 10, 10);
      p.set(x + 1, y, 80, 5, 5);
    }
  }
  return p;
}

function texExit() {
  const p = new Pix(64, 64);
  // green panel
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) p.set(x, y, 30, 90, 40);
  // border
  for (let x = 0; x < 64; x++) { p.set(x, 0, 200, 230, 80); p.set(x, 63, 10, 40, 15); }
  for (let y = 0; y < 64; y++) { p.set(0, y, 200, 230, 80); p.set(63, y, 10, 40, 15); }
  // big "EXIT" via pixel letters
  const letters = [
    // E
    [[2,2],[3,2],[4,2],[5,2],[2,3],[2,4],[2,5],[3,5],[4,5],[2,6],[2,7],[2,8],[3,8],[4,8],[5,8]],
    // X
    [[7,2],[11,2],[8,3],[10,3],[9,4],[9,5],[8,6],[10,6],[7,7],[11,7],[7,8],[11,8]],
    // I
    [[13,2],[14,2],[15,2],[14,3],[14,4],[14,5],[14,6],[14,7],[13,8],[14,8],[15,8]],
    // T
    [[17,2],[18,2],[19,2],[20,2],[21,2],[19,3],[19,4],[19,5],[19,6],[19,7],[19,8]]
  ];
  const scale = 3;
  const ox = 6, oy = 22;
  for (const letter of letters) for (const [lx, ly] of letter) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      p.set(ox + lx * scale + dx, oy + ly * scale + dy, 240, 255, 200);
    }
  }
  return p;
}

function texDoor(tint) {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xB1);
  // metallic body
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 110, 16);
    p.set(x, y, v, v, v + 8);
  }
  // recessed center stripe with tint
  for (let y = 4; y < 60; y++) for (let x = 26; x < 38; x++) {
    p.set(x, y, tint[0], tint[1], tint[2]);
  }
  // bolts
  const bolts = [[6, 6], [57, 6], [6, 57], [57, 57]];
  for (const [bx, by] of bolts) {
    p.circle(bx, by, 2, 220, 220, 230);
    p.set(bx, by, 60, 60, 60);
  }
  // top/bottom rails
  for (let x = 0; x < 64; x++) { p.set(x, 0, 60, 60, 70); p.set(x, 63, 30, 30, 40); }
  return p;
}

function texFloorTile() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xC1);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 65, 14);
    const tile = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0);
    p.set(x, y, v + (tile ? 25 : 0), v + (tile ? 20 : 0), v + (tile ? 10 : 5));
  }
  for (let i = 0; i < 64; i += 16) {
    for (let x = 0; x < 64; x++) { p.set(x, i, 30, 30, 30); }
    for (let y = 0; y < 64; y++) { p.set(i, y, 30, 30, 30); }
  }
  return p;
}

function texFloorConcrete() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xC2);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 85, 20);
    p.set(x, y, v, v - 3, v - 8);
  }
  // a few cracks
  for (let i = 0; i < 5; i++) {
    let x = Math.floor(r() * 64), y = Math.floor(r() * 64);
    for (let s = 0; s < 12; s++) {
      p.set(x, y, 40, 35, 30);
      x += r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1);
      y += r() < 0.5 ? 1 : (r() < 0.5 ? 0 : -1);
    }
  }
  return p;
}

function texFloorBlood() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xC3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 50, 18);
    p.set(x, y, v + 60, v - 25, v - 30);
  }
  // pools
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(r() * 64), cy = Math.floor(r() * 64);
    const rad = 4 + Math.floor(r() * 5);
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      if (x*x + y*y <= rad*rad) p.set(cx + x, cy + y, 130, 8, 8);
    }
  }
  return p;
}

function texCeilingGray() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xD1);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 75, 10);
    p.set(x, y, v, v, v);
  }
  // ceiling lamps
  for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
    const cx = 16 + px * 32, cy = 16 + py * 32;
    p.circle(cx, cy, 4, 230, 220, 160);
    p.circle(cx, cy, 2, 255, 250, 200);
  }
  return p;
}

function texCeilingDark() {
  const p = new Pix(64, 64);
  const r = rng(SEED ^ 0xD2);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = jitter(r, 35, 8);
    p.set(x, y, v, v, v + 4);
  }
  return p;
}

// -------------- sprite recipes -----------------------------------------------

function spriteEnemyZombie() {
  const p = new Pix(32, 48);
  // body — green-tinted ragged uniform
  // head
  p.rect(11, 4, 10, 8, 130, 110, 90);          // skin
  p.rect(11, 4, 10, 1, 60, 50, 40);            // hair line
  p.set(13, 7, 220, 30, 30);                   // eye
  p.set(18, 7, 220, 30, 30);                   // eye
  p.rect(14, 9, 4, 1, 70, 20, 20);             // mouth
  // body
  p.rect(8, 12, 16, 18, 70, 90, 60);
  p.rect(8, 12, 16, 1, 40, 55, 35);            // collar
  p.rect(11, 14, 10, 4, 90, 70, 50);           // chest patch
  // arms
  p.rect(4, 14, 4, 14, 60, 80, 55);
  p.rect(24, 14, 4, 14, 60, 80, 55);
  // hands
  p.rect(4, 28, 4, 3, 130, 110, 90);
  p.rect(24, 28, 4, 3, 130, 110, 90);
  // legs
  p.rect(10, 30, 5, 14, 45, 50, 40);
  p.rect(17, 30, 5, 14, 45, 50, 40);
  // boots
  p.rect(10, 44, 5, 4, 25, 25, 25);
  p.rect(17, 44, 5, 4, 25, 25, 25);
  // blood smear
  p.set(15, 17, 180, 20, 20);
  p.set(16, 18, 180, 20, 20);
  p.set(17, 19, 180, 20, 20);
  return p;
}

function spriteEnemyImp() {
  const p = new Pix(32, 48);
  // brown demon
  p.rect(10, 2, 12, 10, 100, 50, 30);          // head
  // horns
  p.rect(10, 0, 2, 3, 70, 35, 20);
  p.rect(20, 0, 2, 3, 70, 35, 20);
  p.set(11, 1, 130, 70, 40);
  p.set(21, 1, 130, 70, 40);
  // eyes
  p.set(13, 6, 240, 200, 0);
  p.set(14, 6, 240, 200, 0);
  p.set(18, 6, 240, 200, 0);
  p.set(19, 6, 240, 200, 0);
  // fangs
  p.set(14, 10, 240, 240, 220);
  p.set(17, 10, 240, 240, 220);
  // body
  p.rect(8, 12, 16, 16, 110, 55, 30);
  // spikes on shoulders
  p.set(7, 13, 80, 40, 25); p.set(8, 12, 80, 40, 25);
  p.set(24, 13, 80, 40, 25); p.set(23, 12, 80, 40, 25);
  // claws
  p.rect(3, 16, 5, 10, 90, 45, 25);
  p.rect(24, 16, 5, 10, 90, 45, 25);
  p.set(3, 26, 240, 240, 220); p.set(4, 27, 240, 240, 220);
  p.set(28, 26, 240, 240, 220); p.set(27, 27, 240, 240, 220);
  // legs
  p.rect(10, 28, 5, 16, 90, 45, 25);
  p.rect(17, 28, 5, 16, 90, 45, 25);
  // hooves
  p.rect(10, 44, 5, 4, 30, 20, 10);
  p.rect(17, 44, 5, 4, 30, 20, 10);
  return p;
}

function spriteEnemyDemon() {
  const p = new Pix(32, 48);
  // pink wide demon
  p.rect(6, 8, 20, 14, 210, 130, 130);          // head/mouth
  // mouth (huge)
  p.rect(8, 16, 16, 5, 40, 10, 10);
  // teeth
  for (let x = 9; x < 24; x += 2) p.set(x, 16, 240, 240, 220);
  for (let x = 9; x < 24; x += 2) p.set(x, 20, 240, 240, 220);
  // eyes
  p.set(11, 11, 250, 250, 50); p.set(12, 11, 250, 250, 50);
  p.set(19, 11, 250, 250, 50); p.set(20, 11, 250, 250, 50);
  // body
  p.rect(7, 22, 18, 14, 200, 120, 120);
  // arms
  p.rect(2, 22, 5, 14, 180, 100, 100);
  p.rect(25, 22, 5, 14, 180, 100, 100);
  // legs
  p.rect(9, 36, 5, 12, 170, 90, 90);
  p.rect(18, 36, 5, 12, 170, 90, 90);
  // claws on feet
  p.set(9, 47, 240, 240, 220); p.set(13, 47, 240, 240, 220);
  p.set(18, 47, 240, 240, 220); p.set(22, 47, 240, 240, 220);
  return p;
}

function spriteHealth() {
  const p = new Pix(24, 24);
  // white kit
  p.rect(2, 4, 20, 16, 240, 240, 240);
  p.rect(2, 4, 20, 2, 200, 200, 200);          // shading
  p.rect(2, 18, 20, 2, 180, 180, 180);
  // red cross
  p.rect(10, 7, 4, 10, 220, 30, 30);
  p.rect(6, 10, 12, 4, 220, 30, 30);
  // handle hint
  p.rect(8, 2, 8, 2, 180, 180, 180);
  return p;
}

function spriteArmor() {
  const p = new Pix(24, 24);
  // green chest plate
  // shoulders
  p.rect(2, 6, 4, 10, 40, 120, 50);
  p.rect(18, 6, 4, 10, 40, 120, 50);
  // chest
  p.rect(6, 4, 12, 16, 60, 160, 70);
  // highlight
  p.rect(7, 5, 10, 2, 100, 200, 110);
  // V shape
  p.line(8, 8, 12, 14, 30, 90, 35);
  p.line(15, 8, 12, 14, 30, 90, 35);
  return p;
}

function spriteAmmo() {
  const p = new Pix(24, 24);
  // box of bullets
  p.rect(2, 8, 20, 12, 130, 110, 60);
  p.rect(2, 8, 20, 2, 180, 150, 80);
  p.rect(2, 18, 20, 2, 80, 65, 30);
  // 4 bullet tips peeking out
  for (let i = 0; i < 4; i++) {
    const x = 4 + i * 5;
    p.rect(x, 4, 3, 4, 200, 180, 60);
    p.rect(x, 4, 3, 1, 240, 230, 120);
  }
  return p;
}

function spriteShells() {
  const p = new Pix(24, 24);
  // red shell box
  p.rect(2, 6, 20, 14, 160, 30, 30);
  p.rect(2, 6, 20, 2, 200, 60, 60);
  p.rect(2, 18, 20, 2, 100, 15, 15);
  // shell pip
  p.rect(8, 9, 8, 8, 240, 220, 80);
  p.rect(10, 11, 4, 4, 200, 60, 60);
  return p;
}

function spriteKey(tint) {
  const p = new Pix(16, 24);
  // big card
  for (let y = 4; y < 22; y++) for (let x = 3; x < 13; x++) {
    p.set(x, y, tint[0], tint[1], tint[2]);
  }
  // highlight stripe
  for (let x = 3; x < 13; x++) p.set(x, 7, 255, 255, 255);
  for (let x = 3; x < 13; x++) p.set(x, 8, tint[0] + 40, tint[1] + 40, tint[2] + 40);
  // dark outline
  for (let y = 4; y < 22; y++) { p.set(3, y, 20, 20, 20); p.set(12, y, 20, 20, 20); }
  for (let x = 3; x < 13; x++) { p.set(x, 4, 20, 20, 20); p.set(x, 21, 20, 20, 20); }
  return p;
}

function spriteShotgunPickup() {
  const p = new Pix(32, 24);
  // barrel
  p.rect(4, 9, 22, 4, 80, 80, 90);
  p.rect(4, 9, 22, 1, 130, 130, 140);
  // stock
  p.rect(2, 11, 6, 8, 110, 70, 30);
  p.rect(2, 11, 6, 1, 160, 120, 60);
  // trigger guard
  p.rect(14, 13, 4, 4, 60, 60, 70);
  return p;
}

function spriteBarrel() {
  const p = new Pix(24, 32);
  // body
  for (let y = 6; y < 28; y++) for (let x = 4; x < 20; x++) {
    const r = 160 + Math.floor((Math.sin((x - 4) * 0.4) + 1) * 20);
    p.set(x, y, r, 80, 30);
  }
  // top ellipse
  for (let x = 4; x < 20; x++) { p.set(x, 4, 130, 60, 20); p.set(x, 5, 200, 100, 40); }
  // bottom
  for (let x = 4; x < 20; x++) { p.set(x, 28, 60, 30, 15); p.set(x, 29, 30, 15, 10); }
  // rims
  for (let x = 4; x < 20; x++) { p.set(x, 12, 80, 40, 20); p.set(x, 22, 80, 40, 20); }
  // hazard stripe
  for (let x = 5; x < 19; x++) { p.set(x, 15, 230, 200, 50); p.set(x, 16, 230, 200, 50); }
  for (let x = 5; x < 19; x += 4) { p.set(x, 15, 30, 30, 30); p.set(x, 16, 30, 30, 30); }
  return p;
}

function spriteLamp() {
  const p = new Pix(16, 32);
  // post
  p.rect(7, 8, 2, 22, 60, 60, 70);
  // base
  p.rect(5, 28, 6, 3, 80, 80, 90);
  p.rect(5, 31, 6, 1, 40, 40, 50);
  // lamp glow
  p.circle(8, 6, 5, 255, 230, 120);
  p.circle(8, 6, 3, 255, 250, 200);
  p.set(8, 6, 255, 255, 255);
  // halo (subtle)
  p.circle(8, 6, 7, 255, 220, 100, 70);
  return p;
}

function spritePillar() {
  const p = new Pix(24, 40);
  // base
  p.rect(2, 34, 20, 6, 100, 100, 110);
  // shaft
  p.rect(6, 6, 12, 28, 130, 130, 140);
  p.rect(7, 6, 10, 28, 170, 170, 180);
  p.rect(8, 6, 8, 28, 190, 190, 200);
  // capital
  p.rect(2, 2, 20, 4, 120, 120, 130);
  p.rect(2, 2, 20, 1, 200, 200, 210);
  return p;
}

function spriteCorpse() {
  const p = new Pix(32, 16);
  // pool of blood
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(Math.random() * 32);  // any-seed ok; static drawing
  }
  // smear
  for (let y = 10; y < 16; y++) for (let x = 0; x < 32; x++) {
    const t = ((x - 16) * (x - 16) + (y - 14) * (y - 14) * 4);
    if (t < 80) p.set(x, y, 140, 10, 10);
  }
  // body
  p.rect(8, 8, 16, 5, 110, 60, 40);
  // head
  p.circle(10, 9, 3, 130, 110, 90);
  // limbs
  p.rect(20, 10, 6, 2, 50, 70, 40);
  p.rect(6, 11, 4, 2, 50, 70, 40);
  return p;
}

function spriteExitPad() {
  const p = new Pix(32, 32);
  // floor pad with arrow
  p.rect(2, 8, 28, 22, 40, 100, 60);
  p.rect(2, 8, 28, 2, 80, 180, 100);
  p.rect(2, 28, 28, 2, 20, 60, 30);
  // arrow up
  for (let y = 12; y < 26; y++) for (let x = 14; x < 18; x++) p.set(x, y, 240, 255, 200);
  for (let y = 12; y < 16; y++) {
    const w = 6 - (y - 12);
    for (let x = 16 - w; x < 16 + w; x++) p.set(x, y, 240, 255, 200);
  }
  return p;
}

// -------------- weapon (first-person) ----------------------------------------

function weaponPistol() {
  const p = new Pix(96, 64);
  // hand
  p.rect(40, 40, 18, 24, 200, 165, 130);
  p.rect(40, 40, 18, 2, 230, 200, 170);
  // pistol body
  p.rect(45, 18, 14, 24, 60, 60, 70);
  p.rect(45, 18, 14, 1, 110, 110, 120);
  // barrel
  p.rect(48, 8, 8, 12, 40, 40, 50);
  p.rect(49, 6, 6, 4, 60, 60, 70);
  // slide
  p.rect(45, 14, 14, 4, 90, 90, 100);
  // grip
  p.rect(46, 34, 12, 16, 110, 80, 50);
  // trigger
  p.set(50, 32, 30, 30, 30); p.set(51, 32, 30, 30, 30);
  return p;
}

function weaponShotgun() {
  const p = new Pix(128, 80);
  // two hands
  p.rect(48, 56, 22, 24, 200, 165, 130);
  p.rect(70, 60, 14, 20, 200, 165, 130);
  // stock
  p.rect(28, 46, 30, 18, 120, 80, 40);
  p.rect(28, 46, 30, 2, 170, 120, 70);
  // receiver
  p.rect(56, 32, 30, 16, 70, 70, 80);
  p.rect(56, 32, 30, 2, 120, 120, 130);
  // barrel
  p.rect(82, 14, 38, 8, 50, 50, 60);
  p.rect(82, 14, 38, 2, 90, 90, 100);
  // muzzle
  p.rect(118, 12, 4, 12, 30, 30, 40);
  // pump
  p.rect(78, 44, 14, 6, 80, 50, 25);
  // trigger
  p.rect(64, 48, 3, 5, 30, 30, 30);
  return p;
}

// -------------- main ---------------------------------------------------------

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

function main() {
  const root = path.resolve(__dirname, '..');
  const tex = path.join(root, 'assets', 'textures');
  const spr = path.join(root, 'assets', 'sprites');
  const wpn = path.join(root, 'assets', 'weapons');
  ensureDir(tex); ensureDir(spr); ensureDir(wpn);

  const textures = {
    'wall_tech.png':       texTech(),
    'wall_panel.png':      texPanel(),
    'wall_brick.png':      texBrick(),
    'wall_blood.png':      texBlood(),
    'wall_exit.png':       texExit(),
    'door_steel.png':      texDoor([110, 110, 130]),
    'door_red.png':        texDoor([180, 30, 30]),
    'door_blue.png':       texDoor([30, 80, 200]),
    'door_yellow.png':     texDoor([220, 200, 40]),
    'floor_tile.png':      texFloorTile(),
    'floor_concrete.png':  texFloorConcrete(),
    'floor_blood.png':     texFloorBlood(),
    'ceiling_gray.png':    texCeilingGray(),
    'ceiling_dark.png':    texCeilingDark()
  };
  for (const [name, pix] of Object.entries(textures)) pix.writePNG(path.join(tex, name));

  const sprites = {
    'enemy_zombie.png':       spriteEnemyZombie(),
    'enemy_imp.png':          spriteEnemyImp(),
    'enemy_demon.png':        spriteEnemyDemon(),
    'pickup_health.png':      spriteHealth(),
    'pickup_armor.png':       spriteArmor(),
    'pickup_ammo.png':        spriteAmmo(),
    'pickup_shells.png':      spriteShells(),
    'pickup_key_red.png':     spriteKey([200, 40, 40]),
    'pickup_key_blue.png':    spriteKey([50, 80, 220]),
    'pickup_key_yellow.png':  spriteKey([220, 200, 50]),
    'pickup_shotgun.png':     spriteShotgunPickup(),
    'decoration_barrel.png':  spriteBarrel(),
    'decoration_lamp.png':    spriteLamp(),
    'decoration_pillar.png':  spritePillar(),
    'decoration_corpse.png':  spriteCorpse(),
    'exit_pad.png':           spriteExitPad()
  };
  for (const [name, pix] of Object.entries(sprites)) pix.writePNG(path.join(spr, name));

  const weapons = {
    'pistol.png':   weaponPistol(),
    'shotgun.png':  weaponShotgun()
  };
  for (const [name, pix] of Object.entries(weapons)) pix.writePNG(path.join(wpn, name));

  const total = Object.keys(textures).length + Object.keys(sprites).length + Object.keys(weapons).length;
  console.log(`Generated ${total} assets`);
  console.log(`  ${Object.keys(textures).length} textures -> ${path.relative(process.cwd(), tex)}`);
  console.log(`  ${Object.keys(sprites).length} sprites  -> ${path.relative(process.cwd(), spr)}`);
  console.log(`  ${Object.keys(weapons).length} weapons  -> ${path.relative(process.cwd(), wpn)}`);
}

main();
