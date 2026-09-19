# Regression Check

Date: 2026-05-17
Branch: `feat/pong-integration-and-regression` on top of `feat/pong-core`

## Game index/navigation pattern

This repo uses a single-page `index.html` with one header tab per game, one matching `#tab-*` content panel, per-game CSS/JS includes, and `registerGame('<tab-id>', { init, cleanup })` lifecycle hooks invoked by `switchTab()` in `js/shared/game-registry.js`. There is no separate `games.json`, router, landing-page card grid, or thumbnail manifest. Game icons are inline tab glyphs (for example `⬡`, `◈`, `▣`, `≋`); Pong uses the same convention with `◫ PONG`.

## Existing game inventory (excluding Pong)

| Game | Directory/file(s) |
| --- | --- |
| Void Fortress / Tower Defense | `index.html` `#tab-td`, `css/td.css`, `js/td/logic.js`, `js/td/towers.js`, `js/td/rendering.js` |
| Deep Space Ops | `index.html` `#tab-cs`, `css/rts.css`, `js/rts/*.js` |
| Nexus Snake | `index.html` `#tab-snake`, `css/snake.css`, `js/snake/game.js` |
| Fish Frenzy | `index.html` `#tab-fish`, `css/fish.css`, `js/fish/game.js` |

`MAKE EXCEPTION` is an intentional exception-capture test button, not a game, so it is excluded from the regression matrix.

## Browser verification

Served the app with `python3 -m http.server 4173` and verified in Chromium via Playwright. Local serverless-only `/api/session` and `/api/stats` calls were stubbed during the browser run so console verification focused on game runtime errors rather than missing API routes under the static server.

| Game | Loads | Interactive | Console errors | Notes |
| --- | --- | --- | --- | --- |
| Void Fortress / Tower Defense | ✅ | ✅ | None | Default tab loaded; placed a Gun tower, gold changed from 200 to 150, and started wave 1. |
| Deep Space Ops | ✅ | ✅ | None | Switched to DSO, selected Shadow Armada, viewed reveal screen, began a skirmish, and clicked Attack. |
| Nexus Snake | ✅ | ✅ | None | Switched to Snake, used keyboard direction input, and selected 2× speed. |
| Fish Frenzy | ✅ | ✅ | None | Switched to Fish Frenzy and moved the player fish with pointer input while the game remained active. |
| Pong | ✅ | ✅ | None | Loaded from the `◫ PONG` tab; selected 1P Easy/Medium/Hard, started local 2P, verified score updates, and confirmed winner overlay (`PLAYER 1 WINS`). |
