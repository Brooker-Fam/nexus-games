// Incubator + upgrades + bird-variety + milestones UI.
//
// Builds DOM into existing #incubator-panel and #upgrades-panel containers,
// listens to clicks, and exposes a render() that the main render hook calls
// every state change and once per animation frame for live timer progress.

import { BIRD_TYPE_KEYS, BIRD_TYPES, getBirdStats } from './birds.js';
import {
  placeEgg,
  cancelIncubation,
  tickIncubators,
  slotProgress,
  slotRemainingMs,
  effectiveHatchTimeMs,
} from './incubator.js';
import { UPGRADES, UPGRADE_KEYS, levelOf, nextCost, canAfford, purchase } from './upgrades.js';
import { FLOCK_MILESTONES, nextMilestone } from './milestones.js';

const REFS = {};
let CTX = null; // { state, onStateChange, onHatch }

export function initIncubatorUI(ctx) {
  CTX = ctx;
  REFS.incubatorList = document.getElementById('incubator-slots');
  REFS.placeButtons = document.getElementById('incubator-place-buttons');
  REFS.statsList = document.getElementById('bird-stats-list');
  REFS.upgradesList = document.getElementById('upgrades-list');
  REFS.milestonesList = document.getElementById('milestones-list');
  REFS.flockProgress = document.getElementById('flock-progress');
  REFS.toasts = document.getElementById('toast-stack');

  buildBirdStats();
  buildPlaceButtons();
  renderIncubatorUI();
}

// ---------- bird variety stats ----------

function buildBirdStats() {
  if (!REFS.statsList) return;
  REFS.statsList.innerHTML = '';
  for (const type of BIRD_TYPE_KEYS) {
    const stats = BIRD_TYPES[type];
    const icon = type === 'chicken' ? '🐔' : '🪿';
    const row = document.createElement('div');
    row.className = 'stat-card';
    row.innerHTML = `
      <div class="stat-card-head">
        <span class="stat-icon" aria-hidden="true">${icon}</span>
        <span class="stat-label">${stats.label}</span>
      </div>
      <ul class="stat-list">
        <li><span>Eggs/min</span><strong>${stats.eggsPerMinute}</strong></li>
        <li><span>Hatch time</span><strong>${Math.round(stats.hatchTimeMs / 1000)}s</strong></li>
        <li><span>Egg value</span><strong>${stats.eggValue} 🪙</strong></li>
      </ul>
    `;
    REFS.statsList.appendChild(row);
  }
}

// ---------- place-egg buttons ----------

function buildPlaceButtons() {
  if (!REFS.placeButtons) return;
  REFS.placeButtons.innerHTML = '';
  for (const type of BIRD_TYPE_KEYS) {
    const icon = type === 'chicken' ? '🐔' : '🪿';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn place-btn';
    btn.dataset.eggType = type;
    btn.innerHTML = `<span aria-hidden="true">${icon}</span> Place ${type} egg <span class="place-count" data-place-count="${type}">0</span>`;
    btn.addEventListener('click', () => handlePlaceEgg(type));
    REFS.placeButtons.appendChild(btn);
  }
}

function handlePlaceEgg(type) {
  const { state, onStateChange } = CTX;
  const result = placeEgg(state, type);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  showToast(`Placed a ${type} egg in incubator ${result.slot + 1}.`);
  onStateChange();
}

// ---------- incubator slots ----------

function renderSlots() {
  if (!REFS.incubatorList) return;
  const { state } = CTX;
  // Rebuild only when slot count changes; otherwise just update children.
  if (REFS.incubatorList.childElementCount !== state.incubators.length) {
    REFS.incubatorList.innerHTML = '';
    for (let i = 0; i < state.incubators.length; i++) {
      const card = document.createElement('div');
      card.className = 'incubator-slot';
      card.dataset.slotIndex = String(i);
      card.innerHTML = `
        <div class="slot-head">
          <span class="slot-title">Incubator ${i + 1}</span>
          <button type="button" class="btn btn-ghost slot-cancel" data-cancel-slot="${i}" hidden>Cancel</button>
        </div>
        <div class="slot-body">
          <div class="slot-icon" data-slot-icon>🥚</div>
          <div class="slot-info">
            <div class="slot-status" data-slot-status>Empty</div>
            <div class="slot-bar"><div class="slot-bar-fill" data-slot-fill></div></div>
            <div class="slot-time" data-slot-time></div>
          </div>
        </div>
      `;
      const cancelBtn = card.querySelector('[data-cancel-slot]');
      cancelBtn.addEventListener('click', () => handleCancel(i));
      REFS.incubatorList.appendChild(card);
    }
  }

  for (let i = 0; i < state.incubators.length; i++) {
    const card = REFS.incubatorList.children[i];
    const slot = state.incubators[i];
    const icon = card.querySelector('[data-slot-icon]');
    const status = card.querySelector('[data-slot-status]');
    const fill = card.querySelector('[data-slot-fill]');
    const time = card.querySelector('[data-slot-time]');
    const cancelBtn = card.querySelector('[data-cancel-slot]');

    if (!slot) {
      card.classList.remove('is-active');
      icon.textContent = '🥚';
      status.textContent = 'Empty';
      fill.style.width = '0%';
      time.textContent = '';
      cancelBtn.hidden = true;
      continue;
    }

    card.classList.add('is-active');
    const progress = slotProgress(slot);
    const remaining = slotRemainingMs(slot);
    const typeLabel = BIRD_TYPES[slot.type]?.label || slot.type;
    icon.textContent = slot.type === 'chicken' ? '🐔' : '🪿';
    status.textContent = `${typeLabel} egg`;
    fill.style.width = `${(progress * 100).toFixed(1)}%`;
    if (remaining <= 0 && state.birds.length >= state.coopCapacity) {
      time.textContent = 'Ready — coop full!';
      card.classList.add('is-blocked');
    } else {
      card.classList.remove('is-blocked');
      time.textContent = formatRemaining(remaining);
    }
    cancelBtn.hidden = false;
  }
}

function handleCancel(slotIndex) {
  const { state, onStateChange } = CTX;
  const result = cancelIncubation(state, slotIndex);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  showToast(`Cancelled incubator ${slotIndex + 1}; egg returned.`);
  onStateChange();
}

function formatRemaining(ms) {
  if (ms <= 0) return 'Hatching…';
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s left`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s left`;
}

// ---------- upgrades ----------

function renderUpgrades() {
  if (!REFS.upgradesList) return;
  const { state } = CTX;
  if (REFS.upgradesList.childElementCount !== UPGRADE_KEYS.length) {
    REFS.upgradesList.innerHTML = '';
    for (const key of UPGRADE_KEYS) {
      const def = UPGRADES[key];
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.dataset.upgrade = key;
      card.innerHTML = `
        <div class="upgrade-head">
          <span class="upgrade-label">${def.label}</span>
          <span class="upgrade-level" data-upgrade-level>Lv 0</span>
        </div>
        <p class="upgrade-desc" data-upgrade-desc></p>
        <button type="button" class="btn btn-primary upgrade-buy" data-upgrade-buy="${key}">Buy</button>
      `;
      card.querySelector('[data-upgrade-buy]').addEventListener('click', () => handleBuy(key));
      REFS.upgradesList.appendChild(card);
    }
  }

  for (const key of UPGRADE_KEYS) {
    const def = UPGRADES[key];
    const card = REFS.upgradesList.querySelector(`[data-upgrade="${key}"]`);
    const level = levelOf(state, key);
    const max = def.maxLevel ?? Infinity;
    const maxed = level >= max;
    card.querySelector('[data-upgrade-level]').textContent = `Lv ${level}`;
    card.querySelector('[data-upgrade-desc]').textContent = def.describe(state);
    const btn = card.querySelector('[data-upgrade-buy]');
    if (maxed) {
      btn.textContent = 'Max level';
      btn.disabled = true;
    } else {
      const cost = nextCost(state, key);
      btn.textContent = `Buy · ${cost} 🪙`;
      btn.disabled = !canAfford(state, key);
    }
  }
}

function handleBuy(key) {
  const { state, onStateChange } = CTX;
  const result = purchase(state, key);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  // Coop-capacity unlocks no new slots, but if we ever add an
  // incubator-slot upgrade in future, sync the array length.
  while (state.incubators.length < state.incubatorSlots) state.incubators.push(null);
  showToast(`Upgraded ${UPGRADES[key].label}!`);
  onStateChange();
}

// ---------- milestones ----------

function renderMilestones() {
  if (!REFS.milestonesList) return;
  const { state } = CTX;
  const flock = state.birds.length;
  if (REFS.milestonesList.childElementCount !== FLOCK_MILESTONES.length) {
    REFS.milestonesList.innerHTML = '';
    for (const target of FLOCK_MILESTONES) {
      const pill = document.createElement('span');
      pill.className = 'milestone-pill';
      pill.dataset.target = String(target);
      pill.textContent = `${target} birds`;
      REFS.milestonesList.appendChild(pill);
    }
  }
  for (const pill of REFS.milestonesList.children) {
    const target = Number(pill.dataset.target);
    pill.classList.toggle('is-reached', flock >= target);
  }
  if (REFS.flockProgress) {
    const next = nextMilestone(state);
    REFS.flockProgress.textContent = next
      ? `Flock: ${flock} — next goal ${next}`
      : `Flock: ${flock} — all milestones reached!`;
  }
}

// ---------- toasts ----------

function showToast(msg, kind = 'info') {
  if (!REFS.toasts) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  REFS.toasts.appendChild(el);
  // Force a reflow so the transition triggers reliably.
  void el.offsetWidth;
  el.classList.add('is-visible');
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 350);
  }, 2200);
}

// ---------- place-button labels (egg counts) ----------

function renderPlaceButtonCounts() {
  if (!REFS.placeButtons) return;
  const { state } = CTX;
  for (const type of BIRD_TYPE_KEYS) {
    const el = REFS.placeButtons.querySelector(`[data-place-count="${type}"]`);
    if (!el) continue;
    const count = state.eggs[type] || 0;
    el.textContent = String(count);
    const btn = el.closest('button');
    const wouldHatchMs = effectiveHatchTimeMs(state, type);
    btn.title = `${count} ${type} eggs in inventory · ${Math.round(wouldHatchMs / 1000)}s hatch`;
    btn.disabled = count <= 0;
  }
}

// ---------- public render hook ----------

export function renderIncubatorUI() {
  if (!CTX) return;
  renderSlots();
  renderUpgrades();
  renderMilestones();
  renderPlaceButtonCounts();
}

// Called by the main loop ~60Hz so progress bars and timers update smoothly,
// and so completed hatches are added to state without waiting for the next
// produceEggs change.
export function incubatorTick(state, _dt, _now) {
  const hatched = tickIncubators(state);
  if (hatched.length > 0) {
    for (const bird of hatched) {
      const label = BIRD_TYPES[bird.type]?.label || bird.type;
      showToast(`🐣 A new ${label.toLowerCase()} hatched!`, 'success');
    }
    CTX && CTX.onHatch && CTX.onHatch(hatched);
    // Fire a window-level event so the farm-view hoglet can react without
    // taking a hard dependency on this module.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fowlfarm:hatch', { detail: { birds: hatched } }));
    }
    return { hatched };
  }
  return { hatched: [] };
}
