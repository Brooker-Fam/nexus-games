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

// ── HOMESTEAD WARS LIFECYCLE ──
function hwSelect(faction){
  hwSelectedFaction=faction;
  hwPreviewClear();
  const fd=HW_FACTION_DATA[faction];
  const rvA=document.getElementById('hw-rv-armada');
  const rvC=document.getElementById('hw-rv-champion');
  const rvL=document.getElementById('hw-rv-lore');
  rvA.textContent=fd.armada; rvA.className='hw-reveal-armada '+faction;
  rvC.textContent=fd.champion; rvC.className='hw-reveal-champion '+faction;
  rvL.textContent=fd.lore;
  [rvA,rvC,rvL].forEach(el=>{el.style.animation='none';el.offsetHeight;el.style.animation='';});
  document.getElementById('hw-select').style.display='none';
  document.getElementById('hw-reveal').style.display='block';
  hwStartRevealAnimation(faction);
}

function hwBack(){
  cancelAnimationFrame(hwRevealRAF);
  hwRevealRAF=null;
  document.getElementById('hw-reveal').style.display='none';
  document.getElementById('hw-select').style.display='block';
  hwInitFactionCards();
}

function hwPlay(){
  cancelAnimationFrame(hwRevealRAF); hwRevealRAF=null;
  document.getElementById('hw-reveal').style.display='none';
  document.getElementById('hw-game').style.display='block';
  document.getElementById('hw-gameover-overlay').style.display='none';
  startHW(hwSelectedFaction);
}
function hwMenuBack(){
  cancelAnimationFrame(H.raf); H.raf=null;
  hwMpDisconnect();
  document.getElementById('hw-game').style.display='none';
  document.getElementById('hw-select').style.display='block';
  document.getElementById('hw-mp-status').textContent='';
  hwInitFactionCards();
}

function hwInitFactionCards(){
  hwRevealFrame=0;
  for(const faction of ['barnyard','creek','woodland']){
    const el=document.getElementById('hw-fc-canvas-'+faction);
    if(el) hwDrawCardCharacter(el,faction,false);
  }
  if(typeof hwRefreshDifficultyStats==='function') hwRefreshDifficultyStats();
}

// Register Homestead Wars lifecycle
registerGame('hw', {
  init(){
    hwInitFactionCards();
    document.getElementById('hw-select').style.display='';
    document.getElementById('hw-reveal').style.display='none';
    document.getElementById('hw-game').style.display='none';
  },
  cleanup(){
    if(window._hwMpMultiplayer) return;
    if(H.raf){ cancelAnimationFrame(H.raf); H.raf=null; }
    if(hwRevealRAF){ cancelAnimationFrame(hwRevealRAF); hwRevealRAF=null; }
    if(hwPreviewRAF){ cancelAnimationFrame(hwPreviewRAF); hwPreviewRAF=null; }
    hwCloseBuildPopup();
  },
});

// Start TD game on load
activateGame('td');

// ── EVENT HANDLERS (moved from inline HTML) ──

// Tabs
document.getElementById('tab-btn-td').onclick=function(){ switchTab('td', this); };
document.getElementById('tab-btn-cs').onclick=function(){ switchTab('cs', this); };

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

// ── HOMESTEAD WARS EVENT HANDLERS ──
document.getElementById('tab-btn-hw').onclick=function(){ switchTab('hw', this); };

// HW faction cards
['barnyard','creek','woodland'].forEach(faction=>{
  const card=document.getElementById('hw-fc-'+faction);
  card.addEventListener('click', ()=>{
    if(hwMpConnected){
      hwMpPickFaction(faction);
      document.getElementById('hw-mp-status').innerHTML=
        `<div class="hw-mp-faction-pick">You chose ${HW_FACTION_DATA[faction].armada}. Waiting for opponent...</div>`;
    } else {
      hwSelect(faction);
    }
  });
  card.addEventListener('mouseenter', ()=>hwPreview(faction));
  card.addEventListener('mouseleave', ()=>hwPreviewClear());
});

// HW reveal screen
document.getElementById('hw-btn-dso-back').onclick=hwBack;
document.getElementById('hw-btn-dso-play').onclick=hwPlay;

// HW multiplayer
document.getElementById('hw-btn-mp-host').onclick=async function(){
  const status=document.getElementById('hw-mp-status');
  status.className='hw-mp-status'; status.textContent='Creating...';
  try {
    const code = await hwMpHost();
    hwMpOnConnect=()=>{ status.className='hw-mp-status'; status.innerHTML='Connected! Both pick a herd.'; };
    status.className='hw-mp-status waiting';
    status.innerHTML=`Code: <span class="hw-mp-code" title="Click to copy">${code}</span> — waiting for opponent...`;
    status.querySelector('.hw-mp-code').onclick=function(){
      navigator.clipboard.writeText(code);
      this.textContent=code+' ✓';
      setTimeout(()=>{ this.textContent=code; },1500);
    };
  } catch(e){
    status.className='hw-mp-status error'; status.textContent='Failed: '+e.message;
  }
};

document.getElementById('hw-btn-mp-join').onclick=async function(){
  const status=document.getElementById('hw-mp-status');
  const code=document.getElementById('hw-mp-join-input').value.trim().toUpperCase();
  if(!code){ status.className='hw-mp-status error'; status.textContent='Enter a code.'; return; }
  status.textContent='Connecting...';
  try {
    await hwMpJoin(code);
    status.className='hw-mp-status';
    status.innerHTML='Connected! Both pick a herd.';
  } catch(e){
    status.className='hw-mp-status error'; status.textContent='Failed: '+e.message;
  }
};

// HW game controls
document.getElementById('hw-btn-attack').onclick=function(e){ e.preventDefault(); hwOrderAttack(); this.blur(); };
document.getElementById('hw-speed-btns').onclick=function(e){
  const btn=e.target.closest('.speed-btn');
  if(!btn) return;
  if(window._hwMpMultiplayer) return;
  H.speed=parseInt(btn.dataset.speed)||1;
  this.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
};
document.getElementById('hw-btn-menu').onclick=hwMenuBack;
document.getElementById('hw-btn-menu-over').onclick=hwMenuBack;
document.getElementById('hw-btn-popup-close').onclick=hwCloseBuildPopup;
