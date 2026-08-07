# Doom-style level & asset bundle

This directory holds the data side of the raycaster game:

- **Map format** — JSON level files under `levels/`
- **Art assets** — PNG textures, sprites and weapons under `assets/`
- **Loader API** — `loader.js`, the interface the raycaster engine consumes
- **Tools** — `tools/generate-assets.cjs` regenerates every PNG from scratch (CC0)

The core raycaster engine (rendering, input, physics) lives elsewhere and pulls
data through `loader.js`.

## Quick start

```js
import { loadLevel, listLevels, loadAssetManifest } from './doom/loader.js';

const level = await loadLevel('e1m1');
console.log(level.width, level.height);     // 24, 24
console.log(level.playerStart);             // { x: 3.5, y: 3.5, angle: 0 }
console.log(level.cells[5][7]);             // wall id at (col 7, row 5)
console.log(level.things);                  // [{ type: 'enemy_zombie', x, y }, ...]

const assets = await loadAssetManifest();
console.log(assets.textures.wall_tech);     // '/doom/assets/textures/wall_tech.png'
```

## Map JSON format

A level is a single JSON file. All numeric coordinates are in **cell units**
(so `x: 3.5` is the centre of column 3 row 0). Y grows downward.

```jsonc
{
  "name": "E1M1: Hangar Echo",
  "description": "Opening level. Pistol start, two zombies, one secret.",
  "width": 24,
  "height": 24,
  "tileset": "tech",

  // Floor and ceiling are flat single-texture surfaces.
  "floor":   { "texture": "floor_tile",   "light": 0.55 },
  "ceiling": { "texture": "ceiling_gray", "light": 0.45 },

  // 2D grid of wall IDs. 0 = empty/walkable, any other int = wall tile.
  // The integer keys into `wallTextures`. Length = height (rows of width).
  "cells": [
    [1,1,1,1, ...],
    [1,0,0,0, ...],
    ...
  ],

  // Map wall ID -> texture name (resolved via the asset manifest).
  "wallTextures": {
    "1": "wall_tech",
    "2": "wall_panel",
    "3": "wall_blood",
    "9": "wall_exit"
  },

  // Doors live "between" cells but occupy a grid cell themselves.
  // The engine should treat a door cell as a wall until opened.
  "doors": [
    { "x": 5, "y": 7, "axis": "y", "texture": "door_steel", "key": null },
    { "x": 12, "y": 9, "axis": "x", "texture": "door_red", "key": "red" }
  ],

  // Everything else — spawns, enemies, pickups, decorations, exit pads.
  // Exactly one entry must have type "player_start".
  "things": [
    { "type": "player_start",   "x": 3.5,  "y": 3.5,  "angle": 0 },
    { "type": "exit",           "x": 22.5, "y": 22.5 },

    { "type": "enemy_zombie",   "x": 10.5, "y": 8.5 },
    { "type": "enemy_imp",      "x": 18.5, "y": 4.5 },

    { "type": "pickup_health",  "x": 6.5,  "y": 12.5 },
    { "type": "pickup_ammo",    "x": 7.5,  "y": 12.5 },
    { "type": "pickup_armor",   "x": 13.5, "y": 18.5 },
    { "type": "pickup_key_red", "x": 19.5, "y": 19.5 },

    { "type": "decoration_barrel", "x": 5.5,  "y": 5.5,  "blocking": true, "destructible": true },
    { "type": "decoration_lamp",   "x": 14.5, "y": 6.5,  "blocking": false, "light": 0.9 }
  ]
}
```

### Field reference

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Human title shown in HUD/menus. |
| `description` | string | Optional flavour text. |
| `width`, `height` | int | Grid dimensions in cells. |
| `tileset` | string | Hint for ambient/audio theming. Not load-bearing. |
| `floor.texture`, `ceiling.texture` | string | Key into asset manifest. |
| `floor.light`, `ceiling.light` | 0..1 | Base brightness multiplier. |
| `cells[y][x]` | int | 0 = walkable air; positive = wall ID. |
| `wallTextures` | obj | Wall ID (as string) → texture name. |
| `doors[]` | array | Door definitions (see below). |
| `things[]` | array | Spawnable entities (see below). |

### Doors

```jsonc
{ "x": 5, "y": 7, "axis": "y", "texture": "door_steel", "key": null }
```

- `axis` is `"x"` if the door slides east-west (a horizontal slab the player
  enters facing north/south), `"y"` if north-south.
- `key` is `null`, `"red"`, `"blue"` or `"yellow"`. Engine refuses to open
  without the matching pickup.
- The cell at `(x, y)` in `cells` should be set to a wall ID that uses the
  door texture (engines may fall back to the `texture` field on the door).

### Things — supported `type` values

The engine should treat unknown types as **inert decorations** so map authors
can experiment without crashing the runtime.

| Category    | `type`                  | Suggested sprite       | Behaviour hint |
|-------------|-------------------------|------------------------|----------------|
| Spawn       | `player_start`          | —                      | Player camera origin. `angle` in radians. |
| Exit        | `exit`                  | `exit_pad`             | Touching ends the level. |
| Enemy       | `enemy_zombie`          | `enemy_zombie`         | Melee/ranged grunt. |
| Enemy       | `enemy_imp`             | `enemy_imp`            | Ranged fireball. |
| Enemy       | `enemy_demon`           | `enemy_demon`          | Fast melee. |
| Pickup      | `pickup_health`         | `pickup_health`        | +25 HP. |
| Pickup      | `pickup_armor`          | `pickup_armor`         | +50 armor. |
| Pickup      | `pickup_ammo`           | `pickup_ammo`          | +20 bullets. |
| Pickup      | `pickup_shells`         | `pickup_shells`        | +8 shells. |
| Pickup      | `pickup_key_red`        | `pickup_key_red`       | Opens red doors. |
| Pickup      | `pickup_key_blue`       | `pickup_key_blue`      | Opens blue doors. |
| Pickup      | `pickup_key_yellow`     | `pickup_key_yellow`    | Opens yellow doors. |
| Weapon      | `weapon_shotgun`        | `pickup_shotgun`       | Gives shotgun. |
| Decoration  | `decoration_barrel`     | `decoration_barrel`    | Explodes if `destructible`. |
| Decoration  | `decoration_lamp`       | `decoration_lamp`      | Static light source. |
| Decoration  | `decoration_pillar`     | `decoration_pillar`    | Blocking pillar. |
| Decoration  | `decoration_corpse`     | `decoration_corpse`    | Non-blocking gore. |

Optional thing fields:

- `angle` (rad) — facing direction.
- `blocking` (bool) — does it block player/enemy movement.
- `destructible` (bool) — can be damaged/removed.
- `light` (0..1) — emits light (engine may ignore).
- `sprite` (string) — override sprite name (defaults from `type`).

## Asset manifest

The loader exposes a single function — `loadAssetManifest()` — that returns:

```js
{
  textures: { wall_tech: '/doom/assets/textures/wall_tech.png', ... },
  sprites:  { enemy_zombie: '/doom/assets/sprites/enemy_zombie.png', ... },
  weapons:  { pistol: '/doom/assets/weapons/pistol.png', ... }
}
```

All paths are root-relative URLs the engine can drop straight into `new Image()`.

## Regenerating the art

All textures and sprites are **procedurally generated** from
`tools/generate-assets.cjs`. They are CC0 / public domain and contain no
third-party content. To re-roll the art:

```bash
node doom/tools/generate-assets.cjs
```

The script is deterministic — it always emits the same pixels for the same
seed. Change the seed at the top of the file if you want a fresh palette.

## Loader API surface

`doom/loader.js` exports the following:

| Function                   | Returns                                      |
|----------------------------|----------------------------------------------|
| `listLevels()`             | `Promise<Array<{ id, name, file }>>`         |
| `loadLevel(id)`            | `Promise<NormalisedLevel>` (validated)       |
| `loadAssetManifest()`      | `Promise<{ textures, sprites, weapons }>`    |
| `validateLevel(json)`      | `{ ok, errors[], warnings[] }` — sync, no IO |
| `THING_DEFAULTS`           | object — default sprite/blocking per type    |

A `NormalisedLevel` is the raw JSON plus:

- `playerStart` — convenience reference to the `player_start` thing.
- `exit` — convenience reference to the `exit` thing (may be null).
- `cells` guaranteed to be a `[height][width]` 2D array of ints.
- Every thing has `blocking` and `sprite` filled in from `THING_DEFAULTS`.

This is the **only** entry point the engine needs to depend on. If we change
the on-disk format later, this module absorbs the migration.
