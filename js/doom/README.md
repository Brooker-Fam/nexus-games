# Nexus Doom

A Wolfenstein/Doom-style raycaster built on vanilla HTML5 Canvas + JS.

Stacked on top of the core engine (per-column DDA raycaster, sprite
z-buffer, fixed-timestep loop) is a self-contained gameplay layer:
weapons, pickups, enemies, projectiles, and a programmatic status-bar HUD.

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
| `LMB` / `Space` / `Ctrl` | Fire |
| `1` … `5` | Select weapon by slot |
| Mouse wheel | Cycle weapons |
| `Q` | Quick-switch to last weapon |
| `R` | Restart (when dead) |
| `Esc` | Pause / unpause |

Click the canvas again while paused to resume.

## Weapons

| Slot | Weapon | Ammo | Damage | Notes |
| --- | --- | --- | --- | --- |
| `1` | Fist            | —       | 22    | Melee. Slow swing, no ammo. |
| `2` | Pistol          | clip    | 15    | Hitscan, semi-auto, tight spread. |
| `3` | Shotgun         | shells  | 7 × 9 | 7-pellet spread; brutal up close. |
| `4` | Chaingun        | clip    | 11    | Hitscan, full-auto, mid spread. |
| `5` | Rocket Launcher | rockets | 90 (+70 splash) | Projectile, splash damage. **Mind your toes.** |

Pickups: `clip`, `box_bullets`, `shells`, `box_shells`, `rocket`,
`box_rockets`, `cell`, `stimpack`, `medkit`, `armor_green` (green,
1/3 absorb), `armor_blue` (mega, 1/2 absorb), and the three weapon
spawners (`weapon_shotgun`, `weapon_chaingun`, `weapon_rocket`).
Walk over them to consume.

## Architecture

```
js/doom/
├── textures.js   — DoomTextures.* texture/sprite atlas + loaders
├── raycaster.js  — DoomRaycaster.create(canvas) — DDA + sprite pipeline
├── weapons.js    — DoomWeapons — loadout, ammo, switch FSM, fire dispatch
├── combat.js     — DoomCombat — player state, damage, pickups, enemies,
│                   projectiles, hitscan resolution, screen-shake/vignette
├── hud.js        — DoomHud — viewmodel, status bar, face portrait, vignette
└── game.js       — window.Doom — loop, input, lifecycle, event bus
```

The HUD draws to a second canvas (`#doomHudCanvas`) stacked on top of the
game canvas; that keeps the engine's `putImageData` path uncontested and
lets the HUD use crisp text/lines while the world stays pixelated.

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

## Status / open follow-ups

- [x] HUD beyond FPS / position / state (weapon, health, armor, ammo, face).
- [x] Audio (Web Audio SFX through the shared `sfx()` synth).
- [x] Weapons (fist / pistol / shotgun / chaingun / rocket launcher).
- [x] Pickups + ammo system, enemies + AI, hitscan + splash projectiles.
- [ ] Textured floor & ceiling pass.
- [ ] Door / pushwall tile types — currently every non-zero tile is solid.
- [ ] Multi-frame sprite atlases (sprite ids today map to single images),
      directional enemy sprites, enemy ranged-attack projectiles.
- [ ] Level loader — real maps from level data files, exit triggers, locked doors.
