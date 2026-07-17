// Public entry point for the gameplay layer.
//
// Typical wiring (with the real engine + level dropped in):
//
//   import { createGame } from './doom/game/index.js';
//   import { createEngine } from './doom/engine/index.js';   // Lizzie's module
//   import { loadLevel }    from './doom/levels/index.js';   // Juraj's module
//
//   const engine = createEngine();
//   engine.attach(document.getElementById('doom-canvas'));
//   const level  = await loadLevel('e1m1');
//   const game   = createGame({ engine, level });
//   game.start();
//
// For local development you can swap in the stub engine/level — see
// doom/doom.html for a minimal demo page.

export { createGame } from './game.js';
export { createStubEngine } from './engine-stub.js';
export { createStubLevel } from './level-stub.js';
export * as Config from './config.js';
