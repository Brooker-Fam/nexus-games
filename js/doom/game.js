// ══════════════════════════════════════════════
//  DOOM — first-person raycaster
// ══════════════════════════════════════════════
//  Wolfenstein-style DDA raycasting on a 2D grid.
//  All textures, sprites and sounds are procedurally
//  generated — nothing is loaded from disk.

const doomCanvas = document.getElementById('doomCanvas');
const doomCtx = doomCanvas.getContext('2d');
const DOOM_W = doomCanvas.width;
const DOOM_H = doomCanvas.height;
const doomMini = document.getElementById('doomMinimap');
const doomMiniCtx = doomMini.getContext('2d');
const DOOM_MINI_W = doomMini.width;
const DOOM_MINI_H = doomMini.height;

// ── MAP ──
//  Tile glyphs (extended in js/doom/levels.js):
//    1 = brick wall   2 = metal wall   3 = stone wall
//    9 = exit (glowing portal — passable)
//    . = empty floor
//    P = player spawn
//    E = enemy (demon) spawn
//    A = ammo pickup        M = medkit pickup
//    S = shotgun pickup     C = chaingun pickup
//    R = rocket pickup      K = armor pickup
//
//  The default 16×16 map is kept here so this file remains usable
//  on its own; level data and the multi-level catalog live in
//  js/doom/levels.js. Call doomLoadLevel(index) to swap.
const DOOM_DEFAULT_MAP_SRC = [
  '1111111111111111',
  '1P.....1.......1',
  '1......1...M...1',
  '1..222.1.......1',
  '1..2.2.1.E..A..1',
  '1..2.2.........1',
  '1..2.2.111.....1',
  '1..222...3.....1',
  '1........3..E..1',
  '1.E......3.....1',
  '1........3.A...1',
  '1..1111111.....1',
  '1.......1......1',
  '1...M...1...E..1',
  '1.......1.....91',
  '1111111111111111',
];

// Mutable level-scoped state — re-populated by doomLoadLevel().
let DOOM_MAP_SRC = DOOM_DEFAULT_MAP_SRC;
let DOOM_MAP_H = DOOM_MAP_SRC.length;
let DOOM_MAP_W = DOOM_MAP_SRC[0].length;
let DOOM_MAP = [];
let DOOM_PLAYER_SPAWN = { x: 1.5, y: 1.5 };
let DOOM_ENEMY_SPAWNS = [];
let DOOM_AMMO_SPAWNS = [];
let DOOM_MEDKIT_SPAWNS = [];
let DOOM_EXTRA_PICKUP_SPAWNS = [];
let DOOM_EXIT = { x: 0, y: 0 };
let DOOM_CURRENT_LEVEL_INDEX = 0;

function doomParseMap(src){
  DOOM_MAP_SRC = src;
  DOOM_MAP_H = src.length;
  DOOM_MAP_W = src[0].length;
  DOOM_MAP = [];
  DOOM_PLAYER_SPAWN = { x: 1.5, y: 1.5 };
  DOOM_ENEMY_SPAWNS = [];
  DOOM_AMMO_SPAWNS = [];
  DOOM_MEDKIT_SPAWNS = [];
  DOOM_EXTRA_PICKUP_SPAWNS = [];
  DOOM_EXIT = { x: 0, y: 0 };
  const extras = (window.DOOM_EXTRA_PICKUPS) || {};
  for(let y = 0; y < DOOM_MAP_H; y++){
    const row = [];
    for(let x = 0; x < DOOM_MAP_W; x++){
      const c = src[y][x];
      if(c === '1') row.push(1);
      else if(c === '2') row.push(2);
      else if(c === '3') row.push(3);
      else if(c === '9'){ row.push(9); DOOM_EXIT = { x: x + 0.5, y: y + 0.5 }; }
      else {
        row.push(0);
        if(c === 'P') DOOM_PLAYER_SPAWN = { x: x + 0.5, y: y + 0.5 };
        else if(c === 'E') DOOM_ENEMY_SPAWNS.push({ x: x + 0.5, y: y + 0.5 });
        else if(c === 'A') DOOM_AMMO_SPAWNS.push({ x: x + 0.5, y: y + 0.5 });
        else if(c === 'M') DOOM_MEDKIT_SPAWNS.push({ x: x + 0.5, y: y + 0.5 });
        else if(extras[c]) DOOM_EXTRA_PICKUP_SPAWNS.push({ x: x + 0.5, y: y + 0.5, glyph: c, ...extras[c] });
      }
    }
    DOOM_MAP.push(row);
  }
}

// Public: swap to a level from window.DOOM_LEVELS (defined in levels.js).
// Falls back to the embedded default if the catalog is absent.
function doomLoadLevel(index){
  const cat = window.DOOM_LEVELS;
  if(cat && cat[index]){
    DOOM_CURRENT_LEVEL_INDEX = index;
    doomParseMap(cat[index].map);
    return cat[index];
  }
  DOOM_CURRENT_LEVEL_INDEX = 0;
  doomParseMap(DOOM_DEFAULT_MAP_SRC);
  return { id: 'default', name: 'CITADEL', subtitle: '', music: 'doomMusicHangar' };
}

// Initial parse — used until flow.js calls doomLoadLevel() with a real level.
doomParseMap(DOOM_DEFAULT_MAP_SRC);

function doomCell(x, y){
  if(x < 0 || y < 0 || x >= DOOM_MAP_W || y >= DOOM_MAP_H) return 1;
  return DOOM_MAP[y][x];
}
function doomIsWall(x, y){
  const c = doomCell(x | 0, y | 0);
  return c !== 0 && c !== 9;  // exit is passable
}

// ── PROCEDURAL TEXTURES ──
const DOOM_TEX_SIZE = 64;

function doomMakeBrickTex(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_TEX_SIZE;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a0808';
  ctx.fillRect(0, 0, DOOM_TEX_SIZE, DOOM_TEX_SIZE);
  // bricks
  const bw = 16, bh = 8;
  for(let row = 0; row < DOOM_TEX_SIZE / bh; row++){
    const offset = (row & 1) ? bw / 2 : 0;
    for(let col = -1; col < DOOM_TEX_SIZE / bw + 1; col++){
      const x = col * bw + offset;
      const y = row * bh;
      const r = 90 + (Math.random() * 40 | 0);
      const g = 25 + (Math.random() * 18 | 0);
      const b = 20 + (Math.random() * 15 | 0);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      // highlight on top, shadow on bottom for depth
      ctx.fillStyle = 'rgba(255,180,140,0.15)';
      ctx.fillRect(x + 1, y + 1, bw - 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 1, y + bh - 2, bw - 2, 1);
    }
  }
  // scuffs
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for(let i = 0; i < 18; i++){
    ctx.fillRect(Math.random() * DOOM_TEX_SIZE | 0, Math.random() * DOOM_TEX_SIZE | 0, 2, 1);
  }
  return c;
}

function doomMakeMetalTex(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_TEX_SIZE;
  const ctx = c.getContext('2d');
  // dark steel base
  const grad = ctx.createLinearGradient(0, 0, DOOM_TEX_SIZE, DOOM_TEX_SIZE);
  grad.addColorStop(0, '#262a30');
  grad.addColorStop(0.5, '#1c2026');
  grad.addColorStop(1, '#0e1216');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, DOOM_TEX_SIZE, DOOM_TEX_SIZE);
  // panel seams
  ctx.strokeStyle = '#070a0d';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, DOOM_TEX_SIZE - 4, DOOM_TEX_SIZE - 4);
  ctx.beginPath();
  ctx.moveTo(DOOM_TEX_SIZE / 2, 2); ctx.lineTo(DOOM_TEX_SIZE / 2, DOOM_TEX_SIZE - 2);
  ctx.stroke();
  // rivets
  ctx.fillStyle = '#3a4248';
  const rivetPositions = [[8, 8], [56, 8], [8, 56], [56, 56], [32, 32]];
  for(const [rx, ry] of rivetPositions){
    ctx.beginPath();
    ctx.arc(rx, ry, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10141a';
    ctx.beginPath();
    ctx.arc(rx + 0.6, ry + 0.6, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a4248';
  }
  // grime noise
  for(let i = 0; i < 30; i++){
    const x = Math.random() * DOOM_TEX_SIZE | 0;
    const y = Math.random() * DOOM_TEX_SIZE | 0;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return c;
}

function doomMakeStoneTex(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_TEX_SIZE;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(0, 0, DOOM_TEX_SIZE, DOOM_TEX_SIZE);
  // chunky stones
  for(let i = 0; i < 26; i++){
    const x = Math.random() * DOOM_TEX_SIZE;
    const y = Math.random() * DOOM_TEX_SIZE;
    const r = 4 + Math.random() * 6;
    const g = 60 + (Math.random() * 50 | 0);
    ctx.fillStyle = `rgb(${g},${g - 5},${g - 15})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x + r * 0.4, y + r * 0.5, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // mortar speckle
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for(let i = 0; i < 50; i++){
    ctx.fillRect(Math.random() * DOOM_TEX_SIZE | 0, Math.random() * DOOM_TEX_SIZE | 0, 1, 1);
  }
  return c;
}

function doomMakeExitTex(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_TEX_SIZE;
  const ctx = c.getContext('2d');
  // frame
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0, 0, DOOM_TEX_SIZE, DOOM_TEX_SIZE);
  ctx.fillStyle = '#152018';
  ctx.fillRect(4, 4, DOOM_TEX_SIZE - 8, DOOM_TEX_SIZE - 8);
  // glowing core
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, '#aaffcc');
  grad.addColorStop(0.4, '#00ff88');
  grad.addColorStop(1, '#003318');
  ctx.fillStyle = grad;
  ctx.fillRect(8, 8, DOOM_TEX_SIZE - 16, DOOM_TEX_SIZE - 16);
  // "EXIT" sigil bars
  ctx.fillStyle = 'rgba(0,255,136,0.7)';
  ctx.fillRect(28, 14, 8, 4);
  ctx.fillRect(20, 28, 24, 4);
  ctx.fillRect(28, 42, 8, 4);
  return c;
}

const DOOM_TEX = [
  null,                  // 0 unused
  doomMakeBrickTex(),    // 1
  doomMakeMetalTex(),    // 2
  doomMakeStoneTex(),    // 3
  null, null, null, null, null,
  doomMakeExitTex(),     // 9
];

// ── ENEMY SPRITE (billboard) ──
const DOOM_ENEMY_SPRITE_SIZE = 64;

function doomMakeDemonSprite(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_ENEMY_SPRITE_SIZE;
  const ctx = c.getContext('2d');
  // transparent background — we use magenta key replaced by transparency below
  ctx.clearRect(0, 0, DOOM_ENEMY_SPRITE_SIZE, DOOM_ENEMY_SPRITE_SIZE);
  // body
  ctx.fillStyle = '#5a1810';
  ctx.beginPath();
  ctx.ellipse(32, 44, 13, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // belly highlight
  ctx.fillStyle = '#8a2820';
  ctx.beginPath();
  ctx.ellipse(32, 46, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = '#722010';
  ctx.beginPath();
  ctx.arc(32, 22, 11, 0, Math.PI * 2);
  ctx.fill();
  // horns
  ctx.fillStyle = '#1a0a04';
  ctx.beginPath();
  ctx.moveTo(24, 14); ctx.lineTo(20, 4); ctx.lineTo(27, 13); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(40, 14); ctx.lineTo(44, 4); ctx.lineTo(37, 13); ctx.closePath();
  ctx.fill();
  // glowing eyes
  ctx.fillStyle = '#fff200';
  ctx.fillRect(26, 21, 4, 3);
  ctx.fillRect(34, 21, 4, 3);
  ctx.fillStyle = '#ff8800';
  ctx.fillRect(27, 22, 2, 1);
  ctx.fillRect(35, 22, 2, 1);
  // teeth
  ctx.fillStyle = '#fff';
  ctx.fillRect(28, 27, 1, 2);
  ctx.fillRect(31, 27, 1, 2);
  ctx.fillRect(34, 27, 1, 2);
  // claws
  ctx.fillStyle = '#1a0a04';
  ctx.fillRect(18, 50, 3, 6);
  ctx.fillRect(43, 50, 3, 6);
  return c;
}

function doomMakeDemonHurtSprite(){
  // tint the base sprite red for hurt flash
  const base = doomMakeDemonSprite();
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_ENEMY_SPRITE_SIZE;
  const ctx = c.getContext('2d');
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,80,40,0.6)';
  ctx.fillRect(0, 0, DOOM_ENEMY_SPRITE_SIZE, DOOM_ENEMY_SPRITE_SIZE);
  return c;
}

function doomMakeAmmoSprite(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_ENEMY_SPRITE_SIZE;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, DOOM_ENEMY_SPRITE_SIZE, DOOM_ENEMY_SPRITE_SIZE);
  // box
  ctx.fillStyle = '#3a3a1a';
  ctx.fillRect(20, 36, 24, 16);
  ctx.fillStyle = '#5a5a26';
  ctx.fillRect(22, 38, 20, 12);
  // band
  ctx.fillStyle = '#00f5ff';
  ctx.fillRect(20, 42, 24, 4);
  // letters "A"
  ctx.fillStyle = '#020810';
  ctx.fillRect(30, 43, 4, 2);
  return c;
}

function doomMakeMedkitSprite(){
  const c = document.createElement('canvas');
  c.width = c.height = DOOM_ENEMY_SPRITE_SIZE;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, DOOM_ENEMY_SPRITE_SIZE, DOOM_ENEMY_SPRITE_SIZE);
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(20, 36, 24, 16);
  ctx.fillStyle = '#ee2244';
  ctx.fillRect(30, 39, 4, 10);
  ctx.fillRect(25, 42, 14, 4);
  return c;
}

const DOOM_SPR_DEMON = doomMakeDemonSprite();
const DOOM_SPR_DEMON_HURT = doomMakeDemonHurtSprite();
const DOOM_SPR_AMMO = doomMakeAmmoSprite();
const DOOM_SPR_MEDKIT = doomMakeMedkitSprite();

// ── WEAPON OVERLAY ──
function doomMakeGunSprite(fire){
  const c = document.createElement('canvas');
  c.width = 240; c.height = 180;
  const ctx = c.getContext('2d');
  // forearm
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(80, 130, 80, 50);
  // grip
  ctx.fillStyle = '#1a0e08';
  ctx.fillRect(105, 100, 30, 50);
  // barrel
  ctx.fillStyle = '#444';
  ctx.fillRect(110, 60, 20, 50);
  // sight
  ctx.fillStyle = '#222';
  ctx.fillRect(115, 55, 10, 8);
  // shading
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(110, 60, 4, 50);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(126, 60, 4, 50);
  if(fire){
    // muzzle flash
    const fx = 120, fy = 50;
    const grad = ctx.createRadialGradient(fx, fy, 2, fx, fy, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ffee88');
    grad.addColorStop(0.7, 'rgba(255,140,40,0.6)');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, 32, 0, Math.PI * 2);
    ctx.fill();
    // spikes
    ctx.strokeStyle = '#ffee88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i = 0; i < 6; i++){
      const a = Math.PI * 2 * i / 6;
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(a) * 28, fy + Math.sin(a) * 28);
    }
    ctx.stroke();
  }
  return c;
}

const DOOM_GUN_IDLE = doomMakeGunSprite(false);
const DOOM_GUN_FIRE = doomMakeGunSprite(true);

// ── STATE ──
const DOOM_DEFAULTS = () => ({
  player: {
    x: DOOM_PLAYER_SPAWN.x,
    y: DOOM_PLAYER_SPAWN.y,
    dirX: 1, dirY: 0,
    planeX: 0, planeY: 0.66,  // FOV ~66°
    hp: 100,
    maxHp: 100,
    ammo: 30,
    maxAmmo: 99,
    kills: 0,
  },
  enemies: DOOM_ENEMY_SPAWNS.map(s => ({
    x: s.x, y: s.y,
    hp: 50,
    state: 'alive',     // alive | dying | dead
    cooldown: 0,        // seconds before next attack
    hurt: 0,            // hurt-flash timer
    deathTimer: 0,
  })),
  pickups: [
    ...DOOM_AMMO_SPAWNS.map(s => ({ x: s.x, y: s.y, type: 'ammo', taken: false })),
    ...DOOM_MEDKIT_SPAWNS.map(s => ({ x: s.x, y: s.y, type: 'medkit', taken: false })),
    ...DOOM_EXTRA_PICKUP_SPAWNS.map(s => ({
      x: s.x, y: s.y,
      type: s.type,           // 'shotgun' | 'chaingun' | 'rocket' | 'armor'
      ammoBonus: s.ammoBonus, hpBonus: s.hpBonus, label: s.label,
      taken: false,
    })),
  ],
  keys: Object.create(null),
  mouseDX: 0,
  shootCooldown: 0,
  muzzleTimer: 0,
  hurtFlash: 0,
  bobPhase: 0,
  gameOver: false,
  won: false,
  pointerLocked: false,
});

let doomState = DOOM_DEFAULTS();
let doomRaf = null;
let doomLastTime = 0;

// pre-allocated z-buffer for sprite occlusion
const doomZBuffer = new Float32Array(DOOM_W);

// ── RAYCASTING ──
function doomRender(){
  const ctx = doomCtx;
  const p = doomState.player;

  // ── Ceiling / floor (flat shaded with vertical gradient) ──
  // ceiling
  const cg = ctx.createLinearGradient(0, 0, 0, DOOM_H / 2);
  cg.addColorStop(0, '#1a0d10');
  cg.addColorStop(1, '#080406');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, DOOM_W, DOOM_H / 2);
  // floor
  const fg = ctx.createLinearGradient(0, DOOM_H / 2, 0, DOOM_H);
  fg.addColorStop(0, '#150e0a');
  fg.addColorStop(1, '#3a261a');
  ctx.fillStyle = fg;
  ctx.fillRect(0, DOOM_H / 2, DOOM_W, DOOM_H / 2);

  // ── Walls (DDA per column) ──
  for(let x = 0; x < DOOM_W; x++){
    const cameraX = 2 * x / DOOM_W - 1;
    const rayDirX = p.dirX + p.planeX * cameraX;
    const rayDirY = p.dirY + p.planeY * cameraX;
    let mapX = p.x | 0;
    let mapY = p.y | 0;
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);
    let stepX, sideDistX, stepY, sideDistY;
    if(rayDirX < 0){ stepX = -1; sideDistX = (p.x - mapX) * deltaDistX; }
    else            { stepX =  1; sideDistX = (mapX + 1 - p.x) * deltaDistX; }
    if(rayDirY < 0){ stepY = -1; sideDistY = (p.y - mapY) * deltaDistY; }
    else            { stepY =  1; sideDistY = (mapY + 1 - p.y) * deltaDistY; }

    let hit = 0, side = 0, cell = 0;
    let safety = 64;
    while(!hit && safety-- > 0){
      if(sideDistX < sideDistY){ sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else                     { sideDistY += deltaDistY; mapY += stepY; side = 1; }
      cell = doomCell(mapX, mapY);
      if(cell !== 0) hit = 1;
    }

    const perpWallDist = (side === 0)
      ? (sideDistX - deltaDistX)
      : (sideDistY - deltaDistY);

    doomZBuffer[x] = perpWallDist;

    const lineHeight = Math.abs(DOOM_H / perpWallDist) | 0;
    let drawStart = -lineHeight / 2 + DOOM_H / 2;
    let drawEnd = lineHeight / 2 + DOOM_H / 2;
    const clampedStart = Math.max(0, drawStart) | 0;
    const clampedEnd = Math.min(DOOM_H, drawEnd) | 0;

    // texture x within the hit wall
    let wallX = (side === 0)
      ? p.y + perpWallDist * rayDirY
      : p.x + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);
    let texX = (wallX * DOOM_TEX_SIZE) | 0;
    if((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)){
      texX = DOOM_TEX_SIZE - texX - 1;
    }

    const tex = DOOM_TEX[cell];
    if(tex){
      ctx.drawImage(
        tex,
        texX, 0, 1, DOOM_TEX_SIZE,
        x, drawStart, 1, drawEnd - drawStart,
      );
      // distance fog / side shading — multiply darker over the column
      const fog = Math.min(1, perpWallDist / 12);
      const sideShade = side === 1 ? 0.25 : 0;
      const dim = fog * 0.7 + sideShade;
      if(dim > 0.02){
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, dim)})`;
        ctx.fillRect(x, clampedStart, 1, clampedEnd - clampedStart);
      }
      // exit pulses
      if(cell === 9){
        const pulse = 0.4 + 0.4 * Math.sin(performance.now() * 0.006);
        ctx.fillStyle = `rgba(0,255,136,${pulse * 0.35})`;
        ctx.fillRect(x, clampedStart, 1, clampedEnd - clampedStart);
      }
    }
  }

  // ── Sprites (enemies + pickups) sorted back-to-front ──
  const sprites = [];
  for(const e of doomState.enemies){
    if(e.state === 'dead') continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    sprites.push({ kind: 'enemy', ref: e, dist: dx * dx + dy * dy });
  }
  for(const k of doomState.pickups){
    if(k.taken) continue;
    const dx = k.x - p.x, dy = k.y - p.y;
    sprites.push({ kind: 'pickup', ref: k, dist: dx * dx + dy * dy });
  }
  sprites.sort((a, b) => b.dist - a.dist);

  const invDet = 1 / (p.planeX * p.dirY - p.dirX * p.planeY);
  for(const s of sprites){
    const ref = s.ref;
    const sx = ref.x - p.x;
    const sy = ref.y - p.y;
    const transformX = invDet * (p.dirY * sx - p.dirX * sy);
    const transformY = invDet * (-p.planeY * sx + p.planeX * sy);
    if(transformY <= 0.1) continue;  // behind player

    const spriteScreenX = ((DOOM_W / 2) * (1 + transformX / transformY)) | 0;
    let spriteH = Math.abs((DOOM_H / transformY)) | 0;
    let spriteW = spriteH;
    let vOffset = 0;
    if(s.kind === 'pickup'){
      spriteH = (spriteH * 0.6) | 0;
      spriteW = spriteH;
      vOffset = spriteH * 0.4;
    }
    const drawStartY = (-spriteH / 2 + DOOM_H / 2 + vOffset) | 0;
    const drawStartX = ((-spriteW / 2 + spriteScreenX)) | 0;
    const drawEndX = ((spriteW / 2 + spriteScreenX)) | 0;

    let img;
    if(s.kind === 'enemy'){
      if(ref.state === 'dying'){
        // squish toward floor
        const t = Math.min(1, ref.deathTimer / 0.5);
        const sh = (spriteH * (1 - t * 0.6)) | 0;
        const sy0 = drawStartY + (spriteH - sh);
        doomDrawSpriteColumns(ref.hurt > 0 ? DOOM_SPR_DEMON_HURT : DOOM_SPR_DEMON,
          drawStartX, sy0, spriteW, sh, transformY);
        continue;
      }
      img = ref.hurt > 0 ? DOOM_SPR_DEMON_HURT : DOOM_SPR_DEMON;
    } else {
      img = ref.type === 'ammo' ? DOOM_SPR_AMMO : DOOM_SPR_MEDKIT;
    }
    doomDrawSpriteColumns(img, drawStartX, drawStartY, spriteW, spriteH, transformY);
  }

  // ── HUD overlays on canvas ──
  // crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cxc = DOOM_W / 2, cyc = DOOM_H / 2;
  ctx.moveTo(cxc - 8, cyc); ctx.lineTo(cxc - 3, cyc);
  ctx.moveTo(cxc + 3, cyc); ctx.lineTo(cxc + 8, cyc);
  ctx.moveTo(cxc, cyc - 8); ctx.lineTo(cxc, cyc - 3);
  ctx.moveTo(cxc, cyc + 3); ctx.lineTo(cxc, cyc + 8);
  ctx.stroke();

  // weapon (with bob)
  const bob = Math.sin(doomState.bobPhase) * 6;
  const gunImg = doomState.muzzleTimer > 0 ? DOOM_GUN_FIRE : DOOM_GUN_IDLE;
  const gw = 240, gh = 180;
  const gx = (DOOM_W - gw) / 2;
  const gy = DOOM_H - gh + 10 + bob;
  ctx.drawImage(gunImg, gx, gy);

  // hurt flash
  if(doomState.hurtFlash > 0){
    ctx.fillStyle = `rgba(255,0,40,${Math.min(0.55, doomState.hurtFlash)})`;
    ctx.fillRect(0, 0, DOOM_W, DOOM_H);
  }

  // vignette
  const vg = ctx.createRadialGradient(DOOM_W / 2, DOOM_H / 2, DOOM_W * 0.3, DOOM_W / 2, DOOM_H / 2, DOOM_W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, DOOM_W, DOOM_H);
}

function doomDrawSpriteColumns(img, x0, y0, w, h, transformY){
  if(w <= 0 || h <= 0) return;
  for(let stripe = 0; stripe < w; stripe++){
    const sx = x0 + stripe;
    if(sx < 0 || sx >= DOOM_W) continue;
    if(transformY >= doomZBuffer[sx]) continue;
    const texX = ((stripe * DOOM_ENEMY_SPRITE_SIZE / w) | 0);
    doomCtx.drawImage(img,
      texX, 0, 1, DOOM_ENEMY_SPRITE_SIZE,
      sx, y0, 1, h,
    );
  }
}

// ── MINIMAP ──
function doomRenderMinimap(){
  const ctx = doomMiniCtx;
  ctx.fillStyle = 'rgba(2,8,16,0.85)';
  ctx.fillRect(0, 0, DOOM_MINI_W, DOOM_MINI_H);
  const cellW = DOOM_MINI_W / DOOM_MAP_W;
  const cellH = DOOM_MINI_H / DOOM_MAP_H;
  for(let y = 0; y < DOOM_MAP_H; y++){
    for(let x = 0; x < DOOM_MAP_W; x++){
      const c = DOOM_MAP[y][x];
      if(c === 0) continue;
      if(c === 9){
        ctx.fillStyle = '#00ff88';
      } else {
        ctx.fillStyle = 'rgba(120,40,40,0.85)';
      }
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }
  // grid
  ctx.strokeStyle = 'rgba(0,245,255,0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for(let x = 0; x <= DOOM_MAP_W; x++){
    ctx.moveTo(x * cellW, 0); ctx.lineTo(x * cellW, DOOM_MINI_H);
  }
  for(let y = 0; y <= DOOM_MAP_H; y++){
    ctx.moveTo(0, y * cellH); ctx.lineTo(DOOM_MINI_W, y * cellH);
  }
  ctx.stroke();
  // enemies
  for(const e of doomState.enemies){
    if(e.state === 'dead') continue;
    ctx.fillStyle = e.state === 'dying' ? 'rgba(200,80,40,0.6)' : '#ff3322';
    ctx.beginPath();
    ctx.arc(e.x * cellW, e.y * cellH, cellW * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // pickups
  for(const k of doomState.pickups){
    if(k.taken) continue;
    ctx.fillStyle = k.type === 'ammo' ? '#00f5ff' : '#ee2244';
    ctx.fillRect(k.x * cellW - 1.5, k.y * cellH - 1.5, 3, 3);
  }
  // player
  const p = doomState.player;
  ctx.save();
  ctx.translate(p.x * cellW, p.y * cellH);
  // FOV cone
  const ang = Math.atan2(p.dirY, p.dirX);
  ctx.fillStyle = 'rgba(0,245,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, cellW * 3.5, ang - 0.5, ang + 0.5);
  ctx.closePath();
  ctx.fill();
  // player dot
  ctx.fillStyle = '#00f5ff';
  ctx.beginPath();
  ctx.arc(0, 0, cellW * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── INPUT ──
function doomOnKeyDown(e){
  doomState.keys[e.key.toLowerCase()] = true;
  if(e.key === 'Escape' && doomState.pointerLocked){
    document.exitPointerLock();
  }
  // prevent page scroll on arrow / WASD / space
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d'].includes(e.key) ||
     ['W','A','S','D'].includes(e.key)){
    e.preventDefault();
  }
}
function doomOnKeyUp(e){
  doomState.keys[e.key.toLowerCase()] = false;
}
function doomOnMouseMove(e){
  if(!doomState.pointerLocked) return;
  doomState.mouseDX += e.movementX || 0;
}
function doomOnMouseDown(e){
  if(doomState.gameOver){ return; }
  if(!doomState.pointerLocked){
    doomCanvas.requestPointerLock();
    return;
  }
  doomShoot();
}
function doomOnPointerLockChange(){
  doomState.pointerLocked = (document.pointerLockElement === doomCanvas);
  const hint = document.getElementById('doomStartHint');
  if(hint){ hint.classList.toggle('hidden', doomState.pointerLocked); }
}

// ── SHOOT ──
function doomShoot(){
  if(doomState.shootCooldown > 0) return;
  if(doomState.player.ammo <= 0){
    sfx('doomEmpty');
    doomState.shootCooldown = 0.3;
    return;
  }
  doomState.player.ammo--;
  doomState.shootCooldown = 0.22;
  doomState.muzzleTimer = 0.08;
  sfx('doomShoot');

  // Hitscan: ray straight ahead. Find nearest alive enemy within angle
  // tolerance whose distance is < the wall distance straight ahead.
  const p = doomState.player;
  const wallDist = doomZBuffer[DOOM_W >> 1] || 999;
  let bestIdx = -1, bestDist = Infinity;
  const HIT_HALF_WIDTH = 0.35; // ~enemy radius in world units
  for(let i = 0; i < doomState.enemies.length; i++){
    const e = doomState.enemies[i];
    if(e.state !== 'alive') continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    // Distance along player direction
    const forward = dx * p.dirX + dy * p.dirY;
    if(forward <= 0) continue;
    // Perpendicular offset from the ray
    const perp = Math.abs(dx * p.dirY - dy * p.dirX);
    if(perp > HIT_HALF_WIDTH) continue;
    if(forward >= wallDist) continue;
    if(forward < bestDist){
      bestDist = forward;
      bestIdx = i;
    }
  }
  if(bestIdx >= 0){
    const e = doomState.enemies[bestIdx];
    e.hp -= 28;
    e.hurt = 0.12;
    sfx('doomEnemyHurt');
    if(e.hp <= 0){
      e.state = 'dying';
      e.deathTimer = 0;
      doomState.player.kills++;
      sfx('doomEnemyDie');
      doomCheckWin();
    }
  }
  doomUpdateHUD();
}

// ── MOVEMENT ──
function doomMove(dt){
  const p = doomState.player;
  const keys = doomState.keys;
  const sprint = (keys['shift'] || keys['shiftleft'] || keys['shiftright']) ? 1.6 : 1;
  const moveSpeed = 3.2 * sprint * dt;
  const turnSpeed = 1.8 * dt;

  // arrow turn
  if(keys['arrowleft']) doomRotate(-turnSpeed);
  if(keys['arrowright']) doomRotate(turnSpeed);

  // mouse turn — sensitivity 0.0022 rad/px
  if(doomState.mouseDX !== 0){
    doomRotate(doomState.mouseDX * 0.0022);
    doomState.mouseDX = 0;
  }

  let mx = 0, my = 0;
  if(keys['w'] || keys['arrowup']){    mx += p.dirX; my += p.dirY; }
  if(keys['s'] || keys['arrowdown']){  mx -= p.dirX; my -= p.dirY; }
  if(keys['a']){                       mx += -p.dirY; my +=  p.dirX; }  // strafe left = perp left
  if(keys['d']){                       mx +=  p.dirY; my += -p.dirX; }  // strafe right

  if(mx !== 0 || my !== 0){
    const len = Math.hypot(mx, my);
    mx = mx / len * moveSpeed;
    my = my / len * moveSpeed;
    // axis-separated collision with 0.22 pad
    const pad = 0.22;
    const nx = p.x + mx;
    if(!doomIsWall(nx + Math.sign(mx) * pad, p.y)) p.x = nx;
    const ny = p.y + my;
    if(!doomIsWall(p.x, ny + Math.sign(my) * pad)) p.y = ny;
    // step bob
    doomState.bobPhase += dt * 9 * sprint;
  } else {
    // settle bob toward zero
    doomState.bobPhase *= Math.pow(0.001, dt);
  }
}

function doomRotate(angle){
  const p = doomState.player;
  const c = Math.cos(angle), s = Math.sin(angle);
  const odx = p.dirX, ody = p.dirY;
  p.dirX = odx * c - ody * s;
  p.dirY = odx * s + ody * c;
  const opx = p.planeX, opy = p.planeY;
  p.planeX = opx * c - opy * s;
  p.planeY = opx * s + opy * c;
}

// ── ENEMY AI ──
function doomUpdateEnemies(dt){
  const p = doomState.player;
  for(const e of doomState.enemies){
    if(e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
    if(e.state === 'dying'){
      e.deathTimer += dt;
      if(e.deathTimer > 0.7) e.state = 'dead';
      continue;
    }
    if(e.state !== 'alive') continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    if(dist < 0.001) continue;
    const ndx = dx / dist, ndy = dy / dist;

    const sees = doomHasLineOfSight(e.x, e.y, p.x, p.y);
    if(sees && dist > 0.9){
      // chase
      const sp = 1.4 * dt;
      const nx = e.x + ndx * sp;
      const ny = e.y + ndy * sp;
      // basic collision: don't enter walls or other enemies
      if(!doomIsWall(nx, e.y) && !doomEnemyBlocked(nx, e.y, e)) e.x = nx;
      if(!doomIsWall(e.x, ny) && !doomEnemyBlocked(e.x, ny, e)) e.y = ny;
    }
    e.cooldown -= dt;
    if(sees && dist < 1.4 && e.cooldown <= 0){
      doomState.player.hp -= 8;
      doomState.hurtFlash = 0.5;
      sfx('doomBite');
      e.cooldown = 0.9;
      if(doomState.player.hp <= 0){
        doomEnd(false);
      }
      doomUpdateHUD();
    }
  }
}

function doomEnemyBlocked(x, y, self){
  for(const e of doomState.enemies){
    if(e === self || e.state !== 'alive') continue;
    if(Math.hypot(e.x - x, e.y - y) < 0.55) return true;
  }
  return false;
}

function doomHasLineOfSight(x0, y0, x1, y1){
  // Step along the segment in 0.1-unit increments; if any sample
  // is inside a wall, no line of sight.
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 0.1);
  for(let i = 1; i < steps; i++){
    const t = i / steps;
    if(doomIsWall(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// ── PICKUPS ──
function doomUpdatePickups(){
  const p = doomState.player;
  for(const k of doomState.pickups){
    if(k.taken) continue;
    if(Math.hypot(p.x - k.x, p.y - k.y) < 0.5){
      if(k.type === 'ammo'){
        p.ammo = Math.min(p.maxAmmo, p.ammo + 12);
        sfx('doomPickup');
      } else if(k.type === 'medkit'){
        p.hp = Math.min(p.maxHp, p.hp + 25);
        sfx('doomMedkit');
      } else if(k.type === 'shotgun' || k.type === 'chaingun' || k.type === 'rocket'){
        // Forward-compat weapon pickup: gives ammo + a small hp bonus.
        // Once the weapons branch lands, this hook is where the player's
        // weapon inventory should be updated.
        p.ammo = Math.min(p.maxAmmo, p.ammo + (k.ammoBonus || 0));
        if(k.hpBonus) p.hp = Math.min(p.maxHp, p.hp + k.hpBonus);
        sfx('doomWeapon');
        if(window.posthog) posthog.capture('doom_weapon_pickup', { weapon: k.type });
      } else if(k.type === 'armor'){
        p.hp = Math.min(p.maxHp, p.hp + (k.hpBonus || 35));
        sfx('doomArmor');
      }
      k.taken = true;
      doomUpdateHUD();
    }
  }
}

// ── WIN/LOSE ──
function doomCheckWin(){
  // Exit cell reached
  const p = doomState.player;
  if(doomCell(p.x | 0, p.y | 0) === 9){
    doomEnd(true);
    return;
  }
  if(doomState.enemies.every(e => e.state !== 'alive')){
    doomEnd(true);
  }
}

function doomEnd(won){
  if(doomState.gameOver) return;
  doomState.gameOver = true;
  doomState.won = won;
  if(document.pointerLockElement) document.exitPointerLock();
  if(window.posthog) posthog.capture('doom_game_ended', {
    won, kills: doomState.player.kills, hp: doomState.player.hp,
    level: DOOM_CURRENT_LEVEL_INDEX,
  });
  // If a flow manager is installed (js/doom/flow.js), let it decide
  // whether the player advances to the next level, sees the final
  // win screen, or hits a death screen. Otherwise fall back to the
  // simple in-canvas overlay so this file remains self-sufficient.
  if(typeof doomOnLevelEnd === 'function'){
    doomOnLevelEnd(won);
    return;
  }
  const ov = document.getElementById('doomOverlay');
  const ot = document.getElementById('doomOverlayTitle');
  const os = document.getElementById('doomOverlaySub');
  if(ov && ot && os){
    ov.classList.add('show');
    ot.className = 'overlay-title ' + (won ? 'win' : 'lose');
    ot.textContent = won ? 'VICTORY' : 'YOU DIED';
    os.textContent = won
      ? `${doomState.player.kills} KILLS · HP ${Math.max(0, doomState.player.hp | 0)}`
      : 'THE CITADEL CLAIMED YOU';
  }
  if(won) sfx('doomVictory'); else sfx('doomDie');
}

// ── HUD ──
function doomUpdateHUD(){
  document.getElementById('doomHp').textContent = Math.max(0, doomState.player.hp | 0);
  document.getElementById('doomAmmo').textContent = doomState.player.ammo;
  document.getElementById('doomKills').textContent = doomState.player.kills;
}

// ── GAME LOOP ──
function doomLoop(ts){
  const dt = Math.min((ts - doomLastTime) / 1000, 0.05);
  doomLastTime = ts;
  if(!doomState.gameOver){
    if(doomState.shootCooldown > 0) doomState.shootCooldown = Math.max(0, doomState.shootCooldown - dt);
    if(doomState.muzzleTimer > 0)   doomState.muzzleTimer = Math.max(0, doomState.muzzleTimer - dt);
    if(doomState.hurtFlash > 0)     doomState.hurtFlash = Math.max(0, doomState.hurtFlash - dt * 2);
    doomMove(dt);
    doomUpdateEnemies(dt);
    doomUpdatePickups();
    if(!doomState.gameOver) doomCheckWin();
  }
  doomRender();
  doomRenderMinimap();
  doomRaf = requestAnimationFrame(doomLoop);
}

// ── RESET ──
// Restart the current level. If a flow manager is installed, defer to
// it so it can re-show the title screen on full "new game" requests.
function doomReset(){
  if(typeof doomOnReset === 'function'){
    doomOnReset();
    return;
  }
  doomState = DOOM_DEFAULTS();
  const ov = document.getElementById('doomOverlay');
  if(ov) ov.classList.remove('show');
  doomUpdateHUD();
  doomLastTime = performance.now();
  if(window.posthog) posthog.capture('doom_game_restarted', {});
}

// Re-initialise gameplay state for the currently loaded level — used by
// flow.js to advance levels or to restart after a death.
function doomRestartCurrentLevel(){
  doomState = DOOM_DEFAULTS();
  doomUpdateHUD();
  doomLastTime = performance.now();
}

// ── LIFECYCLE ──
registerGame('doom', {
  init(){
    doomState = DOOM_DEFAULTS();
    document.getElementById('doomOverlay').classList.remove('show');
    doomUpdateHUD();
    document.addEventListener('keydown', doomOnKeyDown);
    document.addEventListener('keyup', doomOnKeyUp);
    document.addEventListener('mousemove', doomOnMouseMove);
    doomCanvas.addEventListener('mousedown', doomOnMouseDown);
    document.addEventListener('pointerlockchange', doomOnPointerLockChange);
    doomLastTime = performance.now();
    if(!doomRaf) doomRaf = requestAnimationFrame(doomLoop);
    if(window.posthog) posthog.capture('doom_game_started', {});
  },
  cleanup(){
    if(doomRaf){ cancelAnimationFrame(doomRaf); doomRaf = null; }
    document.removeEventListener('keydown', doomOnKeyDown);
    document.removeEventListener('keyup', doomOnKeyUp);
    document.removeEventListener('mousemove', doomOnMouseMove);
    doomCanvas.removeEventListener('mousedown', doomOnMouseDown);
    document.removeEventListener('pointerlockchange', doomOnPointerLockChange);
    if(document.pointerLockElement === doomCanvas) document.exitPointerLock();
  },
});
