// ══════════════════════════════════════════════
//  DOOM — Game flow (menus, transitions, restart)
// ══════════════════════════════════════════════
//  State machine:
//    title    → "press any key / pick a level"
//    briefing → between-level card ("ENTERING <NAME>")
//    playing  → in-game (game.js loop runs)
//    death    → restart current level / back to title
//    victory  → final win screen
//
//  This module is intentionally additive — it injects extra overlay
//  DOM into the existing #tab-doom container and monkey-patches the
//  game registration so the title screen shows up before gameplay
//  starts. Carlos's foundation (game.js) calls back into doomOnLevelEnd
//  and doomOnReset hooks when those callbacks are installed; otherwise
//  it falls back to its original behaviour.
//
//  All overlays use the existing .overlay styling from base.css so the
//  visual language matches the rest of Nexus Games.

(function(){
  const STATE = {
    title:    'title',
    briefing: 'briefing',
    playing:  'playing',
    death:    'death',
    victory:  'victory',
  };
  const flow = {
    phase: STATE.title,
    levelIndex: 0,
    selectedLevel: 0,
    music: true,
    levelStartTime: 0,
  };

  function levels(){
    return window.DOOM_LEVELS || [];
  }

  // ── DOM helpers ──
  let dom = null;
  function buildDom(){
    if(dom) return dom;
    const wrap = document.querySelector('#tab-doom .doom-canvas-wrap');
    if(!wrap) return null;
    const root = document.createElement('div');
    root.className = 'doom-flow';
    root.innerHTML = `
      <div class="doom-flow-title" data-phase="title">
        <div class="doom-flow-logo">CITADEL <span>OF DOOM</span></div>
        <div class="doom-flow-tag">A NEXUS GAMES RAYCAST EXPERIENCE</div>
        <div class="doom-flow-levels"></div>
        <div class="doom-flow-actions">
          <button class="overlay-btn doom-flow-btn-start">▶ ENTER THE CITADEL</button>
          <button class="overlay-btn ghost doom-flow-btn-music">♪ MUSIC: ON</button>
        </div>
        <div class="doom-flow-hint">SELECT FLOOR · PRESS ENTER OR CLICK START</div>
      </div>

      <div class="doom-flow-brief" data-phase="briefing">
        <div class="doom-flow-brief-num"></div>
        <div class="doom-flow-brief-name"></div>
        <div class="doom-flow-brief-sub"></div>
      </div>

      <div class="doom-flow-end" data-phase="death">
        <div class="doom-flow-end-title lose">YOU DIED</div>
        <div class="doom-flow-end-sub">THE CITADEL CLAIMED YOU</div>
        <div class="doom-flow-actions">
          <button class="overlay-btn doom-flow-btn-retry">⟳ RESTART FLOOR</button>
          <button class="overlay-btn ghost doom-flow-btn-menu">◀ MAIN MENU</button>
        </div>
      </div>

      <div class="doom-flow-end" data-phase="victory">
        <div class="doom-flow-end-title win">CITADEL PURGED</div>
        <div class="doom-flow-end-sub">YOU WIN</div>
        <div class="doom-flow-end-stats"></div>
        <div class="doom-flow-actions">
          <button class="overlay-btn doom-flow-btn-newgame">↻ NEW GAME</button>
          <button class="overlay-btn ghost doom-flow-btn-menu">◀ MAIN MENU</button>
        </div>
      </div>
    `;
    wrap.appendChild(root);
    dom = {
      root,
      title:      root.querySelector('[data-phase="title"]'),
      briefing:   root.querySelector('[data-phase="briefing"]'),
      death:      root.querySelector('[data-phase="death"]'),
      victory:    root.querySelector('[data-phase="victory"]'),
      levelList:  root.querySelector('.doom-flow-levels'),
      btnStart:   root.querySelector('.doom-flow-btn-start'),
      btnMusic:   root.querySelector('.doom-flow-btn-music'),
      btnRetry:   root.querySelector('.doom-flow-btn-retry'),
      btnNewgame: root.querySelector('.doom-flow-btn-newgame'),
      btnsMenu:   root.querySelectorAll('.doom-flow-btn-menu'),
      briefNum:   root.querySelector('.doom-flow-brief-num'),
      briefName:  root.querySelector('.doom-flow-brief-name'),
      briefSub:   root.querySelector('.doom-flow-brief-sub'),
      endStats:   root.querySelector('.doom-flow-end-stats'),
    };
    wireDom();
    renderLevelList();
    return dom;
  }

  function renderLevelList(){
    if(!dom) return;
    const cat = levels();
    dom.levelList.innerHTML = '';
    cat.forEach((lvl, i) => {
      const btn = document.createElement('button');
      btn.className = 'doom-flow-level' + (i === flow.selectedLevel ? ' active' : '');
      btn.dataset.idx = i;
      btn.innerHTML = `
        <span class="doom-flow-level-num">FLOOR ${i + 1}</span>
        <span class="doom-flow-level-name">${lvl.name}</span>
        <span class="doom-flow-level-sub">${lvl.subtitle || ''}</span>
      `;
      btn.onclick = () => {
        flow.selectedLevel = i;
        sfxSafe('doomMenuMove');
        renderLevelList();
      };
      dom.levelList.appendChild(btn);
    });
  }

  function wireDom(){
    dom.btnStart.onclick = () => startGame(flow.selectedLevel);
    dom.btnMusic.onclick = () => {
      flow.music = !flow.music;
      dom.btnMusic.textContent = flow.music ? '♪ MUSIC: ON' : '♪ MUSIC: OFF';
      if(typeof doomMusicSetEnabled === 'function') doomMusicSetEnabled(flow.music);
      sfxSafe('doomMenuMove');
    };
    dom.btnRetry.onclick = () => restartCurrentLevel();
    dom.btnNewgame.onclick = () => startGame(0);
    dom.btnsMenu.forEach(b => b.onclick = () => showTitle());
  }

  // ── Phase transitions ──
  function setPhase(phase){
    flow.phase = phase;
    if(!dom) return;
    for(const p of Object.values(STATE)){
      if(!dom[p]) continue;
      dom[p].classList.toggle('show', p === phase);
    }
    dom.root.classList.toggle('doom-flow-active', phase !== STATE.playing);
  }

  function showTitle(){
    if(typeof doomMusicStop === 'function') doomMusicStop();
    if(document.pointerLockElement) document.exitPointerLock();
    if(typeof doomState !== 'undefined' && doomState){
      // Freeze gameplay while the title is up — the loop keeps rendering
      // the world behind the overlay, which looks nice as a backdrop.
      doomState.gameOver = true;
    }
    flow.levelIndex = 0;
    setPhase(STATE.title);
    renderLevelList();
  }

  function startGame(levelIdx){
    sfxSafe('doomMenuPick');
    flow.selectedLevel = levelIdx;
    enterLevel(levelIdx);
  }

  function enterLevel(idx){
    const cat = levels();
    if(!cat[idx]){
      // No catalog — just play the default map.
      idx = 0;
    }
    flow.levelIndex = idx;
    const lvl = (typeof doomLoadLevel === 'function')
      ? doomLoadLevel(idx)
      : { name: 'CITADEL', subtitle: '', music: 'doomMusicHangar' };
    if(typeof doomRestartCurrentLevel === 'function'){
      doomRestartCurrentLevel();
    }
    // Freeze gameplay while the briefing card is showing — enemies
    // shouldn't be roaming behind the curtain.
    if(typeof doomState !== 'undefined' && doomState){
      doomState.gameOver = true;
    }
    // Show the briefing card briefly, then drop into gameplay.
    setPhase(STATE.briefing);
    if(dom){
      dom.briefNum.textContent  = `FLOOR ${idx + 1}`;
      dom.briefName.textContent = lvl.name || 'CITADEL';
      dom.briefSub.textContent  = lvl.subtitle || '';
    }
    sfxSafe('doomLevelStart');
    flow.levelStartTime = performance.now();

    setTimeout(() => {
      setPhase(STATE.playing);
      // Resume gameplay: clear gameOver and arm the loop's last-time so dt is sane.
      if(typeof doomState !== 'undefined' && doomState){
        doomState.gameOver = false;
        doomState.won = false;
      }
      if(typeof doomLastTime !== 'undefined'){
        doomLastTime = performance.now();
      }
      if(flow.music && typeof doomMusicStart === 'function'){
        doomMusicStart(lvl.music || 'doomMusicHangar');
      }
      if(window.posthog) posthog.capture('doom_level_started', {
        level_index: idx, level_id: lvl.id, level_name: lvl.name,
      });
    }, 1100);
  }

  function restartCurrentLevel(){
    sfxSafe('doomMenuPick');
    enterLevel(flow.levelIndex);
  }

  function advanceOrWin(){
    const cat = levels();
    if(flow.levelIndex + 1 < cat.length){
      enterLevel(flow.levelIndex + 1);
    } else {
      // Final win.
      if(typeof doomMusicStop === 'function') doomMusicStop();
      setPhase(STATE.victory);
      if(dom){
        const haveState = (typeof doomState !== 'undefined') && doomState;
        const kills = haveState ? doomState.player.kills : 0;
        const hp = haveState ? Math.max(0, doomState.player.hp | 0) : 0;
        const elapsed = Math.round((performance.now() - flow.levelStartTime) / 1000);
        dom.endStats.textContent = `${kills} KILLS · ${hp} HP · ${elapsed}s`;
      }
      sfxSafe('doomVictory');
      if(window.posthog) posthog.capture('doom_run_completed', {
        kills: (typeof doomState !== 'undefined' && doomState) ? doomState.player.kills : 0,
        levels: cat.length,
      });
    }
  }

  function onPlayerDied(){
    if(typeof doomMusicStop === 'function') doomMusicStop();
    setPhase(STATE.death);
    sfxSafe('doomDie');
  }

  function sfxSafe(name){
    if(typeof sfx === 'function') sfx(name);
  }

  // ── Hooks called from game.js ──
  // doomEnd(won) defers to doomOnLevelEnd when present.
  window.doomOnLevelEnd = function(won){
    if(won) advanceOrWin();
    else onPlayerDied();
  };
  // The HUD restart button (#btn-doom-reset) routes here via init.js;
  // we also expose this so external callers can ask for "restart current".
  window.doomOnReset = function(){
    if(flow.phase === STATE.playing || flow.phase === STATE.death){
      restartCurrentLevel();
    } else {
      // From title/victory screens, "restart" means "back to title".
      showTitle();
    }
  };

  // Keyboard shortcuts on menus: Enter to confirm, arrows to pick a level.
  function onKey(e){
    if(flow.phase === STATE.title){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        startGame(flow.selectedLevel);
      } else if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){
        flow.selectedLevel = Math.min(levels().length - 1, flow.selectedLevel + 1);
        sfxSafe('doomMenuMove');
        renderLevelList();
      } else if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){
        flow.selectedLevel = Math.max(0, flow.selectedLevel - 1);
        sfxSafe('doomMenuMove');
        renderLevelList();
      }
    } else if(flow.phase === STATE.death){
      if(e.key === 'Enter' || e.key === 'r' || e.key === 'R'){
        e.preventDefault();
        restartCurrentLevel();
      } else if(e.key === 'Escape'){
        showTitle();
      }
    } else if(flow.phase === STATE.victory){
      if(e.key === 'Enter') startGame(0);
      else if(e.key === 'Escape') showTitle();
    }
  }

  // ── Wrap the existing registered doom game so init shows the title. ──
  function install(){
    buildDom();
    if(typeof games === 'undefined' || !games.doom){
      // game.js wasn't loaded yet — defer.
      setTimeout(install, 30);
      return;
    }
    const orig = games.doom;
    if(orig.__flowWrapped) return;
    const wrapped = {
      __flowWrapped: true,
      init(){
        orig.init();           // wire engine input + start loop
        showTitle();
        document.addEventListener('keydown', onKey);
      },
      cleanup(){
        document.removeEventListener('keydown', onKey);
        if(typeof doomMusicStop === 'function') doomMusicStop();
        orig.cleanup();
      },
    };
    games.doom = wrapped;
  }

  // Run after DOM is ready (the script tag is at the bottom of index.html
  // so document.readyState is already 'interactive' by the time we run).
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
