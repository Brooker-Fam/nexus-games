# Power-Up Pong discovery

Time-boxed discovery for adding a future Power-Up Pong game to `Brooker-Fam/nexus-games`. Discovery only; no game code was changed.

## 1. Repo type & framework

- **Project type:** Single-page browser arcade with multiple canvas games plus small Vercel serverless API endpoints.
- **Frontend:** Vanilla JavaScript loaded directly by `<script>` tags from `index.html`; no React/Vue/Svelte/etc.
- **Rendering/audio:** Canvas 2D for games; Web Audio API helpers in `js/shared/audio.js`.
- **Backend/API:** Vercel serverless functions under `api/` with shared server modules under `lib/` and SQL migrations under `migrations/`.
- **Language/module style:** Browser scripts are plain/global JavaScript. `package.json` has `"type": "module"` for Node-side scripts/APIs.
- **Build/hosting:** Vercel. `npm run build` runs PostHog config generation, sourcemap generation, and DB migrations.
- **Package manager:** npm (`package-lock.json` is present). There is no bundler such as Vite/Webpack/Rollup.

Primary files:

- `index.html` — single-page markup, tabs, game containers, script load order, PostHog snippet.
- `css/*.css` — global and per-game styles.
- `js/shared/game-registry.js` — lifecycle registry used by tabs.
- `js/<game>/...` — per-game implementation files.
- `api/`, `lib/`, `migrations/` — Vercel API/auth/stats/database support.

## 2. Game registration pattern

Games are registered manually, not auto-discovered.

Mechanism:

1. `index.html` declares a tab button with an id like `tab-btn-snake` and a corresponding content container with an id like `tab-snake`.
2. `index.html` manually loads CSS and JavaScript files in dependency order.
3. `js/shared/game-registry.js` provides global `registerGame(tabId, { init, cleanup })`, `activateGame(tabId)`, and `switchTab(id, btn)` functions.
4. Each game calls `registerGame(...)` from its script, using the same tab id suffix used in `index.html`.
5. `js/init.js` wires tab button clicks to `switchTab(...)` and starts the default game with `activateGame('td')`.

Registry core (`js/shared/game-registry.js`):

```js
const games = {};
let activeGame = null;

function registerGame(tabId, game){
  games[tabId] = game;
}

function activateGame(tabId){
  if(activeGame && games[activeGame] && games[activeGame].cleanup){
    games[activeGame].cleanup();
  }
  activeGame = tabId;
  if(games[tabId] && games[tabId].init){
    games[tabId].init();
  }
}
```

Example existing game registration (`js/snake/game.js`):

```js
registerGame('snake', {
  init(){
    snakeInitState();
    snakeUpdateHUD();
    document.getElementById('snakeOverlay').classList.remove('show');
    document.addEventListener('keydown', snakeOnKey);
    snakeLastTime = performance.now();
    snakeAccum = 0;
    if(!snakeRaf) snakeRaf = requestAnimationFrame(snakeGameLoop);
    if(window.posthog) posthog.capture('snake_game_started', {});
  },
  cleanup(){
    document.removeEventListener('keydown', snakeOnKey);
    if(snakeRaf){ cancelAnimationFrame(snakeRaf); snakeRaf = null; }
  },
});
```

Important manual places a new game likely needs updates:

- `index.html`: add tab button, tab content DOM, CSS link, and script tag(s).
- `js/init.js`: add tab click handler calling `switchTab('<new-id>', this)` and any DOM event handlers.
- `css/<new-game>.css`: per-game styles, if needed.
- `js/<new-game>/...`: implementation that calls `registerGame('<new-id>', ...)`.

## 3. Per-game file layout

Current game code lives under `js/` with one directory per larger game and single-file implementations for smaller games:

- Tower Defense / Void Fortress:
  - `js/td/logic.js` — state, gameplay, lifecycle registration for `td`.
  - `js/td/towers.js` — tower drawing/preview helpers.
  - `js/td/rendering.js` — rendering helpers.
  - `css/td.css` — styles.
  - HTML lives inline in the `#tab-td` section of `index.html`.
- Deep Space Ops / RTS:
  - `js/rts/*.js` — many specialized files (`camera.js`, `commands.js`, `entities.js`, `game.js`, `multiplayer.js`, rendering, units, structures, etc.).
  - Registration is currently in `js/init.js` via `registerGame('cs', ...)`, not in `js/rts/game.js`.
  - `css/rts.css` — styles.
  - HTML lives inline in the `#tab-cs` section of `index.html`.
- Snake:
  - `js/snake/game.js` — gameplay, rendering, lifecycle registration for `snake`.
  - `css/snake.css` — styles.
  - HTML lives inline in the `#tab-snake` section of `index.html`.
- Fish Frenzy:
  - `js/fish/game.js` — gameplay, rendering, lifecycle registration for `fish`.
  - `css/fish.css` — styles.
  - HTML lives inline in the `#tab-fish` section of `index.html`.

Assets: no dedicated static image/audio asset folders were found. Existing games appear to use procedural Canvas graphics and Web Audio. External runtime assets include Google Fonts and PeerJS CDN for RTS multiplayer.

Tests: no test files were found during this time-box.

Likely Power-Up Pong shape, following the smallest existing games:

- `css/pong.css`
- `js/pong/game.js`
- a new `#tab-pong` DOM section in `index.html`
- a `registerGame('pong', { init(){...}, cleanup(){...} })` call in `js/pong/game.js`
- a tab handler in `js/init.js`

## 4. Test harness

No JavaScript test runner appears to be configured.

Evidence:

- `package.json` has scripts for `migrate`, `build`, and `dev`, but no `test`, `lint`, or `typecheck` script.
- No files matching `*test*` or `*spec*` were found in the repository during this discovery pass.
- `docs/architecture.md` also lists "No tests" as known technical debt.

Current local test command: **TBD / none configured**. `npm test` is expected to fail unless a script is added.

Where tests should live if added: TBD. Given the current layout, colocating tests near game code (for example `js/pong/game.test.js`) or adding a top-level `tests/` directory would both be new conventions.

## 5. Dependencies & PostHog

PostHog is already integrated at runtime, but `posthog-js` is **not** an npm dependency.

Current PostHog setup:

- `index.html` loads `js/posthog-config.js` and embeds the PostHog browser snippet directly in the page head.
- `scripts/generate-posthog-config.cjs` writes `js/posthog-config.js` from `POSTHOG_TOKEN` and `POSTHOG_HOST` environment variables.
- `.gitignore` excludes generated `js/posthog-config.js`.
- `package.json`/`vercel.json` run `node scripts/generate-posthog-config.cjs` as part of the build.
- Game files call `if(window.posthog) posthog.capture(...)` directly for analytics events.

Current initialization location (`index.html`):

```html
<script src="js/posthog-config.js"></script>
<script>
  /* PostHog snippet omitted */
  if(window.POSTHOG_TOKEN){
    posthog.init(window.POSTHOG_TOKEN,{api_host:window.POSTHOG_HOST,defaults:'2026-01-30',capture_exceptions:true});
  }
</script>
```

Cleanest place to add `posthog-js` if the project moves to npm modules later: create a small shared initializer such as `js/shared/posthog.js` and load it before game scripts from `index.html`. With the current no-bundler/global-script architecture, the existing snippet is the least disruptive approach and adding `posthog-js` is not necessary for Power-Up Pong instrumentation.

## 6. Validation commands

Install dependencies:

```sh
npm ci
```

Run dev server:

```sh
npm run dev
```

This runs `vercel dev`; it may require the Vercel CLI/runtime login/configuration depending on the local environment.

Run production build / generated config path:

```sh
npm run build
```

Note: `npm run build` also runs `node scripts/migrate.js`, so database environment variables may be required.

Run tests:

```sh
# No test script is configured yet.
npm test
```

Expected status today: no `test` script in `package.json`.

Run lint/typecheck:

```sh
# No lint or typecheck scripts are configured yet.
npm run lint
npm run typecheck
```

Expected status today: both scripts are absent.

Optional static local preview if avoiding Vercel/API behavior:

```sh
python3 -m http.server 8000
```

Then open the repo root in a browser. This is not a package script and will not emulate Vercel API routes.

## 7. Open questions / TBDs

- TBD: Confirm whether maintainers want Power-Up Pong as a new top-level tab or nested/linked differently.
- TBD: Pick the exact tab id (`pong`, `power-pong`, etc.) before implementation; existing ids are short (`td`, `cs`, `snake`, `fish`).
- TBD: Decide whether to keep all Power-Up Pong code in one `js/pong/game.js` file or split rendering/logic if it grows.
- TBD: Decide whether to introduce a test harness before/with Pong. None exists today.
- TBD: Verify `npm run dev` and `npm run build` in a fully provisioned environment with Vercel/database/PostHog env vars. This discovery did not run dependency install/build/test commands.
- TBD: `docs/architecture.md` says "no npm, no build step", but `package.json` now has dependencies and build scripts. Treat `package.json` as current source of truth and update architecture later if desired.
