// Player controller: state, input-driven movement, wall-sliding collision,
// health/armor application.

import { PLAYER, AMMO_MAX } from './config.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle || 0,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,

    health: PLAYER.startHealth,
    maxHealth: PLAYER.maxHealth,
    armor: PLAYER.startArmor,
    maxArmor: PLAYER.maxArmor,

    weapons: new Set(PLAYER.startWeapons),
    weapon: PLAYER.startWeapons[0],
    ammo: { ...PLAYER.startAmmo },

    score: 0,
    kills: 0,

    dead: false,
    painTimer: 0,
    fireCooldown: 0,
    raiseTimer: 0,
    bobPhase: 0,
    message: '',
    messageTimer: 0,
  };
}

export function updatePlayer(player, dt, input, level) {
  if (player.dead) return;

  player.painTimer = Math.max(0, player.painTimer - dt);
  player.messageTimer = Math.max(0, player.messageTimer - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.raiseTimer = Math.max(0, player.raiseTimer - dt);

  const axes = input.getAxes();

  // Mouse-look + keyboard turn.
  player.angle += input.mouseDX * PLAYER.mouseSensitivity;
  player.angle += axes.turn * PLAYER.turnSpeed * dt;
  // Wrap to [-pi, pi] so the value never drifts unbounded.
  if (player.angle > Math.PI) player.angle -= 2 * Math.PI;
  else if (player.angle < -Math.PI) player.angle += 2 * Math.PI;

  // Compute desired velocity in world space.
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  const fwd  = axes.forward * PLAYER.moveSpeed;
  const side = axes.strafe  * PLAYER.strafeSpeed;
  let dx = (cos * fwd + -sin * side) * dt;
  let dy = (sin * fwd +  cos * side) * dt;

  // Wall-sliding collision: try each axis independently.
  moveWithCollision(player, dx, dy, level);

  if (Math.abs(axes.forward) + Math.abs(axes.strafe) > 0.01) {
    player.bobPhase += dt * 8;
  }
}

function moveWithCollision(player, dx, dy, level) {
  const r = player.radius;
  // X axis
  if (dx !== 0) {
    const nx = player.x + dx;
    const probeX = nx + Math.sign(dx) * r;
    if (!isBlocked(probeX, player.y - r, level) &&
        !isBlocked(probeX, player.y + r, level)) {
      player.x = nx;
    }
  }
  // Y axis
  if (dy !== 0) {
    const ny = player.y + dy;
    const probeY = ny + Math.sign(dy) * r;
    if (!isBlocked(player.x - r, probeY, level) &&
        !isBlocked(player.x + r, probeY, level)) {
      player.y = ny;
    }
  }
}

function isBlocked(x, y, level) {
  return level.getTile(Math.floor(x), Math.floor(y)) > 0;
}

export function damagePlayer(player, amount, source) {
  if (player.dead || amount <= 0) return;
  let dmg = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, dmg * PLAYER.armorAbsorb);
    player.armor -= absorbed;
    dmg -= absorbed;
  }
  player.health = Math.max(0, player.health - dmg);
  player.painTimer = PLAYER.painCooldown;
  if (player.health <= 0) {
    player.dead = true;
  }
}

export function healPlayer(player, amount, max) {
  const cap = max ?? player.maxHealth;
  if (player.health >= cap) return false;
  player.health = Math.min(cap, player.health + amount);
  return true;
}

export function addArmor(player, amount, max) {
  const cap = max ?? player.maxArmor;
  if (player.armor >= cap) return false;
  player.armor = Math.min(cap, player.armor + amount);
  return true;
}

export function addAmmo(player, type, amount) {
  const cap = AMMO_MAX[type] ?? 99;
  const cur = player.ammo[type] || 0;
  if (cur >= cap) return false;
  player.ammo[type] = Math.min(cap, cur + amount);
  return true;
}

export function giveWeapon(player, weaponId) {
  const had = player.weapons.has(weaponId);
  player.weapons.add(weaponId);
  if (!had) {
    player.weapon = weaponId;
    player.raiseTimer = 0.2;
  }
  return !had;
}

export function setMessage(player, msg) {
  player.message = msg;
  player.messageTimer = 2.5;
}
