// Enemy AI. State machine: idle -> chase -> attack -> pain -> death.
// Pathfinding is "see player via line-of-sight, then seek with wall sliding".
// That's enough for a Doom-feel without a full nav grid.

import { ENEMIES } from './config.js';
import { fireHitscan } from './weapons.js';

export function createEnemy(typeId, x, y) {
  const def = ENEMIES[typeId];
  if (!def) throw new Error('Unknown enemy type: ' + typeId);
  return {
    type: typeId,
    def,
    x, y,
    radius: def.radius,
    health: def.health,
    angle: 0,
    state: 'idle',
    stateTime: 0,
    attackCooldown: 0.5 + Math.random() * 0.5,
    target: null,
    score: def.score,
    sprite: def.sprite,
    dead: false,
    removeMe: false,
  };
}

export function updateEnemy(enemy, dt, game) {
  enemy.stateTime += dt;
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

  switch (enemy.state) {
    case 'idle':   updateIdle(enemy, game); break;
    case 'chase':  updateChase(enemy, dt, game); break;
    case 'attack': updateAttack(enemy, dt, game); break;
    case 'pain':   updatePain(enemy); break;
    case 'death':  updateDeath(enemy); break;
  }
}

function transition(enemy, state) {
  enemy.state = state;
  enemy.stateTime = 0;
}

function canSee(enemy, target, game) {
  const dx = target.x - enemy.x, dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist > enemy.def.sightRange) return false;
  const facing = Math.atan2(dy, dx);
  // Idle enemies have a forward arc; agitated (already chasing) see 360.
  if (enemy.state === 'idle') {
    const da = angleDiff(facing, enemy.angle);
    if (Math.abs(da) > enemy.def.sightFov * 0.5) return false;
  }
  return game.engine.lineOfSight(enemy.x, enemy.y, target.x, target.y);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function updateIdle(enemy, game) {
  if (!game.player || game.player.dead) return;
  if (canSee(enemy, game.player, game)) {
    enemy.target = game.player;
    transition(enemy, 'chase');
  }
}

function updateChase(enemy, dt, game) {
  const target = enemy.target || game.player;
  if (!target || target.dead) { transition(enemy, 'idle'); return; }

  const dx = target.x - enemy.x, dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  enemy.angle = Math.atan2(dy, dx);

  // Move toward target with axis-separated wall slide.
  if (dist > 0.1) {
    const step = enemy.def.speed * dt;
    const mx = (dx / dist) * step;
    const my = (dy / dist) * step;
    enemyMove(enemy, mx, my, game);
  }

  // Decide whether to attack.
  if (enemy.attackCooldown <= 0 && canSee(enemy, target, game)) {
    const inMelee = enemy.def.meleeRange && dist <= enemy.def.meleeRange;
    const inRange = dist <= enemy.def.attackRange;
    if (inMelee || inRange) {
      transition(enemy, 'attack');
    }
  }
}

function updateAttack(enemy, dt, game) {
  // Telegraph window then commit the shot at the midpoint.
  const windup = 0.25;
  const commit = 0.5;
  const target = enemy.target || game.player;
  if (!target || target.dead) { transition(enemy, 'idle'); return; }

  if (enemy.stateTime >= windup && !enemy._shotFired) {
    enemy._shotFired = true;
    performAttack(enemy, target, game);
  }
  if (enemy.stateTime >= commit) {
    enemy._shotFired = false;
    enemy.attackCooldown = enemy.def.attackCooldown;
    transition(enemy, 'chase');
  }
}

function performAttack(enemy, target, game) {
  const dx = target.x - enemy.x, dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy);

  // Out of LOS by the time the shot resolves? Cancel.
  if (!game.engine.lineOfSight(enemy.x, enemy.y, target.x, target.y)) return;

  if (enemy.def.meleeRange && dist <= enemy.def.meleeRange) {
    game.applyDamage(target, enemy.def.meleeDamage, enemy);
    return;
  }
  if (enemy.def.attackKind === 'hitscan') {
    const angle = Math.atan2(dy, dx) + (Math.random() * 2 - 1) * enemy.def.attackSpread;
    fireHitscan(game, enemy.x, enemy.y, angle, enemy.def.attackRange, enemy.def.attackDamage, enemy);
  } else if (enemy.def.attackKind === 'projectile') {
    const angle = Math.atan2(dy, dx);
    const p = enemy.def.projectile;
    game.spawnProjectile({
      x: enemy.x, y: enemy.y,
      angle,
      speed: p.speed,
      damage: p.damage,
      radius: p.radius,
      ttl: p.ttl,
      sprite: p.sprite,
      owner: enemy,
    });
  }
}

function updatePain(enemy) {
  if (enemy.stateTime >= enemy.def.painTime) {
    transition(enemy, 'chase');
  }
}

function updateDeath(enemy) {
  if (enemy.stateTime >= enemy.def.deathTime) {
    enemy.removeMe = true;
  }
}

function enemyMove(enemy, dx, dy, game) {
  const r = enemy.radius;
  const level = game.level;
  // X
  if (dx !== 0) {
    const nx = enemy.x + dx;
    if (!blocked(nx + Math.sign(dx) * r, enemy.y - r, level) &&
        !blocked(nx + Math.sign(dx) * r, enemy.y + r, level) &&
        !enemyEnemyCollide(enemy, nx, enemy.y, game)) {
      enemy.x = nx;
    }
  }
  // Y
  if (dy !== 0) {
    const ny = enemy.y + dy;
    if (!blocked(enemy.x - r, ny + Math.sign(dy) * r, level) &&
        !blocked(enemy.x + r, ny + Math.sign(dy) * r, level) &&
        !enemyEnemyCollide(enemy, enemy.x, ny, game)) {
      enemy.y = ny;
    }
  }
}

function blocked(x, y, level) {
  return level.getTile(Math.floor(x), Math.floor(y)) > 0;
}

function enemyEnemyCollide(self, nx, ny, game) {
  for (const o of game.enemies) {
    if (o === self || o.dead) continue;
    const dx = o.x - nx, dy = o.y - ny;
    const min = (o.radius + self.radius) * 0.9;
    if (dx * dx + dy * dy < min * min) return true;
  }
  return false;
}

export function damageEnemy(enemy, amount) {
  if (enemy.dead) return;
  enemy.health -= amount;
  if (enemy.health <= 0) {
    enemy.health = 0;
    enemy.dead = true;
    enemy.state = 'death';
    enemy.stateTime = 0;
    return;
  }
  if (Math.random() < enemy.def.painChance) {
    enemy.state = 'pain';
    enemy.stateTime = 0;
  }
}
