# Spice Wars — Dune II clone (integrated)

Real-time strategy on Arrakis. Three feature branches were integrated here:

- **terrain & map** (PR #96) — tile types, passability, build-on-rock, spice
- **units & combat** (PR #97) — A* pathfinding, harvest cycle, combat, AI
- **buildings, economy, HUD** (PR #98) — build queue, power, credits, log

## File layout

```
js/dune/
  config.js         — building catalog + starting credits
  state.js          — central DuneState; freshState / pushLog
  terrain.js        — tiles, passability, build/occupancy, spice
  pathfinding.js    — dunePath() A* over terrain
  units-config.js   — DUNE_UNITS catalog (infantry, vehicles, harvester)
  units.js          — sim + DuneUnits adapter (init/spawn/tick/queueUnit)
  input.js          — left-click select, right-click move/attack/harvest
  economy.js        — credits, storage, power
  buildings.js      — placement, queues, damage, win/lose, refinery lookup
  hud.js            — sidebar, build grid, unit grid, selected, log
  rendering.js      — canvas draw orchestration (terrain → buildings → units)
  game.js           — RAF loop, seed world, dt-based tick fan-out
  init.js           — registerGame('dune') lifecycle
```

Vanilla JS, loaded as plain `<script>` tags from `index.html`. State lives on
`window.DuneState.get()`; subsystems hang on `window.DuneTerrain`,
`window.DuneUnits`, `window.DuneBuildings`, `window.DuneEconomy`, `window.DuneHud`,
`window.DuneRendering`, `window.DuneGame`.

## Gameplay loop

1. Game starts: player and enemy each get a construction yard, wind trap, and
   refinery (which spawns one free harvester).
2. Harvester auto-routes to nearest spice tile, harvests, returns to refinery,
   credits flow into the economy.
3. Player queues buildings from the **CONSTRUCTION** panel — building must be
   placed on rock (concrete slabs can go on sand).
4. Once a barracks, light factory, or heavy factory exists, the **UNITS**
   panel populates. Click to produce — unit appears next to the producer.
5. Right-click an enemy unit to attack, an enemy building to siege.
6. Win: destroy every enemy building. Lose: lose your CY *and* every producer.

## Public surface (for future hoglets)

```js
DuneTerrain.tileAt(x, y) / isRock / isPassable / isSpice
DuneTerrain.isBuildable(x, y, w, h, opts)
DuneTerrain.markOccupied(x, y, w, h, id) / clearOccupied
DuneTerrain.findNearestSpice(fromX, fromY) / consumeSpice(x, y, amt)

DuneUnits.init({onSpiceDelivered})
DuneUnits.spawnUnit(type, tx, ty, owner)
DuneUnits.queueUnit(type, owner)
DuneUnits.tick(dtSeconds, world)
DuneUnits.buildableUnitsFor(owner)

DuneBuildings.add(type, x, y, owner, opts)
DuneBuildings.tryQueue(type, owner) / placePending / cancelPending
DuneBuildings.findRefineryNear(x, y, owner)
DuneBuildings.damage(id, amount, attacker)
DuneBuildings.checkWinLose()

DuneEconomy.recalcPower(owner) / recalcStorage(owner)
DuneEconomy.canAfford / spend / credit / snapshot
```

## Known gaps / follow-up

- Enemy AI is a stub — it only auto-attacks the player with starting units;
  it does not build buildings or produce new units. The enemy base sits idle.
- No fog of war. PR #96's fog module was dropped during integration because
  the units module assumes full world visibility for target acquisition.
- Single-screen camera (no scrolling). PR #96's camera/coords/mapgen modules
  were dropped — the integrated game fits the whole map in the viewport.
- Concrete slab placement on sand exists in the building catalog but doesn't
  yet "claim" the tile as buildable rock — slabs just consume one sand tile.
