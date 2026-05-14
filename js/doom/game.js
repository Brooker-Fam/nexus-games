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
  };
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

  // ── Stub default map (proof-of-life) ────────────────────────────────────
  // 8×8 grid, solid border, one inner pillar to test occlusion.
  // Texture ids: 1 = brick (border), 2 = tech panel (pillar).
  function _defaultMap() {
    const W = 8, H = 8;
    const t = new Array(W * H).fill(0);
    for (let x = 0; x < W; x++) { t[x] = 1; t[(H - 1) * W + x] = 1; }
    for (let y = 0; y < H; y++) { t[y * W] = 1; t[y * W + (W - 1)] = 1; }
    t[3 * W + 4] = 2;
    return {
      width: W,
      height: H,
      tiles: t,
      spawnPoints: [{ x: 1.5, y: 1.5, angle: Math.PI / 4 }],
      floorColor: [35, 25, 25],
      ceilColor: [20, 25, 40],
    };
  }
  function _defaultEntity() {
    return {
      x: 5.5, y: 5.5, angle: 0,
      sprite: 100,
      state: 'idle',
      update(/* dt */) {},
    };
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
  let kills = 0;
  let damageFlashT = 0;     // seconds remaining for damage flash overlay
  let gameOver = false;

  function _tick(dt) {
    const dts = dt / 1000;
    const p = rc.getPlayer();
    if (gameOver) {
      // freeze player movement but keep render loop alive
      events.emit('tick', { dt: dts });
      return;
    }

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
    if (fwd || str) {
      const mag = Math.hypot(fwd, str) || 1;
      const speed = MOVE_SPEED * dts;
      const vx = (cos * fwd - sin * str) / mag * speed;
      const vy = (sin * fwd + cos * str) / mag * speed;
      _moveAndCollide(p, vx, vy);
    }

    events.emit('onPlayerMove', { x: p.x, y: p.y, angle: p.angle });

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

    // Fire (edge-triggered)
    if (input.fireEdge) {
      input.fireEdge = false;
      const hit = rc.castRay(p.angle);
      if (typeof global.sfx === 'function') global.sfx('doomPistol');
      events.emit('onPlayerFire', { angle: p.angle, hit });
    }

    if (damageFlashT > 0) damageFlashT = Math.max(0, damageFlashT - dts);

    events.emit('tick', { dt: dts });
  }

  // ── Render & loop ───────────────────────────────────────────────────────
  function _updateHud() {
    const fpsEl = document.getElementById('doomFps');
    const hpEl  = document.getElementById('doomHp');
    const kEl   = document.getElementById('doomKills');
    const stEl  = document.getElementById('doomState');
    if (fpsEl) fpsEl.textContent = String(fpsValue);
    if (hpEl) {
      const hp = global.DoomEnemies ? global.DoomEnemies.getPlayerHealth() : 100;
      hpEl.textContent = String(hp);
      hpEl.style.color = hp <= 25 ? '#ff2c5c' : (hp <= 60 ? '#ffb84a' : '');
    }
    if (kEl) kEl.textContent = String(kills);
    if (stEl) stEl.textContent = gameOver ? 'DEAD' : (paused ? 'PAUSED' : 'RUN');

    // damage-flash overlay
    const dfl = document.getElementById('doomDamageFlash');
    if (dfl) {
      if (gameOver) dfl.className = 'doom-damage-flash die';
      else dfl.className = 'doom-damage-flash' + (damageFlashT > 0 ? ' show' : '');
    }
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
    } else if (damageFlashT > 0 || gameOver) {
      _updateHud(); // keep overlay state in sync at higher rate when flashing
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
        if (!gameOver) _setPaused(!paused);
        e.preventDefault();
        break;
      case 'KeyR':
        if (gameOver) { restart(); e.preventDefault(); }
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
    if (canvas.requestPointerLock) canvas.requestPointerLock();
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
      if (global.DoomEnemySprites && typeof global.DoomEnemySprites.install === 'function') {
        global.DoomEnemySprites.install();
      }
      rc = global.DoomRaycaster.create(canvas);
      map = _defaultMap();
      rc.setMap(map);
    }
    return true;
  }

  function _spawnEncounter() {
    if (!global.DoomEnemies) return;
    global.DoomEnemies.reset();
    // wipe any stub entities the engine left behind from prior runs
    for (const e of api.getEntities().slice()) api.removeEntity(e);
    global.DoomEnemies.spawnDefaultEncounter();
  }

  function _resetPlayer() {
    if (!rc || !map) return;
    const spawn = (map.spawnPoints && map.spawnPoints[0]) || { x: 1.5, y: 1.5, angle: 0 };
    rc.setPlayer({ x: spawn.x, y: spawn.y, angle: spawn.angle || 0 });
    kills = 0;
    damageFlashT = 0;
    gameOver = false;
    if (global.DoomEnemies) global.DoomEnemies.setPlayerHealth(global.DoomEnemies.PLAYER_MAX_HP);
  }

  function restart() {
    _resetPlayer();
    _spawnEncounter();
    const ov = document.getElementById('doomOverlay');
    if (ov) ov.classList.remove('show');
    const btn = document.getElementById('btn-doom-restart');
    if (btn) btn.style.display = 'none';
    paused = false;
    // clear any input edges held over from the death overlay
    input.fireEdge = false;
    input.fire = false;
    input.mouseDX = 0;
    _updateHud();
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
    restart() { restart(); },
    // expose primitives for testing / advanced gameplay code
    _raycaster() { return rc; },
  };
  global.Doom = api;

  // ── Event wiring (player damage/death, kill scoring, restart button) ────
  let _wiredEvents = false;
  function _wireEvents() {
    if (_wiredEvents) return;
    _wiredEvents = true;
    events.on('onPlayerHurt', () => {
      damageFlashT = 0.25;
      _updateHud();
    });
    events.on('onPlayerDie', () => {
      gameOver = true;
      const ov = document.getElementById('doomOverlay');
      const tt = document.getElementById('doomOverlayTitle');
      const sub = document.getElementById('doomOverlaySub');
      const btn = document.getElementById('btn-doom-restart');
      if (ov) ov.classList.add('show');
      if (tt) tt.textContent = 'YOU DIED';
      if (sub) sub.textContent = 'Press R or click RESTART';
      if (btn) btn.style.display = '';
      if (pointerLocked && document.exitPointerLock) document.exitPointerLock();
      _updateHud();
    });
    events.on('onEntityDeath', ({ entity }) => {
      if (entity && entity._isEnemy && entity._state !== 'dead') {
        // counted at the start of dying; ignore duplicate
        return;
      }
    });
    events.on('onEnemyHurt', ({ entity, killed }) => {
      if (killed && entity && entity._isEnemy) {
        kills++;
        _updateHud();
      }
    });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  function init() {
    if (!_bootEngine()) return;
    _wireEvents();
    // wipe any stub entity from a prior engine boot and drop in the encounter
    _resetPlayer();
    _spawnEncounter();
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup', _onKeyUp);
    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('pointerlockchange', _onPointerLockChange);
    canvas.addEventListener('click', _onCanvasClick);
    const rbtn = document.getElementById('btn-doom-restart');
    if (rbtn) rbtn.onclick = restart;
    active = true;
    paused = false;
    lastTime = performance.now();
    accum = 0;
    frameCount = 0;
    fpsAccum = 0;
    _updateHud();
    if (!raf) raf = requestAnimationFrame(_loop);
    if (global.posthog) global.posthog.capture('doom_game_started', {});
  }

  function cleanup() {
    active = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    document.removeEventListener('keydown', _onKeyDown);
    document.removeEventListener('keyup', _onKeyUp);
    document.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('pointerlockchange', _onPointerLockChange);
    if (canvas) canvas.removeEventListener('click', _onCanvasClick);
    if (pointerLocked && document.exitPointerLock) document.exitPointerLock();
    // reset transient input
    input.forward = input.back = input.strafeL = input.strafeR = false;
    input.turnL = input.turnR = input.fire = input.fireEdge = false;
    input.mouseDX = 0;
    // tear down enemies so next tab activation starts a fresh fight
    if (global.DoomEnemies) global.DoomEnemies.reset();
    for (const e of entities.slice()) api.removeEntity(e);
    gameOver = false;
    damageFlashT = 0;
    const ov = document.getElementById('doomOverlay');
    if (ov) ov.classList.remove('show');
    const btn = document.getElementById('btn-doom-restart');
    if (btn) btn.style.display = 'none';
  }

  if (typeof global.registerGame === 'function') {
    global.registerGame('doom', { init, cleanup });
  }
})(window);
