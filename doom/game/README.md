# DOOM — Gameplay Layer

The gameplay layer for the Doom-style FPS that sits in `doom/`. This package
owns the player, weapons, enemies, combat, pickups, HUD, and the game loop.
It does **not** own rendering or level data — those are provided through two
small interfaces so the engine (Lizzie) and the level/art pipeline (Juraj)
can land independently.

```
doom/
  game/         ← this package
  engine/       ← Lizzie's raycaster (replaces engine-stub.js)
  levels/       ← Juraj's level/art pipeline (replaces level-stub.js)
  doom.html     ← demo page that runs the gameplay layer against the stubs
```

## File map

| File              | Responsibility                                       |
| ----------------- | ---------------------------------------------------- |
| `index.js`        | Public exports (`createGame`, stubs, config)         |
| `game.js`         | Game state + main loop + lifecycle hooks             |
| `player.js`       | Player controller, health/armor, ammo                |
| `weapons.js`      | Pistol, shotgun, chaingun — hitscan + projectile     |
| `enemies.js`      | Zombieman + Imp, state machine, simple AI            |
| `projectiles.js`  | Imp fireballs and any other in-flight damage carriers |
| `pickups.js`      | Health, armor, ammo, weapon pickups                  |
| `hud.js`          | Classic status bar, weapon sprite, overlays          |
| `input.js`        | Keyboard + mouse (pointer-lock) input                |
| `config.js`       | All tunables: player, weapons, enemies, pickups      |
| `engine-stub.js`  | Stand-in raycaster for local development             |
| `level-stub.js`   | Tiny test map until Juraj's level system lands       |

## Quick start

```js
import { createGame, createStubEngine, createStubLevel } from './doom/game/index.js';

const canvas = document.getElementById('doom-canvas');
const engine = createStubEngine();
engine.attach(canvas);

const level = createStubLevel();
const game  = createGame({ engine, level, hooks });
game.start();
```

Or just open `doom/doom.html` in a browser served over `http://` (ES modules
need a real HTTP origin — `file://` will block the imports).

## Controls

| Key                | Action                                  |
| ------------------ | --------------------------------------- |
| `W` / `S` / arrows | move forward / back                     |
| `A` / `D`          | strafe                                  |
| `←` / `→`          | turn (alternative to mouse)             |
| Mouse              | turn (click canvas to grab pointer lock) |
| LMB                | fire                                    |
| `2` / `3` / `4`    | select pistol / shotgun / chaingun      |
| `Q` / `E`          | prev / next weapon                      |
| `P` or `Esc`       | pause / resume                          |
| `R`                | restart (after death or level clear)    |

## Interfaces

### `Engine` (provided by Lizzie's module)

```ts
type Engine = {
  attach(canvas: HTMLCanvasElement): void;
  setLevel(level: Level): void;
  getCanvas(): HTMLCanvasElement;
  getViewport(): { width: number; height: number };

  // World ray against walls. Used for hitscan + AI line-of-sight tests.
  castRay(x: number, y: number, angle: number, maxDist?: number): {
    distance: number;     // distance to wall hit, or maxDist on miss
    hit: boolean;
    tileX: number;
    tileY: number;
    side: 0 | 1;          // 0 = NS face, 1 = EW face — useful for shading
  };

  // Convenience: was line (x1,y1)-(x2,y2) unobstructed?
  lineOfSight(x1: number, y1: number, x2: number, y2: number): boolean;

  // Draw the scene from a camera + sorted sprite list.
  render(camera: { x: number; y: number; angle: number; pitch?: number },
         sprites: Array<{ kind, sprite, state?, x, y, radius, angle? }>): void;
};
```

The gameplay layer **never** issues canvas drawing for world objects — it
hands a `sprites[]` array to `engine.render(...)` and lets the engine sort
+ draw with proper depth. HUD is drawn directly on the canvas the engine
exposes.

### `Level` (provided by Juraj's module)

```ts
type Level = {
  width: number;
  height: number;
  getName?(): string;
  getTile(x: number, y: number): number;                  // 0 = empty, >0 = wall id
  getPlayerSpawn(): { x: number; y: number; angle: number };
  getEntitySpawns(): Array<{
    kind: 'enemy' | 'pickup' | 'exit';
    type: string;                                         // archetype id from config.js
    x: number; y: number;
  }>;
};
```

Stubs of both interfaces live next to the gameplay code — see
`engine-stub.js` and `level-stub.js`. They exist purely so this layer is
testable in isolation; once the real modules land, delete the stub imports
in `index.js` (or leave them as the dev fallback).

## Lifecycle hooks

`createGame({ engine, level, hooks })` accepts:

- `onStart(game)`
- `onPause(game)`
- `onResume(game)`
- `onRestart(game)`
- `onGameOver(game)`
- `onLevelComplete(game)`
- `onKill(game, enemy)`

These are the integration points for the Nexus Games shell — score sync,
PostHog events, audio cues, etc. — without bleeding into the gameplay code.

## Adding content

- **New weapon**: add an entry to `WEAPONS` in `config.js`. Hitscan weapons
  need `damage` / `spread` / `pellets` / `range`; projectile weapons need a
  `projectile: { speed, damage, radius, ttl, sprite }` block.
- **New enemy**: add to `ENEMIES`. Either `attackKind: 'hitscan'` with
  `attackDamage` / `attackSpread` / `attackRange`, or `'projectile'` with a
  nested `projectile: { ... }`. Optional `meleeRange` + `meleeDamage`.
- **New pickup**: add to `PICKUPS`. `kind` is `'health' | 'armor' | 'ammo' |
  'weapon'` and the rest is type-specific (see existing entries).

Sprite IDs are passed through to the engine as strings; map them to actual
art in Juraj's pipeline.

## Known TODOs for engine integration

- `engine.render` is currently a top-down debug view in the stub. Replace
  with the real raycaster output.
- Sprite billboarding / animation frames are referenced by string id only
  — the engine decides which frame to draw based on `state` (`idle`,
  `chase`, `attack`, `pain`, `death`) and `angle` (so 8-way sprite sheets
  work).
- Tracers (`game.tracers`) are emitted but not yet consumed by the stub
  renderer — wire them up if the engine wants to draw bullet streaks.
- Sound effects: `hooks.onKill` etc. are intentionally the only path —
  audio is not the gameplay layer's job.
