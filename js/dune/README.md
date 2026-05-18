# Dune Wars — Terrain & Map System

A Dune II clone living under the `dune` tab. This module owns terrain
representation, map data, the camera, fog of war, and tile rendering.
Units, buildings, harvesters, combat, and UI for the game will live in
sibling modules and consume the public surface defined here.

## File layout

```
js/dune/
  tiles.js       — terrain constants + per-terrain properties
  coords.js      — world / screen / tile coordinate helpers
  map.js         — DuneMap class, JSON load/save, hand-authored test map
  mapgen.js      — procedural Arrakis-style generator
  fog.js         — DuneFog class (unexplored / explored / visible)
  camera.js      — DuneCamera (keys + edge-scroll, bounds-clamped)
  rendering.js   — duneDrawMap / duneDrawMinimap
  game.js        — DUNE namespace, lifecycle, render loop, input
```

Loaded as plain `<script>` tags — no build step, no modules. Everything is
exposed on `window` and prefixed with `dune…` / `DUNE_…` so other games are
unaffected.

## Public API

### `DUNE` (top-level namespace)

Set by `game.js` after `duneStart()` runs. Use this as the entry point from
unit/building/combat code:

| field / method | meaning |
| --- | --- |
| `DUNE.map` | active `DuneMap` instance |
| `DUNE.fog` | active `DuneFog` instance |
| `DUNE.camera` | active `DuneCamera` |
| `DUNE.tileSize` | px per tile (constant) |
| `DUNE.revealTile(tx, ty, r)` | shortcut for `DUNE.fog.revealTile(...)` |
| `DUNE.worldToTile(wx, wy)` | `{tx, ty}` |
| `DUNE.tileToWorld(tx, ty)` | top-left of tile in world px |
| `DUNE.tileCenter(tx, ty)` | centre of tile in world px |
| `DUNE.worldToScreen(wx, wy, cam)` | `{sx, sy}` |
| `DUNE.screenToWorld(sx, sy)` | uses active camera |
| `DUNE.screenToTile(sx, sy)` | uses active camera |
| `DUNE.isPassable(tx, ty)` | `false` for mountains and OOB |
| `DUNE.isBuildable(tx, ty)` | `true` only for rock |

### Terrain (`tiles.js`)

```js
DUNE_TILE.SAND | DUNE.DUNE | ROCK | MOUNTAIN | SPICE | SPICE_BLOW
DUNE_TILE_PROPS[terrain]    // { color, accent, passable, speedMult, buildable, spiceYield }
duneTileProps(terrain)      // safe getter (falls back to sand)
duneIsPassable(terrain)
duneIsBuildable(terrain)
duneSpeedMult(terrain)
```

Movement-speed multipliers (relative to baseline `1.0`):

| terrain | speed |
| --- | ---: |
| sand | 1.00 |
| spice | 0.85 |
| spice_blow | 0.75 |
| dune | 0.55 |
| mountain | 0.00 (impassable) |
| rock | 1.00 |

### Map (`map.js`)

```js
const map = duneLoadMap('test-arrakis-64'); // or pass a JSON object
const map = duneCreateTestMap();            // direct factory
const map = duneGenerateMap({ seed: 42 });  // procedural

map.width / map.height
map.get(tx, ty)            // terrain string, MOUNTAIN if OOB
map.set(tx, ty, terrain)
map.inBounds(tx, ty)
map.toJSON()               // JSON-safe { name, width, height, tiles }
DuneMap.fromJSON(obj)

duneRegisterMap('my-name', jsonData); // register additional hand-authored maps
```

Map files are plain JSON: `{ name, width, height, tiles: [<terrain string>, ...] }`,
row-major (`tiles[y * width + x]`).

### Procedural generation (`mapgen.js`)

```js
duneGenerateMap({
  width: 64, height: 64,
  seed: 12345,        // deterministic
  rockOutcrops: 6,    // major buildable plateaus
  rockMinR: 2, rockMaxR: 5,
  duneBands: 3,       // sinusoidal slow-movement drifts
  spiceFields: 6,     // small spice clumps
  spiceBlows: 3,      // dense high-yield patches
  mountainBorder: 2,  // thickness of impassable edge
});
```

### Fog of war (`fog.js`)

```js
DUNE_FOG.UNEXPLORED | EXPLORED | VISIBLE

const fog = new DuneFog(width, height);
fog.get(tx, ty)            // 0/1/2
fog.isVisible(tx, ty)
fog.isExplored(tx, ty)
fog.revealTile(cx, cy, r)  // mark circle as VISIBLE (and remember EXPLORED)
fog.markExplored(cx, cy, r)// mark as EXPLORED without making VISIBLE
fog.beginFrame()           // demote VISIBLE → EXPLORED; call once per tick,
                           //   then re-reveal from active vision sources
fog.reset()
fog.revealAll()            // debug
```

### Camera (`camera.js`)

```js
const cam = new DuneCamera({ viewW, viewH, worldW, worldH });
cam.tick(dtSeconds, keysHeld);   // handles arrows / WASD / edge-scroll
cam.pan(dx, dy);
cam.centerOnTile(tx, ty);
cam.centerOnWorld(wx, wy);
cam.setMouseScreen(sx, sy);      // for edge scrolling
cam.clamp();                     // call after manual edits to x/y
```

Camera coordinates are top-left world pixels (`cam.x`, `cam.y`).

### Rendering (`rendering.js`)

```js
duneDrawMap(ctx, map, fog, camera);
duneDrawMinimap(ctx, map, fog, x, y, w, h);
```

The renderer culls to `duneVisibleTileRange(cam, map.w, map.h)` and is safe
to call every frame. It only reads state — never mutates `map` or `fog`.

### Coordinates (`coords.js`)

```js
DUNE_TILE_SIZE                       // px per tile (const)
duneWorldToTile(wx, wy)              // → { tx, ty }
duneTileOrigin(tx, ty)               // → top-left world coords
duneTileCenter(tx, ty)               // → centre world coords
duneWorldToScreen(wx, wy, cam)       // → { sx, sy }
duneScreenToWorld(sx, sy, cam)
duneScreenToTile(sx, sy, cam)
duneVisibleTileRange(cam, mapW, mapH) // → { x0, y0, x1, y1 }
duneTileDistance(ax, ay, bx, by)      // euclidean
```

## Integration cheatsheet for sibling hoglets

```js
// Spawn a unit at tile (10, 12). Reveal its surroundings.
const unit = { tx: 10, ty: 12, vision: 5 };
DUNE.revealTile(unit.tx, unit.ty, unit.vision);

// Place a building. Check the footprint first.
function canPlace(tx, ty, w, h){
  for(let y = ty; y < ty + h; y++){
    for(let x = tx; x < tx + w; x++){
      if(!DUNE.isBuildable(x, y)) return false;
    }
  }
  return true;
}

// Movement cost from a tile's terrain.
const speed = duneSpeedMult(DUNE.map.get(tx, ty));
```

## What's in scope / what's deferred

In scope (this PR):
- Tile types, properties, hand-authored 64×64 map, procedural generator
- Camera with keyboard + edge-scroll panning, bounds-clamped
- Fog of war with three states and `revealTile()` API
- Coordinate helpers
- Visible, scrollable map rendered as coloured tiles

Intentionally deferred:
- Pathfinding (A* on the grid) — will live in a separate `pathfind.js`
- Units, buildings, harvesters, combat — sibling modules
- Sprite art (currently coloured-square placeholders + simple accents)
- Map editor UI / save-load to localStorage or server
- Minimap viewport rectangle + click-to-pan (drawing exists, interaction TBD)
- Mouse drag-pan and pinch-zoom
- Multi-player / network sync (use map.toJSON + seed in mapgen)
