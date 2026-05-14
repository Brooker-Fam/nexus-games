# Nexus Doom — Core Engine

A Wolfenstein/Doom-style raycaster built on vanilla HTML5 Canvas + JS.

This branch now ships **engine + enemies/AI/combat**. Future PRs from the
parallel hoglets will plug in real levels / textures and a richer weapon
suite; the contracts below are stable.

## Enemies, AI, combat (this PR)

`js/doom/enemies.js` adds a finite-state AI tick (idle → alerted → chase →
attack → pain → dying → corpse) on top of Carlos's entity update hook, plus
its own DDA line-of-sight check so enemies see through the same wall grid
the renderer does. Three archetypes ship:

| Enemy   | HP | Speed | Attack            | Range | DMG | Notes |
| ------- | -- | ----- | ----------------- | ----- | --- | ----- |
| Imp     | 40 | 1.7   | Fireball projectile | 8   | 8   | Keeps distance, lobs fire |
| Zombie  | 25 | 1.3   | Hitscan rifle      | 10   | 10  | Spread shot, slight inaccuracy |
| Pinky   | 90 | 2.6   | Melee bite        | 1.0  | 18  | Fast bruiser, charges in |

Stats live in `DoomEnemies.TYPES[...]`; tweak there to rebalance.

### Testing enemies in the browser

1. Serve the repo root (`npx serve .` or `python3 -m http.server`).
2. Open `index.html` and click the **✜ DOOM** tab. Three enemies spawn in
   the default 8×8 stub map.
3. **LOS detection** — turn to face an enemy; once your eye-line clears
   the central pillar you'll hear an alert grunt and they'll start
   chasing. Step behind the pillar to break sight; they drift toward
   your last-seen position.
4. **Chase / attack** — back away from the Imp and watch it lob
   fireballs. Let the Zombie shoot you — your HP HUD drops and the
   screen flashes red. The Pinky will charge straight in; back-pedal
   while firing.
5. **Pain** — every shot that doesn't kill has a per-archetype chance to
   flinch the enemy, briefly interrupting its attack (look for the pain
   sprite — the Pinky almost never flinches).
6. **Death animation + corpse** — keep firing. Each death plays a 2-frame
   death animation followed by a flattened corpse that stays on the
   ground for the rest of the encounter.
7. **Player death** — let them kill you. The screen turns red, "YOU DIED"
   shows, press `R` or click **RESTART** to spawn fresh.

## How to run

The game is part of the Nexus Games arcade — no separate build step.

```bash
# anything that serves the repo root works
npx serve .
# or
python3 -m http.server 8080
```

Open the served `index.html`, then click the **✜ DOOM** tab. Click the
canvas to capture the mouse (pointer lock), or just use the keyboard.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Move forward |
| `S` / `↓` | Move backward |
| `A` | Strafe left |
| `D` | Strafe right |
| `←` / `→` | Turn |
| Mouse (after click) | Look left/right |
| `Space` / `Ctrl` | Fire |
| `Esc` | Pause / unpause |

Click the canvas again while paused to resume.

## Architecture

```
js/doom/
├── textures.js   — DoomTextures.* texture/sprite atlas + loaders
├── raycaster.js  — DoomRaycaster.create(canvas) — DDA + sprite pipeline
├── sprites.js    — DoomEnemySprites — procedural multi-frame enemy art
├── game.js       — window.Doom — loop, input, lifecycle, event bus, HUD
└── enemies.js    — DoomEnemies — enemy types, FSM AI, LOS, projectiles
```

`game.js` registers itself with the shared `registerGame('doom', …)`
registry from `js/shared/game-registry.js`, so switching tabs cleans up
event listeners and stops the loop automatically.

## Map schema

```js
/**
 * @typedef {Object} DoomMap
 * @property {number}   width    Grid width in tiles.
 * @property {number}   height   Grid height in tiles.
 * @property {number[]} tiles    Row-major. 0 = empty, >0 = wall texture id.
 * @property {{x:number, y:number, angle:number}[]} spawnPoints
 *                              World units = 1 per tile; the centre of
 *                              tile (i,j) is at (i+0.5, j+0.5).
 * @property {[number,number,number]?} floorColor  Optional RGB 0–255.
 * @property {[number,number,number]?} ceilColor   Optional RGB 0–255.
 */
```

Example (the stub map shipped with this PR):

```js
Doom.setMap({
  width: 8, height: 8,
  tiles: [
    1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,2,0,0,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1,
  ],
  spawnPoints: [{ x: 1.5, y: 1.5, angle: Math.PI / 4 }],
  floorColor: [35, 25, 25],
  ceilColor:  [20, 25, 40],
});
```

## Entity schema

```js
/**
 * @typedef {Object} DoomEntity
 * @property {number} x           World x (tiles).
 * @property {number} y           World y (tiles).
 * @property {number} angle       Facing, radians. Renderer billboards the
 *                                sprite; AI is free to use this for logic.
 * @property {number} sprite      Texture id for the billboard.
 * @property {string} state       Free-form tag ('idle','dying',...).
 * @property {number} [scale]     Display scale (default 1).
 * @property {number} [vOffset]   Vertical world offset (default 0).
 * @property {boolean} [dead]     Set true to remove on the next tick.
 * @property {(dt:number)=>void} [update] Per-tick AI callback.
 */
```

Adding an entity:

```js
const grunt = Doom.addEntity({
  x: 5.5, y: 4.5, angle: 0,
  sprite: 100,
  state: 'idle',
  hp: 30,
  update(dt) {
    // hoglet 2's AI logic here
  },
});
```

When `grunt.dead = true`, the engine drops it from the render list on the
next tick and emits `'onEntityDeath'`.

## Texture loading

```js
// Load from URL (PNG/JPG/etc.):
await Doom.loadTexture(7, 'assets/walls/stone.png');

// Or generate procedurally (e.g. for placeholders or palette swaps):
DoomTextures.addProcedural(8, 64, 64, (x, y) => {
  return [x * 4, y * 4, 128, 255]; // [r, g, b, a]
});
```

Texture id `0` is reserved for "empty"; map tiles with value `0` are
walkable space. Ids `1` and `2` are the default brick and tech-panel
placeholders shipped with the engine. Id `100` is the placeholder sprite.

## Event bus

```js
Doom.events.on('onPlayerFire', ({ angle, hit }) => {
  // hoglet 2 spawns a muzzle flash entity, plays SFX, applies damage…
  console.log('fired into tile', hit.tileX, hit.tileY, 'dist', hit.dist);
});

Doom.events.on('onEntityDeath', ({ entity }) => {
  // gameplay-side bookkeeping
});

Doom.events.on('tick', ({ dt }) => {
  // dt is in seconds, fixed-timestep
});
```

Available events:

| Name | Payload | Fired |
| --- | --- | --- |
| `tick` | `{ dt }` | every fixed-timestep update (~60 Hz) |
| `onPlayerMove` | `{ x, y, angle }` | after every successful move-and-collide |
| `onPlayerFire` | `{ angle, hit }` | edge-triggered on Space/Ctrl |
| `onEntityDeath` | `{ entity }` | when `removeEntity` or `dead=true` strips an entity |

`hit` is the result of `Doom.castRay(angle)` — `{ dist, tile, tileX,
tileY, side, u }`. Use it for hitscan damage, decals, etc.

## Hitscan helper

```js
const hit = Doom.castRay(Doom.getPlayer().angle);
if (hit.dist < 6) {
  // close enough to hurt something on this tile
}
```

## Performance notes

- The renderer writes to a single `ImageData` buffer and pushes it with
  `putImageData` once per frame. Per-column work is tight (one DDA, one
  texture walk).
- Floors and ceilings are solid-colour fills today. A textured floor pass
  is the obvious next step but is intentionally deferred so this PR can
  merge first.
- The main loop is **fixed-timestep update + variable-rate render** at a
  60 Hz simulation tick. Gameplay code receiving `'tick'` always sees a
  constant `dt` of `1/60` seconds.

## Public API additions (enemies/AI)

```js
// Spawning
DoomEnemies.spawnEnemy('imp', 5.5, 4.5);   // type, world x, world y
DoomEnemies.spawnDefaultEncounter();       // 3-enemy demo for the stub map

// Player HP
DoomEnemies.getPlayerHealth();             // → number
DoomEnemies.damagePlayer(amount, source);  // funnel for all incoming hits
DoomEnemies.setPlayerHealth(100);          // restore (also used by Doom.restart())

// Hitscan against enemies (auto-wired to onPlayerFire)
DoomEnemies.tryFirePlayerHitscan({ angle, hit }) → entity | null;

// Generic LOS — DDA grid walk between any two world points
DoomEnemies.lineOfSight(x1, y1, x2, y2) → boolean;

// Reset all enemies + projectiles (called by Doom.restart() too)
DoomEnemies.reset();
```

New events on `Doom.events`:

| Name | Payload | Fired |
| --- | --- | --- |
| `onPlayerHurt` | `{ amount, source, hp }` | every hit through `damagePlayer` |
| `onPlayerDie`  | `{}` | once HP reaches 0 |
| `onEnemyHurt`  | `{ entity, amount, killed }` | every damage event against an enemy |

## Status / open follow-ups

- [ ] Textured floor & ceiling pass.
- [ ] Door / pushwall tile types — currently every non-zero tile is a
      solid wall.
- [x] Multi-frame sprite atlases (per-enemy frame sequences live in
      `DoomEnemies.TYPES[*].sprites`).
- [x] HUD beyond FPS / position / state (HP, kills, damage flash, death overlay).
- [x] Audio (player + per-enemy alert/pain/die/attack SFX via shared audio module).
- [ ] Weapons beyond the single hitscan pistol — pickups, ammo, multi-frame
      first-person weapon sprite.
- [ ] Smarter pathing — current chase is greedy seek with wall-slide.
- [ ] LOS exact-corner case: a ray that passes through the geometric corner
      of a wall tile reports "blocked" because both side distances equalise on
      the same step. Symptom is mild jitter between idle/chase at one or two
      degenerate angles in the stub map. Real maps with offset enemy positions
      don't trip it; worth a one-line tie-break later.
