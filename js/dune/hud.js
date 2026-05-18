// ── SPICE WARS · HUD ────────────────────────────────────────────────────────
// Sidebar, top-bar resource counters, build button grid, queue progress,
// status line, log, and the victory/defeat overlay. Updated every frame via
// `Hud.update()` from game.js.

(function(){
  const $ = (id) => document.getElementById(id);

  // Wire the build grid once on init — we don't re-create elements every frame.
  let buildButtons = {};
  let lastLogLen = -1;
  let wired = false;

  function build(){
    const grid = $('dune-build-grid');
    if(!grid) return;
    grid.innerHTML = '';
    buildButtons = {};
    for(const key of window.DuneConfig.BUILD_ORDER){
      const cfg = window.DuneConfig.BUILDINGS[key];
      if(!cfg) continue;
      const btn = document.createElement('button');
      btn.className = 'dune-build-btn';
      btn.dataset.type = key;
      btn.innerHTML =
        '<span class="dune-build-name">' + cfg.name.toUpperCase() + '</span>' +
        '<span class="dune-build-cost">' + cfg.cost + 'c · ' + cfg.buildTime + 's</span>' +
        '<span class="dune-build-status" data-role="status"></span>' +
        '<div class="dune-build-progress"><div class="dune-build-progress-bar" data-role="bar"></div></div>';
      btn.onclick = () => onBuildClick(key);
      grid.appendChild(btn);
      buildButtons[key] = btn;
    }
    bindCanvas();
    bindSpeed();
    bindReset();
    wired = true;
  }

  function onBuildClick(type){
    const S = window.DuneState.get();
    if(S.over) return;
    // If clicking a button whose pending placement is ready, switch to drop mode.
    const pending = S.placement.player;
    if(pending && pending.type === type){
      // Already armed; do nothing.
      return;
    }
    const res = window.DuneBuildings.tryQueue(type, 'player');
    if(!res.ok){
      setStatus(res.reason || 'cannot build');
    } else {
      const cfg = window.DuneConfig.BUILDINGS[type];
      setStatus('Building ' + cfg.name + '…');
    }
  }

  function bindCanvas(){
    const canvas = $('duneCanvas');
    if(!canvas || canvas.__duneBound) return;
    canvas.__duneBound = true;

    canvas.addEventListener('mousemove', (e) => {
      const S = window.DuneState.get();
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (canvas.width / r.width);
      const py = (e.clientY - r.top)  * (canvas.height / r.height);
      const tx = Math.floor(px / S.tile);
      const ty = Math.floor(py / S.tile);
      S.hover = { x: tx, y: ty };
    });
    canvas.addEventListener('mouseleave', () => {
      window.DuneState.get().hover = null;
    });
    canvas.addEventListener('click', (e) => {
      const S = window.DuneState.get();
      if(S.over) return;
      const pending = S.placement.player;
      if(!pending) return;
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (canvas.width / r.width);
      const py = (e.clientY - r.top)  * (canvas.height / r.height);
      const tx = Math.floor(px / S.tile);
      const ty = Math.floor(py / S.tile);
      const res = window.DuneBuildings.placePending(pending.type, tx, ty, 'player');
      if(!res.ok){
        setStatus('Invalid location — buildings need rock + free tiles.');
      } else {
        setStatus('Ready for next order.');
      }
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.DuneBuildings.cancelPending('player');
      setStatus('Cancelled placement (credits not refunded).');
    });
  }

  function bindSpeed(){
    const wrap = document.querySelector('.dune-speed-btns');
    if(!wrap || wrap.__duneBound) return;
    wrap.__duneBound = true;
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-btn');
      if(!btn) return;
      const s = parseInt(btn.dataset.duneSpeed, 10) || 1;
      window.DuneState.get().speed = s;
      wrap.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  function bindReset(){
    const btn = $('btn-dune-reset');
    if(!btn || btn.__duneBound) return;
    btn.__duneBound = true;
    btn.onclick = () => {
      if(window.DuneGame && window.DuneGame.startNew) window.DuneGame.startNew();
    };
  }

  function setStatus(msg){
    const el = $('dune-status');
    if(el) el.textContent = msg;
  }

  function update(){
    if(!wired) return;
    const S = window.DuneState.get();
    const snap = window.DuneEconomy.snapshot('player');

    // Top stats
    $('dune-credits').textContent = Math.floor(snap.credits);
    $('dune-power').textContent = snap.produced + ' / ' + snap.used;
    const powerEl = $('dune-power');
    powerEl.style.color = snap.ok ? '' : '#ff924a';
    $('dune-storage').textContent = Math.floor(snap.credits) + ' / ' + snap.storage;

    // Build buttons
    const opts = window.DuneBuildings.optionsFor('player');
    const pending = S.placement.player;
    const queue = S.queues.player;
    const inProgress = queue[0] || null;
    for(const o of opts){
      const btn = buildButtons[o.type];
      if(!btn) continue;
      btn.classList.remove('locked', 'queued', 'ready');
      const statusEl = btn.querySelector('[data-role="status"]');
      const barEl = btn.querySelector('[data-role="bar"]');
      statusEl.textContent = '';
      statusEl.classList.remove('ready');
      barEl.style.width = '0%';

      if(pending && pending.type === o.type){
        btn.classList.add('ready');
        statusEl.textContent = 'PLACE';
        statusEl.classList.add('ready');
        btn.disabled = false;
      } else if(inProgress && inProgress.type === o.type){
        btn.classList.add('queued');
        const pct = Math.min(100, Math.floor(100 * inProgress.progress / inProgress.total));
        barEl.style.width = pct + '%';
        statusEl.textContent = pct + '%' + (inProgress.paused ? ' (LOW POWER)' : '');
        btn.disabled = true;
      } else if(!o.ok){
        btn.classList.add('locked');
        btn.disabled = true;
        btn.title = o.reason || '';
      } else {
        btn.disabled = !!pending;   // can't queue while awaiting placement
        btn.title = '';
      }
    }

    // Place hint
    const hint = $('dune-place-hint');
    if(pending){
      const cfg = window.DuneConfig.BUILDINGS[pending.type];
      hint.textContent = 'CLICK MAP TO PLACE ' + cfg.name.toUpperCase() +
                         ' (right-click to cancel)';
      hint.style.color = 'var(--neon-green)';
    } else if(inProgress){
      hint.textContent = 'BUILDING IN PROGRESS…';
      hint.style.color = '';
    } else {
      hint.textContent = 'CLICK A STRUCTURE TO BUILD';
      hint.style.color = '';
    }

    // Queue panel
    const queueEl = $('dune-queue');
    if(!queue.length && !pending){
      if(queueEl.dataset.state !== 'empty'){
        queueEl.innerHTML = '<div class="dune-queue-empty">Idle</div>';
        queueEl.dataset.state = 'empty';
      }
    } else {
      queueEl.dataset.state = 'active';
      let html = '';
      if(inProgress){
        const cfg = window.DuneConfig.BUILDINGS[inProgress.type];
        const pct = Math.min(100, Math.floor(100 * inProgress.progress / inProgress.total));
        const cls = inProgress.paused ? 'paused' : '';
        html += '<div class="dune-queue-item ' + cls + '">' +
          '<span class="dune-queue-name">' + cfg.name + '</span>' +
          '<div class="dune-queue-progress"><div class="dune-queue-progress-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="dune-queue-tag">' + (inProgress.paused ? 'LOW PWR' : pct + '%') + '</span>' +
          '</div>';
      }
      if(pending){
        const cfg = window.DuneConfig.BUILDINGS[pending.type];
        html += '<div class="dune-queue-item ready">' +
          '<span class="dune-queue-name">' + cfg.name + '</span>' +
          '<div class="dune-queue-progress"><div class="dune-queue-progress-bar" style="width:100%"></div></div>' +
          '<span class="dune-queue-tag">READY</span>' +
          '</div>';
      }
      queueEl.innerHTML = html;
    }

    // Log
    if(S.log.length !== lastLogLen){
      lastLogLen = S.log.length;
      const logEl = $('dune-log');
      logEl.innerHTML = S.log.slice(0, 12)
        .map(l => '<div class="dune-log-line ' + (l.level || '') + '">› ' + escapeHtml(l.msg) + '</div>')
        .join('');
    }

    // Overlay
    const overlay = $('duneOverlay');
    if(S.over){
      overlay.style.display = '';
      overlay.classList.toggle('defeat', S.over === 'defeat');
      $('duneOverlayTitle').textContent = S.over === 'victory' ? 'VICTORY' : 'DEFEAT';
      $('duneOverlaySub').textContent = S.over === 'victory'
        ? 'The Harkonnen base lies in ruins.'
        : 'Your forces have been swept from Arrakis.';
    } else {
      overlay.style.display = 'none';
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  window.DuneHud = {
    build,
    update,
    setStatus,
  };
})();
