# DOOM — Nexus Games raycaster

A self-contained first-person shooter built on a Wolfenstein 3D / DOOM-style
DDA raycaster. Pure HTML5 Canvas + vanilla JS, no dependencies.

## Files

- `js/doom/game.js` — game logic, raycaster, sprite billboarding, player,
  pickups, HUD.
- `js/doom/enemies.js` — enemy archetypes, finite-state AI, BFS
  pathfinding, projectiles, hitscan damage routing. Exposed as
  `window.DoomEnemies`.
- `css/doom.css` — styling for the canvas, minimap, hint, and HUD panels.
- The game registers under tab id `doom` and is launched from the **▼ DOOM**
  tab in the main hub (`/index.html`).

All textures (brick / metal / stone / exit portal), sprites (demon / imp /
zombieman / fireball / ammo / medkit / gun + muzzle flash), and sound effects
(shoot / hurt / pickup / victory / rifle / fireball) are generated
procedurally — nothing is loaded from disk and nothing copyrighted is shipped.

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

`game.js` delegates all enemy behavior to `enemies.js`
(`window.DoomEnemies`). Three archetypes are shipped:

| Type | HP | Speed | Range | Attack | Damage |
|---|---|---|---|---|---|
| **demon** (`E`) | 60 | 1.6 | 1.3 (melee) | claw bite | 10 |
| **imp** (`I`) | 35 | 1.1 | 7.0 (projectile) | fireball (lobbed, 4.5 u/s) | 12 |
| **zombieman** (`Z`) | 25 | 0.9 | 10 (hitscan) | rifle, 65 % accuracy w/ falloff | 6 |

Every enemy runs the same finite-state machine:

```
        ┌────────────────────────────┐
        ▼                            │
   ┌─ IDLE ──[LOS + range]──► CHASE ─┤
   │                  │              │
   │                  ▼              │
   │              ATTACK ─[fire]─────┤
   │                                 │
[hit dmg] (pain chance)              │
   │                                 │
   └──► PAIN ─[stun ends]────────────┘
                                     │
                  [hp ≤ 0]           │
                     │               │
                     ▼               │
                  DYING ──[0.7 s]──► DEAD
```

- **Line of sight** is checked by stepping the segment between the enemy
  and the player in 0.1-unit increments; any wall cell blocks vision.
- **Pathfinding** uses a bounded BFS over walkable grid cells (refreshed
  roughly twice per second per enemy) to find the next tile to walk to
  when the player is not visible — keeps enemies from wedging on
  corners. With LOS, the enemy chases the player directly (and backs off
  to its `preferredRange` if a ranged unit gets too close).
- **Damage routing** is one-way: `DoomEnemies.applyHitscan(state, env,
  damage, halfWidth)` is called by the player's gun; enemies hurt the
  player through the `env.hurtPlayer(amount, kind)` callback that
  `game.js` supplies — `enemies.js` never touches the host's globals
  directly. Pistol does 28 damage / shot so it's a one-shot zombie, two
  shots on an imp, three on a demon.
- **Projectiles** (imp fireballs) live in `doomState.projectiles`; each
  tick they advance, collide with walls (and disappear with an impact
  sound), and check player proximity for damage.

### Shooting

Hitscan from the player's eye along `dir`. For each alive enemy we compute
the forward projection (along `dir`) and the perpendicular offset (across
`dir`); enemies inside a `0.35`-unit half-width cone and closer than the
straight-ahead wall are valid targets. The closest valid enemy takes the
hit.

### Map

The level is defined in `DOOM_MAP_SRC` as a 16×16 ASCII grid:

- `1`/`2`/`3` — brick / metal / stone wall types
- `9` — exit tile (the only "wall" you can walk through; standing on it
  triggers victory)
- `P` — player spawn
- `E` — demon spawn (melee)
- `I` — imp spawn (projectile)
- `Z` — zombieman spawn (hitscan)
- `A` — ammo crate pickup (+12 ammo)
- `M` — medkit pickup (+25 HP)
- `.` — empty floor

Edit `DOOM_MAP_SRC` in `js/doom/game.js` to change the layout.
