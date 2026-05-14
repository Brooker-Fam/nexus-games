// ── NEXUS DOOM · ENEMIES, AI, COMBAT ──
// Builds on Carlos's raycaster foundation:
//   • spawns DoomEntity objects with an `update(dt)` that runs a finite-state
//     AI tick (idle → alerted → chase → attack → pain → dying → dead/corpse).
//   • Performs its own grid-walk LOS check (the engine's `castRay` only fires
//     from the player; for enemy-to-player sight we walk DDA from arbitrary
//     points).
//   • Hitscan and projectile attacks. Projectiles are themselves DoomEntities
//     that move per tick and tag the player on impact.
//   • Player damage funnel + HUD damage-flash signal.
//
// Public API (window.DoomEnemies):
//   spawnEnemy(typeId, x, y) → entity
//   spawnDefaultEncounter()         — drops the demo encounter into the map
//   getPlayerHealth() → number
//   damagePlayer(amount, source?)
//   tryFirePlayerHitscan({ angle, hit }) → entity | null  // call from onPlayerFire
//   reset()
//
// Events emitted on `Doom.events`:
//   onPlayerHurt   { amount, source, hp }   — HUD flash + sfx
//   onEnemyHurt    { entity, amount, killed }
//
// Listens on `Doom.events`:
//   tick           updates projectiles in-flight (kept in our own list so
//                  they aren't expected to live in DoomEntity update chain)
//   onPlayerFire   resolved by gameplay caller via tryFirePlayerHitscan

(function (global) {
  'use strict';

  const SPRITES = (global.DoomEnemySprites && global.DoomEnemySprites.ids) || null;

  // ── Enemy archetype table ───────────────────────────────────────────────
  // Stats are in tile-space (1 unit = 1 grid square).
  const TYPES = {
    imp: {
      name:        'Imp',
      hp:          40,
      speed:       1.7,       // tiles per second when chasing
      sightRange:  16,        // beyond this, even with LOS, stays idle
      attackRange: 8,         // start lobbing fireballs at <= this distance
      keepAway:    3.0,       // tries not to close past this
      attackKind:  'projectile',
      attackCD:    1.6,       // seconds between attacks
      attackDmg:   8,
      projectileSpeed: 5.0,
      projectileDmg:   8,
      painChance:  0.35,      // chance a hit interrupts → pain
      painTime:    0.25,
      attackTime:  0.45,
      deathTimeA:  0.18,
      deathTimeB:  0.25,
      radius:      0.32,      // collision radius for friendly-fire / projectile hit
      scale:       0.9,
      vOffset:     0,
      sfxAlert:    'doomImpAlert',
      sfxPain:     'doomImpPain',
      sfxDie:      'doomImpDie',
      sfxAttack:   'doomImpAttack',
      sprites:     SPRITES ? SPRITES.imp : null,
    },
    zombie: {
      name:        'Zombieman',
      hp:          25,
      speed:       1.3,
      sightRange:  20,
      attackRange: 10,
      keepAway:    4.0,
      attackKind:  'hitscan',
      attackCD:    1.8,
      attackDmg:   10,
      hitscanSpread: 0.06,    // radians, ~3.4°
      painChance:  0.5,
      painTime:    0.25,
      attackTime:  0.4,
      deathTimeA:  0.18,
      deathTimeB:  0.3,
      radius:      0.30,
      scale:       0.95,
      vOffset:     0,
      sfxAlert:    'doomZombieAlert',
      sfxPain:     'doomZombiePain',
      sfxDie:      'doomZombieDie',
      sfxAttack:   'doomZombieAttack',
      sprites:     SPRITES ? SPRITES.zombie : null,
    },
    pinky: {
      name:        'Pinky',
      hp:          90,
      speed:       2.6,
      sightRange:  14,
      attackRange: 1.0,        // melee only
      keepAway:    0,          // charge straight in
      attackKind:  'melee',
      attackCD:    1.0,
      attackDmg:   18,
      painChance:  0.15,       // rarely flinches
      painTime:    0.18,
      attackTime:  0.45,
      deathTimeA:  0.22,
      deathTimeB:  0.35,
      radius:      0.40,
      scale:       1.05,
      vOffset:     0,
      sfxAlert:    'doomPinkyAlert',
      sfxPain:     'doomPinkyPain',
      sfxDie:      'doomPinkyDie',
      sfxAttack:   'doomPinkyAttack',
      sprites:     SPRITES ? SPRITES.pinky : null,
    },
  };

  // ── Local state ─────────────────────────────────────────────────────────
  const enemies = [];   // live + dying + corpse entities (also in Doom.getEntities())
  const projectiles = [];

  const PLAYER_MAX_HP = 100;
  let playerHP = PLAYER_MAX_HP;
  let invuln = 0; // brief i-frames after taking damage

  // ── Helpers ─────────────────────────────────────────────────────────────
  function _sfx(name) {
    if (typeof global.sfx === 'function') global.sfx(name);
  }

  function _isWall(x, y) {
    const map = global.Doom && global.Doom.getMap ? global.Doom.getMap() : null;
    if (!map) return true;
    const tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
    return (map.tiles[ty * map.width + tx] | 0) > 0;
  }

  // Grid-DDA line-of-sight between two world points.
  // Returns true if no solid tile sits between them.
  function lineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return true;
    const rdx = dx / dist, rdy = dy / dist;
    let mapX = x1 | 0, mapY = y1 | 0;
    const deltaX = rdx === 0 ? Infinity : Math.abs(1 / rdx);
    const deltaY = rdy === 0 ? Infinity : Math.abs(1 / rdy);
    let stepX, sideX, stepY, sideY;
    if (rdx < 0) { stepX = -1; sideX = (x1 - mapX) * deltaX; }
    else         { stepX =  1; sideX = (mapX + 1 - x1) * deltaX; }
    if (rdy < 0) { stepY = -1; sideY = (y1 - mapY) * deltaY; }
    else         { stepY =  1; sideY = (mapY + 1 - y1) * deltaY; }

    let traveled = 0;
    // safety bound: traverse at most ~map diagonal
    for (let i = 0; i < 256; i++) {
      if (sideX < sideY) { traveled = sideX; sideX += deltaX; mapX += stepX; }
      else               { traveled = sideY; sideY += deltaY; mapY += stepY; }
      if (traveled >= dist) return true;
      if (_isWall(mapX + 0.5, mapY + 0.5)) {
        // wall sits closer than the target — vision blocked
        return false;
      }
    }
    return true;
  }

  // Axis-separated wall-slide move for an enemy.
  function _moveEnemy(e, vx, vy) {
    const pad = e._type.radius;
    let nx = e.x + vx;
    if (vx > 0 && _isWall(nx + pad, e.y)) nx = Math.floor(nx + pad) - pad - 1e-4;
    else if (vx < 0 && _isWall(nx - pad, e.y)) nx = Math.ceil(nx - pad) + pad + 1e-4;
    let ny = e.y + vy;
    if (vy > 0 && _isWall(nx, ny + pad)) ny = Math.floor(ny + pad) - pad - 1e-4;
    else if (vy < 0 && _isWall(nx, ny - pad)) ny = Math.ceil(ny - pad) + pad + 1e-4;
    e.x = nx; e.y = ny;
  }

  // ── Damage funnel ───────────────────────────────────────────────────────
  function damagePlayer(amount, source) {
    if (playerHP <= 0) return;
    if (invuln > 0) return;
    playerHP = Math.max(0, playerHP - amount);
    invuln = 0.18; // brief i-frame so a 7-pellet zombie volley can't one-shot
    global.Doom.events.emit('onPlayerHurt', {
      amount, source: source || null, hp: playerHP,
    });
    _sfx('doomPlayerHurt');
    if (playerHP <= 0) {
      _sfx('doomPlayerDie');
      global.Doom.events.emit('onPlayerDie', {});
    }
  }

  function getPlayerHealth() { return playerHP; }
  function setPlayerHealth(v) { playerHP = Math.max(0, Math.min(PLAYER_MAX_HP, v|0)); }

  function damageEnemy(e, amount) {
    if (e._state === 'dying' || e._state === 'dead') return;
    e._hp -= amount;
    if (e._hp <= 0) {
      _enterDying(e);
      global.Doom.events.emit('onEnemyHurt', { entity: e, amount, killed: true });
      return;
    }
    if (Math.random() < e._type.painChance) {
      e._state = 'pain';
      e._timer = e._type.painTime;
      e.sprite = e._type.sprites.pain;
      _sfx(e._type.sfxPain);
    }
    global.Doom.events.emit('onEnemyHurt', { entity: e, amount, killed: false });
  }

  function _enterDying(e) {
    e._state = 'dying';
    e._timer = e._type.deathTimeA;
    e._deathStage = 0;
    e.sprite = e._type.sprites.deathA;
    _sfx(e._type.sfxDie);
  }

  // ── AI per-enemy update ─────────────────────────────────────────────────
  function _enemyTick(e, dt) {
    const t = e._type;
    const player = global.Doom.getPlayer();
    if (!player) return;

    // dying / dead don't take input
    if (e._state === 'dying') {
      e._timer -= dt;
      if (e._timer <= 0) {
        if (e._deathStage === 0) {
          e._deathStage = 1;
          e._timer = t.deathTimeB;
          e.sprite = t.sprites.deathB;
        } else {
          e._state = 'dead';
          e.sprite = t.sprites.corpse;
          e.scale = (e.scale || 1) * 0.85; // squashed corpse
          // shrink so it sits on the floor
          e.vOffset = -0.25;
        }
      }
      return;
    }
    if (e._state === 'dead') return;

    if (e._state === 'pain') {
      e._timer -= dt;
      if (e._timer <= 0) {
        e._state = 'chase';
        e.sprite = t.sprites.chaseA;
      }
      return;
    }

    // animation flip counter
    e._animT = (e._animT || 0) + dt;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const sees = dist <= t.sightRange && lineOfSight(e.x, e.y, player.x, player.y);

    if (e._state === 'idle') {
      if (sees) {
        e._state = 'alerted';
        e._timer = 0.25;
        e.sprite = t.sprites.idle;
        _sfx(t.sfxAlert);
      }
      return;
    }

    if (e._state === 'alerted') {
      e._timer -= dt;
      if (e._timer <= 0) {
        e._state = 'chase';
        e.sprite = t.sprites.chaseA;
      }
      // face the player while alerting
      e.angle = Math.atan2(dy, dx);
      return;
    }

    if (e._state === 'chase') {
      e.angle = Math.atan2(dy, dx);
      // flip chase frames
      if (e._animT > 0.18) {
        e._animT = 0;
        e.sprite = (e.sprite === t.sprites.chaseA) ? t.sprites.chaseB : t.sprites.chaseA;
      }

      // can we attack?
      if (sees && dist <= t.attackRange && e._cooldown <= 0) {
        e._state = 'attack';
        e._timer = t.attackTime;
        e.sprite = t.sprites.attack;
        return;
      }

      // movement: seek toward player, but try to keep a buffer for ranged types
      if (sees) {
        let dirX = dx / dist, dirY = dy / dist;
        if (t.keepAway > 0 && dist < t.keepAway) {
          dirX = -dirX; dirY = -dirY;
        }
        const sp = t.speed * dt;
        _moveEnemy(e, dirX * sp, dirY * sp);
      } else {
        // lost sight — slow drift toward last seen
        const sp = (t.speed * 0.6) * dt;
        const ddx = (e._lastSeenX != null ? e._lastSeenX : player.x) - e.x;
        const ddy = (e._lastSeenY != null ? e._lastSeenY : player.y) - e.y;
        const dm = Math.hypot(ddx, ddy);
        if (dm > 0.1) _moveEnemy(e, (ddx / dm) * sp, (ddy / dm) * sp);
        else {
          e._state = 'idle';
          e.sprite = t.sprites.idle;
        }
      }
      if (sees) { e._lastSeenX = player.x; e._lastSeenY = player.y; }
      e._cooldown = Math.max(0, e._cooldown - dt);
      return;
    }

    if (e._state === 'attack') {
      e._timer -= dt;
      // attack lands at half the animation (Doom-ish)
      if (!e._attackResolved && e._timer <= t.attackTime * 0.5) {
        e._attackResolved = true;
        _resolveAttack(e);
      }
      if (e._timer <= 0) {
        e._attackResolved = false;
        e._cooldown = t.attackCD;
        e._state = 'chase';
        e.sprite = t.sprites.chaseA;
      }
      return;
    }
  }

  function _resolveAttack(e) {
    const t = e._type;
    const player = global.Doom.getPlayer();
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (!lineOfSight(e.x, e.y, player.x, player.y)) return;
    _sfx(t.sfxAttack);

    if (t.attackKind === 'melee') {
      if (dist <= t.attackRange + 0.4) {
        damagePlayer(t.attackDmg, e);
      }
    } else if (t.attackKind === 'hitscan') {
      // small spread; treat player as a point
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * (t.hitscanSpread || 0);
      // probability of hit falls off slightly with distance (Doom-style)
      const accuracy = Math.max(0.35, 1 - dist / (t.sightRange * 1.5));
      if (Math.random() < accuracy) {
        damagePlayer(t.attackDmg, e);
      }
    } else if (t.attackKind === 'projectile') {
      _spawnProjectile(e, t);
    }
  }

  function _spawnProjectile(e, t) {
    const player = global.Doom.getPlayer();
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist, dirY = dy / dist;

    // spawn slightly in front of the enemy so it doesn't collide with itself
    const startX = e.x + dirX * (t.radius + 0.1);
    const startY = e.y + dirY * (t.radius + 0.1);

    const proj = {
      x: startX, y: startY, angle: Math.atan2(dirY, dirX),
      sprite: (SPRITES && SPRITES.fireball) || 250,
      state: 'projectile',
      scale: 0.5,
      vOffset: 0,
      _vx: dirX * t.projectileSpeed,
      _vy: dirY * t.projectileSpeed,
      _dmg: t.projectileDmg,
      _life: 4.0,
      _isProjectile: true,
      update() {/* engine update will be a no-op; we tick projectiles ourselves */},
    };
    global.Doom.addEntity(proj);
    projectiles.push(proj);
  }

  function _projectileTick(dt) {
    if (!projectiles.length) return;
    const player = global.Doom.getPlayer();
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (p.dead) { projectiles.splice(i, 1); continue; }
      p._life -= dt;
      if (p._life <= 0) { p.dead = true; projectiles.splice(i, 1); continue; }
      const nx = p.x + p._vx * dt;
      const ny = p.y + p._vy * dt;
      // wall hit
      if (_isWall(nx, ny)) {
        p.dead = true; projectiles.splice(i, 1);
        _sfx('doomFireballHit');
        continue;
      }
      // player hit (small radius)
      const dx = player.x - nx, dy = player.y - ny;
      if (dx * dx + dy * dy < 0.28 * 0.28) {
        damagePlayer(p._dmg, { projectile: true });
        p.dead = true; projectiles.splice(i, 1);
        _sfx('doomFireballHit');
        continue;
      }
      p.x = nx; p.y = ny;
    }
  }

  // ── Player firing → resolve hitscan against enemies ─────────────────────
  // Carlos's onPlayerFire already gives us a wall-`hit` from castRay. We just
  // need to find the closest enemy along that ray that isn't behind a wall.
  function tryFirePlayerHitscan(payload) {
    const player = global.Doom.getPlayer();
    if (!player) return null;
    const ang = (payload && payload.angle) != null ? payload.angle : player.angle;
    const wallDist = (payload && payload.hit && payload.hit.dist) || 32;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);

    let best = null;
    let bestT = wallDist; // can't hit through walls
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.dead) continue;
      if (e._state === 'dying' || e._state === 'dead') continue;
      // project enemy onto ray
      const dx = e.x - player.x, dy = e.y - player.y;
      const tProj = dx * dirX + dy * dirY;
      if (tProj <= 0) continue; // behind us
      if (tProj > bestT) continue;
      const px = player.x + dirX * tProj;
      const py = player.y + dirY * tProj;
      const perp = Math.hypot(e.x - px, e.y - py);
      const hitR = (e._type.radius + 0.25); // generous, hitscan is forgiving
      if (perp <= hitR) {
        // double-check LOS isn't blocked by a corner that the castRay missed
        if (lineOfSight(player.x, player.y, e.x, e.y)) {
          best = e;
          bestT = tProj;
        }
      }
    }
    if (best) {
      // damage scales with kind — pistol default ~18; projectile and pinky
      // are not weapon-aware here, so we just deal a flat hit.
      damageEnemy(best, 22);
    }
    return best;
  }

  // ── Spawning ────────────────────────────────────────────────────────────
  function spawnEnemy(typeId, x, y) {
    const t = TYPES[typeId];
    if (!t) { console.warn('Unknown enemy type:', typeId); return null; }
    if (!t.sprites) {
      // sprites module may have loaded after enemies.js; refresh ref.
      const live = global.DoomEnemySprites && global.DoomEnemySprites.ids;
      if (live && live[typeId]) t.sprites = live[typeId];
    }
    const e = {
      x, y, angle: 0,
      sprite: t.sprites.idle,
      state: 'idle',
      scale: t.scale,
      vOffset: t.vOffset,
      _type: t,
      _hp: t.hp,
      _state: 'idle',
      _timer: 0,
      _cooldown: 0,
      _animT: 0,
      _deathStage: 0,
      _attackResolved: false,
      _isEnemy: true,
      update(dt) { _enemyTick(this, dt); },
    };
    global.Doom.addEntity(e);
    enemies.push(e);
    return e;
  }

  function spawnDefaultEncounter() {
    // Tuned for the stub 8×8 default map: spawn one of each type within sight
    // lanes but on distinct cells so the player can pull them one at a time.
    spawnEnemy('zombie', 6.5, 1.5);
    spawnEnemy('imp',    6.5, 6.5);
    spawnEnemy('pinky',  3.5, 6.5);
  }

  function reset() {
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i]) enemies[i].dead = true;
    }
    for (let i = 0; i < projectiles.length; i++) {
      if (projectiles[i]) projectiles[i].dead = true;
    }
    enemies.length = 0;
    projectiles.length = 0;
    playerHP = PLAYER_MAX_HP;
    invuln = 0;
  }

  function getEnemies() { return enemies; }
  function getProjectiles() { return projectiles; }

  // tick hook for projectiles + i-frame countdown
  function _onTick({ dt }) {
    if (invuln > 0) invuln = Math.max(0, invuln - dt);
    _projectileTick(dt);
    // sweep enemies that the engine marked dead (e.g. corpse fade-out)
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i] || enemies[i].dead) enemies.splice(i, 1);
    }
  }

  // Wire up when Doom is available
  function _init() {
    if (!global.Doom || !global.Doom.events) {
      console.warn('Doom engine not ready when enemies.js loaded — wiring deferred');
      setTimeout(_init, 0);
      return;
    }
    // bind sprites if they were installed after enemies.js executed
    if (global.DoomEnemySprites && global.DoomEnemySprites.ids) {
      const ids = global.DoomEnemySprites.ids;
      TYPES.imp.sprites = ids.imp;
      TYPES.zombie.sprites = ids.zombie;
      TYPES.pinky.sprites = ids.pinky;
    }
    global.Doom.events.on('tick', _onTick);
    global.Doom.events.on('onPlayerFire', (payload) => {
      tryFirePlayerHitscan(payload);
    });
  }
  _init();

  global.DoomEnemies = {
    spawnEnemy,
    spawnDefaultEncounter,
    damageEnemy,
    damagePlayer,
    getPlayerHealth,
    setPlayerHealth,
    tryFirePlayerHitscan,
    lineOfSight,
    getEnemies,
    getProjectiles,
    reset,
    PLAYER_MAX_HP,
    TYPES,
  };
})(window);
