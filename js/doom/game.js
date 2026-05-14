// ── NEXUS DOOM · GAME ──
// Engine harness: main loop (fixed-timestep update + variable render),
// input, pause overlay, HUD, and the lifecycle wiring expected by the
// shared `registerGame` registry.
//
// What this layer owns:
//   • Player movement & wall collision against the active map.
//   • Pointer lock / keyboard input → player intent.
//   • Driving the raycaster every animation frame.
//   • Calling `entity.update(dt)` on every registered entity each tick.
//   • Firing events on `Doom.events` so the gameplay layer (hoglet 2) can
//     hook in without touching engine code.
//
// What this layer does NOT own (left for the parallel hoglets):
//   • Real maps / level geometry → hoglet 1 sets `Doom.setMap(map)`.
//   • Enemy AI, weapons, projectiles → hoglet 2 implements via
//     `Doom.addEntity(entity)` and the event bus.
//
// ── Public API (window.Doom) ──────────────────────────────────────────────
//   Doom.setMap(map)
//   Doom.getMap()
//   Doom.addEntity(entity) → entity
//   Doom.removeEntity(entity)
//   Doom.clearEntities()
//   Doom.getEntities() → DoomEntity[]
//   Doom.getPlayer()  → { x, y, angle }
//   Doom.setPlayer(partial)
//   Doom.castRay(angle) → hit  // forwarded from the raycaster
//   Doom.loadTexture(id, url)  → Promise
//   Doom.events.on(name, fn)
//   Doom.events.off(name, fn)
//   Doom.events.emit(name, payload)
//
// Events emitted by the engine:
//   'tick'           { dt }                 every fixed-timestep update
//   'onPlayerMove'   { x, y, angle }        after a move-and-collide step
//   'onPlayerFire'   { angle, hit }         on space / ctrl
//   'onEntityDeath'  { entity }             emitted when removeEntity is
//                                           called (gameplay should also
//                                           use this as a `kill` hook)

(function (global) {
  'use strict';

  // ── Event bus ───────────────────────────────────────────────────────────
  const listeners = new Map();
  const events = {
    on(name, fn) {
      let bucket = listeners.get(name);
      if (!bucket) { bucket = []; listeners.set(name, bucket); }
      bucket.push(fn);
    },
    off(name, fn) {
      const bucket = listeners.get(name);
      if (!bucket) return;
      const i = bucket.indexOf(fn);
      if (i >= 0) bucket.splice(i, 1);
    },
    emit(name, payload) {
      const bucket = listeners.get(name);
      if (!bucket) return;
      for (let i = 0; i < bucket.length; i++) {
        try { bucket[i](payload); } catch (err) { console.error('Doom event handler', name, err); }
      }
    },
  };

  // ── State ───────────────────────────────────────────────────────────────
  /** @type {HTMLCanvasElement} */ let canvas = null;
  let rc = null;
  let map = null;
  const entities = [];

  const input = {
    forward: false, back: false, strafeL: false, strafeR: false,
    turnL: false, turnR: false,
    fire: false, fireEdge: false,
    mouseDX: 0,
    movingFlag: false,
  };
  // Mirror to window for hud.js viewmodel bob without coupling to the engine.
  global._doomInputState = input;
  let paused = false;
  let pointerLocked = false;
  let raf = null;
  let lastTime = 0;
  let accum = 0;
  let frameCount = 0;
  let fpsAccum = 0;
  let fpsValue = 0;
  let active = false;

  const FIXED_DT = 1000 / 60;
  const MOVE_SPEED = 3.0;   // tiles / second
  const TURN_SPEED = 2.8;   // radians / second
  const MOUSE_SENS = 0.0025;
  const COLLIDE_PAD = 0.18; // keep this far from a wall centre line

  // ── Default map ─────────────────────────────────────────────────────────
  // 16×14 testbed with inner pillars and alcoves so weapons / pickups /
  // enemies have somewhere to live. Texture ids: 1 = brick, 2 = tech panel.
  function _defaultMap() {
    const W = 16, H = 14;
    const t = new Array(W * H).fill(0);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; };
    for (let x = 0; x < W; x++) { set(x, 0, 1); set(x, H - 1, 1); }
    for (let y = 0; y < H; y++) { set(0, y, 1); set(W - 1, y, 1); }
    // Inner pillars / divider walls (mix of texture 1 and 2).
    set(4, 3, 2); set(4, 4, 2);
    set(11, 3, 2); set(11, 4, 2);
    set(4, 9, 2); set(4, 10, 2);
    set(11, 9, 2); set(11, 10, 2);
    set(7, 6, 1); set(8, 6, 1);
    set(7, 7, 1); set(8, 7, 1);
    return {
      width: W,
      height: H,
      tiles: t,
      spawnPoints: [{ x: 2.5, y: 2.5, angle: Math.PI / 4 }],
      floorColor: [32, 24, 22],
      ceilColor: [16, 18, 30],
    };
  }

  // Populate the active map with pickups and enemies. Runs once after the
  // engine is up — gameplay layer (combat.js) handles entity behaviour.
  function _populateLevel() {
    if (!global.DoomCombat) return;
    api.clearEntities();
    const C = global.DoomCombat;
    // Pickups scattered around the map.
    C.spawnPickup('clip',           6.5, 2.5);
    C.spawnPickup('clip',          13.5, 2.5);
    C.spawnPickup('box_bullets',    9.5, 12.5);
    C.spawnPickup('shells',         2.5, 8.5);
    C.spawnPickup('box_shells',    13.5, 6.5);
    C.spawnPickup('rocket',         6.5, 10.5);
    C.spawnPickup('box_rockets',   13.5, 11.5);
    C.spawnPickup('stimpack',       3.5, 5.5);
    C.spawnPickup('medkit',         5.5, 11.5);
    C.spawnPickup('armor_green',    9.5, 2.5);
    C.spawnPickup('armor_blue',    13.5, 9.5);
    C.spawnPickup('weapon_shotgun',     5.5, 6.5);
    C.spawnPickup('weapon_chaingun',   12.5, 5.5);
    C.spawnPickup('weapon_rocket',     12.5, 12.5);
    // Enemies — kept off the spawn so the player has a beat to orient.
    C.spawnEnemy('zombie', 10.5, 2.5);
    C.spawnEnemy('zombie',  2.5, 11.5);
    C.spawnEnemy('imp',     9.5, 9.5);
    C.spawnEnemy('imp',     2.5, 6.5);
    C.spawnEnemy('demon',  12.5, 11.5);
  }

  function _restartLevel() {
    if (global.DoomCombat) global.DoomCombat.resetPlayer();
    if (global.DoomWeapons) global.DoomWeapons.reset();
    if (map && map.spawnPoints && map.spawnPoints[0]) {
      const s = map.spawnPoints[0];
      rc.setPlayer({ x: s.x, y: s.y, angle: s.angle || 0 });
    }
    _populateLevel();
  }

  // ── Movement & collision ────────────────────────────────────────────────
  function _isSolid(x, y) {
    if (!map) return true;
    const tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
    return (map.tiles[ty * map.width + tx] | 0) > 0;
  }
  function _moveAndCollide(p, dx, dy) {
    // axis-separated so we slide along walls
    let nx = p.x + dx;
    if (dx > 0 && _isSolid(nx + COLLIDE_PAD, p.y)) {
      nx = Math.floor(nx + COLLIDE_PAD) - COLLIDE_PAD - 1e-4;
    } else if (dx < 0 && _isSolid(nx - COLLIDE_PAD, p.y)) {
      nx = Math.ceil(nx - COLLIDE_PAD) + COLLIDE_PAD + 1e-4;
    }
    let ny = p.y + dy;
    if (dy > 0 && _isSolid(nx, ny + COLLIDE_PAD)) {
      ny = Math.floor(ny + COLLIDE_PAD) - COLLIDE_PAD - 1e-4;
    } else if (dy < 0 && _isSolid(nx, ny - COLLIDE_PAD)) {
      ny = Math.ceil(ny - COLLIDE_PAD) + COLLIDE_PAD + 1e-4;
    }
    p.x = nx; p.y = ny;
  }

  // ── Tick ────────────────────────────────────────────────────────────────
  function _tick(dt) {
    const dts = dt / 1000;
    const p = rc.getPlayer();

    // Turn
    let dAng = 0;
    if (input.turnL) dAng -= TURN_SPEED * dts;
    if (input.turnR) dAng += TURN_SPEED * dts;
    dAng += input.mouseDX * MOUSE_SENS;
    input.mouseDX = 0;
    p.angle += dAng;

    // Move
    const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    let fwd = 0, str = 0;
    if (input.forward) fwd += 1;
    if (input.back)    fwd -= 1;
    if (input.strafeR) str += 1;
    if (input.strafeL) str -= 1;
    input.movingFlag = !!(fwd || str);
    if (fwd || str) {
      const mag = Math.hypot(fwd, str) || 1;
      const speed = MOVE_SPEED * dts;
      const vx = (cos * fwd - sin * str) / mag * speed;
      const vy = (sin * fwd + cos * str) / mag * speed;
      _moveAndCollide(p, vx, vy);
    }

    events.emit('onPlayerMove', { x: p.x, y: p.y, angle: p.angle });

    // Weapon + combat tick (gameplay-layer modules — loaded after engine).
    if (global.DoomWeapons) global.DoomWeapons.tick(dts, input.fire);
    if (global.DoomCombat)  global.DoomCombat.tick(dts);

    // Entities
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e && !e.dead && typeof e.update === 'function') {
        try { e.update(dts); } catch (err) { console.error('Doom entity.update', err); }
      }
    }
    // sweep dead entities (gameplay layer flags `dead = true` to remove)
    for (let i = entities.length - 1; i >= 0; i--) {
      if (!entities[i] || entities[i].dead) {
        const [dead] = entities.splice(i, 1);
        if (dead) events.emit('onEntityDeath', { entity: dead });
      }
    }

    // Fire (edge-triggered). Gameplay layer (DoomWeapons) handles ammo +
    // cooldown + hitscan resolution; the engine emits the event for any
    // listeners that want the raw cast.
    if (input.fireEdge) {
      input.fireEdge = false;
      const hit = rc.castRay(p.angle);
      let dispatched = false;
      if (global.DoomWeapons) dispatched = global.DoomWeapons.dispatchFire();
      events.emit('onPlayerFire', { angle: p.angle, hit, dispatched });
    }

    events.emit('tick', { dt: dts });
  }

  // ── Render & loop ───────────────────────────────────────────────────────
  function _updateHud() {
    const fpsEl = document.getElementById('doomFps');
    const posEl = document.getElementById('doomPos');
    const stEl  = document.getElementById('doomState');
    const p = rc.getPlayer();
    if (fpsEl) fpsEl.textContent = String(fpsValue);
    if (posEl) posEl.textContent = p.x.toFixed(1) + ',' + p.y.toFixed(1);
    if (stEl)  stEl.textContent  = paused ? 'PAUSED' : 'RUN';
  }

  function _loop(ts) {
    if (!active) return;
    const dt = Math.min(ts - lastTime, 100);
    lastTime = ts;

    if (!paused) {
      accum += dt;
      while (accum >= FIXED_DT) {
        _tick(FIXED_DT);
        accum -= FIXED_DT;
      }
    }
    rc.render(entities);

    frameCount++;
    fpsAccum += dt;
    if (fpsAccum >= 500) {
      fpsValue = Math.round((frameCount * 1000) / fpsAccum);
      frameCount = 0;
      fpsAccum = 0;
      _updateHud();
    }

    raf = requestAnimationFrame(_loop);
  }

  // ── Input ───────────────────────────────────────────────────────────────
  function _setPaused(v) {
    paused = v;
    const ov = document.getElementById('doomOverlay');
    if (ov) ov.classList.toggle('show', paused);
    _updateHud();
    if (paused && pointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  function _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    input.forward = true; e.preventDefault(); break;
      case 'KeyS': case 'ArrowDown':  input.back = true;    e.preventDefault(); break;
      case 'KeyA':                    input.strafeL = true; e.preventDefault(); break;
      case 'KeyD':                    input.strafeR = true; e.preventDefault(); break;
      case 'ArrowLeft':               input.turnL = true;   e.preventDefault(); break;
      case 'ArrowRight':              input.turnR = true;   e.preventDefault(); break;
      case 'Space': case 'ControlLeft': case 'ControlRight':
        if (!input.fire) input.fireEdge = true;
        input.fire = true;
        e.preventDefault();
        break;
      case 'Escape':
        _setPaused(!paused);
        e.preventDefault();
        break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        if (global.DoomWeapons) global.DoomWeapons.selectSlot(+e.code.slice(-1));
        e.preventDefault();
        break;
      case 'KeyQ':
        if (global.DoomWeapons) global.DoomWeapons.switchLast();
        e.preventDefault();
        break;
      case 'KeyR':
        if (global.DoomCombat && global.DoomCombat.player.dead) {
          _restartLevel();
        }
        e.preventDefault();
        break;
    }
  }
  function _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    input.forward = false; break;
      case 'KeyS': case 'ArrowDown':  input.back = false; break;
      case 'KeyA':                    input.strafeL = false; break;
      case 'KeyD':                    input.strafeR = false; break;
      case 'ArrowLeft':               input.turnL = false; break;
      case 'ArrowRight':              input.turnR = false; break;
      case 'Space': case 'ControlLeft': case 'ControlRight':
        input.fire = false;
        break;
    }
  }
  function _onMouseMove(e) {
    if (!pointerLocked) return;
    input.mouseDX += e.movementX || 0;
  }
  function _onCanvasClick() {
    if (paused) { _setPaused(false); return; }
    if (!pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock();
  }
  function _onMouseDown(e) {
    if (!pointerLocked) return;
    if (e.button === 0) {
      if (!input.fire) input.fireEdge = true;
      input.fire = true;
      e.preventDefault();
    }
  }
  function _onMouseUp(e) {
    if (e.button === 0) input.fire = false;
  }
  function _onWheel(e) {
    if (!global.DoomWeapons) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    global.DoomWeapons.cycle(dir);
    if (pointerLocked) e.preventDefault();
  }
  function _onPointerLockChange() {
    pointerLocked = (document.pointerLockElement === canvas);
  }

  // ── Bootstrap (called by registerGame.init) ─────────────────────────────
  function _bootEngine() {
    canvas = document.getElementById('doomCanvas');
    if (!canvas) return false;
    if (!rc) {
      global.DoomTextures.installDefaults();
      rc = global.DoomRaycaster.create(canvas);
      map = _defaultMap();
      rc.setMap(map);
    }
    return true;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  const api = {
    events,
    setMap(m) {
      if (!rc) return;
      map = m;
      rc.setMap(m);
    },
    getMap() { return map; },
    addEntity(e) { entities.push(e); return e; },
    removeEntity(e) {
      const i = entities.indexOf(e);
      if (i >= 0) {
        entities.splice(i, 1);
        events.emit('onEntityDeath', { entity: e });
      }
    },
    clearEntities() { entities.length = 0; },
    getEntities() { return entities; },
    getPlayer() { return rc ? rc.getPlayer() : null; },
    setPlayer(p) { if (rc) rc.setPlayer(p); },
    castRay(angle) { return rc ? rc.castRay(angle) : null; },
    loadTexture(id, url) { return global.DoomTextures.loadImageTexture(id, url); },
    // expose primitives for testing / advanced gameplay code
    _raycaster() { return rc; },
  };
  global.Doom = api;

  // ── Lifecycle ───────────────────────────────────────────────────────────
  function init() {
    if (!_bootEngine()) return;
    if (global.DoomCombat) global.DoomCombat.resetPlayer();
    if (global.DoomWeapons) global.DoomWeapons.reset();
    _populateLevel();
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup', _onKeyUp);
    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('mousedown', _onMouseDown);
    document.addEventListener('mouseup', _onMouseUp);
    document.addEventListener('pointerlockchange', _onPointerLockChange);
    canvas.addEventListener('click', _onCanvasClick);
    canvas.addEventListener('wheel', _onWheel, { passive: false });
    canvas.addEventListener('contextmenu', _preventContext);
    active = true;
    paused = false;
    lastTime = performance.now();
    accum = 0;
    frameCount = 0;
    fpsAccum = 0;
    _updateHud();
    if (global.DoomHud) global.DoomHud.init();
    if (!raf) raf = requestAnimationFrame(_loop);
    if (global.posthog) global.posthog.capture('doom_game_started', {});
  }

  function _preventContext(e) { e.preventDefault(); }

  function cleanup() {
    active = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    document.removeEventListener('keydown', _onKeyDown);
    document.removeEventListener('keyup', _onKeyUp);
    document.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('mousedown', _onMouseDown);
    document.removeEventListener('mouseup', _onMouseUp);
    document.removeEventListener('pointerlockchange', _onPointerLockChange);
    if (canvas) {
      canvas.removeEventListener('click', _onCanvasClick);
      canvas.removeEventListener('wheel', _onWheel);
      canvas.removeEventListener('contextmenu', _preventContext);
    }
    if (pointerLocked && document.exitPointerLock) document.exitPointerLock();
    if (global.DoomHud) global.DoomHud.cleanup();
    // reset transient input
    input.forward = input.back = input.strafeL = input.strafeR = false;
    input.turnL = input.turnR = input.fire = input.fireEdge = false;
    input.mouseDX = 0;
  }

  if (typeof global.registerGame === 'function') {
    global.registerGame('doom', { init, cleanup });
  }
})(window);
