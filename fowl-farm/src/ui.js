// Minimal HUD — enough to verify the foundation acceptance criteria.
//
// Renders bird counts, egg inventory (pending + collected), and coins, and
// wires up the Collect / Reset buttons. The follow-up hoglets replace the
// #farm-view and #incubator-panel placeholders with real UIs; this file
// stays focused on the top-status bar.

import { BIRD_TYPE_KEYS, getBirdStats } from './birds.js';
import { collectEggs } from './eggs.js';
import { clearSave, flushSave } from './state.js';

const REFS = {};

export function initUI({ state, onStateChange, onReset }) {
  REFS.chickenCount = document.getElementById('hud-chicken-count');
  REFS.gooseCount = document.getElementById('hud-goose-count');
  REFS.chickenPending = document.getElementById('hud-chicken-pending');
  REFS.chickenCollected = document.getElementById('hud-chicken-collected');
  REFS.goosePending = document.getElementById('hud-goose-pending');
  REFS.gooseCollected = document.getElementById('hud-goose-collected');
  REFS.coins = document.getElementById('hud-coins');
  REFS.collectBtn = document.getElementById('hud-collect-btn');
  REFS.resetBtn = document.getElementById('hud-reset-btn');
  REFS.status = document.getElementById('hud-status');

  REFS.collectBtn.addEventListener('click', () => {
    const summary = collectEggs(state);
    onStateChange();
    flashStatus(
      summary.coinsEarned > 0
        ? `Collected ${totalCollected(summary)} eggs · +${summary.coinsEarned} coins`
        : 'No eggs to collect yet.',
    );
  });

  REFS.resetBtn.addEventListener('click', () => {
    const ok = confirm('Reset Fowl Farm? This wipes your save.');
    if (!ok) return;
    clearSave();
    onReset();
  });

  renderHUD(state);
}

export function renderHUD(state) {
  if (!REFS.chickenCount) return; // not initialised yet
  const counts = countBirds(state);
  REFS.chickenCount.textContent = String(counts.chicken || 0);
  REFS.gooseCount.textContent = String(counts.goose || 0);

  REFS.chickenPending.textContent = String(state.pendingEggs.chicken || 0);
  REFS.chickenCollected.textContent = String(state.eggs.chicken || 0);
  REFS.goosePending.textContent = String(state.pendingEggs.goose || 0);
  REFS.gooseCollected.textContent = String(state.eggs.goose || 0);

  REFS.coins.textContent = String(state.resources.coins || 0);

  const hasPending = (state.pendingEggs.chicken || 0) + (state.pendingEggs.goose || 0) > 0;
  REFS.collectBtn.disabled = !hasPending;
}

function countBirds(state) {
  const out = {};
  for (const t of BIRD_TYPE_KEYS) out[t] = 0;
  for (const b of state.birds) {
    if (out[b.type] == null) out[b.type] = 0;
    out[b.type] += 1;
  }
  return out;
}

function totalCollected(summary) {
  return Object.values(summary.collected).reduce((a, b) => a + b, 0);
}

let _statusTimer = 0;
function flashStatus(msg) {
  if (!REFS.status) return;
  REFS.status.textContent = msg;
  REFS.status.classList.add('is-visible');
  clearTimeout(_statusTimer);
  _statusTimer = setTimeout(() => {
    REFS.status.classList.remove('is-visible');
  }, 2500);
}

// Surfaced for the follow-up hoglets that may want to inspect chosen stats.
export function describeBirdStats() {
  return BIRD_TYPE_KEYS.map((t) => ({ type: t, ...getBirdStats(t) }));
}
