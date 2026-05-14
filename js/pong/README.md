# Pong entry point

Reserved for the Atari Pong implementation. The shell PR registers the game at:

- Tab/content ID: `pong` (`#tab-pong` in `index.html`)
- Canvas ID: `pongCanvas`
- Script entry point: `js/pong/game.js`
- Lifecycle contract: `registerGame('pong', { init, cleanup })`

`js/pong/game.js` currently contains placeholder drawing/lifecycle code only. The Pong-core branch should replace it with gameplay while preserving the IDs above.
