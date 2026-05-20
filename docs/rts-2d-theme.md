# Citadel Ops (2.5D RTS) — Theme & Foundation Contract

This document is the shared style reference for the 2.5D RTS tab (`tab-iso`).
All subsequent hoglets (units, AI, combat, fog of war, etc.) should pull
colors, naming, lore, and exported utilities from here — not invent their own.

The existing 1D RTS ("Deep Space Ops", tab id `cs`) is the source of truth for
faction lore/colors. The 2.5D tab is a **new battlefield** in the same universe:
same factions, same color language, new perspective (top-down isometric grid
instead of side-on side-scroller).

---

## 1. Universe & Lore

The site is **NEXUS GAMES**, subtitle "Citadel of Zharoth". Deep Space Ops is
the spaceborne RTS (side view, base on left vs. right). Citadel Ops is the
**ground campaign** of the same conflict: armadas have landed and are fighting
for control of the Citadel surface, viewed from an isometric (StarCraft-style)
camera.

Three factions (carry over verbatim from `js/rts/factions.js`):

| Faction | Armada           | Champion        | Lore                                                                                                 |
|---------|------------------|-----------------|------------------------------------------------------------------------------------------------------|
| shadow  | SHADOW ARMADA    | THE SWORDSMAN   | "From the void between stars, he emerged. None who faced his blade lived to name him."               |
| prism   | PRISM ARMADA     | THE WHITE WITCH | "She speaks in light. Her words become spells. Her spells become storms."                            |
| roboto  | ROBOTO ARMADA    | THE GUNBOT      | "Forged in a dead star's core. Programmed for one purpose: total suppression."                       |

Resource language (when later hoglets add resources, match Deep Space Ops):
- **GOLD** (primary, every faction)
- **OIL** (secondary, Roboto only)

---

## 2. Color Palette

Pull these via the existing CSS custom properties in `css/base.css` whenever
possible. They're all defined on `:root`.

### Site-wide neon palette
| Token             | Hex      | Use                            |
|-------------------|----------|--------------------------------|
| `--neon-cyan`     | #00f5ff  | primary accent, friendly UI    |
| `--neon-blue`     | #0088ff  | secondary accent               |
| `--neon-purple`  | #8800ff  | tertiary accent                |
| `--neon-pink`    | #ff0088  | warnings, lost-unit feedback   |
| `--neon-green`   | #00ff88  | OK / online status             |
| `--bg-deep`       | #020810  | page background                |
| `--bg-mid`        | #060e1a  | mid-tone panels                |
| `--panel-bg`      | rgba(0,20,40,0.85) | HUD panel fill       |
| `--panel-border`  | rgba(0,245,255,0.2) | HUD panel stroke    |

### Faction colors (from `FACTION_CFG`)
| Faction | Primary  | Accent   | Worker tint | Warrior tint |
|---------|----------|----------|-------------|--------------|
| shadow  | #9922ff  | #dd88ff  | #8855cc     | #cc88ff      |
| prism   | #00ddff  | #aaffff  | #88ccff     | #ffffff      |
| roboto  | #ff8800  | #ffcc44  | #aa6622     | #ff9933      |

### Terrain palette (2.5D additions — derived from the neon set above)
These are picked from the base palette so they sit in the same color family:
| Terrain     | Top fill | Side / shade | Outline                |
|-------------|----------|--------------|------------------------|
| `ground`    | #0c2440  | #061830      | rgba(0,245,255,0.18)   |
| `highground`| #1e3a5c  | #112440      | rgba(0,245,255,0.32)   |
| `obstacle`  | #2a1040  | #1a0828      | rgba(136,0,255,0.50)   |
| `water`     | #042033  | #021420      | rgba(0,136,255,0.40)   |

> Two terrain types are required by the foundation. Four are defined so later
> hoglets can ship cliffs, choke points, and water/lava without inventing new
> values.

---

## 3. Typography

| Family    | Where                                                        |
|-----------|--------------------------------------------------------------|
| Orbitron  | Headings, tab buttons, HUD labels, faction names (700/900)   |
| Rajdhani  | Body, hints, log text (300/400/600)                          |

Both loaded from Google Fonts in `index.html`. Don't introduce a third family.

Common letter-spacing values in this codebase: `6px` for big titles, `3px`
for tab buttons, `2px` for stat labels, `1.5px` for small chips.

---

## 4. Visual language / art direction

Style cues to match Deep Space Ops:

- **Clipped corners** via `clip-path: polygon(...)` on panels and buttons
  (~10–16px corner cut). Gives the StarCraft / cyberpunk paneled look.
- **Glow** via `box-shadow: 0 0 Npx rgba(neon, 0.x)` on hover/active. No
  drop-shadows.
- **Scanline overlay** is already global (`.scanline` in `base.css`).
- **Background grid** is already global (`.bg-grid`).
- **Procedural everything** — no image assets. Tiles, units, icons are all
  drawn via Canvas 2D or composed with CSS shapes.
- **Status colors** map to neon-green (good), neon-pink (bad/critical),
  neon-cyan (info).

For the isometric tiles: solid diamond fills, 1px neon outline at the listed
opacity, optional `+8 lightness` highlight on the top-left edge for fake
depth. No textures. Keep it programmer-art clean.

---

## 5. File layout (this hoglet's contribution)

```
css/iso.css                       — 2.5D RTS styles
js/iso/
  coords.js   — ISO_TILE_W/H, screen↔world↔tile conversions
  map.js      — TERRAIN constants, Tile shape, GameMap class
  world.js    — Entity base, World container (game state)
  camera.js   — IsoCamera (edge-scroll + WASD + arrow keys, clamped pan)
  render.js   — drawIsoMap, drawWorld, full-frame render(ctx, world, cam)
  game.js     — registerGame('iso', ...), RAF loop, init/cleanup
docs/rts-2d-theme.md               — this file
```

Scripts are loaded as plain `<script>` tags from `index.html` in dependency
order (coords → map → world → camera → render → game).

---

## 6. Exported globals (the foundation contract)

Other hoglets MUST use these instead of inventing parallel utilities.

### Coordinates (`js/iso/coords.js`)
- `ISO_TILE_W` / `ISO_TILE_H` — pixel size of one diamond (default 64×32).
- `worldToScreen(wx, wy, cam)` → `{x, y}`
- `screenToWorld(sx, sy, cam)` → `{x, y}`
- `worldToTile(wx, wy)` → `{col, row}` (floored)
- `tileToWorld(col, row)` → `{x, y}` (center of the tile diamond)
- `screenToTile(sx, sy, cam)` → `{col, row}`
- `tileTopScreen(col, row, cam)` → `{x, y}` (top vertex of the diamond,
  use this for back-to-front draw ordering reference points)

### Map (`js/iso/map.js`)
- `TERRAIN` — `{ GROUND, HIGHGROUND, OBSTACLE, WATER }` (string consts).
- `TERRAIN_PASSABLE` — `{ [terrain]: boolean }` (lookup table).
- `TERRAIN_STYLE` — `{ [terrain]: {top, shade, outline} }` (palette).
- `Tile` (jsdoc typedef): `{ col, row, terrain, passable, elevation }`.
- `class GameMap`:
  - `new GameMap(cols, rows)` — empty map
  - `.cols`, `.rows`, `.tiles` (flat `Tile[]` indexed `row * cols + col`)
  - `.get(col, row) → Tile | null` (out-of-bounds returns null)
  - `.set(col, row, terrain)`
  - `.inBounds(col, row) → boolean`
  - `.isPassable(col, row) → boolean`
  - `.pixelWidth()`, `.pixelHeight()` — total bounding box in world px
- `generateDemoMap(cols, rows) → GameMap` — placeholder map generator that
  scatters HIGHGROUND blobs and OBSTACLE clusters on a GROUND base. Later
  hoglets can ignore this and load their own maps.

### World (`js/iso/world.js`)
- `class Entity` — minimal base: `{ id, type, x, y, components }`. Other
  hoglets extend or wrap (units, buildings, projectiles). Don't sub-class
  deeply; prefer composition via `components`.
- `class World` — the single game-state container.
  - `.map` (GameMap)
  - `.entities` (Entity[])
  - `.add(entity) → entity`
  - `.remove(entity)`
  - `.find(id) → Entity | undefined`
  - `.systems` — array of `{ update(dt, world) }` objects. Push your own
    system here (movement, combat, AI). They run in array order in
    `World.update(dt)`.

### Camera (`js/iso/camera.js`)
- `class IsoCamera` — `{ x, y, viewportW, viewportH, mapW, mapH }`.
  - `.attach(canvasEl, world)` — wires up edge-scroll + WASD + arrow-key
    panning, plus mouse-position tracking. Idempotent.
  - `.detach()` — removes listeners.
  - `.update(dt)` — integrates key state, clamps.
  - `.clamp()` — keeps the camera inside the map bounds.

### Game (`js/iso/game.js`)
- `registerGame('iso', { init, cleanup })` — hooks into the existing game
  lifecycle in `js/shared/game-registry.js`. The `tab-btn-iso` button calls
  `switchTab('iso', this)` which fires this.
- `isoStart()` / `isoStop()` — public, idempotent. The game loop runs at
  `requestAnimationFrame` cadence with a `dt` (ms) delta passed to every
  system.

### Coordinate-system conventions
- **Tile-space**: integer `(col, row)`. `col` grows east-southeast, `row`
  grows west-southeast in screen terms — i.e. standard diamond layout.
- **World-space**: continuous pixels in the same axes as tile-space *but*
  measured in pixels. `tileToWorld(col, row)` returns the **center** of
  the diamond; the diamond's top vertex is `(x, y - ISO_TILE_H/2)`, bottom
  is `(x, y + ISO_TILE_H/2)`, left/right are `(x ± ISO_TILE_W/2, y)`.
- **Screen-space**: pixel `(sx, sy)` inside the canvas. `worldToScreen`
  applies the camera offset.

### Usage example

```js
// Place a unit at the tile the user clicked.
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const { col, row } = screenToTile(sx, sy, camera);
  if (!world.map.isPassable(col, row)) return;
  const { x, y } = tileToWorld(col, row);
  world.add(new Entity({ type: 'marine', x, y }));
});
```

---

## 7. HUD frame (placeholders only in this hoglet)

StarCraft-style command-panel layout. The DOM frame is in `index.html`; later
hoglets fill in functionality.

```
┌──────────────────────────────────────────────────────────┐
│ TOP BAR: minerals / gas / supply (placeholder)           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                  ISOMETRIC VIEWPORT                      │
│                                                          │
│                                                          │
├──────────────┬──────────────────────┬────────────────────┤
│   MINIMAP    │  SELECTION / PORTRAIT │  COMMAND GRID     │
│ (bottom-left)│   (bottom-center)     │  (bottom-right)   │
└──────────────┴──────────────────────┴────────────────────┘
```

CSS class prefix is `iso-` (e.g. `iso-hud`, `iso-minimap`, `iso-cmd-grid`).
Don't reuse `rts-*` — those belong to Deep Space Ops.

---

## 8. Rules of engagement for follow-up hoglets

- **Don't touch Deep Space Ops** (`#tab-cs`, `js/rts/*`, `css/rts.css`).
- **Don't add image assets.** All graphics are procedural.
- **Don't import a framework or 3D engine.** Canvas 2D only.
- **Don't introduce a build step.** Add `<script>` tags to `index.html`.
- Reuse colors from this file. If you need a new color, add it here first.
- Reuse coordinate utilities. If you need a new conversion, add it to
  `coords.js` and document it in this file.
- Keep individual JS files under ~600 lines (matches the rest of the repo).
