// ── NEXUS DOOM · COMBAT ──
// Player state (hp / armor), pickup factory, enemy AI, projectiles,
// hitscan resolution, splash damage, and damage-feedback timers
// (vignette + screen-shake) consumed by the HUD layer.

(function (global) {
  'use strict';

  // ── Player state ────────────────────────────────────────────────────────
  const player = {
    hp: 100, maxHp: 100, hpCeiling: 200,
    armor: 0, maxArmor: 100, armorCeiling: 200,
    armorClass: 1, // 1 = green (1/3 absorb), 2 = blue (1/2 absorb)
    dead: false,
    painFlash: 0,
    hurtFlash: 0,
    shakeAmp: 0, shakeTime: 0,
    pickupMsg: null, pickupMsgTime: 0,
    facePainTimer: 0,
    score: 0, kills: 0,
  };

  function resetPlayer() {
    player.hp = 100; player.armor = 0; player.armorClass = 1;
    player.dead = false;
    player.painFlash = 0; player.hurtFlash = 0;
    player.shakeAmp = 0; player.shakeTime = 0;
    player.pickupMsg = null; player.pickupMsgTime = 0;
    player.facePainTimer = 0;
    player.score = 0; player.kills = 0;
  }

  function _sfx(name, throttle) {
    if (typeof global.sfx === 'function') global.sfx(name, throttle || 0);
  }

  function hurtPlayer(amount, kind) {
    if (player.dead || amount <= 0) return;
    let dmg = amount;
    if (player.armor > 0) {
      const absorb = player.armorClass === 2 ? 0.5 : 1 / 3;
      const armorDmg = Math.min(player.armor, Math.floor(dmg * absorb));
      player.armor -= armorDmg;
      dmg -= armorDmg;
    }
    player.hp = Math.max(0, player.hp - dmg);
    player.painFlash = 0.35;
    player.hurtFlash = Math.min(0.75, 0.25 + dmg / 40);
    player.facePainTimer = 0.6;
    if (dmg > 8) {
      player.shakeAmp = Math.min(10, 2 + dmg * 0.15);
      player.shakeTime = 0.28;
    }
    _sfx('doomHurt', 90);
    if (player.hp <= 0) {
      player.dead = true;
      _sfx('doomDie');
    }
  }

  function heal(amount, ceiling) {
    const cap = ceiling || player.maxHp;
    if (player.hp >= cap) return false;
    player.hp = Math.min(cap, player.hp + amount);
    return true;
  }
  function giveArmor(amount, armorClass) {
    const ac = armorClass || 1;
    const cap = ac === 2 ? player.armorCeiling : player.maxArmor;
    // Doom rule: blue armor replaces; green only fills up to its own cap.
    if (ac === 2) {
      if (player.armor >= cap && player.armorClass === 2) return false;
      player.armor = Math.min(cap, player.armor + amount);
      player.armorClass = 2;
      return true;
    }
    if (player.armor >= cap) return false;
    player.armor = Math.min(cap, player.armor + amount);
    if (player.armorClass !== 2) player.armorClass = 1;
    return true;
  }

  function flashPickupMsg(text) {
    player.pickupMsg = text;
    player.pickupMsgTime = 1.6;
  }

  // ── Pickup definitions ──────────────────────────────────────────────────
  // Sprite ids: 200-203 ammo, 210-211 health, 220-221 armor, 250-252 weapons.
  // Sprites are installed by hud.js so the engine has something to draw.
  const PICKUPS = {
    clip:        { sprite: 200, msg: '+10 BULLETS',    scale: 0.45, ammo: { type: 'clip', amt: 10 } },
    box_bullets: { sprite: 200, msg: '+50 BULLETS',    scale: 0.55, ammo: { type: 'clip', amt: 50 } },
    shells:      { sprite: 201, msg: '+4 SHELLS',      scale: 0.45, ammo: { type: 'shells', amt: 4 } },
    box_shells:  { sprite: 201, msg: '+20 SHELLS',     scale: 0.55, ammo: { type: 'shells', amt: 20 } },
    rocket:      { sprite: 202, msg: '+1 ROCKET',      scale: 0.45, ammo: { type: 'rockets', amt: 1 } },
    box_rockets: { sprite: 202, msg: '+5 ROCKETS',     scale: 0.55, ammo: { type: 'rockets', amt: 5 } },
    cell:        { sprite: 203, msg: '+20 CELLS',      scale: 0.45, ammo: { type: 'cells', amt: 20 } },
    stimpack:    { sprite: 210, msg: '+10 HEALTH',     scale: 0.40, heal: 10, healCap: 100 },
    medkit:      { sprite: 211, msg: '+25 HEALTH',     scale: 0.55, heal: 25, healCap: 100 },
    soulsphere:  { sprite: 211, msg: 'SOUL SPHERE!',   scale: 0.55, heal: 100, healCap: 200 },
    armor_green: { sprite: 220, msg: 'ARMOR +100',     scale: 0.55, armor: { amt: 100, type: 1 } },
    armor_blue:  { sprite: 221, msg: 'MEGA-ARMOR!',    scale: 0.55, armor: { amt: 200, type: 2 } },
    weapon_shotgun:  { sprite: 250, msg: 'SHOTGUN!',         scale: 0.55, weapon: 'shotgun',        ammoBonus: 8 },
    weapon_chaingun: { sprite: 251, msg: 'CHAINGUN!',        scale: 0.55, weapon: 'chaingun',       ammoBonus: 25 },
    weapon_rocket:   { sprite: 252, msg: 'ROCKET LAUNCHER!', scale: 0.55, weapon: 'rocketLauncher', ammoBonus: 4 },
  };

  function spawnPickup(kind, x, y) {
    const def = PICKUPS[kind];
    if (!def || !global.Doom) return null;
    const e = {
      x, y, angle: 0,
      sprite: def.sprite,
      scale: def.scale, vOffset: -0.25,
      state: 'pickup', isPickup: true,
      kind, def,
      _bob: Math.random() * Math.PI * 2,
      update(dt) {
        this._bob += dt * 3;
        this.vOffset = -0.25 + Math.sin(this._bob) * 0.05;
        const p = global.Doom.getPlayer();
        if (!p) return;
        const dx = p.x - this.x, dy = p.y - this.y;
        if (dx * dx + dy * dy < 0.42 * 0.42) {
          if (_consumePickup(this)) this.dead = true;
        }
      },
    };
    return global.Doom.addEntity(e);
  }

  function _consumePickup(e) {
    const def = e.def;
    let took = false;
    if (def.ammo) {
      if (global.DoomWeapons.addAmmo(def.ammo.type, def.ammo.amt)) took = true;
    }
    if (def.heal) {
      if (heal(def.heal, def.healCap || player.maxHp)) took = true;
    }
    if (def.armor) {
      if (giveArmor(def.armor.amt, def.armor.type)) took = true;
    }
    if (def.weapon) {
      const wasNew = global.DoomWeapons.giveWeapon(def.weapon, def.ammoBonus);
      // Pick up weapons even if owned (for the ammo bonus).
      took = took || wasNew || !!def.ammoBonus;
    }
    if (took) {
      flashPickupMsg(def.msg);
      _sfx('doomPickup');
    }
    return took;
  }

  // ── Enemies ─────────────────────────────────────────────────────────────
  const ENEMY_DEFS = {
    zombie: { sprite: 230, hp: 22, speed: 1.0, meleeDamage: 6,  meleeRange: 1.0, score: 25, scale: 0.95 },
    imp:    { sprite: 231, hp: 38, speed: 1.4, meleeDamage: 10, meleeRange: 1.05, score: 50, scale: 1.00 },
    demon:  { sprite: 232, hp: 60, speed: 1.7, meleeDamage: 14, meleeRange: 1.20, score: 75, scale: 1.10 },
  };

  function spawnEnemy(kind, x, y) {
    const def = ENEMY_DEFS[kind] || ENEMY_DEFS.imp;
    const e = {
      x, y, angle: 0,
      sprite: def.sprite,
      scale: def.scale, vOffset: 0,
      state: 'idle',
      kind: kind || 'imp',
      hp: def.hp, maxHp: def.hp,
      meleeRange: def.meleeRange, meleeDamage: def.meleeDamage,
      speed: def.speed, score: def.score,
      attackCooldown: 0,
      painTimer: 0,
      deathTimer: 0,
      isEnemy: true,
      update(dt) { _enemyTick(this, dt); },
    };
    return global.Doom.addEntity(e);
  }

  function _enemyTick(e, dt) {
    if (e.deathTimer > 0) {
      e.deathTimer -= dt;
      e.vOffset = -0.5 + Math.min(0, -0.2 + (0.8 - e.deathTimer));
      e.scale = Math.max(0.55, e.scale - dt * 0.4);
      if (e.deathTimer <= 0) e.dead = true;
      return;
    }
    if (e.painTimer > 0) {
      e.painTimer -= dt;
      return;
    }
    const p = global.Doom.getPlayer();
    if (!p) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;
    e.angle = Math.atan2(dy, dx);

    if (dist <= e.meleeRange) {
      e.state = 'attack';
      if (e.attackCooldown <= 0) {
        hurtPlayer(e.meleeDamage, 'melee');
        e.attackCooldown = 1.3 + Math.random() * 0.4;
      } else {
        e.attackCooldown -= dt;
      }
    } else {
      e.state = 'chase';
      if (e.attackCooldown > 0) e.attackCooldown -= dt;
      const vx = (dx / dist) * e.speed * dt;
      const vy = (dy / dist) * e.speed * dt;
      _moveEntity(e, vx, vy);
    }
  }

  function _moveEntity(e, dx, dy) {
    const pad = 0.22;
    const nx = e.x + dx;
    if (!_isSolid(nx + (dx > 0 ? pad : -pad), e.y)) e.x = nx;
    const ny = e.y + dy;
    if (!_isSolid(e.x, ny + (dy > 0 ? pad : -pad))) e.y = ny;
  }

  function _isSolid(x, y) {
    const map = global.Doom.getMap();
    if (!map) return true;
    const tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
    return (map.tiles[ty * map.width + tx] | 0) > 0;
  }

  // ── Hitscan ─────────────────────────────────────────────────────────────
  // Pick the nearest enemy whose cylinder intersects the ray, capped by the
  // wall hit (so you can't shoot through walls) and the weapon's range.
  function hitscan(originX, originY, angle, range, wallHit) {
    const wallDist = wallHit ? wallHit.dist : range;
    const limit = Math.min(wallDist, range);
    const entities = global.Doom.getEntities();
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let best = null, bestDist = limit;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e || e.dead || !e.isEnemy || e.deathTimer > 0) continue;
      const dx = e.x - originX, dy = e.y - originY;
      const t = dx * cos + dy * sin;
      if (t <= 0 || t > bestDist) continue;
      const px = dx - cos * t;
      const py = dy - sin * t;
      const perp = Math.hypot(px, py);
      if (perp <= 0.36) {
        bestDist = t;
        best = e;
      }
    }
    return { enemy: best, dist: bestDist };
  }

  function damageEnemy(e, amt) {
    if (!e || e.dead || e.deathTimer > 0) return;
    e.hp -= amt;
    e.painTimer = 0.16;
    e.state = 'pain';
    _sfx('doomEnemyHurt', 60);
    if (e.hp <= 0) {
      e.state = 'dying';
      e.deathTimer = 0.8;
      player.kills++;
      player.score += e.score || 25;
      _sfx('doomEnemyDie');
    }
  }

  function splashDamage(x, y, radius, dmg) {
    const ents = global.Doom.getEntities();
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e || e.dead || !e.isEnemy || e.deathTimer > 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= radius) damageEnemy(e, dmg * (1 - d / radius));
    }
    const p = global.Doom.getPlayer();
    if (p) {
      const pd = Math.hypot(p.x - x, p.y - y);
      if (pd <= radius) {
        const fall = 1 - pd / radius;
        hurtPlayer(Math.floor(dmg * fall * 0.5), 'splash');
      }
    }
  }

  // ── Projectile (rocket) ─────────────────────────────────────────────────
  function spawnRocket(x, y, angle, speed, dmg, splash, splashRad) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const e = {
      x: x + cos * 0.35, y: y + sin * 0.35,
      angle,
      sprite: 240,
      scale: 0.40, vOffset: -0.1,
      state: 'flying', isProjectile: true,
      vx: cos * speed, vy: sin * speed,
      dmg, splash, splashRad,
      life: 4.0,
      update(dt) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        const nx = this.x + this.vx * dt;
        const ny = this.y + this.vy * dt;
        if (_isSolid(nx, ny)) {
          splashDamage(this.x, this.y, this.splashRad, this.splash);
          _sfx('doomExplosion');
          this.dead = true;
          return;
        }
        const ents = global.Doom.getEntities();
        for (let i = 0; i < ents.length; i++) {
          const t = ents[i];
          if (!t || t === this || t.dead || !t.isEnemy || t.deathTimer > 0) continue;
          if (Math.hypot(t.x - nx, t.y - ny) < 0.45) {
            damageEnemy(t, this.dmg);
            splashDamage(nx, ny, this.splashRad, this.splash);
            _sfx('doomExplosion');
            this.dead = true;
            return;
          }
        }
        this.x = nx; this.y = ny;
      },
    };
    return global.Doom.addEntity(e);
  }

  function tick(dt) {
    if (player.painFlash > 0) player.painFlash = Math.max(0, player.painFlash - dt);
    if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    if (player.facePainTimer > 0) player.facePainTimer = Math.max(0, player.facePainTimer - dt);
    if (player.shakeTime > 0) {
      player.shakeTime = Math.max(0, player.shakeTime - dt);
      if (player.shakeTime === 0) player.shakeAmp = 0;
    }
    if (player.pickupMsgTime > 0) {
      player.pickupMsgTime = Math.max(0, player.pickupMsgTime - dt);
      if (player.pickupMsgTime === 0) player.pickupMsg = null;
    }
  }

  global.DoomCombat = {
    player, resetPlayer,
    hurtPlayer, heal, giveArmor, flashPickupMsg,
    PICKUPS, spawnPickup,
    ENEMY_DEFS, spawnEnemy, damageEnemy,
    spawnRocket, splashDamage,
    hitscan, tick,
  };
})(window);
