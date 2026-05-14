// ── NEXUS DOOM · WEAPONS ──
// Player loadout state, weapon definitions, and the firing dispatcher.
// Reads the engine via window.Doom (raycaster + entity list) and the
// gameplay layer via window.DoomCombat (hitscan + projectile spawns).

(function (global) {
  'use strict';

  // Per-weapon balance. damage is per-hit (per-pellet for shotgun).
  // fireRate is in seconds between shots. range is in tiles.
  // hitscan=false weapons spawn a projectile via DoomCombat.spawnRocket.
  const WEAPONS = {
    fist: {
      slot: 1, name: 'FIST', short: 'FIST',
      damage: 22, fireRate: 0.45, range: 1.3, spread: 0,
      ammoType: null, ammoPerShot: 0,
      hitscan: true, auto: true, switchTime: 0.15,
      sfx: 'doomPunch',
      view: { color: '#e2c0a0', accent: '#5a3a26' },
    },
    pistol: {
      slot: 2, name: 'PISTOL', short: 'PISTOL',
      damage: 15, fireRate: 0.30, range: 32, spread: 0.025,
      ammoType: 'clip', ammoPerShot: 1,
      hitscan: true, auto: false, switchTime: 0.18,
      sfx: 'doomPistol', emptySfx: 'doomEmpty',
      view: { color: '#3a3a44', accent: '#88898f' },
    },
    shotgun: {
      slot: 3, name: 'SHOTGUN', short: 'SG',
      damage: 9, pellets: 7, fireRate: 0.85, range: 24, spread: 0.10,
      ammoType: 'shells', ammoPerShot: 1,
      hitscan: true, auto: false, switchTime: 0.25,
      sfx: 'doomShotgun', emptySfx: 'doomEmpty',
      view: { color: '#4a2e1a', accent: '#a8a8a8' },
    },
    chaingun: {
      slot: 4, name: 'CHAINGUN', short: 'CG',
      damage: 11, fireRate: 0.09, range: 32, spread: 0.07,
      ammoType: 'clip', ammoPerShot: 1,
      hitscan: true, auto: true, switchTime: 0.25,
      sfx: 'doomChaingun', emptySfx: 'doomEmpty',
      view: { color: '#1f1f24', accent: '#c0c0c4' },
    },
    rocketLauncher: {
      slot: 5, name: 'ROCKET LAUNCHER', short: 'RL',
      damage: 90, splash: 70, splashRadius: 2.6,
      fireRate: 0.9, range: 28, spread: 0,
      ammoType: 'rockets', ammoPerShot: 1,
      hitscan: false, projectileSpeed: 9,
      auto: false, switchTime: 0.3,
      sfx: 'doomRocketFire', emptySfx: 'doomEmpty',
      view: { color: '#2e2e36', accent: '#d8d8dc' },
    },
  };

  const SLOTS = { 1: 'fist', 2: 'pistol', 3: 'shotgun', 4: 'chaingun', 5: 'rocketLauncher' };

  // Player-side loadout state.
  const state = {
    owned: { fist: true, pistol: true, shotgun: false, chaingun: false, rocketLauncher: false },
    ammo:    { clip: 50, shells: 0, rockets: 0, cells: 0 },
    maxAmmo: { clip: 200, shells: 50, rockets: 50, cells: 300 },
    current: 'pistol',
    last: 'fist',
    cooldown: 0,
    switchTimer: 0,
    raising: false,
    lowering: false,
    pendingSwitch: null,
    fireFlash: 0,
    bobPhase: 0,
    bobAmp: 0,
  };

  function reset() {
    state.owned = { fist: true, pistol: true, shotgun: false, chaingun: false, rocketLauncher: false };
    state.ammo = { clip: 50, shells: 0, rockets: 0, cells: 0 };
    state.current = 'pistol';
    state.last = 'fist';
    state.cooldown = 0;
    state.switchTimer = 0;
    state.raising = false; state.lowering = false; state.pendingSwitch = null;
    state.fireFlash = 0;
    state.bobPhase = 0; state.bobAmp = 0;
  }

  function get(id) { return WEAPONS[id]; }
  function ownedList() {
    const order = ['fist', 'pistol', 'shotgun', 'chaingun', 'rocketLauncher'];
    return order.filter(id => state.owned[id]);
  }

  function _maybeSfx(name, throttle) {
    if (typeof global.sfx === 'function') global.sfx(name, throttle || 0);
  }

  function selectSlot(slot) {
    const id = SLOTS[slot];
    if (!id) return false;
    return switchTo(id);
  }

  function switchTo(id) {
    if (!WEAPONS[id] || !state.owned[id]) return false;
    if (state.lowering || state.raising) return false;
    if (id === state.current) return false;
    state.last = state.current;
    state.pendingSwitch = id;
    state.lowering = true;
    state.switchTimer = WEAPONS[state.current].switchTime || 0.2;
    _maybeSfx('doomSwitch', 80);
    return true;
  }

  function switchLast() {
    if (state.owned[state.last] && state.last !== state.current) switchTo(state.last);
  }

  function cycle(dir) {
    const owned = ownedList();
    if (owned.length <= 1) return;
    const i = owned.indexOf(state.current);
    const n = ((i + dir) % owned.length + owned.length) % owned.length;
    switchTo(owned[n]);
  }

  // Consume cooldown/ammo and signal the caller that a shot should fire.
  function _tryConsume() {
    if (state.lowering || state.raising) return false;
    if (state.cooldown > 0) return false;
    const w = WEAPONS[state.current];
    const need = w.ammoPerShot || 0;
    if (w.ammoType && state.ammo[w.ammoType] < need) {
      if (w.emptySfx) _maybeSfx(w.emptySfx, 250);
      state.cooldown = 0.3;
      return false;
    }
    if (w.ammoType) state.ammo[w.ammoType] -= need;
    state.cooldown = w.fireRate;
    state.fireFlash = 0.08;
    return true;
  }

  // Fire the current weapon. Returns true if a shot resolved (false on
  // cooldown / empty / mid-switch).
  function dispatchFire() {
    if (!_tryConsume()) return false;
    const w = WEAPONS[state.current];
    const p = global.Doom.getPlayer();
    if (!p) return false;
    if (w.hitscan) {
      const pellets = w.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const ang = p.angle + (Math.random() - 0.5) * w.spread * 2;
        const hit = global.Doom.castRay(ang);
        if (global.DoomCombat) {
          const scan = global.DoomCombat.hitscan(p.x, p.y, ang, w.range, hit);
          if (scan.enemy) global.DoomCombat.damageEnemy(scan.enemy, w.damage);
        }
      }
    } else if (global.DoomCombat) {
      global.DoomCombat.spawnRocket(p.x, p.y, p.angle, w.projectileSpeed, w.damage, w.splash, w.splashRadius);
    }
    if (w.sfx) _maybeSfx(w.sfx);
    return true;
  }

  function tick(dt, fireHeld) {
    if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);
    if (state.fireFlash > 0) state.fireFlash = Math.max(0, state.fireFlash - dt);

    if (state.switchTimer > 0) {
      state.switchTimer = Math.max(0, state.switchTimer - dt);
      if (state.switchTimer === 0) {
        if (state.lowering) {
          state.current = state.pendingSwitch || state.current;
          state.pendingSwitch = null;
          state.lowering = false;
          state.raising = true;
          state.switchTimer = WEAPONS[state.current].switchTime || 0.2;
        } else if (state.raising) {
          state.raising = false;
        }
      }
    }

    // Auto-fire while the trigger is held on automatic weapons.
    if (fireHeld) {
      const w = WEAPONS[state.current];
      if (w && w.auto) dispatchFire();
    }
  }

  function addAmmo(type, amt) {
    if (state.ammo[type] == null) return false;
    if (state.ammo[type] >= state.maxAmmo[type]) return false;
    state.ammo[type] = Math.min(state.maxAmmo[type], state.ammo[type] + amt);
    return true;
  }
  function giveWeapon(id, ammoBonus) {
    if (!WEAPONS[id]) return false;
    const had = !!state.owned[id];
    state.owned[id] = true;
    if (ammoBonus && WEAPONS[id].ammoType) addAmmo(WEAPONS[id].ammoType, ammoBonus);
    if (!had) switchTo(id);
    return !had;
  }
  function maxAmmoOut() {
    for (const k of Object.keys(state.ammo)) state.ammo[k] = state.maxAmmo[k];
  }

  global.DoomWeapons = {
    WEAPONS, SLOTS, state, reset, get, ownedList,
    selectSlot, switchTo, switchLast, cycle,
    dispatchFire, tick, addAmmo, giveWeapon, maxAmmoOut,
  };
})(window);
