// Weapon firing logic. Hitscan via engine.castRay, projectiles spawned into
// the world via game.spawnProjectile.

import { WEAPONS } from './config.js';

export function tryFire(game, player, input) {
  if (player.dead) return;
  if (player.fireCooldown > 0 || player.raiseTimer > 0) return;
  if (!input.firing) return;

  const def = WEAPONS[player.weapon];
  if (!def) return;

  // Auto-fire weapons keep firing while held; semi-auto only on a press edge.
  // Pointer-lock takes the first click as "engage", so semi-auto still
  // responds because we only fire when fireCooldown is also 0.
  const ammoType = def.ammoType;
  const need = def.ammoPerShot;
  if ((player.ammo[ammoType] || 0) < need) {
    // dry-click: small cooldown so it doesn't spam.
    player.fireCooldown = 0.3;
    return;
  }

  player.ammo[ammoType] -= need;
  player.fireCooldown = def.fireDelay;
  player.lastFireTime = game.time;

  if (def.kind === 'hitscan') {
    for (let i = 0; i < def.pellets; i++) {
      const spread = (Math.random() * 2 - 1) * def.spread;
      const angle = player.angle + spread;
      fireHitscan(game, player.x, player.y, angle, def.range, def.damage, player);
    }
  } else if (def.kind === 'projectile') {
    game.spawnProjectile({
      x: player.x, y: player.y,
      angle: player.angle,
      speed: def.projectile.speed,
      damage: def.projectile.damage,
      radius: def.projectile.radius,
      ttl: def.projectile.ttl,
      sprite: def.projectile.sprite,
      owner: 'player',
    });
  }
}

export function fireHitscan(game, x, y, angle, range, damage, owner) {
  const ray = game.engine.castRay(x, y, angle, range);
  const wallDist = ray.hit ? ray.distance : range;

  // Walk all hostile entities; pick the closest one within wallDist whose
  // body cylinder intersects the ray.
  let bestDist = wallDist;
  let bestTarget = null;

  const dx = Math.cos(angle), dy = Math.sin(angle);

  // Target enemies if shooter is the player; target the player if shooter is enemy.
  const targets = (owner === 'player' || owner === game.player)
    ? game.enemies
    : [game.player];

  for (const t of targets) {
    if (!t || t.dead) continue;
    const tx = t.x - x, ty = t.y - y;
    const proj = tx * dx + ty * dy;
    if (proj <= 0 || proj > bestDist) continue;
    const perp = Math.abs(tx * -dy + ty * dx);
    const r = t.radius || 0.3;
    if (perp <= r) {
      bestDist = proj;
      bestTarget = t;
    }
  }

  game.spawnTracer?.(x, y, x + dx * bestDist, y + dy * bestDist);

  if (bestTarget) {
    game.applyDamage(bestTarget, damage, owner);
  }
}

export function switchWeapon(player, weaponId) {
  if (!player.weapons.has(weaponId)) return false;
  if (player.weapon === weaponId) return false;
  const def = WEAPONS[weaponId];
  if (!def) return false;
  player.weapon = weaponId;
  player.raiseTimer = def.raise || 0.25;
  return true;
}

export function nextWeapon(player, dir = 1) {
  const order = Object.keys(WEAPONS)
    .filter(id => player.weapons.has(id))
    .sort((a, b) => (WEAPONS[a].slot || 99) - (WEAPONS[b].slot || 99));
  if (order.length < 2) return;
  const idx = order.indexOf(player.weapon);
  const next = order[(idx + dir + order.length) % order.length];
  switchWeapon(player, next);
}

export function handleWeaponInput(player, input) {
  // Number keys 2..4 select weapons by slot.
  for (const id of Object.keys(WEAPONS)) {
    const slot = WEAPONS[id].slot;
    if (slot && input.wasPressed(`Digit${slot}`) && player.weapons.has(id)) {
      switchWeapon(player, id);
      return;
    }
  }
  if (input.wasPressed('KeyQ')) nextWeapon(player, -1);
  if (input.wasPressed('KeyE')) nextWeapon(player, 1);
}
