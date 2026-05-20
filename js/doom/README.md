# DOOM — Nexus Games raycaster

A self-contained first-person shooter built on a Wolfenstein 3D / DOOM-style
DDA raycaster. Pure HTML5 Canvas + vanilla JS, no dependencies.

## Files

- `js/doom/game.js` — game logic, raycaster, sprite billboarding, AI, HUD.
- `css/doom.css` — styling for the canvas, minimap, hint, and HUD panels.
- The game registers under tab id `doom` and is launched from the **▼ DOOM**
  tab in the main hub (`/index.html`).

All textures (brick / metal / stone / exit portal), sprites (demon / ammo /
medkit / gun + muzzle flash), and sound effects (shoot / hurt / pickup /
victory) are generated procedurally — nothing is loaded from disk and nothing
copyrighted is shipped.

## How to play

1. Open the project's `index.html`.
2. Click the **▼ DOOM** tab.
3. Click the canvas to capture the mouse (pointer lock).
4. Survive the citadel.

| Action | Keys |
|---|---|
| Move | `W` `A` `S` `D` or `↑ ↓` |
| Strafe | `A` / `D` |
| Turn | mouse / `← →` |
| Sprint | `Shift` |
| Fire | mouse click |
| Release mouse | `Esc` |

**Win** by either reaching the glowing green exit portal or by purging every
demon in the citadel. **Lose** when your HP hits 0.

## How it works

### Raycasting (`doomRender`)

For each vertical screen column `x`:

1. Build a ray from the player's `dirX/dirY` rotated by `cameraX = 2*x/W − 1`
   along the camera plane `planeX/planeY`. The plane's length sets the FOV
   (here `|plane|=0.66` → ~66°).
2. Walk the 2D map grid with the standard DDA algorithm, advancing along
   whichever axis has the smaller `sideDist` until a non-zero map cell is hit.
3. The perpendicular wall distance gives the projected slice height
   (`H / perpWallDist`).
4. The hit point's fractional coordinate (`wallX`) becomes the `texX` into the
   64×64 pre-rendered wall texture canvas, and the whole column is drawn with
   a single `drawImage` slice.
5. Side shading + distance fog + a green exit pulse are layered on top.

The per-column `perpWallDist` is stashed in a `Float32Array` z-buffer used for
sprite occlusion.

### Sprites

Enemies and pickups are billboards. For each one we transform the world
offset into camera space using the inverse of the `(plane, dir)` matrix and
project onto the screen. Each vertical stripe is drawn only if its
`transformY` is closer than the wall behind it (`zBuffer[stripeX]`).

### Enemies

`doomUpdateEnemies` runs simple AI per demon:

- Line-of-sight check by stepping along the segment to the player; any wall
  cell blocks vision.
- If they see the player and are farther than `0.9` units, they walk toward
  the player at `1.4 u/s` with axis-separated collision.
- When within `1.4` units they bite for `8` HP on a `0.9` s cooldown.
- Demons have `50` HP. Pistol does `28` damage per shot — two-shot kills.

### Shooting

Hitscan from the player's eye along `dir`. For each alive enemy we compute
the forward projection (along `dir`) and the perpendicular offset (across
`dir`); enemies inside a `0.35`-unit half-width cone and closer than the
straight-ahead wall are valid targets. The closest valid enemy takes the
hit.

### Map

Levels are ASCII grids defined in `js/doom/levels.js` (`DOOM_LEVELS`).
`doomLoadLevel(index)` swaps the active grid and rebuilds spawn lists.

Tile glyphs:

- `1`/`2`/`3` — brick / metal / stone wall types
- `9` — exit tile (the only "wall" you can walk through; standing on it
  triggers level end)
- `P` — player spawn
- `E` — enemy spawn
- `A` — ammo crate pickup (+12 ammo)
- `M` — medkit pickup (+25 HP)
- `S` — shotgun pickup    (forward-compat with the weapons branch; +20 ammo here)
- `C` — chaingun pickup   (forward-compat; +30 ammo here)
- `R` — rocket pickup     (forward-compat; +10 ammo +25 HP here)
- `K` — armor pickup      (forward-compat; +35 HP here)
- `.` — empty floor

All rows in a level must be the same length. The engine treats
out-of-bounds reads as solid walls.

## Game flow

`js/doom/flow.js` adds a state machine that wraps the registered game:

```
title  → briefing → playing → death  → (restart) ↺
                            \→ victory (final level)
```

* **Title** — list of floors, "ENTER THE CITADEL" button, music toggle.
  Enter / Space to start, arrows to select floor.
* **Briefing** — 1.1s "FLOOR n / NAME / SUBTITLE" card.
* **Playing** — normal gameplay loop. Reaching the exit tile fires
  `doomEnd(true)` → flow advances to the next level.
* **Death** — "YOU DIED" card with **RESTART FLOOR** and **MAIN MENU**.
  `R` or Enter restarts; Esc returns to title.
* **Victory** — shown after the last floor with kill / HP / time stats.
  **NEW GAME** restarts from floor 1.

## Audio

* Per-level procedural music loop (`js/doom/audio.js`), started by
  `doomMusicStart(trackId)` and stopped on death / level transition /
  cleanup. Tracks: `doomMusicHangar`, `doomMusicPit`, `doomMusicSanctum`.
* SFX (synthesised in `js/shared/audio.js`):
  - `doomShoot`, `doomEmpty` — weapon fire / dry-click
  - `doomEnemyHurt`, `doomEnemyDie`, `doomBite` — combat
  - `doomPickup`, `doomMedkit`, `doomWeapon`, `doomArmor` — pickups
  - `doomDoor`, `doomDoorClose`, `doomExit` — doors / level switch
  - `doomLevelStart`, `doomMenuMove`, `doomMenuPick` — flow

Asset hooks (no files required to run, but real audio can drop in):

* `assets/doom/music/{e1m1,arena,sanctum}.ogg` — looping music tracks
* `assets/doom/sfx/{door_open,door_close,exit_switch}.wav` — SFX
