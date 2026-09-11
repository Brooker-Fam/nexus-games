// ── SKINS SHOWCASE ──
// Preview cards + selection for the SKINS tab. Reuse the real in-game
// Arkship renderer (drawArkshipUnit, aerial2.js) so each skin matches what
// actually appears on the battlefield — held in 'attacking' mode with its
// blade-fins unfurled and twin beam emitters lit, or 'phasing' mode
// collapsed into a short, squat cone as it prepares to release Prism and
// her Witches.
//
// A "skin" applies to the whole Arkship unit, not to a single mode — so the
// Attacking/Phasing preview cards for ROYAL VANGUARD are two windows onto
// one selectable option (one click target, one equip state), same as BASIC.
let skinsRAF=null;
let skinsFrame=0;

// Each equippable unit gets its own localStorage slot so picking a skin for
// one (e.g. the Capital Ship) never clobbers another (e.g. the Arkship).
const UNIT_SKIN_CFG={
  arkship:     { key:'nexusArkshipSkin',     default:'basic' },
  capitalship: { key:'nexusCapitalShipSkin', default:'ironcrown' },
};

function getUnitSkin(unit){
  const cfg=UNIT_SKIN_CFG[unit];
  if(!cfg) return null;
  try { return localStorage.getItem(cfg.key) || cfg.default; }
  catch(e){ return cfg.default; }
}
function setUnitSkin(unit,id){
  const cfg=UNIT_SKIN_CFG[unit];
  if(!cfg) return;
  try { localStorage.setItem(cfg.key, id); } catch(e){}
  refreshSkinOptionsUI();
  if(window.posthog) posthog.capture('skin_equipped', { unit, skin:id });
}
function getArkshipSkin(){ return getUnitSkin('arkship'); }
function setArkshipSkin(id){ setUnitSkin('arkship', id); }

function refreshSkinOptionsUI(){
  document.querySelectorAll('.skin-option').forEach(opt=>{
    const unit=opt.dataset.unit || 'arkship';
    const on=opt.dataset.skin===getUnitSkin(unit);
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
  c.translate(W*0.42,H*0.52);
  c.rotate(-0.12);
  c.scale(scale,scale);

  if(!isPhasing){
    // twin beams lancing off toward unseen targets, from the nose emitters — sells "attacking mode"
    const flicker=0.7+Math.sin(skinsFrame*0.25)*0.3;
    for(const [ey,tx,ty] of [[-ARKSHIP_EMITTER_Y,58,-22],[ARKSHIP_EMITTER_Y,58,26]]){
      c.save();
      c.shadowColor='#ffffff'; c.shadowBlur=20/scale;
      c.strokeStyle=`rgba(180,255,255,${0.35*flicker})`; c.lineWidth=6/scale; c.lineCap='round';
      c.beginPath(); c.moveTo(ARKSHIP_NOSE_X,ey); c.lineTo(tx,ty); c.stroke();
      c.strokeStyle=`rgba(255,255,255,${0.9*flicker})`; c.lineWidth=2/scale; c.lineCap='round';
      c.beginPath(); c.moveTo(ARKSHIP_NOSE_X,ey); c.lineTo(tx,ty); c.stroke();
      c.restore();
      const fg=c.createRadialGradient(tx,ty,0,tx,ty,8);
      fg.addColorStop(0,'#ffffff'); fg.addColorStop(0.5,'#aaffff'); fg.addColorStop(1,'transparent');
      c.fillStyle=fg; c.beginPath(); c.arc(tx,ty,8*flicker,0,Math.PI*2); c.fill();
    }
  } else if(skin==='royal-vanguard'){
    // outward phase ripples — the hull dims as it readies to release its crew
    for(let r=0;r<2;r++){
      const rr=((skinsFrame*0.01)+r*0.5)%1;
      c.save();
      c.globalAlpha=(1-rr)*0.4;
      c.strokeStyle='rgba(150,220,255,0.9)'; c.lineWidth=1.4/scale;
      c.beginPath(); c.arc(0,0,34+rr*40,0,Math.PI*2); c.stroke();
      c.restore();
    }
  }

  drawArkshipUnit(c,cfg,fakeShip);
  c.restore();
}

// Hero portrait cards — Prism, Vanthel and Gongui rendered with their real
// in-game draw functions (drawPrism/drawVanthel/drawGongui), posed mid-attack
// so each reads as a combat-ready hero rather than a static idle sprite.
const HERO_SKIN_CFG={
  prism:  { faction:'prism',  draw:(c,cfg,w)=>drawPrism(c,cfg,w) },
  vanthel:{ faction:'shadow', draw:(c,cfg,w)=>drawVanthel(c,cfg,w) },
  gongui: { faction:'roboto', draw:(c,cfg,w)=>drawGongui(c,cfg,w) },
};

function drawHeroSkinCard(canvasEl,heroKey){
  const c=canvasEl.getContext('2d');
  const W=canvasEl.width, H=canvasEl.height;
  drawSkinsBackdrop(c,W,H);

  const hero=HERO_SKIN_CFG[heroKey];
  const cfg=FACTION_CFG[hero.faction];
  const scale=3.2;
  const fakeW={frame:skinsFrame, state:'attack', faction:hero.faction};

  c.save();
  c.translate(W*0.5,H*0.72);
  c.scale(scale,scale);
  hero.draw(c,cfg,fakeW);
  c.restore();
}

// ── ROBOTO CAPITAL SHIP — IRONCROWN DREADNOUGHT SKIN ──
// A stockier, slab-armoured refit of Gongui's flagship: a long boxy hull
// bristling with turret batteries along the belly, twin heavy mounts flanking
// the bridge, and a bank of blue-white engines instead of the stock ship's
// bare thruster glow. Purely a showcase illustration for this tab — not tied
// to drawCapitalShipUnit's in-game top-down sprite.
function drawIroncrownTurretPod(c,x,edgeY,side,big,litColor){
  const podW=big?8.5:6, podH=big?4.8:3.6;
  const py=edgeY+side*podH*0.5;
  c.fillStyle='#241408';
  c.beginPath(); c.roundRect(x-podW/2,py-podH/2,podW,podH,1.2); c.fill();
  c.strokeStyle='rgba(255,160,40,0.6)'; c.lineWidth=0.6; c.stroke();
  c.fillStyle='#0a0502';
  const barrelW=big?9:6.5, barrelH=big?1.7:1.2;
  c.fillRect(x-1,py-barrelH-0.4,barrelW,barrelH);
  c.fillRect(x-1,py+0.4,barrelW,barrelH);
  c.strokeStyle='rgba(255,150,30,0.3)'; c.lineWidth=0.3;
  c.strokeRect(x-1,py-barrelH-0.4,barrelW,barrelH); c.strokeRect(x-1,py+0.4,barrelW,barrelH);
  c.save();
  c.shadowColor='#88ddff'; c.shadowBlur=big?4:2.5;
  c.fillStyle=litColor;
  c.beginPath(); c.arc(x-podW*0.5+1.4,py,big?1.5:1.1,0,Math.PI*2); c.fill();
  c.restore();
}

function drawCapitalShipSkinCard(canvasEl,mode){
  const c=canvasEl.getContext('2d');
  const W=canvasEl.width, H=canvasEl.height;
  drawSkinsBackdrop(c,W,H);

  const isLanded=mode==='landed';
  const pulse=0.5+Math.sin(skinsFrame*0.25)*0.5;

  c.save();
  c.translate(W*0.44,H*0.56);
  c.rotate(-0.08);
  c.scale(4.2,4.2);

  // engine bank — quad blue-white thrusters, dimmed while landed
  const engineGlow=isLanded?0.15:pulse;
  for(const ey of [-10,-3.3,3.3,10]){
    const eg=c.createRadialGradient(-34,ey,0,-34,ey,6);
    eg.addColorStop(0,`rgba(130,225,255,${engineGlow})`); eg.addColorStop(1,'transparent');
    c.fillStyle=eg; c.beginPath(); c.arc(-34,ey,6,0,Math.PI*2); c.fill();
  }

  // long slab hull, tapering to a point at the bow
  c.shadowColor='#ff8800'; c.shadowBlur=10;
  const bg=c.createLinearGradient(-34,0,36,0);
  bg.addColorStop(0,'#1a1008'); bg.addColorStop(0.15,'#a04800'); bg.addColorStop(0.5,'#ff9414'); bg.addColorStop(0.85,'#a04800'); bg.addColorStop(1,'#1a1008');
  c.fillStyle=bg;
  c.beginPath();
  c.moveTo(36,0);
  c.lineTo(24,-7); c.lineTo(6,-10); c.lineTo(-28,-10); c.lineTo(-34,-6); c.lineTo(-34,6); c.lineTo(-28,10); c.lineTo(6,10); c.lineTo(24,7);
  c.closePath(); c.fill();
  c.shadowBlur=0;
  c.strokeStyle='rgba(255,180,60,0.7)'; c.lineWidth=1; c.stroke();

  // hull plating seams
  c.strokeStyle='rgba(90,45,10,0.7)'; c.lineWidth=0.6;
  for(const sx of [-20,-10,0,10,20]){ c.beginPath(); c.moveTo(sx,-9.5); c.lineTo(sx,9.5); c.stroke(); }
  c.beginPath(); c.moveTo(-30,0); c.lineTo(20,0); c.stroke();

  const litColor=isLanded?'rgba(120,200,255,0.5)':`rgba(120,220,255,${0.5+pulse*0.5})`;

  // belly turret battery — five twin-barrel pods along the underside
  for(const tx of [-20,-10,0,10,20]) drawIroncrownTurretPod(c,tx,10,1,false,litColor);
  // two heavier quad-mounts flanking the bridge, upper and lower
  drawIroncrownTurretPod(c,18,-9,-1,true,litColor);
  drawIroncrownTurretPod(c,18,9,1,true,litColor);

  // bridge / cockpit at the bow
  const cg=c.createLinearGradient(20,-4,34,4);
  cg.addColorStop(0,'rgba(150,230,255,0.9)'); cg.addColorStop(1,'rgba(20,120,160,0.7)');
  c.fillStyle=cg;
  c.beginPath(); c.moveTo(34,0); c.lineTo(26,-4); c.lineTo(20,-2); c.lineTo(20,2); c.lineTo(26,4); c.closePath(); c.fill();
  c.strokeStyle='rgba(200,255,255,0.6)'; c.lineWidth=0.6; c.stroke();

  if(isLanded){
    // landing legs, deployed
    c.strokeStyle='#443322'; c.lineWidth=2; c.lineCap='round';
    for(const lx of [-24,-4,16]){
      c.beginPath(); c.moveTo(lx,10); c.lineTo(lx,20); c.stroke();
      c.fillStyle='rgba(255,190,0,0.7)'; c.beginPath(); c.arc(lx,21,1.6,0,Math.PI*2); c.fill();
    }
    // gold throne-bay glow as Gongui disembarks
    const kPulse=0.5+Math.sin(skinsFrame*0.15)*0.5;
    c.fillStyle=`rgba(255,215,0,${0.4+kPulse*0.4})`;
    c.beginPath(); c.arc(-6,0,3,0,Math.PI*2); c.fill();
  }

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
  for(const heroKey of ['prism','vanthel','gongui']){
    const canvasEl=document.getElementById(`skin-${heroKey}-canvas`);
    if(canvasEl) drawHeroSkinCard(canvasEl,heroKey);
  }
  const air=document.getElementById('skin-ironcrown-airborne-canvas');
  if(air) drawCapitalShipSkinCard(air,'airborne');
  const lnd=document.getElementById('skin-ironcrown-landed-canvas');
  if(lnd) drawCapitalShipSkinCard(lnd,'landed');
  skinsRAF=requestAnimationFrame(skinsPreviewLoop);
}

registerGame('skins', {
  init(){ refreshSkinOptionsUI(); if(!skinsRAF) skinsPreviewLoop(); },
  cleanup(){ if(skinsRAF){ cancelAnimationFrame(skinsRAF); skinsRAF=null; } },
});

// ── SELECTION — click (or Enter/Space) on a .skin-option to equip that skin.
// Each .skin-option can bundle several preview cards (e.g. Royal Vanguard's
// Attacking/Phasing pair, Ironcrown's Airborne/Landed pair), so clicking any
// card inside it equips/lights up the whole option together. Options are
// scoped per-unit via data-unit (arkship vs capitalship) so equipping one
// unit's skin never affects the other's.
(function wireSkinOptions(){
  const gallery=document.querySelector('.skins-gallery');
  if(!gallery) return;
  gallery.addEventListener('click', e=>{
    const opt=e.target.closest('.skin-option');
    if(opt && opt.dataset.skin) setUnitSkin(opt.dataset.unit || 'arkship', opt.dataset.skin);
  });
  gallery.addEventListener('keydown', e=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const opt=e.target.closest('.skin-option');
    if(opt && opt.dataset.skin){ e.preventDefault(); setUnitSkin(opt.dataset.unit || 'arkship', opt.dataset.skin); }
  });
  refreshSkinOptionsUI();
})();

//# sourceMappingURL=skins.js.map
