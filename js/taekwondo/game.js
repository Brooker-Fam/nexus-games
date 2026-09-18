import { createDojoView } from './view.js';
import { DojoRenderer } from './renderer.js';
import { createPoseTracker } from './tracker.js';
import { bodyVisible, measureStance, KickDetector, DojoRound, DEMO_STANCE } from './model.js';

const container = document.getElementById('tab-tkd');
const view = createDojoView(container);
const renderer = new DojoRenderer(view.canvas);
let active = false;
let locked = true;
let phase = 'idle';
let mode = 'camera';
let sound = true;
let round = null;
let detector = null;
let calibration = null;
let calibrationSeconds = 0;
let calibrationTimestamp = 0;
let landmarks = null;
let lastPoseTime = 0;
let countdown = 3;
let previousFrame = 0;
let animation = 0;
let startAttempt = 0;
let savedPhase = null;
let wasTracked = false;

const tracker = createPoseTracker({
  video: view.video,
  onPose: receivePose,
  onStatus: status => {
    if (status === 'requesting') setStatus('Allow camera access to enter the dojo.');
    if (status === 'loading') setStatus('Loading body tracking. The first download may take a moment.');
  },
  onError: cameraError,
});

function setStatus(message) {
  if (view.status.textContent !== message) view.status.textContent = message;
}

// Neon Dojo is a Nexus MAX exclusive (see js/shared/memberships.js). Locked
// by default until membership status resolves, so gameplay never starts
// unentitled while that fetch is in flight.
function applyLock() {
  locked = !window.nexusMaxActive;
  view.lockPanel.hidden = !locked;
  view.startButton.disabled = locked;
  view.demoButton.disabled = locked;
  if (locked && active && !['idle', 'results', 'error'].includes(phase)) {
    stopSession('Locked. Upgrade to Nexus MAX to keep training.');
  }
}
window.renderTkdLock = applyLock;

function bestKey() {
  return `nexus-dojo-best-${mode}-${view.difficultySelect.value}`;
}

function readBest() {
  try { return Math.max(0, Number(localStorage.getItem(bestKey())) || 0); }
  catch { return 0; }
}

function updateHud() {
  view.score.textContent = String(round?.score || 0);
  view.combo.textContent = `${round?.combo || 0}×`;
  view.time.textContent = `${Math.ceil(round?.remaining ?? 60)}s`;
  view.best.textContent = String(readBest());
}

function controls() {
  const ongoing = !['idle', 'error', 'results'].includes(phase);
  view.startButton.hidden = ongoing;
  view.demoButton.hidden = ongoing;
  view.stopButton.hidden = !ongoing;
  view.recalibrateButton.hidden = !ongoing || mode !== 'camera' || phase === 'loading';
  view.pauseButton.hidden = !['countdown', 'playing', 'paused'].includes(phase);
  view.pauseButton.textContent = phase === 'paused' ? 'Resume' : 'Pause';
  view.difficultySelect.disabled = ongoing;
  view.overlay.hidden = !['idle', 'loading', 'error', 'paused'].includes(phase);
  view.countdown.hidden = phase !== 'countdown';
  view.calibrationFill.hidden = phase !== 'calibrating';
  view.results.hidden = phase !== 'results';
  container.dataset.mode = mode;
  container.dataset.phase = phase;
  view.canvas.setAttribute('aria-label', mode === 'demo'
    ? 'Demo dojo. Click the glowing pad, or use A and D for left and right pads.'
    : 'Mirrored camera dojo with virtual kick targets.');
}

function stopSession(message = 'Camera off. Ready when you are.') {
  startAttempt++;
  tracker.stop();
  phase = 'idle';
  round = null;
  landmarks = null;
  calibration = null;
  detector = null;
  savedPhase = null;
  wasTracked = false;
  view.overlayTitle.textContent = 'Your body. Your controller.';
  view.overlayText.textContent = 'Step into the frame. Kick the glowing pads. Build your combo.';
  view.hint.textContent = 'One player · 60 seconds · Controlled kicks';
  controls();
  updateHud();
  setStatus(message);
}

async function startCamera() {
  if (locked) return;
  stopSession();
  mode = 'camera';
  phase = 'loading';
  const attempt = ++startAttempt;
  view.overlayTitle.textContent = 'Opening the dojo';
  view.overlayText.textContent = 'Your camera stays on this device. Stand where your whole body fits in view.';
  controls();
  try {
    await tracker.start();
    if (!active || attempt !== startAttempt) return;
    recalibrate();
  } catch (error) {
    if (attempt === startAttempt && error.name !== 'AbortError') cameraError(error);
  }
}

function cameraError(error) {
  if (!active) return;
  stopSession();
  phase = 'error';
  view.overlayTitle.textContent = 'Camera could not start';
  const messages = {
    NotAllowedError: 'Camera access was blocked. Allow it in your browser’s site settings, then try again.',
    NotFoundError: 'No camera was found. Connect one, or try the demo.',
    NotReadableError: 'The camera is busy or unavailable. Close other camera apps, then try again.',
    SecurityError: 'Open the game over HTTPS or localhost to use the camera.',
  };
  const message = messages[error.name] || error.message || 'Body tracking could not load. Check your connection and try again, or play the demo.';
  view.overlayText.textContent = message;
  setStatus(message);
  controls();
  if (!['NotAllowedError', 'NotFoundError', 'AbortError'].includes(error.name)) {
    window.posthog?.captureException?.(error, { game: 'taekwondo', phase: 'camera' });
  }
}

function recalibrate() {
  phase = 'calibrating';
  round = null;
  detector = null;
  calibration = null;
  calibrationSeconds = 0;
  calibrationTimestamp = 0;
  view.calibrationFill.value = 0;
  view.hint.textContent = 'Stand with both feet down. Keep your shoulders, knees and feet in view.';
  setStatus('Step back until your full body is visible, then hold still for two seconds.');
  controls();
  updateHud();
}

function startDemo() {
  if (locked) return;
  stopSession();
  mode = 'demo';
  calibration = { ...DEMO_STANCE };
  beginCountdown();
}

function beginCountdown() {
  phase = 'countdown';
  countdown = 3;
  previousFrame = performance.now();
  round = new DojoRound(calibration, view.difficultySelect.value);
  detector = new KickDetector(calibration);
  view.countdown.textContent = '3';
  view.hint.textContent = mode === 'demo'
    ? 'DEMO · Click or tap a pad. A / ← = left, D / → = right. Esc pauses.'
    : 'Kick the pad, then put your foot down. Pads stay below hip height. Esc pauses.';
  setStatus(mode === 'demo' ? 'Demo mode. No camera needed.' : 'Body calibrated. Get ready.');
  controls();
  updateHud();
}

function receivePose(points, timestamp) {
  if (!active || mode !== 'camera' || phase === 'idle') return;
  const age = performance.now() - timestamp;
  if (!Number.isFinite(timestamp) || age < 0 || age > 350 || timestamp <= lastPoseTime) {
    landmarks = null;
    detector?.reset();
    if (phase === 'calibrating') {
      calibrationSeconds = 0;
      calibration = null;
      view.calibrationFill.value = 0;
    }
    return;
  }
  landmarks = points.map(point => ({ ...point, x: 1 - point.x }));
  lastPoseTime = timestamp;
  if (!bodyVisible(landmarks)) {
    detector?.reset();
    if (phase === 'calibrating') {
      calibrationSeconds = 0;
      calibration = null;
      view.calibrationFill.value = 0;
      setStatus('Keep your shoulders, knees and both feet inside the camera view.');
    }
    return;
  }
  if (phase === 'calibrating') sampleCalibration(timestamp);
  if (phase === 'playing' && detector.update(landmarks, timestamp, round.target)) registerHit();
  if (phase === 'countdown') detector.update(landmarks, timestamp, null);
}

function sampleCalibration(timestamp) {
  const aspect = view.video.videoWidth / view.video.videoHeight || 16 / 9;
  const sample = measureStance(landmarks, aspect);
  const elapsed = (timestamp - calibrationTimestamp) / 1000;
  calibrationTimestamp = timestamp;
  const stable = sample && calibration && elapsed > 0 && elapsed < 0.25
    && Math.abs(sample.centerX - calibration.centerX) * aspect < 0.05
    && Math.abs(sample.floorY - calibration.floorY) < 0.05
    && Math.abs(sample.shoulderY - calibration.shoulderY) < 0.05;
  calibrationSeconds = stable ? calibrationSeconds + elapsed : 0;
  calibration = sample;
  view.calibrationFill.value = Math.min(100, calibrationSeconds / 2 * 100);
  setStatus(sample ? 'Hold your stance… calibrating your reach.' : 'Stand upright with both feet on the floor.');
  if (calibrationSeconds >= 2) beginCountdown();
}

function registerHit() {
  const hit = round?.hit();
  if (!hit) return;
  renderer.burst(hit.x, hit.y, `+${hit.points}`);
  if (sound) {
    window.sfxNoise?.(0.13, 0.1, 2200);
    window.sfxTone?.(180 + round.combo * 12, 'sine', 0.14, 0.008, 0.14, 80);
  }
  updateHud();
}

function finishRound() {
  phase = 'results';
  tracker.stop();
  landmarks = null;
  if (round.score > readBest()) {
    try { localStorage.setItem(bestKey(), String(round.score)); } catch {}
  }
  view.resultScore.textContent = String(round.score);
  view.resultHits.textContent = String(round.hits);
  view.resultCombo.textContent = `${round.bestCombo}×`;
  view.resultAccuracy.textContent = `${round.accuracy}%`;
  setStatus(mode === 'demo' ? 'Demo complete. Enable your camera to play with kicks.' : 'Round complete. Camera off.');
  controls();
  updateHud();
}

function togglePause() {
  if (phase === 'paused') {
    phase = savedPhase;
    savedPhase = null;
    previousFrame = performance.now();
    detector?.reset();
  } else if (phase === 'playing' || phase === 'countdown') {
    savedPhase = phase;
    phase = 'paused';
    view.overlayTitle.textContent = 'Take a breath';
    view.overlayText.textContent = 'Your round is paused. Resume when you are ready.';
    setStatus(mode === 'camera' ? 'Paused. Camera is on; Stop turns it off.' : 'Demo paused.');
  }
  controls();
}

function frame(now) {
  if (!active) return;
  animation = requestAnimationFrame(frame);
  const elapsed = (now - previousFrame) / 1000;
  if (elapsed < (phase === 'idle' || phase === 'results' ? 1 / 20 : 1 / 60)) return;
  previousFrame = now;
  const tracked = mode === 'demo' || (now - lastPoseTime < 350 && bodyVisible(landmarks));
  if (phase === 'playing' || phase === 'countdown') {
    if (!tracked) {
      detector?.reset();
      setStatus('Tracking paused. Bring your full body back into view. Your timer is frozen.');
    } else {
      setStatus(mode === 'demo' ? 'DEMO · Click a pad or use A / D.' : 'Tracking your feet. Kick across a pad, then return to your stance.');
      if (wasTracked) {
        if (phase === 'countdown') {
          countdown -= elapsed;
          view.countdown.textContent = String(Math.max(1, Math.ceil(countdown)));
          if (countdown <= 0) {
            phase = 'playing';
            controls();
          }
        } else {
          round.advance(elapsed);
          updateHud();
          if (round.finished) finishRound();
        }
      }
    }
  }
  wasTracked = tracked;
  renderer.render({
    video: mode === 'camera' && view.video.srcObject ? view.video : null,
    landmarks: now - lastPoseTime < 350 ? landmarks : null,
    target: phase === 'playing' ? round?.target : null,
    phase, calibration, time: now / 1000, delta: Math.min(elapsed, 0.1), showSkeleton: true,
  });
}

view.startButton.addEventListener('click', startCamera);
view.demoButton.addEventListener('click', startDemo);
view.lockUpgradeButton.addEventListener('click', () => {
  const btn = document.getElementById('tab-btn-memberships');
  if (btn) window.switchTab('memberships', btn);
});
view.stopButton.addEventListener('click', () => stopSession());
view.recalibrateButton.addEventListener('click', recalibrate);
view.pauseButton.addEventListener('click', togglePause);
view.retryButton.addEventListener('click', () => mode === 'demo' ? startDemo() : startCamera());
view.difficultySelect.addEventListener('change', updateHud);
view.soundButton.addEventListener('click', () => {
  sound = !sound;
  view.soundButton.textContent = sound ? 'Sound on' : 'Sound off';
  view.soundButton.setAttribute('aria-pressed', String(sound));
});
view.canvas.addEventListener('pointerdown', event => {
  if (mode !== 'demo' || phase !== 'playing' || !round.target) return;
  const bounds = view.canvas.getBoundingClientRect();
  const { x, y, width, height } = renderer.viewport;
  const px = (event.clientX - bounds.left) / bounds.width * renderer.width;
  const py = (event.clientY - bounds.top) / bounds.height * renderer.height;
  const target = round.target;
  if (Math.hypot(px - x - target.x * width, py - y - target.y * height) <= target.radius * height * 1.2) registerHit();
});
window.addEventListener('keydown', event => {
  if (!active || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  if (event.key === 'Escape') togglePause();
  if (mode !== 'demo' || phase !== 'playing' || event.repeat) return;
  const key = event.key.toLowerCase();
  const side = ['a', 'arrowleft'].includes(key) ? 'left' : ['d', 'arrowright'].includes(key) ? 'right' : null;
  if (side) event.preventDefault();
  if (side && round.target?.side === side) registerHit();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active && !['idle', 'results', 'error'].includes(phase)) {
    stopSession('Session stopped because the page was hidden. Start again when you are ready.');
  }
});
window.addEventListener('pagehide', () => tracker.stop());

window.registerGame('tkd', {
  init() {
    active = true;
    stopSession();
    applyLock();
    previousFrame = performance.now();
    animation = requestAnimationFrame(frame);
  },
  cleanup() {
    active = false;
    cancelAnimationFrame(animation);
    stopSession();
  },
});
document.getElementById('tab-btn-tkd').addEventListener('click', function () {
  window.switchTab('tkd', this);
});
if (location.hash === '#taekwondo') window.switchTab('tkd', document.getElementById('tab-btn-tkd'));

//# sourceMappingURL=game.js.map
