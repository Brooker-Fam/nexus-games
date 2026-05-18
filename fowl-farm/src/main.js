// Boot/init for Fowl Farm. Wires state -> loop -> ui -> persistence together.
//
// Extension points for follow-up hoglets:
//   * Farm view (sprites): add a renderer that reads `state.birds` and draws
//     into #farm-view. Hook into the tick callback below if you need
//     per-frame animation; otherwise call your render fn from renderHUD.
//   * Incubator UI: read/write `state.incubators` and operate on it via its
//     own module. Add buttons/controls inside #incubator-panel. Use the
//     existing scheduleAutoSave/flushSave from state.js for persistence.

import { loadState, scheduleAutoSave, flushSave, createNewGame } from './state.js';
import { startLoop } from './loop.js';
import { produceEggs } from './eggs.js';
import { initUI, renderHUD } from './ui.js';

let state = loadState();
let loopHandle = null;

function onTick(s, dt) {
  const result = produceEggs(s, dt);
  if (result.changed) {
    renderHUD(s);
    scheduleAutoSave(s);
  }
}

function onStateChange() {
  renderHUD(state);
  scheduleAutoSave(state);
}

function onReset() {
  state = createNewGame();
  // Re-init UI bindings with the new state and restart the loop so the tick
  // callback closes over the right object.
  if (loopHandle) loopHandle.stop();
  initUI({ state, onStateChange, onReset });
  loopHandle = startLoop(state, onTick);
  flushSave(state);
}

function boot() {
  initUI({ state, onStateChange, onReset });
  loopHandle = startLoop(state, onTick);

  window.addEventListener('beforeunload', () => flushSave(state));
  // Best-effort flush when the tab is hidden — beforeunload isn't fired on
  // mobile when users swipe away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave(state);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Expose for ad-hoc debugging in the browser console. Not used by any module.
if (typeof window !== 'undefined') {
  window.__fowlFarm = {
    getState: () => state,
    forceSave: () => flushSave(state),
  };
}
