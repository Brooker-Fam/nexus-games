// ══════════════════════════════════════════════
//  DOOM — enemies, AI, pathfinding, projectiles
// ══════════════════════════════════════════════
//
// Self-contained module exposed via `window.DoomEnemies`. Implements:
//   • Three enemy archetypes (demon / imp / zombieman) with distinct
//     stats, sprites, and attack patterns.
//   • Per-enemy finite state machine:
//       IDLE -> CHASE -> ATTACK -> CHASE -> PAIN -> ... -> DYING -> DEAD
//     Transitions are driven by line-of-sight, range, hit events, and
//     attack cooldown.
//   • Lightweight grid-based pathfinding (breadth-first search on the
//     walkable tiles, refreshed roughly twice a second per enemy). The
//     enemy walks toward the next waypoint cell rather than straight
//     toward the player, so it can navigate around walls instead of
//     wedging against them.
//   • Projectile entities (imp fireballs) with billboard rendering and
//     wall / player collision.
//   • A hitscan helper used by the player's weapon and by the
//     zombieman's rifle.
//
// The host game (game.js) supplies a small `env` object each tick:
//   { player, dt, isWall, cell, hurtPlayer, sfx, screenWidth, time }
// — everything the enemies need to read/write the world. This keeps the
// dependency one-way: game.js knows about enemies; enemies.js does not
// reach back into game.js globals.

(function (global) {
  'use strict';

  const SPRITE_SIZE = 64;

  // ── Sprite factories ────────────────────────────────────────────────
  function makeDemonSprite(hurt) {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    // body
    ctx.fillStyle = '#5a1810';
    ctx.beginPath();
    ctx.ellipse(32, 44, 13, 16, 0, 0, Math.PI * 2);
    ctx.fill();
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
    // eyes / teeth / claws
    ctx.fillStyle = '#fff200';
    ctx.fillRect(26, 21, 4, 3);
    ctx.fillRect(34, 21, 4, 3);
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(27, 22, 2, 1);
    ctx.fillRect(35, 22, 2, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(28, 27, 1, 2);
    ctx.fillRect(31, 27, 1, 2);
    ctx.fillRect(34, 27, 1, 2);
    ctx.fillStyle = '#1a0a04';
    ctx.fillRect(18, 50, 3, 6);
    ctx.fillRect(43, 50, 3, 6);
    if (hurt) tintRed(ctx);
    return c;
  }

  function makeImpSprite(hurt) {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    // body — slimmer, brown
    ctx.fillStyle = '#5a3818';
    ctx.beginPath();
    ctx.ellipse(32, 44, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a20';
    ctx.beginPath();
    ctx.ellipse(32, 46, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.fillStyle = '#6a3818';
    ctx.beginPath();
    ctx.arc(32, 24, 9, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#3a200c';
    ctx.beginPath();
    ctx.moveTo(24, 20); ctx.lineTo(20, 14); ctx.lineTo(25, 22); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, 20); ctx.lineTo(44, 14); ctx.lineTo(39, 22); ctx.closePath();
    ctx.fill();
    // glowing yellow eyes
    ctx.fillStyle = '#ffee44';
    ctx.fillRect(27, 23, 3, 3);
    ctx.fillRect(34, 23, 3, 3);
    // raised hand with fireball charge
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(42, 32, 4, 9);
    const grad = ctx.createRadialGradient(46, 33, 1, 46, 33, 6);
    grad.addColorStop(0, '#ffffaa');
    grad.addColorStop(0.4, '#ff8822');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(46, 33, 6, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.fillStyle = '#3a200c';
    ctx.fillRect(26, 54, 3, 6);
    ctx.fillRect(35, 54, 3, 6);
    if (hurt) tintRed(ctx);
    return c;
  }

  function makeZombiemanSprite(hurt) {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    // tattered uniform body
    ctx.fillStyle = '#3a4a26';
    ctx.fillRect(22, 30, 20, 26);
    // arms
    ctx.fillRect(16, 32, 6, 18);
    ctx.fillRect(42, 32, 6, 18);
    // belt
    ctx.fillStyle = '#1a1a0c';
    ctx.fillRect(22, 44, 20, 3);
    // tatters / blood
    ctx.fillStyle = 'rgba(120,30,30,0.6)';
    ctx.fillRect(24, 36, 4, 6);
    ctx.fillRect(34, 48, 5, 4);
    // head — pale undead
    ctx.fillStyle = '#aab098';
    ctx.beginPath();
    ctx.arc(32, 20, 10, 0, Math.PI * 2);
    ctx.fill();
    // hollow eyes
    ctx.fillStyle = '#0a0a05';
    ctx.fillRect(26, 18, 4, 4);
    ctx.fillRect(34, 18, 4, 4);
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(27, 19, 2, 2);
    ctx.fillRect(35, 19, 2, 2);
    // mouth
    ctx.fillStyle = '#1a0606';
    ctx.fillRect(28, 27, 8, 2);
    // rifle (held to side, foreshortened toward viewer)
    ctx.fillStyle = '#222';
    ctx.fillRect(40, 36, 18, 4);
    ctx.fillRect(54, 38, 4, 6);
    ctx.fillStyle = '#553322';
    ctx.fillRect(38, 38, 6, 6);
    // legs
    ctx.fillStyle = '#22321a';
    ctx.fillRect(24, 56, 6, 6);
    ctx.fillRect(34, 56, 6, 6);
    if (hurt) tintRed(ctx);
    return c;
  }

  function makeFireballSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const cx = 32, cy = 32;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    grad.addColorStop(0, '#fff6cc');
    grad.addColorStop(0.3, '#ffaa22');
    grad.addColorStop(0.7, '#cc3300');
    grad.addColorStop(1, 'rgba(60,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    // hot core
    ctx.fillStyle = '#ffffee';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  function makeCorpseSprite(type) {
    // Squashed silhouette in the type's body color
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const color = type === 'imp' ? '#3a200c'
                : type === 'zombieman' ? '#22321a'
                : '#3a0e08';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(32, 56, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // blood pool
    ctx.fillStyle = 'rgba(140,20,20,0.55)';
    ctx.beginPath();
    ctx.ellipse(32, 58, 26, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  function tintRed(ctx) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,80,40,0.65)';
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Type definitions ────────────────────────────────────────────────
  // Stats are tuned around the player's 100 HP / 28-damage pistol.
  const TYPES = {
    demon: {
      sprite: makeDemonSprite(false),
      spriteHurt: makeDemonSprite(true),
      corpse: makeCorpseSprite('demon'),
      hp: 60,
      speed: 1.6,           // world units / second
      sightRange: 12,
      attackRange: 1.3,     // melee
      attackCooldown: 0.9,
      attackWindup: 0.18,
      painChance: 0.6,
      painDuration: 0.25,
      damage: 10,
      attackKind: 'melee',
      bodyHeight: 1.0,      // sprite scale multiplier
      hitWidth: 0.4,
    },
    imp: {
      sprite: makeImpSprite(false),
      spriteHurt: makeImpSprite(true),
      corpse: makeCorpseSprite('imp'),
      hp: 35,
      speed: 1.1,
      sightRange: 14,
      attackRange: 7.0,     // projectile lob
      preferredRange: 4.5,  // tries to keep some distance
      attackCooldown: 1.3,
      attackWindup: 0.35,
      painChance: 0.8,
      painDuration: 0.3,
      damage: 12,
      projectileSpeed: 4.5,
      attackKind: 'projectile',
      bodyHeight: 0.85,
      hitWidth: 0.35,
    },
    zombieman: {
      sprite: makeZombiemanSprite(false),
      spriteHurt: makeZombiemanSprite(true),
      corpse: makeCorpseSprite('zombieman'),
      hp: 25,
      speed: 0.9,
      sightRange: 16,
      attackRange: 10,      // hitscan
      preferredRange: 5,
      attackCooldown: 1.6,
      attackWindup: 0.25,
      painChance: 0.9,
      painDuration: 0.35,
      damage: 6,
      attackKind: 'hitscan',
      hitscanAccuracy: 0.65, // probability of landing
      bodyHeight: 0.95,
      hitWidth: 0.35,
    },
  };

  const FIREBALL_SPRITE = makeFireballSprite();

  // ── Helpers ─────────────────────────────────────────────────────────
  function lineOfSight(env, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return true;
    const steps = Math.ceil(dist / 0.1);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (env.isWall(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  // Lightweight BFS toward the player's cell. Returns the next tile
  // center to walk to, or null if no path is found. Limited fan-out so
  // even a roomy map stays cheap (worst case ~150 cells visited).
  function pathStep(env, ex, ey) {
    const sx = ex | 0, sy = ey | 0;
    const tx = env.player.x | 0, ty = env.player.y | 0;
    if (sx === tx && sy === ty) {
      return { x: env.player.x, y: env.player.y };
    }
    const W = env.mapW, H = env.mapH;
    const visited = new Uint8Array(W * H);
    const parent = new Int32Array(W * H);
    parent.fill(-1);
    const queue = [sy * W + sx];
    visited[sy * W + sx] = 1;
    let found = -1, head = 0;
    const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let budget = 220;
    while (head < queue.length && budget-- > 0) {
      const cur = queue[head++];
      const cx = cur % W;
      const cy = (cur / W) | 0;
      if (cx === tx && cy === ty) { found = cur; break; }
      for (const [dx, dy] of NEIGH) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const idx = ny * W + nx;
        if (visited[idx]) continue;
        // Block on walls only — pickups and the exit (which the player
        // can stand on) are walkable. We always allow the target tile.
        if (env.isWall(nx + 0.5, ny + 0.5) && !(nx === tx && ny === ty)) continue;
        visited[idx] = 1;
        parent[idx] = cur;
        queue.push(idx);
      }
    }
    if (found < 0) return null;
    // walk parents back to the cell adjacent to the start
    let node = found;
    while (parent[node] !== sy * W + sx && parent[node] !== -1) {
      node = parent[node];
    }
    if (parent[node] === -1) return null;
    const nxs = node % W, nys = (node / W) | 0;
    return { x: nxs + 0.5, y: nys + 0.5 };
  }

  // ── Construction ────────────────────────────────────────────────────
  function makeEnemy(type, x, y) {
    const def = TYPES[type];
    return {
      type, def,
      x, y,
      hp: def.hp,
      state: 'idle',        // idle | chase | attack | pain | dying | dead
      stateTime: 0,
      cooldown: 0,
      windup: 0,
      hurt: 0,              // visual flash timer
      deathTimer: 0,
      // pathfinding cache
      path: null,
      pathTimer: 0,
      // facing direction (used for minimap arrow)
      face: 0,
    };
  }

  function spawnFrom(spawns) {
    const out = [];
    for (const s of spawns) {
      const t = s.type || 'demon';
      if (!TYPES[t]) continue;
      out.push(makeEnemy(t, s.x, s.y));
    }
    return out;
  }

  // ── Per-tick update ─────────────────────────────────────────────────
  function update(state, env) {
    const dt = env.dt;
    const p = env.player;
    // enemies
    for (const e of state.enemies) {
      if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
      e.stateTime += dt;

      if (e.state === 'dead') continue;

      if (e.state === 'dying') {
        e.deathTimer += dt;
        if (e.deathTimer > 0.7) e.state = 'dead';
        continue;
      }

      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) e.face = Math.atan2(dy, dx);
      const sees = dist <= e.def.sightRange &&
                   lineOfSight(env, e.x, e.y, p.x, p.y);

      if (e.state === 'pain') {
        if (e.stateTime >= e.def.painDuration) {
          setState(e, sees ? 'chase' : 'idle');
        }
        continue;
      }

      if (e.state === 'attack') {
        // windup -> fire -> reset to chase
        e.windup -= dt;
        if (e.windup <= 0) {
          fireAttack(e, env);
          e.cooldown = e.def.attackCooldown;
          setState(e, 'chase');
        }
        continue;
      }

      if (e.state === 'idle') {
        if (sees) setState(e, 'chase');
        continue;
      }

      // CHASE
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.pathTimer -= dt;

      const inAttackRange = dist <= e.def.attackRange;
      const ready = e.cooldown <= 0 && sees;

      if (inAttackRange && ready) {
        e.windup = e.def.attackWindup;
        setState(e, 'attack');
        continue;
      }

      // Decide a destination — toward player if we have LOS, else BFS
      // along walkable tiles to navigate around walls. The result is a
      // unit vector (mvx, mvy) of where to move this frame.
      let mvx, mvy;
      if (sees) {
        // For ranged enemies that prefer some standoff, back off when too close
        if (e.def.preferredRange && dist < e.def.preferredRange * 0.6) {
          const inv = 1 / Math.max(0.001, dist);
          mvx = -dx * inv;
          mvy = -dy * inv;
        } else if (dist > e.def.attackRange * 0.7) {
          const inv = 1 / Math.max(0.001, dist);
          mvx = dx * inv;
          mvy = dy * inv;
        } else {
          // strafe slightly — looks less stiff
          const inv = 1 / Math.max(0.001, dist);
          const sgn = ((((e.x * 13) | 0) + ((e.y * 7) | 0)) & 1) ? 1 : -1;
          mvx = -dy * inv * sgn * 0.6;
          mvy =  dx * inv * sgn * 0.6;
        }
      } else {
        if (!e.path || e.pathTimer <= 0) {
          e.path = pathStep(env, e.x, e.y);
          e.pathTimer = 0.45 + Math.random() * 0.2;
        }
        if (!e.path) {
          mvx = 0; mvy = 0;
        } else {
          const tx = e.path.x - e.x;
          const ty = e.path.y - e.y;
          const d = Math.hypot(tx, ty);
          if (d < 0.15) {
            e.path = null;
            mvx = 0; mvy = 0;
          } else {
            mvx = tx / d;
            mvy = ty / d;
          }
        }
      }

      if (mvx !== 0 || mvy !== 0) {
        const step = e.def.speed * dt;
        const nx = e.x + mvx * step;
        const ny = e.y + mvy * step;
        // axis-separated wall collision + enemy-vs-enemy avoidance
        if (!env.isWall(nx, e.y) && !blockedByOther(state.enemies, e, nx, e.y)) e.x = nx;
        if (!env.isWall(e.x, ny) && !blockedByOther(state.enemies, e, e.x, ny)) e.y = ny;
      }
    }

    // projectiles
    for (const pr of state.projectiles) {
      if (pr.dead) continue;
      pr.life -= dt;
      if (pr.life <= 0) { pr.dead = true; continue; }
      const step = pr.speed * dt;
      const nx = pr.x + pr.dx * step;
      const ny = pr.y + pr.dy * step;
      if (env.isWall(nx, ny)) {
        pr.dead = true;
        if (env.sfx) env.sfx('doomImpactWall', 80);
        continue;
      }
      pr.x = nx; pr.y = ny;
      // player hit
      const px = p.x - pr.x, py = p.y - pr.y;
      if (px * px + py * py < 0.18) {
        env.hurtPlayer(pr.damage, 'fireball');
        pr.dead = true;
      }
    }
    // prune
    state.projectiles = state.projectiles.filter(pr => !pr.dead);
  }

  function setState(e, s) {
    if (e.state === s) return;
    e.state = s;
    e.stateTime = 0;
  }

  function blockedByOther(enemies, self, x, y) {
    for (const o of enemies) {
      if (o === self) continue;
      if (o.state === 'dead' || o.state === 'dying') continue;
      const ox = o.x - x, oy = o.y - y;
      if (ox * ox + oy * oy < 0.55 * 0.55) return true;
    }
    return false;
  }

  // ── Attacks ─────────────────────────────────────────────────────────
  function fireAttack(e, env) {
    const p = env.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;
    const nx = dx / dist, ny = dy / dist;
    const kind = e.def.attackKind;
    if (!lineOfSight(env, e.x, e.y, p.x, p.y)) return;

    if (kind === 'melee') {
      if (dist <= e.def.attackRange + 0.1) {
        env.hurtPlayer(e.def.damage, 'melee');
        if (env.sfx) env.sfx('doomBite');
      }
    } else if (kind === 'projectile') {
      // spawn fireball from in front of the imp
      const ox = e.x + nx * 0.4;
      const oy = e.y + ny * 0.4;
      env.spawnProjectile({
        x: ox, y: oy,
        dx: nx, dy: ny,
        speed: e.def.projectileSpeed,
        damage: e.def.damage,
        life: 4,
        owner: e,
        dead: false,
      });
      if (env.sfx) env.sfx('doomImpFire');
    } else if (kind === 'hitscan') {
      // hit roll falls off with distance
      const falloff = Math.max(0.25, 1 - dist / e.def.attackRange);
      if (Math.random() < e.def.hitscanAccuracy * falloff) {
        env.hurtPlayer(e.def.damage, 'rifle');
      }
      if (env.sfx) env.sfx('doomRifle');
    }
  }

  // ── External: player shoots an enemy (hitscan) ──────────────────────
  function applyHitscan(state, env, damage, halfWidth) {
    const p = env.player;
    halfWidth = halfWidth == null ? 0.35 : halfWidth;
    let bestIdx = -1, bestDist = Infinity;
    const wallDist = env.wallDistAhead;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.state === 'dead' || e.state === 'dying') continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const forward = dx * p.dirX + dy * p.dirY;
      if (forward <= 0) continue;
      const perp = Math.abs(dx * p.dirY - dy * p.dirX);
      if (perp > halfWidth) continue;
      if (forward >= wallDist) continue;
      if (forward < bestDist) { bestDist = forward; bestIdx = i; }
    }
    if (bestIdx < 0) return null;
    return damageEnemy(state, env, bestIdx, damage);
  }

  function damageEnemy(state, env, idx, damage) {
    const e = state.enemies[idx];
    e.hp -= damage;
    e.hurt = 0.14;
    if (e.hp <= 0) {
      setState(e, 'dying');
      e.deathTimer = 0;
      if (env.sfx) env.sfx('doomEnemyDie');
      return { killed: true, enemy: e };
    }
    // pain transition: skip if already attacking & past windup or in pain
    if (e.state !== 'pain' && Math.random() < e.def.painChance) {
      setState(e, 'pain');
    }
    if (env.sfx) env.sfx('doomEnemyHurt');
    return { killed: false, enemy: e };
  }

  // ── Rendering helpers ───────────────────────────────────────────────
  function pickSprite(e) {
    if (e.state === 'dead') return null;
    if (e.state === 'dying') return e.def.corpse;
    return e.hurt > 0 ? e.def.spriteHurt : e.def.sprite;
  }

  function aliveCount(state) {
    let n = 0;
    for (const e of state.enemies) {
      if (e.state !== 'dead' && e.state !== 'dying') n++;
    }
    return n;
  }

  // ── Public API ──────────────────────────────────────────────────────
  global.DoomEnemies = {
    SPRITE_SIZE,
    TYPES,
    FIREBALL_SPRITE,
    spawnFrom,
    update,
    applyHitscan,
    damageEnemy,
    pickSprite,
    aliveCount,
    lineOfSight,
  };
})(typeof window !== 'undefined' ? window : globalThis);
