// Farm view: canvas-based 2D scene with animated bird sprites and clickable
// eggs. Reads `state.birds` and `state.pendingEggs`; for the click-to-collect
// path it mutates `state.pendingEggs`, `state.eggs`, and `state.resources.coins`
// using the same accounting as `collectEggs` in eggs.js.
//
// Rendering strategy:
//   * One <canvas> sized to FARM_WIDTH x FARM_HEIGHT (logical), upscaled with
//     CSS to fit its container and devicePixelRatio for crisp lines.
//   * Each bird gets a local "actor" that drifts toward a wander target with
//     a sine bob for a walking cadence. The bird's logical position is mirrored
//     back to state.birds[i].{x,y} so saves remember where things ended up.
//   * Pending eggs are reified into visual sprites; new pending eggs spawn
//     a new sprite near a random bird of that type. Sprites are clickable
//     for individual collection and animate out on collect.

import { FARM_WIDTH, FARM_HEIGHT } from './state.js';
import { BIRD_TYPE_KEYS, getBirdStats } from './birds.js';

const PADDING = 24; // keep birds away from the fence
const EGG_HIT_RADIUS = 16;

const COLORS = {
  grassA: '#9ad26b',
  grassB: '#8bc55c',
  dirt: '#c9a16b',
  fence: '#7a5a36',
  fenceLight: '#a07a4d',
  shadow: 'rgba(0, 0, 0, 0.18)',
  chickenBody: '#c2410c',
  chickenBelly: '#fde68a',
  chickenComb: '#dc2626',
  chickenBeak: '#facc15',
  gooseBody: '#f8fafc',
  gooseShade: '#cbd5e1',
  gooseBeak: '#f97316',
  gooseLeg: '#f97316',
  eyeDot: '#1f2937',
  eggShell: '#fffaf0',
  eggShellHi: '#ffffff',
  eggShade: '#e5d6b8',
  gooseEggShell: '#f5f3e7',
};

const BIRD_SCALE = { chicken: 1.0, goose: 1.35 };
const BIRD_SPEED = { chicken: 38, goose: 26 }; // px / second

let canvas = null;
let ctx = null;
let _state = null;
let _eggCollectCallback = null;

const actors = new Map();           // bird.id -> actor
const eggs = [];                    // visual eggs: { id, type, x, y, age, removing, removeAge, jiggle }
const popups = [];                  // ephemeral floating "+N coin" notes
let eggIdCounter = 1;
let lastNow = null;

// ---------- public API ----------

export function initFarmView({ state, onEggCollected }) {
  _state = state;
  _eggCollectCallback = onEggCollected || (() => {});

  const host = document.getElementById('farm-view');
  if (!host) {
    console.warn('[fowl-farm] #farm-view not found');
    return;
  }

  // Clear out the foundation's placeholder content.
  host.innerHTML = '';
  host.classList.remove('placeholder');
  host.classList.add('farm-view');

  canvas = document.createElement('canvas');
  canvas.className = 'farm-canvas';
  canvas.setAttribute('aria-label', 'Farm scene');
  host.appendChild(canvas);

  const hint = document.createElement('p');
  hint.className = 'farm-hint';
  hint.textContent = 'Click eggs to collect them — or use the Collect Eggs button.';
  host.appendChild(hint);

  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('click', onCanvasClick);

  // Seed actors from existing state.
  syncActors(state);
}

// Re-bind to a new state object (used on Reset).
export function rebindFarmView(state) {
  _state = state;
  actors.clear();
  eggs.length = 0;
  popups.length = 0;
  syncActors(state);
}

// Called from the per-frame tick. Updates actors, spawns/removes eggs, and
// redraws the canvas. Cheap enough for 30+ birds — all simple shapes.
export function tickFarmView(state, dt /* ms */, now /* ms */) {
  if (!ctx || !_state) return;
  // The main module re-creates state on reset; keep our reference current.
  if (state !== _state) _state = state;

  syncActors(state);
  reconcileEggs(state);

  const dtSec = dt / 1000;
  if (lastNow == null) lastNow = now;
  lastNow = now;

  updateActors(dtSec, now);
  updateEggs(dtSec);
  updatePopups(dtSec);
  draw(now);
}

// ---------- internals ----------

function resizeCanvas() {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  // Match canvas backing size to logical farm coords scaled by DPR so drawing
  // can stay in logical (FARM_WIDTH x FARM_HEIGHT) space.
  const cssWidth = Math.min(canvas.parentElement.clientWidth || FARM_WIDTH, 900);
  const aspect = FARM_HEIGHT / FARM_WIDTH;
  const cssHeight = Math.round(cssWidth * aspect);

  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.round(FARM_WIDTH * ratio * (cssWidth / FARM_WIDTH));
  canvas.height = Math.round(FARM_HEIGHT * ratio * (cssHeight / FARM_HEIGHT));

  // Set transform so 1 unit in draw code = 1 logical px.
  ctx.setTransform(canvas.width / FARM_WIDTH, 0, 0, canvas.height / FARM_HEIGHT, 0, 0);
  ctx.imageSmoothingEnabled = true;
}

function syncActors(state) {
  const seen = new Set();
  for (const b of state.birds) {
    seen.add(b.id);
    let a = actors.get(b.id);
    if (!a) {
      a = makeActor(b);
      actors.set(b.id, a);
    } else {
      // Type can theoretically change (it shouldn't, but be defensive).
      a.type = b.type;
    }
  }
  // Remove actors whose birds were removed from state (e.g., not currently
  // possible in v1, but supports a future "sell bird" feature cleanly).
  for (const id of actors.keys()) {
    if (!seen.has(id)) actors.delete(id);
  }
}

function makeActor(bird) {
  const x = clampX(bird.x ?? randInRange(PADDING, FARM_WIDTH - PADDING));
  const y = clampY(bird.y ?? randInRange(PADDING, FARM_HEIGHT - PADDING));
  return {
    id: bird.id,
    type: bird.type,
    x,
    y,
    targetX: x,
    targetY: y,
    facing: Math.random() < 0.5 ? -1 : 1,
    bobPhase: Math.random() * Math.PI * 2,
    idleUntil: 0,
    speed: BIRD_SPEED[bird.type] || 30,
  };
}

function updateActors(dtSec, now) {
  for (const a of actors.values()) {
    if (now < a.idleUntil) {
      // Just bob in place a little.
      a.bobPhase += dtSec * 4;
      continue;
    }
    const dx = a.targetX - a.x;
    const dy = a.targetY - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      // Reached target — pick a new one (with a chance of idling first).
      if (Math.random() < 0.4) {
        a.idleUntil = now + 400 + Math.random() * 1400;
      }
      const tx = randInRange(PADDING, FARM_WIDTH - PADDING);
      const ty = randInRange(PADDING, FARM_HEIGHT - PADDING);
      a.targetX = tx;
      a.targetY = ty;
      a.facing = tx >= a.x ? 1 : -1;
    } else {
      const step = Math.min(dist, a.speed * dtSec);
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
      a.facing = dx >= 0 ? 1 : -1;
      a.bobPhase += dtSec * 8; // walking cadence
    }
    // Mirror back into state so saves remember the rough position.
    const bird = findBird(a.id);
    if (bird) {
      bird.x = Math.round(a.x);
      bird.y = Math.round(a.y);
    }
  }
}

function findBird(id) {
  if (!_state) return null;
  for (const b of _state.birds) if (b.id === id) return b;
  return null;
}

// Keep the visual egg list aligned with state.pendingEggs. New eggs appear
// near a random bird of that type; surplus visual eggs (after a "Collect Eggs"
// click) are flagged for removal so they fade out instead of vanishing.
function reconcileEggs(state) {
  for (const type of BIRD_TYPE_KEYS) {
    const pending = state.pendingEggs[type] || 0;
    const live = countLiveEggs(type);
    if (live < pending) {
      const toAdd = pending - live;
      for (let i = 0; i < toAdd; i++) spawnEgg(type);
    } else if (live > pending) {
      const toRemove = live - pending;
      flagEggsForRemoval(type, toRemove);
    }
  }
}

function countLiveEggs(type) {
  let n = 0;
  for (const e of eggs) if (e.type === type && !e.removing) n += 1;
  return n;
}

function spawnEgg(type) {
  const bird = pickRandomBirdOfType(type);
  const ox = (Math.random() - 0.5) * 24;
  const oy = 10 + Math.random() * 8; // just below/in front of the bird
  const baseX = bird ? bird.x : randInRange(PADDING, FARM_WIDTH - PADDING);
  const baseY = bird ? bird.y : randInRange(PADDING, FARM_HEIGHT - PADDING);
  eggs.push({
    id: `e-${eggIdCounter++}`,
    type,
    x: clampX(baseX + ox),
    y: clampY(baseY + oy),
    age: 0,
    removing: false,
    removeAge: 0,
    jiggle: Math.random() * Math.PI * 2,
  });
}

function flagEggsForRemoval(type, n) {
  // Remove the oldest "live" eggs first (they've been waiting longest).
  let removed = 0;
  for (let i = 0; i < eggs.length && removed < n; i++) {
    const e = eggs[i];
    if (e.type === type && !e.removing) {
      e.removing = true;
      removed += 1;
    }
  }
}

function pickRandomBirdOfType(type) {
  const candidates = [];
  for (const a of actors.values()) if (a.type === type) candidates.push(a);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function updateEggs(dtSec) {
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i];
    e.age += dtSec;
    if (e.removing) {
      e.removeAge += dtSec;
      if (e.removeAge > 0.4) eggs.splice(i, 1);
    }
  }
}

function updatePopups(dtSec) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dtSec;
    p.y -= 22 * dtSec;
    if (p.age > 1.0) popups.splice(i, 1);
  }
}

// ---------- click handling ----------

function onCanvasClick(ev) {
  if (!_state || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cssX = ev.clientX - rect.left;
  const cssY = ev.clientY - rect.top;
  // Convert from CSS pixels to logical farm coords.
  const lx = (cssX / rect.width) * FARM_WIDTH;
  const ly = (cssY / rect.height) * FARM_HEIGHT;

  // Hit-test eggs (front-to-back: prefer the most recently spawned).
  for (let i = eggs.length - 1; i >= 0; i--) {
    const e = eggs[i];
    if (e.removing) continue;
    const dx = e.x - lx;
    const dy = e.y - ly;
    if (dx * dx + dy * dy <= EGG_HIT_RADIUS * EGG_HIT_RADIUS) {
      collectSingleEgg(e);
      return;
    }
  }
}

function collectSingleEgg(egg) {
  if (!_state) return;
  if ((_state.pendingEggs[egg.type] || 0) <= 0) {
    // State drifted (e.g., raced with the Collect-all button) — just drop it.
    egg.removing = true;
    return;
  }
  const value = getBirdStats(egg.type).eggValue;
  _state.pendingEggs[egg.type] -= 1;
  _state.eggs[egg.type] = (_state.eggs[egg.type] || 0) + 1;
  _state.resources.coins += value;

  egg.removing = true;
  popups.push({ x: egg.x, y: egg.y - 6, age: 0, text: `+${value}` });

  _eggCollectCallback({ type: egg.type, value });
}

// ---------- drawing ----------

function draw(now) {
  ctx.save();
  drawBackground();
  drawFence();

  // Sort actors by y so closer (lower) birds render in front.
  const sorted = [...actors.values()].sort((a, b) => a.y - b.y);
  for (const a of sorted) drawBird(a, now);

  // Eggs render after birds so they sit "in front" — they're objects on the ground.
  for (const e of eggs) drawEgg(e);

  for (const p of popups) drawPopup(p);
  ctx.restore();
}

function drawBackground() {
  // Grass with subtle striping for texture.
  ctx.fillStyle = COLORS.grassA;
  ctx.fillRect(0, 0, FARM_WIDTH, FARM_HEIGHT);

  ctx.fillStyle = COLORS.grassB;
  const stripeH = 24;
  for (let y = 0; y < FARM_HEIGHT; y += stripeH * 2) {
    ctx.fillRect(0, y, FARM_WIDTH, stripeH);
  }

  // A patch of dirt in one corner just to break up the green.
  ctx.fillStyle = COLORS.dirt;
  ctx.beginPath();
  ctx.ellipse(FARM_WIDTH * 0.78, FARM_HEIGHT * 0.78, 70, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sprinkle a few darker grass tufts (purely decorative, deterministic so
  // they don't dance between frames).
  ctx.fillStyle = 'rgba(60, 110, 50, 0.4)';
  const tufts = TUFTS;
  for (const t of tufts) {
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, t.r, t.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

const TUFTS = (() => {
  // Deterministic pseudo-random tufts so the background is stable.
  const out = [];
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 24; i++) {
    out.push({
      x: rnd() * (FARM_WIDTH - 40) + 20,
      y: rnd() * (FARM_HEIGHT - 40) + 20,
      r: 3 + rnd() * 5,
    });
  }
  return out;
})();

function drawFence() {
  const top = 4;
  const bottom = FARM_HEIGHT - 4;
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.fence;
  // Outer frame
  ctx.strokeRect(2, 2, FARM_WIDTH - 4, FARM_HEIGHT - 4);

  // A few vertical posts on top/bottom to read as a fence.
  ctx.fillStyle = COLORS.fenceLight;
  const posts = 12;
  for (let i = 0; i <= posts; i++) {
    const x = (i / posts) * (FARM_WIDTH - 4) + 2;
    ctx.fillRect(x - 2, top - 2, 4, 12);
    ctx.fillRect(x - 2, bottom - 10, 4, 12);
  }
}

function drawBird(actor, now) {
  const scale = BIRD_SCALE[actor.type] || 1;
  const bob = Math.sin(actor.bobPhase) * 1.4;
  const x = actor.x;
  const y = actor.y + bob;

  // Soft ground shadow
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(actor.x, actor.y + 12 * scale, 12 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (actor.type === 'chicken') drawChicken(x, y, scale, actor.facing, actor.bobPhase);
  else drawGoose(x, y, scale, actor.facing, actor.bobPhase);
}

function drawChicken(x, y, s, facing, phase) {
  const f = facing >= 0 ? 1 : -1;
  // Body
  ctx.fillStyle = COLORS.chickenBody;
  ctx.beginPath();
  ctx.ellipse(x, y, 11 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly highlight
  ctx.fillStyle = COLORS.chickenBelly;
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = COLORS.chickenBody;
  ctx.beginPath();
  ctx.arc(x + 7 * s * f, y - 6 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  // Comb (the little red squiggle on top)
  ctx.fillStyle = COLORS.chickenComb;
  ctx.beginPath();
  ctx.arc(x + 6 * s * f, y - 11 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.arc(x + 8 * s * f, y - 11.6 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = COLORS.chickenBeak;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s * f, y - 6 * s);
  ctx.lineTo(x + 15 * s * f, y - 5 * s);
  ctx.lineTo(x + 12 * s * f, y - 4 * s);
  ctx.closePath();
  ctx.fill();
  // Eye
  ctx.fillStyle = COLORS.eyeDot;
  ctx.beginPath();
  ctx.arc(x + 8 * s * f, y - 7 * s, 0.8 * s, 0, Math.PI * 2);
  ctx.fill();
  // Legs alternate with bob phase for a walking cadence
  ctx.strokeStyle = COLORS.chickenBeak;
  ctx.lineWidth = 1.4 * s;
  const legSwing = Math.sin(phase) * 2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y + 8 * s);
  ctx.lineTo(x - 2 * s + legSwing, y + 13 * s);
  ctx.moveTo(x + 3 * s, y + 8 * s);
  ctx.lineTo(x + 3 * s - legSwing, y + 13 * s);
  ctx.stroke();
  // Tail feather hint (opposite direction of facing)
  ctx.fillStyle = COLORS.chickenBody;
  ctx.beginPath();
  ctx.moveTo(x - 10 * s * f, y - 2 * s);
  ctx.lineTo(x - 14 * s * f, y - 6 * s);
  ctx.lineTo(x - 9 * s * f, y - 4 * s);
  ctx.closePath();
  ctx.fill();
}

function drawGoose(x, y, s, facing, phase) {
  const f = facing >= 0 ? 1 : -1;
  // Body
  ctx.fillStyle = COLORS.gooseBody;
  ctx.beginPath();
  ctx.ellipse(x, y, 13 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Subtle underside shading
  ctx.fillStyle = COLORS.gooseShade;
  ctx.beginPath();
  ctx.ellipse(x, y + 5 * s, 10 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Long neck
  ctx.fillStyle = COLORS.gooseBody;
  ctx.beginPath();
  ctx.ellipse(x + 8 * s * f, y - 7 * s, 3.4 * s, 7 * s, (Math.PI / 8) * f, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(x + 11 * s * f, y - 12 * s, 4.2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = COLORS.gooseBeak;
  ctx.beginPath();
  ctx.moveTo(x + 14 * s * f, y - 12 * s);
  ctx.lineTo(x + 18 * s * f, y - 11 * s);
  ctx.lineTo(x + 14 * s * f, y - 10 * s);
  ctx.closePath();
  ctx.fill();
  // Eye
  ctx.fillStyle = COLORS.eyeDot;
  ctx.beginPath();
  ctx.arc(x + 12 * s * f, y - 13 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.strokeStyle = COLORS.gooseLeg;
  ctx.lineWidth = 1.6 * s;
  const legSwing = Math.sin(phase) * 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y + 8 * s);
  ctx.lineTo(x - 2 * s + legSwing, y + 14 * s);
  ctx.moveTo(x + 4 * s, y + 8 * s);
  ctx.lineTo(x + 4 * s - legSwing, y + 14 * s);
  ctx.stroke();
  // Tail
  ctx.fillStyle = COLORS.gooseBody;
  ctx.beginPath();
  ctx.moveTo(x - 12 * s * f, y - 2 * s);
  ctx.lineTo(x - 17 * s * f, y - 5 * s);
  ctx.lineTo(x - 11 * s * f, y - 5 * s);
  ctx.closePath();
  ctx.fill();
}

function drawEgg(e) {
  const sizeBase = e.type === 'goose' ? 8 : 6;
  // Subtle hover-jiggle that disappears as the egg settles, plus a tiny pop-in.
  const popIn = Math.min(1, e.age / 0.25); // 0..1 over first 250ms
  const removeT = e.removing ? Math.min(1, e.removeAge / 0.4) : 0;
  const alpha = e.removing ? 1 - removeT : 1;
  const scale = (e.removing ? 1 + removeT * 0.8 : popIn);
  const wobble = e.removing ? 0 : Math.sin(e.age * 3 + e.jiggle) * 0.5;

  ctx.save();
  ctx.globalAlpha = alpha;
  // Shadow
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + sizeBase * scale * 0.8, sizeBase * scale, sizeBase * scale * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Egg body
  ctx.fillStyle = e.type === 'goose' ? COLORS.gooseEggShell : COLORS.eggShell;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + wobble, sizeBase * scale * 0.85, sizeBase * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = COLORS.eggShellHi;
  ctx.beginPath();
  ctx.ellipse(e.x - sizeBase * 0.25, e.y - sizeBase * 0.25 + wobble, sizeBase * 0.25, sizeBase * 0.5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Shade
  ctx.fillStyle = COLORS.eggShade;
  ctx.beginPath();
  ctx.ellipse(e.x + sizeBase * 0.3, e.y + sizeBase * 0.4 + wobble, sizeBase * 0.3, sizeBase * 0.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPopup(p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - p.age);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.text, p.x, p.y);
  ctx.restore();
}

// Surfaced for ad-hoc debugging from the devtools console; not for production
// callers. Returns a snapshot of the renderer's local sprite state.
export function _debugFarmView() {
  return {
    eggs: eggs.map((e) => ({ id: e.id, type: e.type, x: e.x, y: e.y, removing: e.removing })),
    actors: [...actors.values()].map((a) => ({ id: a.id, type: a.type, x: a.x, y: a.y })),
  };
}

// ---------- math helpers ----------

function clampX(x) {
  return Math.max(PADDING, Math.min(FARM_WIDTH - PADDING, x));
}
function clampY(y) {
  return Math.max(PADDING, Math.min(FARM_HEIGHT - PADDING, y));
}
function randInRange(a, b) {
  return a + Math.random() * (b - a);
}
