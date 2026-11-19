// ── MODE TABS (AI / PVP / TRAINING) ──
let dsoMode='ai';
const DSO_MODE_DESC={
  ai:'Battle an adaptive AI opponent that scales to your skill.',
  pvp:'Host or join a match and fight another commander online.',
  training:'An AI advisor walks you through the basics, step by step.',
};
function setDsoMode(mode){
  dsoMode=mode;
  document.querySelectorAll('.dso-mode-tab').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.mode===mode);
  });
  const desc=document.getElementById('dso-mode-desc');
  if(desc) desc.textContent=DSO_MODE_DESC[mode]||'';
  const cards=document.querySelector('.faction-cards');
  if(cards) cards.style.display = (mode==='pvp' && !mpConnected) ? 'none' : '';
  const mp=document.getElementById('mp-controls');
  if(mp) mp.style.display = mode==='pvp' ? '' : 'none';
  const banner=document.getElementById('dso-training-banner');
  if(banner) banner.style.display = mode==='training' ? '' : 'none';
}
function mpRevealFactionPicker(){
  const cards=document.querySelector('.faction-cards');
  if(cards) cards.style.display='';
}

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
  const rvStats=document.getElementById('rv-stats');
  if(rvStats) rvStats.innerHTML=factionStatBarsHTML(faction);
  // reset animations
  [rvA,rvC,rvL].forEach(el=>{el.style.animation='none';el.offsetHeight;el.style.animation='';});
  document.getElementById('dso-select').style.display='none';
  document.getElementById('dso-reveal').style.display='block';
  startRevealAnimation(faction);
  if(typeof refreshDifficultyStats==='function') refreshDifficultyStats();
}

function dsoBack(){
  cancelAnimationFrame(dsoRevealRAF);
  dsoRevealRAF=null;
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-select').style.display='block';
  initFactionCards();
  setDsoMode(dsoMode);
}

function dsoPlay(){
  cancelAnimationFrame(dsoRevealRAF); dsoRevealRAF=null;
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-game').style.display='flex';
  document.getElementById('rts-gameover-overlay').style.display='none';
  window._dsoTrainingMode=(dsoMode==='training');
  startRTS(dsoSelectedFaction);
  if(window._dsoTrainingMode){
    applyTrainingEasyMode();
    startTrainingGuide();
  } else {
    stopTrainingGuide();
  }
  if(window.posthog) posthog.capture('dso_game_started', { faction: dsoSelectedFaction, mode: window._dsoTrainingMode ? 'training' : 'singleplayer' });
}
function rtsMenuBack(){
  cancelAnimationFrame(S.raf); S.raf=null;
  stopTrainingGuide();
  window._dsoTrainingMode=false;
  mpDisconnect();
  document.getElementById('dso-game').style.display='none';
  document.getElementById('dso-select').style.display='block';
  document.getElementById('mp-status').textContent='';
  initFactionCards();
  setDsoMode(dsoMode);
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
    setDsoMode(dsoMode);
  },
  cleanup(){
    if(window._mpMultiplayer) return; // don't stop during multiplayer
    if(S.raf){ cancelAnimationFrame(S.raf); S.raf=null; }
    if(dsoRevealRAF){ cancelAnimationFrame(dsoRevealRAF); dsoRevealRAF=null; }
    if(dsoPreviewRAF){ cancelAnimationFrame(dsoPreviewRAF); dsoPreviewRAF=null; }
    stopTrainingGuide();
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
document.getElementById('tab-btn-skins').onclick=function(){
  switchTab('skins', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'skins' });
};
document.getElementById('tab-btn-book').onclick=function(){
  switchTab('book', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'book' });
};
document.getElementById('tab-btn-memberships').onclick=function(){
  switchTab('memberships', this);
  if(window.posthog) posthog.capture('game_tab_switched', { tab: 'memberships' });
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
    if(window.posthog) posthog.capture('dso_faction_selected', { faction, mode: mpConnected ? 'multiplayer' : dsoMode });
  });
  card.addEventListener('mouseenter', ()=>dsoPreview(faction));
  card.addEventListener('mouseleave', ()=>dsoPreviewClear());
});

// Mode tabs (AI / PVP / TRAINING)
document.querySelectorAll('.dso-mode-tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    setDsoMode(btn.dataset.mode);
    if(window.posthog) posthog.capture('dso_mode_selected', { mode: btn.dataset.mode });
  });
});

// Training guide controls
document.getElementById('btn-training-next').onclick=advanceTrainingStep;
document.getElementById('btn-training-close').onclick=stopTrainingGuide;

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
    mpOnConnect=()=>{ status.className='mp-status'; status.innerHTML='Connected! Both pick a faction.'; mpRevealFactionPicker(); };
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
    mpRevealFactionPicker();
  } catch(e){
    status.className='mp-status error'; status.textContent='Failed: '+e.message;
  }
};

// RTS controls
document.getElementById('btn-select-army').onclick=function(e){ e.preventDefault(); rtsSelectArmy(); this.blur(); };
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
