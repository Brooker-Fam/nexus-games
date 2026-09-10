// ── SKINS SHOWCASE ──
// Preview cards + selection for the SKINS tab. Reuse the real in-game
// Arkship renderer (drawArkshipUnit, aerial2.js) so each skin matches what
// actually appears on the battlefield — held in 'attacking' mode with its
// twin beam emitters lit and firing, or 'phasing' mode with the shard-swirl
// dimmed and rippling as it prepares to release Prism and her Witches.
//
// A "skin" applies to the whole Arkship unit, not to a single mode — so the
// Attacking/Phasing preview cards for ROYAL VANGUARD are two windows onto
// one selectable option (one click target, one equip state), same as BASIC.
let skinsRAF=null;
let skinsFrame=0;

const ARKSHIP_SKIN_KEY='nexusArkshipSkin';
const ARKSHIP_SKIN_DEFAULT='basic';

function getArkshipSkin(){
  try { return localStorage.getItem(ARKSHIP_SKIN_KEY) || ARKSHIP_SKIN_DEFAULT; }
  catch(e){ return ARKSHIP_SKIN_DEFAULT; }
}
function setArkshipSkin(id){
  try { localStorage.setItem(ARKSHIP_SKIN_KEY, id); } catch(e){}
  refreshSkinOptionsUI();
  if(window.posthog) posthog.capture('skin_equipped', { unit:'arkship', skin:id });
}
function refreshSkinOptionsUI(){
  const current=getArkshipSkin();
  document.querySelectorAll('.skin-option').forEach(opt=>{
    const on=opt.dataset.skin===current;
    opt.classList.toggle('selected', on);
    opt.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// Deep-space backdrop — nebula wash upper-right, a planet lower-left and a
// small moon upper-right, echoing the armada's concept-art compositions.
function drawSkinsBackdrop(c,W,H){
  c.clearRect(0,0,W,H);
  const base=c.createLinearGradient(0,0,0,H);
  base.addColorStop(0,'#03040c'); base.addColorStop(1,'#050310');
  c.fillStyle=base; c.fillRect(0,0,W,H);

  c.save();
  c.globalCompositeOperation='lighter';
  const nebulaBlobs=[
    [W*0.8,H*0.2,W*0.5,'rgba(140,60,220,0.20)'],
    [W*0.92,H*0.14,W*0.32,'rgba(80,120,255,0.18)'],
    [W*0.65,H*0.4,W*0.4,'rgba(0,200,255,0.10)'],
  ];
  for(const [nx,ny,nr,col] of nebulaBlobs){
    const ng=c.createRadialGradient(nx,ny,0,nx,ny,nr);
    ng.addColorStop(0,col); ng.addColorStop(1,'transparent');
    c.fillStyle=ng; c.beginPath(); c.arc(nx,ny,nr,0,Math.PI*2); c.fill();
  }
  c.restore();

  for(let i=0;i<90;i++){
    const sx=(i*97)%W, sy=(i*53+(i*31)%H)%H;
    const tw=0.4+0.6*Math.abs(Math.sin(skinsFrame*0.02+i));
    c.fillStyle=`rgba(255,255,255,${tw*0.7})`;
    c.fillRect(sx,sy,1.3,1.3);
  }

  // planet, lower-left
  const px=W*0.1, py=H*0.94, pr=W*0.17;
  const pg=c.createRadialGradient(px-pr*0.3,py-pr*0.3,pr*0.1,px,py,pr);
  pg.addColorStop(0,'#3a4a68'); pg.addColorStop(0.6,'#131b2c'); pg.addColorStop(1,'#05070c');
  c.fillStyle=pg; c.beginPath(); c.arc(px,py,pr,0,Math.PI*2); c.fill();

  // small moon, upper-right
  const mx=W*0.93, my=H*0.13, mr=W*0.035;
  const mg=c.createRadialGradient(mx-mr*0.3,my-mr*0.3,mr*0.1,mx,my,mr);
  mg.addColorStop(0,'#8892a8'); mg.addColorStop(1,'#1a1f2c');
  c.fillStyle=mg; c.beginPath(); c.arc(mx,my,mr,0,Math.PI*2); c.fill();
}

function drawArkshipSkinCard(canvasEl,mode,skin){
  const c=canvasEl.getContext('2d');
  const W=canvasEl.width, H=canvasEl.height;
  drawSkinsBackdrop(c,W,H);

  const cfg=FACTION_CFG.prism;
  const scale=3.4;
  const isPhasing=mode==='phasing';
  const fakeShip={frame:skinsFrame, arkMode:mode, skin};

  c.save();
  c.translate(W*0.46,H*0.55);
  c.rotate(-0.12);
  c.scale(scale,scale);

  if(!isPhasing){
    // twin beams lancing off toward unseen targets — sells "attacking mode"
    const flicker=0.7+Math.sin(skinsFrame*0.25)*0.3;
    for(const [ey,tx,ty] of [[-7,112,-40],[7,112,44]]){
      c.save();
      c.shadowColor='#ffffff'; c.shadowBlur=20/scale;
      c.strokeStyle=`rgba(180,255,255,${0.35*flicker})`; c.lineWidth=6/scale; c.lineCap='round';
      c.beginPath(); c.moveTo(17,ey); c.lineTo(tx,ty); c.stroke();
      c.strokeStyle=`rgba(255,255,255,${0.9*flicker})`; c.lineWidth=2/scale; c.lineCap='round';
      c.beginPath(); c.moveTo(17,ey); c.lineTo(tx,ty); c.stroke();
      c.restore();
      const fg=c.createRadialGradient(tx,ty,0,tx,ty,8);
      fg.addColorStop(0,'#ffffff'); fg.addColorStop(0.5,'#aaffff'); fg.addColorStop(1,'transparent');
      c.fillStyle=fg; c.beginPath(); c.arc(tx,ty,8*flicker,0,Math.PI*2); c.fill();
    }
  } else if(skin==='royal-vanguard'){
    // outward phase ripples — the swirl dims as it readies to release its crew
    for(let r=0;r<2;r++){
      const rr=((skinsFrame*0.01)+r*0.5)%1;
      c.save();
      c.globalAlpha=(1-rr)*0.4;
      c.strokeStyle='rgba(150,220,255,0.9)'; c.lineWidth=1.4/scale;
      c.beginPath(); c.arc(0,0,10+rr*34,0,Math.PI*2); c.stroke();
      c.restore();
    }
  }

  drawArkshipUnit(c,cfg,fakeShip);
  c.restore();
}

function skinsPreviewLoop(){
  skinsFrame++;
  const basic=document.getElementById('skin-arkship-basic-canvas');
  if(basic) drawArkshipSkinCard(basic,'attacking','basic');
  const atk=document.getElementById('skin-arkship-attacking-canvas');
  if(atk) drawArkshipSkinCard(atk,'attacking','royal-vanguard');
  const pha=document.getElementById('skin-arkship-phasing-canvas');
  if(pha) drawArkshipSkinCard(pha,'phasing','royal-vanguard');
  skinsRAF=requestAnimationFrame(skinsPreviewLoop);
}

registerGame('skins', {
  init(){ refreshSkinOptionsUI(); if(!skinsRAF) skinsPreviewLoop(); },
  cleanup(){ if(skinsRAF){ cancelAnimationFrame(skinsRAF); skinsRAF=null; } },
});

// ── SELECTION — click (or Enter/Space) on a .skin-option to equip that skin.
// Both Royal Vanguard preview cards live inside one .skin-option, so clicking
// either one equips/lights up the pair together, same as the single Basic card.
(function wireSkinOptions(){
  const gallery=document.querySelector('.skins-gallery');
  if(!gallery) return;
  gallery.addEventListener('click', e=>{
    const opt=e.target.closest('.skin-option');
    if(opt && opt.dataset.skin) setArkshipSkin(opt.dataset.skin);
  });
  gallery.addEventListener('keydown', e=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const opt=e.target.closest('.skin-option');
    if(opt && opt.dataset.skin){ e.preventDefault(); setArkshipSkin(opt.dataset.skin); }
  });
  refreshSkinOptionsUI();
})();

//# sourceMappingURL=skins.js.map
