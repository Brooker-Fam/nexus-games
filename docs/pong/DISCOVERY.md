# Atari Pong discovery — Nexus Games

Purpose: map the existing `brooker-fam/nexus-games` repo so follow-up hoglets can add Pong without colliding. This PR intentionally does **not** implement Pong or change the game index.

## 1. Repo layout

Top-level layout in this checkout:

```text
api/                 Vercel serverless auth/session/stats endpoints
css/                 Global and per-game CSS (`base.css`, `td.css`, `rts.css`, `snake.css`, `fish.css`)
docs/                Architecture docs; this discovery lives in `docs/pong/`
js/                  Browser game/runtime code
  shared/            Shared audio, auth UI/client, stats sync, tab registry, background UI
  td/                Void Fortress tower defense code
  rts/               Deep Space Ops RTS code
  snake/             Nexus Snake code
  fish/              Fish Frenzy code
lib/                 Server-side auth/db helpers
migrations/          SQL migrations used by `scripts/migrate.js`
scripts/             Build helpers for PostHog config, source maps, migrations
index.html           Single-page arcade entry point and all game tab markup
profile.html         Account/profile page
vercel.json          Vercel build/static output config
package.json         npm scripts and server/API dependencies
```

Games do **not** live as standalone `games/<name>/index.html` pages. They are tabs inside the root `index.html`, with per-game JS under `js/<game>/` and per-game CSS under `css/<game>.css`.

Shared assets are mostly generated at runtime:

- Visuals: Canvas 2D drawing in game JS; no image asset directory.
- Audio: procedural Web Audio in `js/shared/audio.js`.
- Fonts: Google Fonts loaded from `index.html` when not using `file:`.
- Shared layout/theme: CSS variables and tab shell in `css/base.css`.

## 2. Tech stack

- Frontend: vanilla HTML/CSS/JavaScript. No React/Vue/Svelte/etc.
- Browser script style: classic `<script src="...">` tags, not ES modules. Functions/constants become page globals, so name collisions matter.
- Rendering: Canvas 2D for all games inspected.
- Bundler: none. `vercel.json` serves the repo root as static output (`"outputDirectory": "."`).
- Package manager: npm; `package-lock.json` is lockfileVersion 3.
- Node version: not pinned. No `.nvmrc`, `.node-version`, or `engines.node` in `package.json`. Verification was run with Node `v24.15.0` and npm `11.12.1`.
- Build script: `npm run build` runs `scripts/generate-posthog-config.cjs`, `scripts/generate-sourcemaps.cjs`, then `scripts/migrate.js`.
- Dev server: `package.json` has `"dev": "vercel dev"`, but `vercel` is not a dependency in this repo; it requires a globally installed or `npx` Vercel CLI and Vercel auth for serverless emulation.
- Tests: no test script in `package.json`; `npm test --if-present` exits successfully as a no-op.
- Lint/format: no ESLint, Prettier, Jest, Vitest, Vite, or Webpack config files found.
- CI: no `.github/workflows/` directory exists.

Relevant `package.json` excerpt:

```json
{
  "type": "module",
  "scripts": {
    "migrate": "node scripts/migrate.js",
    "build": "node scripts/generate-posthog-config.cjs && node scripts/generate-sourcemaps.cjs && node scripts/migrate.js",
    "dev": "vercel dev"
  }
}
```

## 3. How a game is structured

### Example A: Nexus Snake

File layout:

```text
index.html                 Tab button, tab panel, HUD, canvas, overlay, speed buttons
css/snake.css              Snake-specific canvas and hint styles
js/snake/game.js           State, input, simulation, drawing, loop, lifecycle registration
js/init.js                 Tab click handler and reset/speed button wiring
js/shared/game-registry.js Shared lifecycle registry used by all tabs
```

Entry HTML is inline in `index.html`:

```html
<button class="tab" id="tab-btn-snake">▣ SNAKE</button>
...
<div id="tab-snake" class="tab-content">
  ...
  <canvas id="snakeCanvas" width="720" height="480"></canvas>
  <div class="overlay" id="snakeOverlay">...</div>
</div>
```

Script loading is manual and order-dependent:

```html
<!-- Nexus Snake -->
<script src="js/snake/game.js"></script>

<!-- Init -->
<script src="js/init.js"></script>
```

JS module pattern: no import/export. `js/snake/game.js` declares globals prefixed with `snake` / `SNAKE_`:

```js
const snakeCanvas = document.getElementById('snakeCanvas');
const snakeCtx = snakeCanvas.getContext('2d');
const SNAKE_CONFIG = { cell: 24, cols: 30, rows: 20, ... };
let snakeState = {...SNAKE_DEFAULTS, snake: []};
```

Start/lifecycle: Snake does not export a separate `start` function. It registers an `init()` callback; activating the tab starts the game loop.

```js
registerGame('snake', {
  init(){
    snakeInitState();
    snakeUpdateHUD();
    document.addEventListener('keydown', snakeOnKey);
    if(!snakeRaf) snakeRaf = requestAnimationFrame(snakeGameLoop);
  },
  cleanup(){
    document.removeEventListener('keydown', snakeOnKey);
    if(snakeRaf){ cancelAnimationFrame(snakeRaf); snakeRaf = null; }
  },
});
```

Input: document-level `keydown` handles arrows/WASD and is removed on cleanup.

```js
case 'ArrowUp': case 'w': case 'W':    nd = {x: 0, y:-1}; break;
case 'ArrowDown': case 's': case 'S':  nd = {x: 0, y: 1}; break;
```

Rendering/game loop: fixed timestep accumulator on `requestAnimationFrame`; drawing is Canvas 2D.

```js
function snakeGameLoop(ts){
  const dt = Math.min(ts - snakeLastTime, 100);
  snakeAccum += dt * snakeState.speed;
  while(snakeAccum >= SNAKE_TARGET_MS){ snakeTick(); snakeAccum -= SNAKE_TARGET_MS; }
  snakeDraw();
  snakeRaf = requestAnimationFrame(snakeGameLoop);
}
```

Styling: `css/snake.css` only has a few Snake-specific selectors, reusing shared `.game-area`, `.canvas-wrap`, `.sidebar`, `.panel`, `.overlay`, and `.speed-btn` styles from `css/td.css`/`css/base.css`.

```css
#snakeCanvas {
  display: block;
  width: 100%;
  max-width: 720px;
  border: 1px solid var(--panel-border);
  background: #020810;
}
```

### Example B: Fish Frenzy

File layout:

```text
index.html               Tab button, tab panel, HUD, canvas, overlay, instructions
css/fish.css             Fish-specific layout, overlay, meter, responsive rules
js/fish/game.js          State, input, simulation, drawing, loop, lifecycle registration
js/init.js               Tab click handler and restart button wiring
js/shared/game-registry.js Shared lifecycle registry
```

Entry HTML is inline in `index.html`:

```html
<button class="tab" id="tab-btn-fish">≋ FISH FRENZY</button>
...
<div id="tab-fish" class="tab-content">
  <canvas id="fishCanvas" width="900" height="520"></canvas>
  <div class="fish-overlay" id="fishOverlay">...</div>
</div>
```

Script loading:

```html
<!-- Fish Frenzy -->
<script src="js/fish/game.js"></script>

<!-- Init -->
<script src="js/init.js"></script>
```

JS module pattern: no import/export; globals are prefixed with `fish` / `FISH_`.

```js
const fishCanvas = document.getElementById('fishCanvas');
const fishCtx = fishCanvas.getContext('2d');
const FISH_CONFIG = { startSize: 14, winSize: 95, maxFish: 18, ... };
const fishState = { player: {...}, mouse: {...}, fishes: [], ... };
```

Start/lifecycle: tab activation calls `init()` and starts `fishGameLoop`; cleanup removes canvas input listeners and cancels RAF.

```js
registerGame('fish', {
  init(){
    fishInitState();
    fishUpdateHUD();
    fishCanvas.addEventListener('mousemove', fishOnMouseMove);
    fishCanvas.addEventListener('touchmove', fishOnTouchMove, { passive: false });
    if(!fishRaf) fishRaf = requestAnimationFrame(fishGameLoop);
  },
  cleanup(){
    fishCanvas.removeEventListener('mousemove', fishOnMouseMove);
    fishCanvas.removeEventListener('touchmove', fishOnTouchMove);
    if(fishRaf){ cancelAnimationFrame(fishRaf); fishRaf = null; }
  },
});
```

Input: pointer/touch position is mapped to canvas coordinates.

```js
const rect = fishCanvas.getBoundingClientRect();
const sx = FISH_W / rect.width;
fishState.mouse.x = (e.clientX - rect.left) * sx;
fishState.mouse.inside = true;
```

Rendering/game loop: Canvas 2D drawing every RAF frame; simulation consumes capped `dt`.

```js
function fishGameLoop(ts){
  const dt = Math.min(ts - fishLastTime, 100);
  fishLastTime = ts;
  fishTick(dt);
  fishDraw();
  fishRaf = requestAnimationFrame(fishGameLoop);
}
```

Styling: `css/fish.css` scopes many rules to Fish-specific class names, but also uses shared `.game-header`, `.game-title`, `.game-stats`, `.panel`, and CSS variables.

```css
.fish-area { display:grid; grid-template-columns: 1fr 220px; gap:16px; }
#fishCanvas { width:100%; border:1px solid var(--panel-border); cursor: none; }
.fish-overlay.show { display:flex; }
```

## 4. Game index / navigation

There is no data-driven game list and no folder convention. Navigation is hard-coded across these files:

- `index.html`: CSS links, tab buttons, tab content panels, and script tags.
- `js/shared/game-registry.js`: generic registry (`registerGame`, `activateGame`, `switchTab`).
- `js/init.js`: tab button click handlers and per-game UI event wiring.

Current tab list in `index.html`:

```html
<div class="tabs">
  <button class="tab active" id="tab-btn-td">⬡ TOWER DEFENSE</button>
  <button class="tab" id="tab-btn-cs">◈ DEEP SPACE OPS</button>
  <button class="tab" id="tab-btn-snake">▣ SNAKE</button>
  <button class="tab" id="tab-btn-fish">≋ FISH FRENZY</button>
  <button class="tab" id="tab-btn-exc">⚠ MAKE EXCEPTION</button>
</div>
```

Registry shape in `js/shared/game-registry.js`:

```js
const games = {};
function registerGame(tabId, game){ games[tabId] = game; }
function activateGame(tabId){
  if(activeGame && games[activeGame] && games[activeGame].cleanup) games[activeGame].cleanup();
  activeGame = tabId;
  if(games[tabId] && games[tabId].init) games[tabId].init();
}
```

Precise changes needed later for Pong to appear:

1. `index.html`: add `<link rel="stylesheet" href="css/pong.css">` after existing game CSS links.
2. `index.html`: add `<button class="tab" id="tab-btn-pong">◫ PONG</button>` in `.tabs`.
3. `index.html`: add `<div id="tab-pong" class="tab-content">...</div>` under `<main>` with Pong HUD/canvas/controls.
4. `index.html`: add `<script src="js/pong/game.js"></script>` after Fish/Snake scripts and before `js/init.js`.
5. `js/pong/game.js`: call `registerGame('pong', { init(){...}, cleanup(){...} })`.
6. `js/init.js`: add a click handler for `tab-btn-pong` that calls `switchTab('pong', this)` and captures `game_tab_switched` if PostHog is present.

## 5. Build / run / test commands

Commands to use from repo root:

```bash
npm ci
npm run build
npm test --if-present
```

Verified on 2026-05-14:

- `npm ci` completed successfully. npm reported 10 vulnerabilities in transitive dependencies (3 moderate, 7 high); no dependency changes were made.
- `npm run build` completed successfully. It generated ignored `js/posthog-config.js` and `js/**/*.js.map`; with no `DATABASE_URL`, migrations were skipped by design.
- `npm test --if-present` completed successfully as a no-op because no test script exists.

Run commands:

```bash
# Static game-only smoke test; does not emulate /api serverless routes.
python3 -m http.server 4173
# then open http://127.0.0.1:4173/index.html

# Vercel/serverless local dev, if Vercel CLI is installed and authenticated.
npm run dev
# or: npx -y vercel@latest dev
```

Verified run behavior on 2026-05-14:

- `python3 -m http.server 4173` served `index.html` successfully; `curl -I http://127.0.0.1:4173/index.html` returned `HTTP/1.0 200 OK`.
- `npm run dev` failed in this environment with `sh: 1: vercel: not found` because the Vercel CLI is not installed by `package.json`.
- `npx -y vercel@latest dev --listen 127.0.0.1:3000` reached the Vercel login flow and waited for authentication; serverless dev was not completed without credentials.

CI workflows: none found; `.github/workflows/` does not exist.

Build gotcha: `scripts/generate-sourcemaps.cjs` appends `//# sourceMappingURL=...` to tracked `.js` files when absent. During verification it dirtied a few tracked JS files; those generated edits were reverted so this PR remains docs/scaffolding only.

## 6. Existing games inventory

Regression checklist for follow-up hoglets:

| Game | Paths | One-line description |
| --- | --- | --- |
| Void Fortress / Tower Defense | `index.html` `#tab-td`, `css/td.css`, `js/td/logic.js`, `js/td/towers.js`, `js/td/rendering.js` | Canvas tower defense: place towers, send waves, defend lives, manage gold/score/speed. |
| Deep Space Ops | `index.html` `#tab-cs`, `css/rts.css`, `js/rts/*.js` | Canvas RTS with faction selection, reveal animation, AI skirmish, PeerJS multiplayer, rating/stats. |
| Nexus Snake | `index.html` `#tab-snake`, `css/snake.css`, `js/snake/game.js` | Canvas Snake with WASD/arrow input, speed buttons, local best score. |
| Fish Frenzy | `index.html` `#tab-fish`, `css/fish.css`, `js/fish/game.js` | Canvas fish-eating growth game with mouse/touch control, win/lose overlay, local best score. |
| Make Exception tab button | `index.html` `#tab-btn-exc`, `js/init.js` | Not a game; intentionally throws an exception to exercise PostHog exception capture. |

## 7. PostHog status

PostHog is already wired in manually; `posthog-js` is **not** an npm dependency.

Integration points found:

- `index.html` loads generated config and the PostHog snippet:

```html
<script src="js/posthog-config.js"></script>
<script>
  ...
  if(window.POSTHOG_TOKEN){
    posthog.init(window.POSTHOG_TOKEN,{api_host:window.POSTHOG_HOST,defaults:'2026-01-30',capture_exceptions:true});
  }
</script>
```

- `scripts/generate-posthog-config.cjs` writes `js/posthog-config.js` from environment variables:

```js
const token = process.env.POSTHOG_TOKEN || '';
const host = process.env.POSTHOG_HOST || '';
const output = `window.POSTHOG_TOKEN=${JSON.stringify(token)};\nwindow.POSTHOG_HOST=${JSON.stringify(host)};\n`;
```

- `.gitignore` excludes `js/posthog-config.js` and `js/**/*.js.map`.
- `package.json`/`vercel.json` run the config generator during build.
- Existing event captures include:
  - `game_tab_switched` in `js/init.js`
  - `td_tower_placed`, `td_wave_started`, `td_game_ended`, `td_game_restarted` in `js/td/logic.js`
  - `dso_game_started`, `dso_faction_selected`, `mp_game_hosted`, `mp_game_joined`, `dso_game_ended` across `js/init.js` and `js/rts/game.js`
  - `snake_game_started`, `snake_food_eaten`, `snake_game_ended`, `snake_game_restarted` in `js/snake/game.js`
  - `fish_game_started`, `fish_game_ended`, `fish_game_restarted` in `js/fish/game.js`
- Survey-specific code: no custom survey UI/hooks found. The PostHog snippet stubs methods such as `getSurveys`, `renderSurvey`, and `canRenderSurvey`, but no game code calls them.
- Env names found: `POSTHOG_TOKEN`, `POSTHOG_HOST`. No `POSTHOG_KEY` or `NEXT_PUBLIC_POSTHOG_KEY` usage found.
- `posthog-setup-report.md` documents the earlier analytics setup and dashboard/insight links.

## 8. Recommended Pong location

Follow the current tab convention rather than creating a standalone `games/pong/index.html` route.

Recommended future files:

```text
css/pong.css          Pong-specific styles, preferably scoped under `#tab-pong` / `.pong-*`
js/pong/game.js       Pong state, input, rendering, fixed-timestep loop, lifecycle registration
docs/pong/            Discovery/implementation notes only
```

Exact future `index.html` diff shape:

```diff
 <link rel="stylesheet" href="css/snake.css">
 <link rel="stylesheet" href="css/fish.css">
+<link rel="stylesheet" href="css/pong.css">
 ...
   <button class="tab" id="tab-btn-snake">▣ SNAKE</button>
   <button class="tab" id="tab-btn-fish">≋ FISH FRENZY</button>
+  <button class="tab" id="tab-btn-pong">◫ PONG</button>
   <button class="tab" id="tab-btn-exc">⚠ MAKE EXCEPTION</button>
 ...
+<!-- ATARI PONG -->
+<div id="tab-pong" class="tab-content">
+  <div class="game-header">...</div>
+  <div class="game-area pong-area">
+    <div class="canvas-wrap pong-canvas-wrap">
+      <canvas id="pongCanvas" width="900" height="520"></canvas>
+      <div class="overlay" id="pongOverlay">...</div>
+    </div>
+    <div class="sidebar pong-sidebar">...</div>
+  </div>
+</div>
 ...
 <!-- Fish Frenzy -->
 <script src="js/fish/game.js"></script>
+
+<!-- Atari Pong -->
+<script src="js/pong/game.js"></script>
 
 <!-- Init -->
 <script src="js/init.js"></script>
```

Exact future `js/init.js` registration diff shape:

```diff
 document.getElementById('tab-btn-fish').onclick=function(){
   switchTab('fish', this);
   if(window.posthog) posthog.capture('game_tab_switched', { tab: 'fish' });
 };
+document.getElementById('tab-btn-pong').onclick=function(){
+  switchTab('pong', this);
+  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'pong' });
+};
```

Exact future `js/pong/game.js` lifecycle shape:

```js
registerGame('pong', {
  init(){
    pongInitState();
    pongAttachInput();
    if(!pongRaf) pongRaf = requestAnimationFrame(pongGameLoop);
  },
  cleanup(){
    pongDetachInput();
    if(pongRaf){ cancelAnimationFrame(pongRaf); pongRaf = null; }
  },
});
```

This discovery PR only adds `js/pong/README.md` as a placeholder. It does not add Pong CSS/JS/HTML yet.

## 9. Parallelization plan

After this PR merges, these scopes can run in parallel if they respect file ownership:

1. **Pong shell + index integration**
   - Owns: `index.html`, `css/pong.css` initial layout, `js/init.js` Pong tab handler.
   - Adds tab button, tab panel, script tag, CSS link, reset/difficulty button wiring.
   - Should not implement game physics beyond placeholders needed for shell smoke test.

2. **Pong core simulation + Canvas rendering**
   - Owns: `js/pong/game.js` internals for state, ball/paddle physics, collisions, scoring, fixed-timestep loop, draw functions.
   - Touches `index.html` only if shell did not already create required element IDs; coordinate with scope 1 to avoid collisions.

3. **Pong input + AI difficulty tiers**
   - Owns: `js/pong/game.js` input/AI sections only, or a separate future `js/pong/ai.js` if the shell adds that script tag.
   - Implements keyboard/mouse/touch player controls and 3 AI tiers.
   - Avoids `index.html` except for control labels/buttons agreed with scope 1.

4. **PostHog analytics + survey hook points**
   - Owns: Pong-specific capture calls in `js/pong/game.js`; may touch `js/init.js` only for tab switch event if not done by scope 1.
   - Suggested events: `pong_game_started`, `pong_point_scored`, `pong_difficulty_changed`, `pong_game_ended`, `pong_game_restarted`.
   - Survey hooks should be no-op guarded (`if(window.posthog && posthog.getActiveMatchingSurveys)`) unless a survey UX is explicitly designed.

5. **Regression sweep + docs update**
   - Owns: `docs/pong/` updates and manual test notes only.
   - Verifies TD, DSO, Snake, Fish still activate/cleanup after Pong is added.
   - Should not change game implementation files unless filing a separate fix.

To minimize conflicts, scope 1 should land the DOM/CSS/script skeleton first, then scopes 2–4 can work mostly inside `js/pong/game.js`.

## 10. Risks / gotchas

- **Shared globals:** Browser scripts are classic globals. Use a strict `pong` / `PONG_` prefix for all functions, constants, RAF handles, and state. Avoid generic names like `state`, `canvas`, `ctx`, `TARGET_MS`, or `gameLoop` because existing games already use some of these globally.
- **CSS bleed:** Shared classes such as `.game-header`, `.game-title`, `.game-area`, `.sidebar`, `.panel`, `.overlay`, and `.speed-btn` are used by multiple games. Scope new styles under `#tab-pong` or `.pong-*` unless intentionally reusing shared styles.
- **Tab lifecycle:** New games must call `registerGame('pong', ...)`; cleanup must cancel RAF and remove global/canvas event listeners or Pong will keep running after tab switches.
- **Script order:** `js/shared/game-registry.js` must load before `js/pong/game.js`; `js/pong/game.js` must load before `js/init.js` if `init.js` wires Pong buttons by ID/function name.
- **Index is manual:** There is no central game array. Missing any one of CSS link, tab button, tab panel, script tag, registry call, or `init.js` handler will make Pong partially broken.
- **Build side effects:** `npm run build` may append source map comments to tracked JS files via `scripts/generate-sourcemaps.cjs`. Do not include those incidental edits in Pong PRs unless intentionally normalizing source map comments.
- **Generated files:** `js/posthog-config.js` and `js/**/*.js.map` are ignored build artifacts. Do not commit them.
- **Dev command:** `npm run dev` assumes a `vercel` binary outside the repo. For quick front-end-only checks, a static server is enough; for API/auth/stats checks, use authenticated Vercel CLI.
- **PostHog guard style:** Existing code guards calls with `if(window.posthog)`. Pong should do the same so local/static runs work without `POSTHOG_TOKEN`.
- **Stats/auth coupling:** Shared `js/shared/stats-sync.js` and auth code load on the page. Pong should not reuse existing game IDs until a deliberate stats integration plan is made.
