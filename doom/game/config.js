// Doom-style FPS — gameplay tunables.
//
// Distances are in tile units (1 tile = 1 world unit). Times are in seconds.

export const TILE = 1;

export const PLAYER = {
  radius: 0.25,
  moveSpeed: 3.4,
  strafeSpeed: 2.8,
  turnSpeed: 2.6,           // radians/sec (A/D keyboard turn)
  mouseSensitivity: 0.0025, // radians per pixel of mouse delta
  startHealth: 100,
  maxHealth: 100,
  startArmor: 0,
  maxArmor: 200,
  armorAbsorb: 0.5,         // fraction of damage soaked by armor (Doom green armor)
  painCooldown: 0.25,       // seconds of pain stun
  startWeapons: ['pistol'],
  startAmmo: { bullets: 50, shells: 0 },
};

// Weapons. `kind` is 'hitscan' (instant) or 'projectile' (slow, spawned).
export const WEAPONS = {
  pistol: {
    name: 'PISTOL',
    kind: 'hitscan',
    ammoType: 'bullets',
    ammoPerShot: 1,
    damage: 12,
    spread: 0.012,
    pellets: 1,
    fireDelay: 0.42,
    range: 32,
    slot: 2,
    auto: false,
    raise: 0.2,
    sprite: 'pistol',
  },
  shotgun: {
    name: 'SHOTGUN',
    kind: 'hitscan',
    ammoType: 'shells',
    ammoPerShot: 1,
    damage: 7,
    spread: 0.13,
    pellets: 7,
    fireDelay: 0.9,
    range: 22,
    slot: 3,
    auto: false,
    raise: 0.35,
    sprite: 'shotgun',
  },
  chaingun: {
    name: 'CHAINGUN',
    kind: 'hitscan',
    ammoType: 'bullets',
    ammoPerShot: 1,
    damage: 10,
    spread: 0.045,
    pellets: 1,
    fireDelay: 0.1,
    range: 32,
    slot: 4,
    auto: true,
    raise: 0.3,
    sprite: 'chaingun',
  },
};

// Enemy archetypes. State machine states: idle, chase, attack, pain, death.
export const ENEMIES = {
  zombie: {
    name: 'ZOMBIEMAN',
    health: 20,
    radius: 0.3,
    speed: 1.2,
    sightRange: 18,
    sightFov: Math.PI,        // ~180° forward arc
    attackKind: 'hitscan',
    attackDamage: 6,
    attackRange: 16,
    attackSpread: 0.08,
    attackCooldown: 1.4,
    painChance: 0.6,
    painTime: 0.25,
    deathTime: 0.9,
    score: 100,
    sprite: 'zombie',
  },
  imp: {
    name: 'IMP',
    health: 60,
    radius: 0.3,
    speed: 1.6,
    sightRange: 24,
    sightFov: Math.PI,
    attackKind: 'projectile',
    projectile: {
      speed: 8,
      damage: 14,
      radius: 0.15,
      ttl: 4,
      sprite: 'imp_fireball',
    },
    attackRange: 22,
    attackCooldown: 1.6,
    meleeRange: 1.1,
    meleeDamage: 12,
    painChance: 0.5,
    painTime: 0.3,
    deathTime: 1.1,
    score: 200,
    sprite: 'imp',
  },
};

export const PICKUPS = {
  stimpack:   { kind: 'health', amount: 10,  max: 100, sprite: 'stimpack',  message: 'Picked up a stimpack.' },
  medikit:    { kind: 'health', amount: 25,  max: 100, sprite: 'medikit',   message: 'Picked up a medikit!' },
  armor_g:    { kind: 'armor',  amount: 100, max: 100, sprite: 'armor_g',   message: 'Picked up the armor.' },
  armor_b:    { kind: 'armor',  amount: 200, max: 200, sprite: 'armor_b',   message: 'Picked up the MegaArmor!' },
  clip:       { kind: 'ammo',   ammoType: 'bullets', amount: 10, sprite: 'clip',    message: 'Picked up a clip.' },
  ammo_box:   { kind: 'ammo',   ammoType: 'bullets', amount: 50, sprite: 'ammo',    message: 'Picked up a box of bullets.' },
  shells:     { kind: 'ammo',   ammoType: 'shells',  amount: 4,  sprite: 'shells',  message: 'Picked up shotgun shells.' },
  shellbox:   { kind: 'ammo',   ammoType: 'shells',  amount: 20, sprite: 'shellbox',message: 'Picked up a box of shells.' },
  w_shotgun:  { kind: 'weapon', weapon: 'shotgun',  giveAmmo: 8,  sprite: 'shotgun_pickup',  message: 'You got the shotgun!' },
  w_chaingun: { kind: 'weapon', weapon: 'chaingun', giveAmmo: 20, sprite: 'chaingun_pickup', message: 'You got the chaingun!' },
};

export const AMMO_MAX = {
  bullets: 200,
  shells: 50,
};

export const SCORE = {
  pickup: 10,
  levelClear: 1000,
};
