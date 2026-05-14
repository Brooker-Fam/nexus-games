// ── NEXUS DOOM · ENEMY SPRITES ──
// Procedurally draws every enemy frame onto an offscreen canvas and registers
// it with DoomTextures so the raycaster can sample it like any other sprite.
//
// Frame layout per enemy type:
//   IDLE  CHASE_A  CHASE_B  ATTACK  PAIN  DEATH_A  DEATH_B  CORPSE
//
// The actual ImageData is stored in DoomTextures.* — this module only needs
// to be loaded before `installDoomEnemySprites()` is called.

(function (global) {
  'use strict';

  const SPRITE_SIZE = 64;

  // ── Sprite id allocation (avoid 0/1/2/100 from textures.js) ──────────────
  const SPRITES = {
    imp:    { idle: 200, chaseA: 201, chaseB: 202, attack: 203, pain: 204, deathA: 205, deathB: 206, corpse: 207 },
    zombie: { idle: 210, chaseA: 211, chaseB: 212, attack: 213, pain: 214, deathA: 215, deathB: 216, corpse: 217 },
    pinky:  { idle: 220, chaseA: 221, chaseB: 222, attack: 223, pain: 224, deathA: 225, deathB: 226, corpse: 227 },
    // projectile
    fireball: 250,
  };

  // shared offscreen canvas; one pass per frame
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const cx = c.getContext('2d', { willReadFrequently: true });

  function _clear() {
    cx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }

  function _install(id) {
    // addImageElement accepts any CanvasImageSource — our offscreen canvas
    // round-trips through DoomTextures' scratch canvas to produce an
    // ImageData entry that the raycaster can sample directly.
    global.DoomTextures.addImageElement(id, c);
  }

  // Pixel helper — draws a rect of `size` × `size` "pixels" anchored at the
  // sprite's pixel grid (so everything stays chunky and Doom-y).
  function px(x, y, size, fill) {
    cx.fillStyle = fill;
    cx.fillRect(x, y, size, size);
  }

  // ── IMP: lithe red demon, projectile attacker ────────────────────────────
  function drawImp(frame) {
    _clear();
    // body sway: -2..+2 px to differentiate chase frames
    const sway = frame === 'chaseB' ? 2 : frame === 'chaseA' ? -2 : 0;
    const armRaise = frame === 'attack' ? -8 : 0;
    const eyeOpen = frame !== 'pain';
    const cxx = 32 + sway;

    // shadow
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.beginPath();
    cx.ellipse(32, 60, 16, 4, 0, 0, Math.PI * 2);
    cx.fill();

    // legs
    cx.fillStyle = '#5a1c12';
    cx.fillRect(cxx - 9, 44, 6, 14);
    cx.fillRect(cxx + 3, 44, 6, 14);

    // torso
    cx.fillStyle = '#a4321e';
    cx.fillRect(cxx - 11, 26, 22, 22);
    // chest ridges
    cx.fillStyle = '#7b2014';
    cx.fillRect(cxx - 9, 30, 4, 2);
    cx.fillRect(cxx + 5, 30, 4, 2);
    cx.fillRect(cxx - 5, 38, 10, 2);

    // arms
    cx.fillStyle = '#8a2818';
    cx.fillRect(cxx - 16, 28 + armRaise, 5, 16);
    cx.fillRect(cxx + 11, 28 + armRaise, 5, 16);
    // claws on attack
    if (frame === 'attack') {
      cx.fillStyle = '#ffd24a';
      cx.fillRect(cxx - 18, 18, 3, 6);
      cx.fillRect(cxx + 15, 18, 3, 6);
    }

    // head
    cx.fillStyle = '#b73a22';
    cx.fillRect(cxx - 9, 12, 18, 16);
    // horns
    cx.fillStyle = '#3a1208';
    cx.fillRect(cxx - 10, 8, 3, 6);
    cx.fillRect(cxx + 7, 8, 3, 6);
    // eyes
    if (eyeOpen) {
      cx.fillStyle = '#ffe14a';
      cx.fillRect(cxx - 6, 18, 3, 3);
      cx.fillRect(cxx + 3, 18, 3, 3);
    } else {
      cx.fillStyle = '#5a1c12';
      cx.fillRect(cxx - 6, 19, 3, 1);
      cx.fillRect(cxx + 3, 19, 3, 1);
    }
    // fanged mouth
    cx.fillStyle = '#220606';
    cx.fillRect(cxx - 4, 23, 8, 2);
    cx.fillStyle = '#ffffff';
    cx.fillRect(cxx - 3, 24, 1, 2);
    cx.fillRect(cxx + 2, 24, 1, 2);
  }

  function drawImpDeath(stage) {
    _clear();
    // shadow
    cx.fillStyle = 'rgba(0,0,0,0.4)';
    cx.beginPath();
    cx.ellipse(32, 60, 20, 5, 0, 0, Math.PI * 2);
    cx.fill();
    if (stage === 'A') {
      // collapsing
      cx.fillStyle = '#7b2014';
      cx.fillRect(18, 38, 28, 18);
      cx.fillStyle = '#a4321e';
      cx.fillRect(22, 30, 20, 14);
      cx.fillStyle = '#3a0a08';
      cx.fillRect(26, 26, 4, 4);
      cx.fillRect(34, 26, 4, 4);
      // blood splat
      cx.fillStyle = '#ff2c2c';
      cx.fillRect(10, 50, 3, 3);
      cx.fillRect(52, 52, 4, 4);
    } else {
      // corpse: flat blob
      cx.fillStyle = '#5a1c12';
      cx.fillRect(14, 48, 36, 10);
      cx.fillStyle = '#7b2014';
      cx.fillRect(18, 52, 28, 6);
      // blood pool
      cx.fillStyle = '#8a0c0c';
      cx.beginPath();
      cx.ellipse(32, 60, 24, 4, 0, 0, Math.PI * 2);
      cx.fill();
    }
  }

  // ── ZOMBIE: shambling rifleman, hitscan attacker ─────────────────────────
  function drawZombie(frame) {
    _clear();
    const sway = frame === 'chaseB' ? -2 : frame === 'chaseA' ? 2 : 0;
    const cxx = 32 + sway;
    const aim = frame === 'attack';

    cx.fillStyle = 'rgba(0,0,0,0.3)';
    cx.beginPath();
    cx.ellipse(32, 60, 14, 4, 0, 0, Math.PI * 2);
    cx.fill();

    // boots / legs (drab green)
    cx.fillStyle = '#2a2a16';
    cx.fillRect(cxx - 8, 56, 6, 4);
    cx.fillRect(cxx + 2, 56, 6, 4);
    cx.fillStyle = '#3d4a2a';
    cx.fillRect(cxx - 8, 42, 6, 16);
    cx.fillRect(cxx + 2, 42, 6, 16);

    // torso — torn uniform
    cx.fillStyle = '#5d6a3a';
    cx.fillRect(cxx - 10, 24, 20, 22);
    cx.fillStyle = '#2a2a16';
    cx.fillRect(cxx - 4, 32, 8, 6); // belt
    // blood stains
    cx.fillStyle = '#6a0808';
    cx.fillRect(cxx - 8, 27, 4, 3);
    cx.fillRect(cxx + 2, 36, 5, 3);

    // arms holding rifle
    cx.fillStyle = '#5d6a3a';
    if (aim) {
      cx.fillRect(cxx - 14, 26, 6, 4);
      cx.fillRect(cxx + 8, 26, 22, 4);
      // rifle
      cx.fillStyle = '#1a1a1a';
      cx.fillRect(cxx + 14, 24, 18, 3);
      cx.fillRect(cxx + 28, 22, 4, 7);
      // muzzle flash
      cx.fillStyle = '#fff0a0';
      cx.fillRect(cxx + 32, 23, 4, 5);
      cx.fillStyle = '#ff8800';
      cx.fillRect(cxx + 34, 25, 3, 1);
    } else {
      cx.fillRect(cxx - 14, 28, 5, 14);
      cx.fillRect(cxx + 9, 28, 5, 14);
      // rifle slung
      cx.fillStyle = '#1a1a1a';
      cx.fillRect(cxx + 10, 30, 14, 2);
    }

    // head — sickly green
    cx.fillStyle = '#9aa86a';
    cx.fillRect(cxx - 7, 12, 14, 12);
    // hair / cap
    cx.fillStyle = '#2a2a16';
    cx.fillRect(cxx - 8, 10, 16, 4);
    // eyes
    if (frame === 'pain') {
      cx.fillStyle = '#2a0606';
      cx.fillRect(cxx - 4, 16, 8, 1);
    } else {
      cx.fillStyle = '#ffffff';
      cx.fillRect(cxx - 5, 16, 3, 2);
      cx.fillRect(cxx + 2, 16, 3, 2);
      cx.fillStyle = '#222';
      cx.fillRect(cxx - 4, 17, 1, 1);
      cx.fillRect(cxx + 3, 17, 1, 1);
    }
    // mouth
    cx.fillStyle = '#3a0606';
    cx.fillRect(cxx - 3, 21, 6, 2);
  }

  function drawZombieDeath(stage) {
    _clear();
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.beginPath();
    cx.ellipse(32, 60, 18, 4, 0, 0, Math.PI * 2);
    cx.fill();
    if (stage === 'A') {
      // knocked back
      cx.fillStyle = '#3d4a2a';
      cx.fillRect(14, 42, 36, 14);
      cx.fillStyle = '#5d6a3a';
      cx.fillRect(18, 34, 28, 12);
      cx.fillStyle = '#9aa86a';
      cx.fillRect(40, 32, 12, 10);
      cx.fillStyle = '#ff2c2c';
      cx.fillRect(46, 36, 4, 3);
    } else {
      cx.fillStyle = '#3d4a2a';
      cx.fillRect(10, 50, 44, 10);
      cx.fillStyle = '#5d6a3a';
      cx.fillRect(14, 53, 36, 6);
      cx.fillStyle = '#6a0808';
      cx.beginPath();
      cx.ellipse(32, 60, 28, 4, 0, 0, Math.PI * 2);
      cx.fill();
    }
  }

  // ── PINKY: bulky pink melee bruiser ──────────────────────────────────────
  function drawPinky(frame) {
    _clear();
    const sway = frame === 'chaseB' ? 2 : frame === 'chaseA' ? -2 : 0;
    const cxx = 32 + sway;
    const lunge = frame === 'attack';

    cx.fillStyle = 'rgba(0,0,0,0.45)';
    cx.beginPath();
    cx.ellipse(32, 60, 22, 5, 0, 0, Math.PI * 2);
    cx.fill();

    // squat legs
    cx.fillStyle = '#6a2a3a';
    cx.fillRect(cxx - 12, 44, 9, 16);
    cx.fillRect(cxx + 3, 44, 9, 16);

    // wide torso
    cx.fillStyle = '#d68aa8';
    cx.fillRect(cxx - 18, 22, 36, 26);
    // shading
    cx.fillStyle = '#a05a78';
    cx.fillRect(cxx - 18, 38, 36, 4);
    cx.fillRect(cxx - 16, 28, 4, 8);
    cx.fillRect(cxx + 12, 28, 4, 8);

    // arms (forward when attacking)
    if (lunge) {
      cx.fillStyle = '#c07090';
      cx.fillRect(cxx - 26, 24, 10, 8);
      cx.fillRect(cxx + 16, 24, 10, 8);
      // claws
      cx.fillStyle = '#fffacb';
      cx.fillRect(cxx - 28, 22, 3, 4);
      cx.fillRect(cxx - 28, 28, 3, 4);
      cx.fillRect(cxx + 25, 22, 3, 4);
      cx.fillRect(cxx + 25, 28, 3, 4);
    } else {
      cx.fillStyle = '#c07090';
      cx.fillRect(cxx - 22, 26, 6, 16);
      cx.fillRect(cxx + 16, 26, 6, 16);
    }

    // big head — fused with torso, tusks
    cx.fillStyle = '#e0a0bc';
    cx.fillRect(cxx - 12, 8, 24, 18);
    // tusks
    cx.fillStyle = '#fffacb';
    cx.fillRect(cxx - 9, 22, 3, 6);
    cx.fillRect(cxx + 6, 22, 3, 6);
    // eyes
    if (frame === 'pain') {
      cx.fillStyle = '#2a0606';
      cx.fillRect(cxx - 5, 16, 10, 1);
    } else {
      cx.fillStyle = '#fff';
      cx.fillRect(cxx - 7, 14, 4, 3);
      cx.fillRect(cxx + 3, 14, 4, 3);
      cx.fillStyle = '#5a0a0a';
      cx.fillRect(cxx - 6, 15, 2, 2);
      cx.fillRect(cxx + 4, 15, 2, 2);
    }
    // gaping mouth on attack
    if (lunge) {
      cx.fillStyle = '#3a0606';
      cx.fillRect(cxx - 8, 20, 16, 5);
      cx.fillStyle = '#fffacb';
      for (let i = 0; i < 4; i++) {
        cx.fillRect(cxx - 7 + i * 4, 20, 2, 2);
        cx.fillRect(cxx - 7 + i * 4, 23, 2, 2);
      }
    } else {
      cx.fillStyle = '#3a0606';
      cx.fillRect(cxx - 4, 21, 8, 2);
    }
  }

  function drawPinkyDeath(stage) {
    _clear();
    cx.fillStyle = 'rgba(0,0,0,0.45)';
    cx.beginPath();
    cx.ellipse(32, 60, 26, 5, 0, 0, Math.PI * 2);
    cx.fill();
    if (stage === 'A') {
      cx.fillStyle = '#a05a78';
      cx.fillRect(10, 36, 44, 22);
      cx.fillStyle = '#d68aa8';
      cx.fillRect(14, 32, 36, 18);
      cx.fillStyle = '#fffacb';
      cx.fillRect(20, 30, 3, 6);
      cx.fillRect(40, 30, 3, 6);
      cx.fillStyle = '#ff2c2c';
      cx.fillRect(8, 30, 4, 4);
      cx.fillRect(50, 26, 5, 5);
    } else {
      cx.fillStyle = '#a05a78';
      cx.fillRect(8, 50, 48, 10);
      cx.fillStyle = '#d68aa8';
      cx.fillRect(12, 54, 40, 6);
      cx.fillStyle = '#8a0c0c';
      cx.beginPath();
      cx.ellipse(32, 60, 30, 5, 0, 0, Math.PI * 2);
      cx.fill();
    }
  }

  // ── FIREBALL projectile ──────────────────────────────────────────────────
  function drawFireball() {
    _clear();
    // outer halo (transparent center handled by clearRect)
    const cx0 = 32, cy0 = 32;
    for (let r = 26; r >= 4; r -= 2) {
      const t = 1 - (r - 4) / 22; // 0..1
      const red   = (255 * t) | 0;
      const green = (180 * t * t) | 0;
      const alpha = (180 * t + 40) | 0;
      cx.fillStyle = `rgba(${red},${green},20,${alpha / 255})`;
      cx.beginPath();
      cx.arc(cx0, cy0, r, 0, Math.PI * 2);
      cx.fill();
    }
    // hot core
    cx.fillStyle = '#fffacb';
    cx.beginPath();
    cx.arc(cx0, cy0, 4, 0, Math.PI * 2);
    cx.fill();
  }

  // ── Public installer ─────────────────────────────────────────────────────
  function installDoomEnemySprites() {
    if (!global.DoomTextures) {
      console.warn('DoomTextures missing — load textures.js first');
      return SPRITES;
    }

    // IMP
    drawImp('idle');   _install(SPRITES.imp.idle);
    drawImp('chaseA'); _install(SPRITES.imp.chaseA);
    drawImp('chaseB'); _install(SPRITES.imp.chaseB);
    drawImp('attack'); _install(SPRITES.imp.attack);
    drawImp('pain');   _install(SPRITES.imp.pain);
    drawImpDeath('A'); _install(SPRITES.imp.deathA);
    drawImpDeath('B'); _install(SPRITES.imp.deathB);
    drawImpDeath('B'); _install(SPRITES.imp.corpse);

    // ZOMBIE
    drawZombie('idle');   _install(SPRITES.zombie.idle);
    drawZombie('chaseA'); _install(SPRITES.zombie.chaseA);
    drawZombie('chaseB'); _install(SPRITES.zombie.chaseB);
    drawZombie('attack'); _install(SPRITES.zombie.attack);
    drawZombie('pain');   _install(SPRITES.zombie.pain);
    drawZombieDeath('A'); _install(SPRITES.zombie.deathA);
    drawZombieDeath('B'); _install(SPRITES.zombie.deathB);
    drawZombieDeath('B'); _install(SPRITES.zombie.corpse);

    // PINKY
    drawPinky('idle');    _install(SPRITES.pinky.idle);
    drawPinky('chaseA');  _install(SPRITES.pinky.chaseA);
    drawPinky('chaseB');  _install(SPRITES.pinky.chaseB);
    drawPinky('attack');  _install(SPRITES.pinky.attack);
    drawPinky('pain');    _install(SPRITES.pinky.pain);
    drawPinkyDeath('A');  _install(SPRITES.pinky.deathA);
    drawPinkyDeath('B');  _install(SPRITES.pinky.deathB);
    drawPinkyDeath('B');  _install(SPRITES.pinky.corpse);

    // FIREBALL
    drawFireball();
    _install(SPRITES.fireball);

    return SPRITES;
  }

  global.DoomEnemySprites = {
    install: installDoomEnemySprites,
    ids: SPRITES,
  };
})(window);
