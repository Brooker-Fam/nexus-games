# Insight Wars stack binding

Confirmed on 2026-05-19 from `package.json`, `index.html`, and existing `js/<game>/` directories:

- Frontend: vanilla JavaScript, HTML, and CSS.
- Game mounting: global tab registry in `js/shared/game-registry.js`.
- Hosting/dev: Vercel (`npm run dev` runs `vercel dev`).
- Build: Node scripts only; there is no React, Vite, TypeScript compiler, bundler, or framework router in this repo.
- Tests added for this game use Vitest via `npm test`.

Downstream hoglets should keep Insight Wars aligned with the vanilla JS renderer and should not introduce a React/Vite layer for this game.
