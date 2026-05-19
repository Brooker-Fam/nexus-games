# Insight Wars stack binding

Confirmed on 2026-05-19 from `package.json`, `index.html`, and existing `js/<game>/` directories:

- Frontend: vanilla JavaScript, HTML, and CSS.
- Game mounting: global tab registry in `js/shared/game-registry.js`.
- Hosting: Vercel. Local dev: `npm run dev` runs the repo's lightweight static Node server (`scripts/dev-server.mjs`).
- Build: Node scripts only; there is no React, Vite, TypeScript compiler, bundler, or framework router in this repo.
- Tests added for this game use Node's built-in `node:test` runner via `npm test`.

Downstream hoglets should keep Insight Wars aligned with the vanilla JS renderer and should not introduce a React/Vite layer for this game.
