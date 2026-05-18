# Insight Wars stacked PR notes

## Hoglet 1 scope

This branch is scaffold-only. It adds the `Insight Wars` tab placeholder, a local entry module, styles, README stub, and a smoke test. It intentionally does **not** implement card logic, turn state, card resolution, AI, analytics, animations, sound, or production UI components.

## Repo discovery findings

- **Frontend framework + version:** no app framework is present. The frontend is vanilla HTML/CSS/JavaScript; `package.json` has no React, Vue, Svelte, or equivalent dependency.
- **Bundler:** none. There is no `vite.config.*`, Webpack, or Rollup config. `vercel.json` serves the repo root with `"outputDirectory": "."`.
- **Package manager:** npm. `package-lock.json` is present and there is no `pnpm-lock.yaml` or `yarn.lock`.
- **Build tool/scripts:** `npm run build` runs `node scripts/generate-posthog-config.cjs && node scripts/generate-sourcemaps.cjs && node scripts/migrate.js`.
- **Dev server:** `npm run dev` runs `vercel dev`; this requires the Vercel CLI outside normal npm dependencies.
- **Test runner:** no project test runner is configured. There is no `test` script, Vitest, Jest, Mocha, or Playwright config. This scaffold adds a Node built-in `node:test` smoke test at `games/insight-wars/index.test.mjs`, runnable with `node --test games/insight-wars/index.test.mjs`.
- **Routing/navigation pattern:** the app is a single `index.html` arcade shell. Games are hard-coded as tab buttons and `<div class="tab-content">` panels. `js/shared/game-registry.js` exposes `registerGame`, `activateGame`, and `switchTab`; existing games register lifecycle callbacks and tab buttons switch panels.
- **Styling approach:** plain CSS. Shared shell styles and variables live in `css/base.css`; existing game-specific styles live in `css/<game>.css` and are manually linked from `index.html`. This scaffold keeps Insight Wars styles in `games/insight-wars/styles.css` and injects that stylesheet from its entry module to respect the constraint that only `index.html` changes outside `games/insight-wars/`.
- **Existing game path pattern:** game UI markup is inline in `index.html`; game logic lives under `js/<game>/`; styles live under `css/<game>.css`. Examples: Snake uses `index.html` `#tab-snake`, `js/snake/game.js`, `css/snake.css`; Fish Frenzy uses `index.html` `#tab-fish`, `js/fish/game.js`, `css/fish.css`; Pong uses `index.html` `#tab-pong`, `js/pong/game.js`, `css/pong.css`.

## Insight Wars files in this scaffold

```text
games/insight-wars/
  README.md
  STACK.md
  index.js
  index.test.mjs
  styles.css
```

The only modified file outside this directory is `index.html`, which adds the `INSIGHT WARS` tab button, tab panel mount point, and module script tag.

## Guidance for hoglets 2–4

- Keep names scoped with `insightWars` / `INSIGHT_WARS` or under `games/insight-wars/` to avoid global collisions in the vanilla app.
- Do not add `posthog-js`; this game should stay self-contained unless a later analytics-specific task explicitly requests guarded use of the existing global snippet.
- Preserve the placeholder CSS color direction: PostHog orange/yellow for player-side accents and muted grey for AI-side accents.
- If more app-wide routing or package scripts are needed later, call out the hard-constraint tradeoff before touching files outside this directory.
