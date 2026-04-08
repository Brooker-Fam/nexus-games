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
  cancelAnimationFrame(rtsRAF); rtsRAF=null;
  document.getElementById('dso-game').style.display='none';
  document.getElementById('dso-select').style.display='block';
  initFactionCards();
}

// ── INIT ──
function initFactionCards(){
  dsoRevealFrame=0;
  for(const faction of ['shadow','prism','roboto']){
    const el=document.getElementById('fc-canvas-'+faction);
    if(el) drawCardCharacter(el,faction,false);
  }
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
    if(rtsRAF){ cancelAnimationFrame(rtsRAF); rtsRAF=null; }
    if(dsoRevealRAF){ cancelAnimationFrame(dsoRevealRAF); dsoRevealRAF=null; }
    if(dsoPreviewRAF){ cancelAnimationFrame(dsoPreviewRAF); dsoPreviewRAF=null; }
    closeBuildPopup();
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

// Faction cards
['shadow','prism','roboto'].forEach(faction=>{
  const card=document.getElementById('fc-'+faction);
  card.addEventListener('click', ()=>dsoSelect(faction));
  card.addEventListener('mouseenter', ()=>dsoPreview(faction));
  card.addEventListener('mouseleave', ()=>dsoPreviewClear());
});

// Reveal screen
document.getElementById('btn-dso-back').onclick=dsoBack;
document.getElementById('btn-dso-play').onclick=dsoPlay;

// RTS controls
document.getElementById('btn-attack').onclick=function(e){ e.preventDefault(); rtsOrderAttack(); this.blur(); };
document.getElementById('rts-speed-btns').onclick=function(e){
  const btn=e.target.closest('.speed-btn');
  if(!btn) return;
  rtsSpeed=parseInt(btn.dataset.speed)||1;
  this.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
};
document.getElementById('btn-rts-menu').onclick=rtsMenuBack;
document.getElementById('btn-rts-menu-over').onclick=rtsMenuBack;
document.getElementById('btn-popup-close').onclick=closeBuildPopup;
