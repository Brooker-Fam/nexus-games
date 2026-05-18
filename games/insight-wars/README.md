# Insight Wars

Single-player, turn-based card game scaffolded into the existing Nexus Games arcade shell.

## Framework / rendering

This repo does **not** use React, Next, Svelte, Vite, or another app framework. Insight Wars matches the existing scaffold and renders with vanilla JavaScript modules plus plain CSS injected by `games/insight-wars/index.js`.

## Local setup

From the repo root:

```bash
npm ci
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/index.html` and select the `INSIGHT WARS` tab.

For the repo's Vercel/serverless workflow, use `npm run dev` when the Vercel CLI is available and authenticated.

## UI scope

The current UI branch adds:

- AI and player hero panels.
- Board minion rows with empty-zone states and ready/summoning-sickness minion styling.
- Player hand and reusable card markup for spells/minions.
- End Turn, New Game, and win/lose overlay controls.
- A tiny route controller exposed as `window.insightWarsUi` for manual testing.

To manually test the result overlay in the browser console:

```js
window.insightWarsUi.setState({
  ...window.insightWarsUi.getState(),
  gameOver: 'win',
})
```

Use `'lose'` to test the losing copy.

## Stub game state API

`games/insight-wars/game-state.js` exports the temporary UI contract that later stacked work can replace:

- `createInitialGameState()`
- `playCard(state, cardId, target?)`
- `attack(state, attackerId, targetId)`
- `endTurn(state)`

Type definitions live in `games/insight-wars/game-state.d.ts` and describe `GameState`, `Card`, and `Minion`.

## Card reference

1. Feature Flag (spell, 1) — 🚩
2. Session Replay (minion, 2) — 1/3 — 🎥
3. A/B Test (spell, 3) — random 50/50 — 🅰️🅱️
4. Funnel (minion, 4) — 3/4 — 🔻
5. Cohort (spell, 2) — 👥
6. Insight (spell, 3) — draw cards — 💡
7. Surveys (spell, 1) — 📋
8. Heatmap (spell, 4) — direct damage — 🔥
9. Experiment (minion, 5) — 4/5 — 🧪
