// Top-level game state + main loop. Wires player, enemies, projectiles,
// pickups, weapons, HUD, and the engine/level interfaces together.
//
// Lifecycle:
//   create()           builds the game object but does not start the loop
//   start()            kicks off the rAF loop and marks state = 'playing'
//   pause() / resume() toggles the pause overlay; loop keeps running so HUD
//                      stays painted but updates are skipped
//   gameOver()         freezes input + shows the game-over overlay
//   levelComplete()    fires when the player reaches an exit tile/sprite
//
// Engine and level are injected so this layer can be developed against the
// stubs and then re-wired to the real modules.

import { createPlayer, updatePlayer, damagePlayer, setMessage } from './player.js';
import { createEnemy, updateEnemy, damageEnemy } from './enemies.js';
import { createPickup, updatePickups } from './pickups.js';
import { createProjectile, updateProjectile } from './projectiles.js';
import { tryFire, handleWeaponInput } from './weapons.js';
import { createInput } from './input.js';
import { drawHud, drawScreen } from './hud.js';
import { SCORE } from './config.js';

export function createGame({ engine, level, hooks = {} }) {
  const canvas = engine.getCanvas();
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);

  engine.setLevel(level);

  const game = {
    engine,
    level,
    input,
    hooks,
    time: 0,
    state: 'menu',           // 'menu' | 'playing' | 'paused' | 'gameover' | 'complete'
    player: null,
    enemies: [],
    pickups: [],
    projectiles: [],
    tracers: [],
    exit: null,
    totalKills: 0,
    enemyCount: 0,
    spawnProjectile,
    spawnTracer,
    applyDamage,
    start,
    pause,
    resume,
    togglePause,
    restart,
    destroy,
    gameOver,
    levelComplete,
  };

  spawnEntities();

  // rAF loop control.
  let rafId = 0;
  let lastTs = 0;

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1; // clamp huge tab-switch deltas

    if (game.state === 'playing') update(dt);

    render();
    input.endFrame();
  }

  function start() {
    if (game.state === 'playing') return;
    game.state = 'playing';
    lastTs = 0;
    if (!rafId) rafId = requestAnimationFrame(loop);
    hooks.onStart?.(game);
  }

  function pause()  { if (game.state === 'playing') { game.state = 'paused';  hooks.onPause?.(game); } }
  function resume() { if (game.state === 'paused')  { game.state = 'playing'; hooks.onResume?.(game); } }
  function togglePause() {
    if (game.state === 'playing') pause();
    else if (game.state === 'paused') resume();
  }

  function gameOver() {
    if (game.state === 'gameover') return;
    game.state = 'gameover';
    hooks.onGameOver?.(game);
  }

  function levelComplete() {
    if (game.state === 'complete') return;
    game.state = 'complete';
    game.player.score += SCORE.levelClear;
    hooks.onLevelComplete?.(game);
  }

  function restart() {
    game.enemies.length = 0;
    game.pickups.length = 0;
    game.projectiles.length = 0;
    game.tracers.length = 0;
    game.totalKills = 0;
    spawnEntities();
    game.state = 'playing';
    hooks.onRestart?.(game);
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    input.destroy();
  }

  function spawnEntities() {
    const spawn = level.getPlayerSpawn();
    game.player = createPlayer(spawn);
    let enemyCount = 0;
    for (const s of level.getEntitySpawns()) {
      if (s.kind === 'enemy') {
        game.enemies.push(createEnemy(s.type, s.x, s.y));
        enemyCount++;
      } else if (s.kind === 'pickup') {
        game.pickups.push(createPickup(s.type, s.x, s.y));
      } else if (s.kind === 'exit') {
        game.exit = { x: s.x, y: s.y, radius: 0.6 };
      }
    }
    game.enemyCount = enemyCount;
  }

  function update(dt) {
    game.time += dt;

    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      togglePause();
      return;
    }
    if (game.player.dead) {
      gameOver();
      return;
    }

    handleWeaponInput(game.player, input);
    updatePlayer(game.player, dt, input, level);
    tryFire(game, game.player, input);

    for (const e of game.enemies) updateEnemy(e, dt, game);
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (e.removeMe) game.enemies.splice(i, 1);
    }

    for (const p of game.projectiles) updateProjectile(p, dt, game);
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
      if (game.projectiles[i].dead) game.projectiles.splice(i, 1);
    }

    // Tracers are eye-candy; fade them out.
    for (const t of game.tracers) t.life -= dt;
    for (let i = game.tracers.length - 1; i >= 0; i--) {
      if (game.tracers[i].life <= 0) game.tracers.splice(i, 1);
    }

    updatePickups(game);
    for (let i = game.pickups.length - 1; i >= 0; i--) {
      if (game.pickups[i].consumed) game.pickups.splice(i, 1);
    }

    checkExit();
  }

  function checkExit() {
    if (!game.exit) return;
    const dx = game.exit.x - game.player.x;
    const dy = game.exit.y - game.player.y;
    const r = game.exit.radius + game.player.radius;
    if (dx * dx + dy * dy <= r * r) {
      // Doom convention: must clear all monsters? We allow either route.
      levelComplete();
    }
  }

  function render() {
    const camera = {
      x: game.player.x,
      y: game.player.y,
      angle: game.player.angle,
    };
    const sprites = buildSpriteList();
    engine.render(camera, sprites);

    drawHud(ctx, game);

    if (game.state === 'menu')
      drawScreen(ctx, 'DOOM-LIKE', 'click to start', 'WASD move · mouse aim · LMB fire · 2/3/4 weapons');
    else if (game.state === 'paused')
      drawScreen(ctx, 'PAUSED', '', 'press P or ESC to resume');
    else if (game.state === 'gameover')
      drawScreen(ctx, 'YOU DIED', `score ${game.player.score} · kills ${game.player.kills}`, 'press R to restart');
    else if (game.state === 'complete')
      drawScreen(ctx, 'LEVEL CLEAR', `score ${game.player.score} · kills ${game.player.kills}/${game.enemyCount}`, 'press R for another run');

    if (input.wasPressed('KeyR') && (game.state === 'gameover' || game.state === 'complete')) {
      restart();
    }
  }

  function buildSpriteList() {
    const sprites = [];
    for (const e of game.enemies) {
      sprites.push({
        kind: 'enemy',
        sprite: e.sprite,
        state: e.state,
        x: e.x, y: e.y,
        radius: e.radius,
        angle: e.angle,
        color: e.dead ? '#553' : (e.type === 'imp' ? '#c33' : '#9a9'),
      });
    }
    for (const p of game.pickups) {
      if (p.consumed) continue;
      sprites.push({
        kind: 'pickup',
        sprite: p.sprite,
        x: p.x, y: p.y,
        radius: p.radius,
        color: '#7df',
      });
    }
    for (const p of game.projectiles) {
      sprites.push({
        kind: 'projectile',
        sprite: p.sprite,
        x: p.x, y: p.y,
        radius: p.radius,
        color: '#fa3',
      });
    }
    if (game.exit) {
      sprites.push({
        kind: 'exit',
        sprite: 'exit',
        x: game.exit.x, y: game.exit.y,
        radius: game.exit.radius,
        color: '#5f5',
      });
    }
    return sprites;
  }

  function spawnProjectile(spec) {
    game.projectiles.push(createProjectile(spec));
  }

  function spawnTracer(x1, y1, x2, y2) {
    game.tracers.push({ x1, y1, x2, y2, life: 0.06 });
  }

  function applyDamage(target, amount, source) {
    if (!target || target.dead) return;
    if (target === game.player) {
      damagePlayer(game.player, amount, source);
      if (game.player.dead) gameOver();
    } else {
      const before = target.dead;
      damageEnemy(target, amount);
      if (!before && target.dead) {
        game.player.score += target.score | 0;
        game.player.kills += 1;
        game.totalKills += 1;
        hooks.onKill?.(game, target);
      }
    }
  }

  // Auto-start when canvas is clicked from a 'menu' state. Hosts can also
  // call game.start() directly if they want their own start UI.
  canvas.addEventListener('mousedown', () => {
    if (game.state === 'menu') start();
  }, { once: false });

  return game;
}
