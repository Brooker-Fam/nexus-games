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
  capitalship: { key:'nexusCapitalShipSkin', default:'regular' },
  witch:            { key:'nexusWitchSkin',           default:'standard' },
  swordsman:        { key:'nexusSwordsmanSkin',        default:'standard' },
  gunbot:           { key:'nexusGunbotSkin',           default:'standard' },
  legionnaire:      { key:'nexusLegionnaireSkin',      default:'standard' },
  warbot:           { key:'nexusWarbotSkin',           default:'standard' },
  oracle:           { key:'nexusOracleSkin',           default:'standard' },
  darkwarrior:      { key:'nexusDarkWarriorSkin',      default:'standard' },
  shockbot:         { key:'nexusShockbotSkin',         default:'standard' },
  wizard:           { key:'nexusWizardSkin',           default:'standard' },
  necromancer:      { key:'nexusNecromancerSkin',      default:'standard' },
  tank:             { key:'nexusTankSkin',             default:'standard' },
  'wardrone-prism':  { key:'nexusWarDronePrismSkin',   default:'standard' },
  'wardrone-shadow': { key:'nexusWarDroneShadowSkin',  default:'standard' },
  'wardrone-roboto': { key:'nexusWarDroneRobotoSkin',  default:'standard' },
  lightfighter:     { key:'nexusLightFighterSkin',     default:'standard' },
  destroyer:        { key:'nexusDestroyerSkin',        default:'standard' },
  warship:          { key:'nexusWarshipSkin',          default:'standard' },
  prism:            { key:'nexusPrismHeroSkin',        default:'standard' },
  vanthel:          { key:'nexusVanthelSkin',          default:'standard' },
  gongui:           { key:'nexusGonguiSkin',           default:'standard' },
};

// ── ALTERNATE SKIN LIVERIES ──
// Every "standard issue" unit (barracks/elite/aerial warriors and the three
// commanders) gets one faction-wide alternate livery, reusing the same
// in-game draw function but recolored into a single accent hue and finished
// with a themed corner frame + ribbon — the same "reskin, don't redraw"
// approach the flagships' own alt skins (Royal Vanguard, Ironcrown) use for
// their trim, just applied as a duotone recolor instead of hand-picked
// gradients since these units don't have their own w.skin-aware renderers.
const ALT_SKIN_THEME={
  prism:  { id:'royal-vanguard',   label:'ROYAL VANGUARD',   accent:'#ffcf4d', accentDark:'#a3690f' },
  shadow: { id:'crimson-covenant', label:'CRIMSON COVENANT', accent:'#ff3355', accentDark:'#5c0016' },
  roboto: { id:'ironcrown',        label:'IRONCROWN',        accent:'#ff9414', accentDark:'#a04800' },
};

// Reused scratch canvases for the alt-livery recolor pipeline — safe to
// share since only one warrior/hero card is drawn at a time.
const skinScratch={draw:null, result:null};
function getSkinScratchCanvas(id,w,h){
  if(!skinScratch[id]) skinScratch[id]=document.createElement('canvas');
  const el=skinScratch[id];
  if(el.width!==w) el.width=w;
  if(el.height!==h) el.height=h;
  return el;
}

// Recolors a freshly-drawn unit into a single accent hue and draws the
// result onto the real canvas. A straight hue-rotate filter was tried first,
// but it also rotates small existing accent details (a red eye slit, say)
// into off-theme, clashing hues. Desaturating to gray and multiplying the
// accent on top was tried next, but multiply only darkens — it crushed the
// original artwork's rim-light and shadowBlur glow into a flat, muddy
// silhouette instead of a "livery". Using the canvas 'color' blend mode
// keeps the original's luminosity (so highlights and glow halos still pop)
// while swapping in the theme's hue/saturation, then a destination-in alpha
// clip removes the accent fill's bleed outside the unit's silhouette.
function drawAltLiveryUnit(c,srcCanvas,W,H,theme){
  const result=getSkinScratchCanvas('result',W,H);
  const rc=result.getContext('2d');
  rc.clearRect(0,0,W,H);
  rc.globalCompositeOperation='source-over';
  rc.drawImage(srcCanvas,0,0);
  rc.globalCompositeOperation='color';
  rc.fillStyle=theme.accent;
  rc.fillRect(0,0,W,H);
  rc.globalCompositeOperation='destination-in';
  rc.drawImage(srcCanvas,0,0);
  rc.globalCompositeOperation='source-over';

  c.drawImage(result,0,0);
}

// Corner brackets + a bottom ribbon bearing the livery name — drawn AFTER
// the (filtered) unit so the frame itself stays crisp and unrecolored.
function drawAltSkinFrame(c,W,H,theme){
  c.save();
  const inset=10, len=20;
  c.strokeStyle=theme.accent; c.lineWidth=2; c.lineCap='round';
  c.shadowColor=theme.accent; c.shadowBlur=6;
  for(const [x,y,dx,dy] of [[inset,inset,1,1],[W-inset,inset,-1,1],[inset,H-inset,1,-1],[W-inset,H-inset,-1,-1]]){
    c.beginPath();
    c.moveTo(x,y+len*dy); c.lineTo(x,y); c.lineTo(x+len*dx,y);
    c.stroke();
  }
  c.shadowBlur=0;
  c.restore();

  c.save();
  const bw=Math.min(220,W*0.6), bh=22, bx=(W-bw)/2, by=H-bh-10;
  const bg=c.createLinearGradient(bx,0,bx+bw,0);
  bg.addColorStop(0,'rgba(0,0,0,0)'); bg.addColorStop(0.12,theme.accentDark); bg.addColorStop(0.5,theme.accent); bg.addColorStop(0.88,theme.accentDark); bg.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=bg; c.fillRect(bx,by,bw,bh);
  c.strokeStyle='rgba(255,255,255,0.5)'; c.lineWidth=0.6;
  c.beginPath(); c.moveTo(bx,by+1); c.lineTo(bx+bw,by+1); c.stroke();
  c.font='bold 11px Orbitron,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#1a1204'; c.fillText(theme.label,W/2,by+bh/2+1);
  c.restore();
}

function getUnitSkin(unit){
  const cfg=UNIT_SKIN_CFG[unit];
  if(!cfg) return null;
  try { return localStorage.getItem(cfg.key) || cfg.default; }
  catch(e){ return cfg.default; }
}
function setUnitSkin(unit,id){
  const cfg=UNIT_SKIN_CFG[unit];
  if(!cfg) return;
  if(isPaidSkin(unit,id) && !ownedSkins.has(skinOwnKey(unit,id))) return;
  try { localStorage.setItem(cfg.key, id); } catch(e){}
  refreshSkinOptionsUI();
  if(window.posthog) posthog.capture('skin_equipped', { unit, skin:id });
}
function getArkshipSkin(){ return getUnitSkin('arkship'); }
function setArkshipSkin(id){ setUnitSkin('arkship', id); }

// ── PAID ALT SKINS ──
// A skin is "paid" whenever it isn't the unit's free default (see
// UNIT_SKIN_CFG above). Ownership is fetched from /api/skin-purchases —
// backed by the skin_purchases table, populated only by the Polar
// order.paid webhook — so equipping a locked skin can never be spoofed by
// editing localStorage directly.
let ownedSkins=new Set();
let skinsBuyInFlight=false;

function isPaidSkin(unit,skin){
  const cfg=UNIT_SKIN_CFG[unit];
  return !!cfg && skin!==cfg.default;
}
function skinOwnKey(unit,skin){ return `${unit}:${skin}`; }

async function loadOwnedSkins(){
  try{
    const res=await fetch('/api/skin-purchases',{credentials:'include'});
    if(!res.ok) return;
    const body=await res.json();
    ownedSkins=new Set((body.purchases||[]).map(p=>skinOwnKey(p.unit,p.skin)));
  } catch(e){ /* offline — treat as nothing owned yet */ }
  refreshSkinOptionsUI();
}

async function buySkin(unit,skin){
  if(skinsBuyInFlight) return;
  skinsBuyInFlight=true;
  try{
    const res=await fetch('/api/skin-checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify({ unit, skin }),
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok || !body.checkoutUrl){
      alert(body.message || "Couldn't start checkout — please try again.");
      return;
    }
    window.location.href=body.checkoutUrl;
  } catch(e){
    alert("Couldn't start checkout — please try again.");
  } finally {
    skinsBuyInFlight=false;
  }
}

// Polar redirects back here after a successful payment with
// ?skin_checkout_id=... — the webhook that actually grants the skin can
// land a moment after that redirect, so poll briefly instead of assuming
// it's already recorded.
(function handleSkinCheckoutReturn(){
  const params=new URLSearchParams(location.search);
  const checkoutId=params.get('skin_checkout_id');
  if(!checkoutId) return;
  params.delete('skin_checkout_id');
  const qs=params.toString();
  history.replaceState(null,'',location.pathname+(qs?`?${qs}`:'')+location.hash);
  let attempts=0;
  const poll=()=>{ attempts++; loadOwnedSkins(); if(attempts<5) setTimeout(poll,1500); };
  poll();
})();

function refreshSkinOptionsUI(){
  document.querySelectorAll('.skin-option').forEach(opt=>{
    const unit=opt.dataset.unit || 'arkship';
    const skin=opt.dataset.skin;
    const on=skin===getUnitSkin(unit);
    opt.classList.toggle('selected', on);
    opt.setAttribute('aria-pressed', on ? 'true' : 'false');

    const paid=isPaidSkin(unit,skin);
    const owned=!paid || ownedSkins.has(skinOwnKey(unit,skin));
    opt.classList.toggle('locked', paid && !owned);
    opt.classList.toggle('owned', paid && owned);
    const priceEl=opt.querySelector('.skin-price');
    if(priceEl && paid){
      if(!opt.dataset.priceText) opt.dataset.priceText=priceEl.textContent;
      priceEl.textContent = owned ? 'OWNED — CLICK TO EQUIP' : opt.dataset.priceText;
    }
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

function drawHeroSkinCard(canvasEl,heroKey,skin){
  const c=canvasEl.getContext('2d');
  const W=canvasEl.width, H=canvasEl.height;
  drawSkinsBackdrop(c,W,H);

  const hero=HERO_SKIN_CFG[heroKey];
  const cfg=FACTION_CFG[hero.faction];
  const scale=3.2;
  const fakeW={frame:skinsFrame, state:'attack', faction:hero.faction};
  const theme=ALT_SKIN_THEME[hero.faction];
  const isAlt=skin===theme.id;

  // Same offscreen-draw-then-recolor approach as drawWarriorSkinCard — see comment there.
  const tc = isAlt ? getSkinScratchCanvas('draw',W,H).getContext('2d') : c;
  if(isAlt) tc.clearRect(0,0,W,H);

  tc.save();
  tc.translate(W*0.5,H*0.72);
  tc.scale(scale,scale);
  hero.draw(tc,cfg,fakeW);
  tc.restore();

  if(isAlt){
    drawAltLiveryUnit(c,tc.canvas,W,H,theme);
    drawAltSkinFrame(c,W,H,theme);
  }
}

// ── BARRACKS / ELITE / AERIAL WARRIOR PORTRAITS ──
// Every trainable barracks, elite and aerial-tier unit across all three
// factions, rendered with its real in-game draw function (same approach as
// the hero portraits above). Each is equippable with its faction's alt
// livery via ALT_SKIN_THEME (see drawAltSkinFrame above).
const WARRIOR_SKIN_CFG={
  witch:            { faction:'prism',  category:'ground', draw:(c,cfg,w)=>drawWarriorPrism(c,cfg,w) },
  swordsman:        { faction:'shadow', category:'ground', draw:(c,cfg,w)=>drawWarriorShadow(c,cfg,w) },
  gunbot:           { faction:'roboto', category:'ground', draw:(c,cfg,w)=>drawWarriorRoboto(c,cfg,w) },
  legionnaire:      { faction:'prism',  category:'ground', draw:(c,cfg,w)=>drawLegionnaire(c,cfg,w) },
  warbot:           { faction:'roboto', category:'ground', draw:(c,cfg,w)=>drawWarbot(c,cfg,w) },
  oracle:           { faction:'prism',  category:'ground', draw:(c,cfg,w)=>drawEliteOracle(c,cfg,w) },
  darkwarrior:      { faction:'shadow', category:'ground', draw:(c,cfg,w)=>drawEliteDarkWarrior(c,cfg,w) },
  shockbot:         { faction:'roboto', category:'ground', draw:(c,cfg,w)=>drawEliteShockbot(c,cfg,w) },
  wizard:           { faction:'prism',  category:'ground', draw:(c,cfg,w)=>drawWizard(c,cfg,w) },
  necromancer:      { faction:'shadow', category:'ground', draw:(c,cfg,w)=>drawNecromancer(c,cfg,w) },
  tank:             { faction:'roboto', category:'ground', draw:(c,cfg,w)=>drawTankUnit(c,cfg,w) },
  'wardrone-prism': { faction:'prism',  category:'aerial', draw:(c,cfg,w)=>drawPrismWarDrone(c,cfg,w) },
  'wardrone-shadow':{ faction:'shadow', category:'aerial', draw:(c,cfg,w)=>drawShadowWraith(c,cfg,w) },
  'wardrone-roboto':{ faction:'roboto', category:'aerial', draw:(c,cfg,w)=>drawSkyAttackerUnit(c,cfg,w) },
  lightfighter:     { faction:'prism',  category:'aerial', draw:(c,cfg,w)=>drawLightFighterUnit(c,cfg,w) },
  destroyer:        { faction:'shadow', category:'aerial', draw:(c,cfg,w)=>drawDestroyerUnit(c,cfg,w) },
  warship:          { faction:'roboto', category:'aerial', draw:(c,cfg,w)=>drawWarshipUnit(c,cfg,w) },
};

function drawWarriorSkinCard(canvasEl,key,skin){
  const c=canvasEl.getContext('2d');
  const W=canvasEl.width, H=canvasEl.height;
  drawSkinsBackdrop(c,W,H);

  const unit=WARRIOR_SKIN_CFG[key];
  const cfg=FACTION_CFG[unit.faction];
  const isAerial=unit.category==='aerial';
  const scale=isAerial?4.4:3.4;
  const fakeW={frame:skinsFrame, state:'attack', faction:unit.faction};
  const theme=ALT_SKIN_THEME[unit.faction];
  const isAlt=skin===theme.id;

  // Alt liveries draw the unit into an offscreen scratch canvas first, then
  // recolor+blit it onto the real canvas once — far cheaper than running
  // every fill/stroke in unit.draw() through a per-shape recolor.
  const tc = isAlt ? getSkinScratchCanvas('draw',W,H).getContext('2d') : c;
  if(isAlt) tc.clearRect(0,0,W,H);

  tc.save();
  if(isAerial){
    tc.translate(W*0.5,H*0.52);
    tc.rotate(-0.1);
  } else {
    tc.translate(W*0.5,H*0.72);
  }
  tc.scale(scale,scale);
  unit.draw(tc,cfg,fakeW);
  tc.restore();

  if(isAlt){
    drawAltLiveryUnit(c,tc.canvas,W,H,theme);
    drawAltSkinFrame(c,W,H,theme);
  }
}

// ── ROBOTO CAPITAL SHIP — REGULAR SKIN ──
// The stock hull, drawn with the real in-game renderer (drawCapitalShipUnit,
// aerial2.js) so this card matches what actually appears on the
// battlefield — same approach as the Arkship's BASIC card above.
function drawCapitalShipRegularSkinCard(canvasEl,mode){
  const c=canvasEl.getContext('2d');
  const W=canvasEl.width, H=canvasEl.height;
  drawSkinsBackdrop(c,W,H);

  const cfg=FACTION_CFG.roboto;
  const isLanded=mode==='landed';
  const fakeShip={frame:skinsFrame, state:'attack', landed:isLanded, passenger:true};

  c.save();
  c.translate(W*0.42,H*0.52);
  c.rotate(-0.08);
  c.scale(4.2,4.2);
  drawCapitalShipUnit(c,cfg,fakeShip);
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

// Only the selected unit's detail panel is ever shown at once (see
// showSkinDetail), so skip redrawing every other unit's off-screen
// canvases each frame — with 22 equippable units now in the tab (each with
// a standard + alt-livery card) that's the difference between animating 2
// canvases and 40+ every frame.
function isSkinCanvasVisible(el){ return !!el && el.offsetParent!==null; }

function skinsPreviewLoop(){
  skinsFrame++;
  const basic=document.getElementById('skin-arkship-basic-canvas');
  if(isSkinCanvasVisible(basic)) drawArkshipSkinCard(basic,'attacking','basic');
  const atk=document.getElementById('skin-arkship-attacking-canvas');
  if(isSkinCanvasVisible(atk)) drawArkshipSkinCard(atk,'attacking','royal-vanguard');
  const pha=document.getElementById('skin-arkship-phasing-canvas');
  if(isSkinCanvasVisible(pha)) drawArkshipSkinCard(pha,'phasing','royal-vanguard');
  for(const heroKey of ['prism','vanthel','gongui']){
    const std=document.getElementById(`skin-${heroKey}-canvas`);
    if(isSkinCanvasVisible(std)) drawHeroSkinCard(std,heroKey,'standard');
    const alt=document.getElementById(`skin-${heroKey}-alt-canvas`);
    if(isSkinCanvasVisible(alt)) drawHeroSkinCard(alt,heroKey,ALT_SKIN_THEME[HERO_SKIN_CFG[heroKey].faction].id);
  }
  for(const key of Object.keys(WARRIOR_SKIN_CFG)){
    const std=document.getElementById(`skin-${key}-canvas`);
    if(isSkinCanvasVisible(std)) drawWarriorSkinCard(std,key,'standard');
    const alt=document.getElementById(`skin-${key}-alt-canvas`);
    if(isSkinCanvasVisible(alt)) drawWarriorSkinCard(alt,key,ALT_SKIN_THEME[WARRIOR_SKIN_CFG[key].faction].id);
  }
  const stdAir=document.getElementById('skin-capitalship-airborne-canvas');
  if(isSkinCanvasVisible(stdAir)) drawCapitalShipRegularSkinCard(stdAir,'airborne');
  const stdLnd=document.getElementById('skin-capitalship-landed-canvas');
  if(isSkinCanvasVisible(stdLnd)) drawCapitalShipRegularSkinCard(stdLnd,'landed');
  const air=document.getElementById('skin-ironcrown-airborne-canvas');
  if(isSkinCanvasVisible(air)) drawCapitalShipSkinCard(air,'airborne');
  const lnd=document.getElementById('skin-ironcrown-landed-canvas');
  if(isSkinCanvasVisible(lnd)) drawCapitalShipSkinCard(lnd,'landed');
  skinsRAF=requestAnimationFrame(skinsPreviewLoop);
}

registerGame('skins', {
  init(){ refreshSkinOptionsUI(); loadOwnedSkins(); if(!skinsRAF) skinsPreviewLoop(); },
  cleanup(){ if(skinsRAF){ cancelAnimationFrame(skinsRAF); skinsRAF=null; } },
});

// ── SELECTION — click (or Enter/Space) on a .skin-option to equip that skin.
// Each .skin-option can bundle several preview cards (e.g. Royal Vanguard's
// Attacking/Phasing pair, Ironcrown's Airborne/Landed pair), so clicking any
// card inside it equips/lights up the whole option together. Options are
// scoped per-unit via data-unit (arkship vs capitalship) so equipping one
// unit's skin never affects the other's. Delegated on the whole detail
// column since each unit's .skin-option(s) live in their own detail panel.
(function wireSkinOptions(){
  const col=document.querySelector('.skins-detail-col');
  if(!col) return;
  col.addEventListener('click', e=>{
    const opt=e.target.closest('.skin-option');
    if(!opt || !opt.dataset.skin) return;
    const unit=opt.dataset.unit || 'arkship', skin=opt.dataset.skin;
    if(isPaidSkin(unit,skin) && !ownedSkins.has(skinOwnKey(unit,skin))) buySkin(unit,skin);
    else setUnitSkin(unit,skin);
  });
  col.addEventListener('keydown', e=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const opt=e.target.closest('.skin-option');
    if(!opt || !opt.dataset.skin) return;
    e.preventDefault();
    const unit=opt.dataset.unit || 'arkship', skin=opt.dataset.skin;
    if(isPaidSkin(unit,skin) && !ownedSkins.has(skinOwnKey(unit,skin))) buySkin(unit,skin);
    else setUnitSkin(unit,skin);
  });
  refreshSkinOptionsUI();
})();

// ── LIST NAVIGATION — click (or Enter/Space) on a unit's name in the list
// to show that unit's detail panel (its default skin, and alternate skin
// when it has one) and hide every other panel.
function showSkinDetail(unit){
  document.querySelectorAll('.skins-list-item').forEach(li=>{
    const on=li.dataset.unit===unit;
    li.classList.toggle('selected', on);
    li.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('.skin-detail').forEach(panel=>{
    panel.hidden = panel.id!==`skin-detail-${unit}`;
  });
}

(function wireSkinList(){
  const list=document.querySelector('.skins-list-col');
  if(!list) return;
  list.addEventListener('click', e=>{
    const li=e.target.closest('.skins-list-item');
    if(li && li.dataset.unit) showSkinDetail(li.dataset.unit);
  });
  list.addEventListener('keydown', e=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const li=e.target.closest('.skins-list-item');
    if(li && li.dataset.unit){ e.preventDefault(); showSkinDetail(li.dataset.unit); }
  });
})();

//# sourceMappingURL=skins.js.map
