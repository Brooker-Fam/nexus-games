# Stack Discovery: Insight Wars

Confirmed before implementation:

- **Framework:** Not React + Vite. `package.json` describes a vanilla JS frontend with Vercel serverless API; there is no `vite.config.*`, `src/main.*`, or `src/App.*`.
- **Router/navigation:** Existing games use tabbed DOM sections in `index.html`, lifecycle registration through `js/shared/game-registry.js`, and click handlers in JavaScript. `/insight-wars` is added as a Vercel rewrite to `index.html`, then the Insight Wars module activates its tab based on `location.pathname`.
- **Language:** Plain JavaScript ES modules. The engine uses JSDoc typedefs in `engine/types.js` instead of TypeScript files.
- **Test runner:** No root test runner was present. Vitest is configured minimally inside `js/insight-wars/package.json` only.
- **Game folder layout:** Existing game logic lives under `js/<game>/` with CSS loaded from the page. Insight Wars mirrors the game-code convention at `js/insight-wars/` and keeps its engine, UI, docs, and local tests there for follow-up hoglets.
