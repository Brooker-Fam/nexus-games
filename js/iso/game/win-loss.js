// ════════════════════════════════════════════════════
//  CITADEL OPS — WIN / LOSS DETECTION + OVERLAY
// ════════════════════════════════════════════════════
//
// A System that scans entities each frame, counts each side's living
// units+buildings, and ends the match when one side hits 0. End-of-game
// shows a DOM overlay (#iso-endgame) — created lazily — with VICTORY
// or DEFEAT, a tagline, and a Play Again button that reboots the match.
//
// The reset path:
//   isoStop()  — tear down RAF + camera
//   isoStart() — fresh world, spawn, AI, win-loss
// So a "Play Again" click is just stop+start; no special reset code.

class IsoWinLossSystem {
  constructor(player, ai){
    this.player    = player;
    this.ai        = ai;
    this.ended     = false;
    this.checkMs   = 0;
  }

  update(dt, world){
    if (this.ended) return;
    // Throttle to ~6Hz; counting on every frame is wasteful.
    this.checkMs += dt;
    if (this.checkMs < 160) return;
    this.checkMs = 0;

    let pAlive = 0, aAlive = 0;
    for (let i = 0; i < world.entities.length; i++){
      const e = world.entities[i];
      if (e.dead) continue;
      if (e.kind !== 'unit' && e.kind !== 'building') continue;
      if (e.side === this.player) pAlive++;
      else if (e.side === this.ai) aAlive++;
    }

    // Guard: never end on tick 1 (entities haven't spawned yet)
    if (pAlive === 0 && aAlive === 0) return;
    if (pAlive === 0){ this._end('defeat'); return; }
    if (aAlive === 0){ this._end('victory'); return; }
  }

  _end(outcome){
    this.ended = true;
    const winner = outcome === 'victory' ? this.player : this.ai;
    isoShowEndOverlay(outcome, winner);
  }
}

// ── DOM overlay ────────────────────────────────────
function isoShowEndOverlay(outcome, winnerSide){
  let el = document.getElementById('iso-endgame');
  if (!el){
    el = document.createElement('div');
    el.id = 'iso-endgame';
    el.className = 'iso-endgame';
    // host inside the iso-stage so it overlays only the canvas, not the
    // whole page
    const stage = document.querySelector('#tab-iso .iso-stage');
    if (stage) stage.appendChild(el);
    else document.body.appendChild(el);
  }
  const isWin = outcome === 'victory';
  const title = isWin ? 'VICTORY' : 'DEFEAT';
  const tagline = isWin
    ? 'The Citadel stands. Your armada holds the high ground.'
    : 'The Citadel falls. Your armada is broken.';
  const accent = (winnerSide && winnerSide.faction) ? winnerSide.faction.color : '#00f5ff';
  const armada = (winnerSide && winnerSide.faction) ? winnerSide.faction.armada : '';

  el.style.setProperty('--iso-end-accent', accent);
  el.innerHTML = `
    <div class="iso-endgame-panel" data-outcome="${outcome}">
      <div class="iso-endgame-eyebrow">${armada}</div>
      <div class="iso-endgame-title">${title}</div>
      <div class="iso-endgame-tagline">${tagline}</div>
      <button class="iso-endgame-btn" id="iso-play-again">PLAY AGAIN</button>
    </div>
  `;
  el.classList.add('show');

  const btn = el.querySelector('#iso-play-again');
  if (btn){
    btn.addEventListener('click', isoResetMatch, { once:true });
  }
}

function isoHideEndOverlay(){
  const el = document.getElementById('iso-endgame');
  if (!el) return;
  el.classList.remove('show');
  el.innerHTML = '';
}

// Hard reset: tear down + restart. Defined separately so the overlay
// button click is a one-line call.
function isoResetMatch(){
  isoHideEndOverlay();
  if (typeof isoStop === 'function') isoStop();
  if (typeof isoStart === 'function') isoStart();
}

window.IsoWinLossSystem = IsoWinLossSystem;
window.isoShowEndOverlay= isoShowEndOverlay;
window.isoHideEndOverlay= isoHideEndOverlay;
window.isoResetMatch    = isoResetMatch;
