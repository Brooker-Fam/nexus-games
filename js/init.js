// ── REVEAL SCREEN ──
function dsoSelect(faction){
  dsoSelectedFaction=faction;
  dsoPreviewClear();
  const fd=FACTION_DATA[faction];
  const rvA=document.getElementById('rv-armada');
  const rvC=document.getElementById('rv-champion');
  const rvL=document.getElementById('rv-lore');
  rvA.textContent=fd.armada; rvA.className='reveal-armada '+faction;
  rvC.textContent=fd.champion; rvC.className='reveal-champion '+faction;
  rvL.textContent=fd.lore;
  // reset animations
  [rvA,rvC,rvL].forEach(el=>{el.style.animation='none';el.offsetHeight;el.style.animation='';});
  document.getElementById('dso-select').style.display='none';
  document.getElementById('dso-reveal').style.display='block';
  startRevealAnimation(faction);
}

function dsoBack(){
  cancelAnimationFrame(dsoRevealRAF);
  dsoRevealRAF=null;
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-select').style.display='block';
  initFactionCards();
}

function dsoPlay(){
  cancelAnimationFrame(dsoRevealRAF); dsoRevealRAF=null;
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-game').style.display='block';
  document.getElementById('rts-gameover-overlay').style.display='none';
  startRTS(dsoSelectedFaction);
  if(window.posthog) posthog.capture('dso_game_started', { faction: dsoSelectedFaction, mode: 'singleplayer' });
}
function rtsMenuBack(){
  cancelAnimationFrame(S.raf); S.raf=null;
  mpDisconnect();
  document.getElementById('dso-game').style.display='none';
  document.getElementById('dso-select').style.display='block';
  document.getElementById('mp-status').textContent='';
  initFactionCards();
}

// ── INIT ──
function initFactionCards(){
  dsoRevealFrame=0;
  for(const faction of ['shadow','prism','roboto']){
    const el=document.getElementById('fc-canvas-'+faction);
    if(el) drawCardCharacter(el,faction,false);
  }
  if(typeof refreshDifficultyStats==='function') refreshDifficultyStats();
}

// Register Deep Space Ops lifecycle
registerGame('cs', {
  init(){
    initFactionCards();
    document.getElementById('dso-select').style.display='';
    document.getElementById('dso-reveal').style.display='none';
    document.getElementById('dso-game').style.display='none';
  },
  cleanup(){
    if(window._mpMultiplayer) return; // don't stop during multiplayer
    if(S.raf){ cancelAnimationFrame(S.raf); S.raf=null; }
    if(dsoRevealRAF){ cancelAnimationFrame(dsoRevealRAF); dsoRevealRAF=null; }
    if(dsoPreviewRAF){ cancelAnimationFrame(dsoPreviewRAF); dsoPreviewRAF=null; }
    closeBuildPopup();
  },
});

// Start TD game on load
activateGame('td');

// ── EVENT HANDLERS (moved from inline HTML) ──

// Tabs
document.getElementById('tab-btn-td').onclick=function(){
  switchTab('td', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'tower_defense' });
};
document.getElementById('tab-btn-cs').onclick=function(){
  switchTab('cs', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'deep_space_ops' });
  const dsoCount = document.getElementById('dso-player-count');
  if (dsoCount) dsoCount.textContent = '0';
};
document.getElementById('tab-btn-snake').onclick=function(){
  switchTab('snake', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'snake' });
};
document.getElementById('tab-btn-fish').onclick=function(){
  switchTab('fish', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'fish' });
};
document.getElementById('tab-btn-doom').onclick=function(){
  switchTab('doom', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'doom' });
};
document.getElementById('btn-doom-reset').onclick=function(){ doomReset(); };
document.getElementById('btn-fish-reset').onclick=function(){ fishReset(); };
document.getElementById('tab-btn-exc').onclick=function(){
  const id = new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 10);
  throw new TypeError("Cannot read properties of undefined (reading 'entities') at GameState.tick [session " + id + ']');
};

// Snake controls
document.getElementById('btn-snake-reset').onclick=function(){ snakeReset(); };
document.querySelector('.snake-speed-btns').onclick=function(e){
  const btn=e.target.closest('.speed-btn');
  if(!btn) return;
  snakeSetSpeed(parseInt(btn.dataset.speed)||1, btn);
};

// TD controls
document.getElementById('btn-reset').onclick=resetGame;
document.getElementById('waveBtn').onclick=startWave;

// Tower selection (event delegation)
document.getElementById('towerGrid').onclick=function(e){
  const btn=e.target.closest('.tower-btn');
  if(btn && btn.dataset.type) selectTower(btn.dataset.type, btn);
};

// Speed buttons (event delegation)
document.querySelector('.speed-btns').onclick=function(e){
  const btn=e.target.closest('.speed-btn');
  if(!btn) return;
  const speeds=[1,2,3];
  const idx=[...btn.parentElement.children].indexOf(btn);
  if(idx>=0) setSpeed(speeds[idx], btn);
};

// Faction cards — in multiplayer mode, pick faction; in singleplayer, start game
['shadow','prism','roboto'].forEach(faction=>{
  const card=document.getElementById('fc-'+faction);
  card.addEventListener('click', ()=>{
    if(mpConnected){
      mpPickFaction(faction);
      document.getElementById('mp-status').innerHTML=
        `<div class="mp-faction-pick">You chose ${FACTION_DATA[faction].armada}. Waiting for opponent...</div>`;
    } else {
      dsoSelect(faction);
    }
    if(window.posthog) posthog.capture('dso_faction_selected', { faction, mode: mpConnected ? 'multiplayer' : 'singleplayer' });
  });
  card.addEventListener('mouseenter', ()=>dsoPreview(faction));
  card.addEventListener('mouseleave', ()=>dsoPreviewClear());
});

// Reveal screen
document.getElementById('btn-dso-back').onclick=dsoBack;
document.getElementById('btn-dso-play').onclick=dsoPlay;

// Multiplayer buttons
document.getElementById('btn-mp-host').onclick=async function(){
  const status=document.getElementById('mp-status');
  status.className='mp-status'; status.textContent='Creating...';
  try {
    const code = await mpHost();
    if(window.posthog) posthog.capture('mp_game_hosted');
    mpOnConnect=()=>{ status.className='mp-status'; status.innerHTML='Connected! Both pick a faction.'; };
    status.className='mp-status waiting';
    status.innerHTML=`Code: <span class="mp-code" title="Click to copy">${code}</span> — waiting for opponent...`;
    status.querySelector('.mp-code').onclick=function(){
      navigator.clipboard.writeText(code);
      this.textContent=code+' ✓';
      setTimeout(()=>{ this.textContent=code; },1500);
    };
  } catch(e){
    status.className='mp-status error'; status.textContent='Failed: '+e.message;
  }
};

document.getElementById('btn-mp-join').onclick=async function(){
  const status=document.getElementById('mp-status');
  const code=document.getElementById('mp-join-input').value.trim().toUpperCase();
  if(!code){ status.className='mp-status error'; status.textContent='Enter a code.'; return; }
  status.textContent='Connecting...';
  try {
    await mpJoin(code);
    if(window.posthog) posthog.capture('mp_game_joined');
    status.className='mp-status';
    status.innerHTML='Connected! Both pick a faction.';
  } catch(e){
    status.className='mp-status error'; status.textContent='Failed: '+e.message;
  }
};

// RTS controls
document.getElementById('btn-attack').onclick=function(e){ e.preventDefault(); rtsOrderAttack(); this.blur(); };
document.getElementById('rts-speed-btns').onclick=function(e){
  const btn=e.target.closest('.speed-btn');
  if(!btn) return;
  if(window._mpMultiplayer) return; // speed locked to 1x in multiplayer
  S.speed=parseInt(btn.dataset.speed)||1;
  this.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
};
document.getElementById('btn-rts-menu').onclick=rtsMenuBack;
document.getElementById('btn-rts-menu-over').onclick=rtsMenuBack;
document.getElementById('btn-popup-close').onclick=closeBuildPopup;

//# sourceMappingURL=init.js.map
