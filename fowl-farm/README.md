# Fowl Farm

An idle egg-hatching farm game. This directory holds the **foundation** hoglet:
core game state, persistence, the idle production loop, and a minimal HUD.
Subsequent hoglets stack on top to add the farm view (sprites) and the
incubator/upgrade UI.

## Run

No build step. Open `index.html` in a modern browser. Because the code uses
ES modules, some browsers block `file://` module loading — if that's the case
serve the directory with any static server, e.g.:

```sh
python3 -m http.server -d fowl-farm 8000
# then visit http://localhost:8000/
```

## What's implemented

- **Game state model** (`src/state.js`) — single `GameState` object matching
  the spec: `birds`, `eggs`, `pendingEggs`, `incubators` (2 empty slots),
  `coopCapacity` (6), `incubatorSlots` (2), `incubatorSpeedMultiplier` (1),
  `lastTickAt`, `resources.coins`, and a private `_eggProgress` accumulator.
- **Starting flock** — 2 chickens + 1 goose, scattered inside the notional
  600×400 farm area. Each bird has `{ id, type, x, y }`.
- **Bird stats** (`src/birds.js`) — exactly as spec'd:
  - Chicken: 1.0 eggs/min · 20s hatch · 1 coin per egg
  - Goose:   0.4 eggs/min · 60s hatch · 5 coins per egg
- **Idle production loop** (`src/loop.js` + `src/eggs.js`) — requestAnimationFrame
  driven, `dt = now - lastTickAt`, fractional eggs accumulate per-type at
  `eggsPerMinute / 60000 * count * dt`. When the accumulator crosses 1.0, one
  `pendingEggs[type]` is added.
  - **Pending cap**: `max(20, birdsOfType * 5)` per type. Anything beyond the
    cap is lost — collect more often. Documented in `state.js#pendingCapFor`.
  - **No offline catch-up**: on load, `lastTickAt` is reset to "now" and
    `_eggProgress` starts at 0. Per the v1 assumptions.
  - **Tab-pause clamp**: per-frame `dt` is clamped to 1000ms so a backgrounded
    tab doesn't dump a huge delta on the next frame.
- **Persistence** (`src/state.js`) — `localStorage` key `fowlFarm:v1`,
  versioned (`version: 1`). Auto-saves on a 5s debounce after any state
  change, and on `beforeunload` / `visibilitychange → hidden`. On a version
  mismatch we log a warning and start a fresh game.
- **Minimal HUD** (`src/ui.js`) — chicken/goose counts, pending+collected
  egg counts per type, coin balance, **Collect Eggs** button (disabled when
  nothing is pending), and a **Reset Game** button with a confirm prompt.
- **Reserved placeholders** — `<div id="farm-view">` and
  `<div id="incubator-panel">` are present in `index.html` but currently
  render dashed-border placeholder cards. Extension points are documented
  inline in `src/main.js`.

## How to verify acceptance

1. Open `index.html`. HUD shows: 2 chickens, 1 goose, 0/0 eggs, 0 coins.
2. Leave the tab open ~30 seconds. Pending chicken eggs reach ~0–1 (chickens
   produce ~1/min = 1 every 60s for two of them ⇒ ~1 egg per 30s). Goose
   pending stays at 0 for the first ~2.5 minutes (0.4/min ⇒ 1 egg / 150s).
3. Click **Collect Eggs**. The pending counters drop to 0; the collected
   counters and coins increase. `chickenCollected * 1 + gooseCollected * 5
   == coinsEarned`.
4. Refresh the page. Bird counts, egg inventory, and coin total persist.
5. Click **Reset Game**, confirm. The flock returns to 2 chickens + 1 goose
   and counters reset to zero.

In the devtools console, `window.__fowlFarm.getState()` returns the live
state object, and `window.__fowlFarm.forceSave()` flushes the debounced save.

## Where to extend (next hoglets)

| Hoglet | Hook |
| --- | --- |
| Farm view / sprites | Replace `#farm-view` in `index.html`. Read `state.birds` (each has `x, y`); use the existing tick callback in `src/main.js` if you need per-frame animation. |
| Incubator UI | Replace `#incubator-panel` in `index.html`. Operate on `state.incubators` (an array of length `state.incubatorSlots`, with `null` meaning empty). Use `scheduleAutoSave(state)` from `src/state.js` after any mutation. |
| Upgrades | Spend `state.resources.coins`. Suggested first targets: `coopCapacity`, `incubatorSlots`, `incubatorSpeedMultiplier`. |

## Design notes / deviations

- **Repo layout**: the rest of `nexus-games` is a single `index.html` with
  per-game `js/<game>/` and `css/<game>.css`. The spec asked for a
  self-contained `src/state.js`, `src/birds.js`, …, so per the spec's
  fallback ("create the game at `fowl-farm/` at the repo root") this hoglet
  is self-contained under `fowl-farm/`. The follow-up "view" hoglet can
  either keep this layout or merge into the main shell — its call.
- **Pending cap**: chose `max(20, birdsOfType * 5)` so a growing flock still
  has headroom but unattended sessions can't accumulate forever.
- **No bundler**: native ES modules, no Vite. Keeps the foundation runnable
  by just opening `index.html` (with a tiny static server when modules are
  blocked from `file://`).
- **`_eggProgress` is not persisted**: the spec says "v1 does NOT do offline
  catch-up", so we intentionally drop the fractional accumulator on save. At
  most ~1 egg of progress per type is lost across a session boundary.
