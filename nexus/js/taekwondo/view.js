export function createDojoView(container) {
  container.innerHTML = `
    <section class="tkd-dojo" aria-labelledby="tkd-title">
      <div class="tkd-heading">
        <div>
          <p class="tkd-eyebrow">TAEKWONDO · CAMERA ARCADE</p>
          <h1 id="tkd-title">NEON <span>DOJO</span></h1>
          <p class="tkd-tagline">Find your stance. Hit your rhythm.</p>
        </div>
        <div class="tkd-stats" aria-label="Round statistics">
          <div class="tkd-stat"><span>Score</span><strong data-ref="score">0</strong></div>
          <div class="tkd-stat"><span>Combo</span><strong data-ref="combo">0</strong></div>
          <div class="tkd-stat"><span>Seconds</span><strong data-ref="time">60</strong></div>
          <div class="tkd-stat"><span>Best</span><strong data-ref="best">0</strong></div>
        </div>
      </div>
      <div class="tkd-layout">
        <div class="tkd-main">
          <div class="tkd-stage ph-no-capture" data-ph-no-capture>
            <canvas class="ph-no-capture" data-ref="canvas" width="960" height="540" aria-label="Neon Dojo playing area. In demo mode, tap the glowing pads or use A and D." tabindex="0"></canvas>
            <video class="ph-no-capture" data-ref="video" autoplay playsinline muted hidden aria-hidden="true"></video>
            <div class="tkd-stage-label" aria-hidden="true"><span></span> NEXUS TRAINING SYSTEM</div>
            <div class="tkd-overlay" data-ref="overlay">
              <p class="tkd-kicker">60 SECOND CHALLENGE</p>
              <h2 data-ref="overlayTitle">Your body.<br>Your controller.</h2>
              <p data-ref="overlayText">Kick the glowing pads, keep your combo alive, and make every strike count.</p>
            </div>
            <div class="tkd-countdown" data-ref="countdown" aria-live="assertive" hidden></div>
            <div class="tkd-stage-footer" aria-hidden="true"><span>FOCUS / CONTROL / RHYTHM</span><span>01 / DOJO</span></div>
          </div>
          <div class="tkd-statusbar">
            <span class="tkd-status-light" aria-hidden="true"></span>
            <p data-ref="status" role="status" aria-live="polite">Ready when you are.</p>
          </div>
          <progress class="tkd-calibration" data-ref="calibrationFill" max="100" value="0" aria-label="Body calibration progress" hidden></progress>
          <p class="tkd-hint" data-ref="hint">Enable your camera to play, or try the demo first.</p>
          <section class="tkd-results" data-ref="results" aria-label="Round results" hidden>
            <div class="tkd-results-title"><span>ROUND COMPLETE</span><h2>That's a wrap.</h2></div>
            <div class="tkd-result-grid">
              <div><strong data-ref="resultScore">0</strong><span>Score</span></div>
              <div><strong data-ref="resultHits">0</strong><span>Pads hit</span></div>
              <div><strong data-ref="resultCombo">0</strong><span>Best combo</span></div>
              <div><strong data-ref="resultAccuracy">0%</strong><span>Targets hit</span></div>
            </div>
            <button class="tkd-button tkd-button-primary" data-ref="retryButton" type="button">Play again <span aria-hidden="true">↗</span></button>
          </section>
        </div>
        <aside class="tkd-sidebar" aria-label="Game controls and instructions">
          <div class="tkd-control-card">
            <div class="tkd-card-heading"><span class="tkd-step">01</span><h2>Enter the dojo</h2></div>
            <p class="tkd-card-copy">A camera, a little space, and your best controlled kicks.</p>
            <button class="tkd-button tkd-button-primary" data-ref="startButton" type="button">Enable camera <span aria-hidden="true">↗</span></button>
            <button class="tkd-button tkd-button-secondary" data-ref="demoButton" type="button">Try demo <span aria-hidden="true">→</span></button>
            <label class="tkd-difficulty" for="tkd-difficulty">Pace
              <select data-ref="difficultySelect" id="tkd-difficulty">
                <option value="easy" selected>Easy · find your rhythm</option>
                <option value="normal">Normal · pick up the pace</option>
              </select>
            </label>
            <div class="tkd-session-controls">
              <button class="tkd-button tkd-button-small" data-ref="pauseButton" type="button" hidden>Pause</button>
              <button class="tkd-button tkd-button-small" data-ref="stopButton" type="button" hidden>Stop</button>
              <button class="tkd-button tkd-button-small" data-ref="recalibrateButton" type="button" hidden>Recalibrate</button>
              <button class="tkd-button tkd-button-small" data-ref="soundButton" type="button" aria-pressed="true">Sound on</button>
            </div>
            <p class="tkd-privacy"><span aria-hidden="true">◈</span> Camera footage is processed locally on your device.</p>
          </div>
          <div class="tkd-howto">
            <div class="tkd-card-heading"><span class="tkd-step">02</span><h2>Make room to move</h2></div>
            <ol>
              <li><strong>Frame your whole body.</strong> One person, good light, head and feet visible.</li>
              <li><strong>Stand comfortably.</strong> Hold still while the game finds your stance.</li>
              <li><strong>Kick the pads.</strong> Use either foot and return to your stance.</li>
            </ol>
            <p class="tkd-space-note">Clear the area around you. Keep kicks low and controlled. This is a game, not a technique assessment.</p>
          </div>
          <div class="tkd-demo-help"><strong>JUST EXPLORING?</strong><p>In demo, tap or click a pad, or use <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> to strike. <kbd>Esc</kbd> pauses.</p></div>
        </aside>
      </div>
      <div class="tkd-lock" data-ref="lockPanel" hidden>
        <div class="tkd-lock-card">
          <p class="tkd-eyebrow">NEXUS PRO</p>
          <h2>Neon Dojo is a PRO exclusive.</h2>
          <p>Upgrade to Nexus PRO to unlock the camera dojo, plus every alternate skin and the full book.</p>
          <button class="tkd-button tkd-button-primary" data-ref="lockUpgradeButton" type="button">Upgrade to PRO <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </section>`;
  const refs = {};
  container.querySelectorAll('[data-ref]').forEach(element => {
    refs[element.dataset.ref] = element;
  });
  refs.video.muted = true;
  return refs;
}

//# sourceMappingURL=view.js.map
