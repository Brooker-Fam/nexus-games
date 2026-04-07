// ── REVEAL SCREEN ──
const FACTION_DATA={
  shadow:{ armada:'SHADOW ARMADA', champion:'THE SWORDSMAN', lore:'"From the void between stars, he emerged. None who faced his blade lived to name him."', accentColor:'#9933ff' },
  prism: { armada:'PRISM ARMADA',  champion:'THE WHITE WITCH', lore:'"She speaks in light. Her words become spells. Her spells become storms."', accentColor:'#00ddff' },
  roboto:{ armada:'ROBOTO ARMADA', champion:'THE GUNBOT',     lore:'"Forged in a dead star\'s core. Programmed for one purpose: total suppression."', accentColor:'#ff8800' },
};

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
initFactionCards();
addLog('Game initialized. Place towers and send waves!','info');
updateHUD();
renderPreviewGun(document.getElementById('prev-gun').getContext('2d'));
renderPreviewLaser(document.getElementById('prev-laser').getContext('2d'));
renderPreviewMissile(document.getElementById('prev-missile').getContext('2d'));
renderPreviewCryo(document.getElementById('prev-slow').getContext('2d'));
raf=requestAnimationFrame(gameLoop);
