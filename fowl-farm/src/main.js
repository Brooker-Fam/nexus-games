// Boot/init for Fowl Farm. Wires state -> loop -> ui -> persistence together.
//
// Extension points for follow-up hoglets:
//   * Farm view (sprites): add a renderer that reads `state.birds` and draws
//     into #farm-view. Hook into the tick callback below if you need
//     per-frame animation; otherwise call your render fn from renderHUD.

import { loadState, scheduleAutoSave, flushSave, createNewGame } from './state.js';
import { startLoop } from './loop.js';
import { produceEggs } from './eggs.js';
import { initUI, renderHUD } from './ui.js';
import { initIncubatorUI, renderIncubatorUI, incubatorTick } from './incubatorUI.js';

let state = loadState();
let loopHandle = null;

function onTick(s, dt) {
  const result = produceEggs(s, dt);
  const incResult = incubatorTick(s, dt);
  if (result.changed || incResult.hatched.length > 0) {
    renderHUD(s);
    renderIncubatorUI();
    scheduleAutoSave(s);
  } else {
    // Even if nothing committed, refresh slot progress bars and timers so
    // the player sees the countdown advance.
    renderIncubatorUI();
  }
}

function onStateChange() {
  renderHUD(state);
  renderIncubatorUI();
  scheduleAutoSave(state);
}

function onReset() {
  state = createNewGame();
  if (loopHandle) loopHandle.stop();
  initUI({ state, onStateChange, onReset });
  initIncubatorUI({ state, onStateChange, onHatch });
  loopHandle = startLoop(state, onTick);
  flushSave(state);
}

function onHatch() {
  renderHUD(state);
  renderIncubatorUI();
  scheduleAutoSave(state);
}

function boot() {
  initUI({ state, onStateChange, onReset });
  initIncubatorUI({ state, onStateChange, onHatch });
  loopHandle = startLoop(state, onTick);

  window.addEventListener('beforeunload', () => flushSave(state));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave(state);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

if (typeof window !== 'undefined') {
  window.__fowlFarm = {
    getState: () => state,
    forceSave: () => flushSave(state),
  };
}
