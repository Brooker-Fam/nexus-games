// ── SIDEBAR PREVIEW RENDERERS ──
function renderPreviewGun(pc){
  pc.clearRect(0,0,44,44); pc.save(); pc.translate(22,22);
  pc.beginPath(); for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2-Math.PI/8,r=14;i===0?pc.moveTo(Math.cos(a)*r,Math.sin(a)*r):pc.lineTo(Math.cos(a)*r,Math.sin(a)*r);} pc.closePath();
  const bg=pc.createRadialGradient(0,0,2,0,0,14); bg.addColorStop(0,'#1a2a3a'); bg.addColorStop(1,'#0a1520');
  pc.fillStyle=bg; pc.fill(); pc.strokeStyle='#00f5ff'; pc.lineWidth=1.2; pc.stroke();
  pc.shadowColor='#00f5ff'; pc.shadowBlur=8;
  const tg=pc.createLinearGradient(-8,-6,8,6); tg.addColorStop(0,'#2a4a6a'); tg.addColorStop(1,'#0d2035');
  pc.fillStyle=tg; pc.beginPath(); pc.roundRect(-8,-6,16,12,3); pc.fill(); pc.strokeStyle='#00c8dd'; pc.lineWidth=1; pc.stroke();
  for(const yo of [-3,3]){
    pc.fillStyle='#1a3a55'; pc.fillRect(2,yo-1.5,14,3); pc.strokeStyle='#00f5ff'; pc.lineWidth=0.7; pc.strokeRect(2,yo-1.5,14,3);
    pc.fillStyle='rgba(0,245,255,0.4)'; pc.beginPath(); pc.arc(16,yo,2,0,Math.PI*2); pc.fill();
  }
  pc.restore();
}
function renderPreviewLaser(pc){
  pc.clearRect(0,0,44,44); pc.save(); pc.translate(22,22);
  pc.beginPath(); for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2-Math.PI/8,r=14;i===0?pc.moveTo(Math.cos(a)*r,Math.sin(a)*r):pc.lineTo(Math.cos(a)*r,Math.sin(a)*r);} pc.closePath();
  const bg=pc.createRadialGradient(0,0,2,0,0,14); bg.addColorStop(0,'#2a0818'); bg.addColorStop(1,'#0a0510');
  pc.fillStyle=bg; pc.fill(); pc.strokeStyle='#ff0088'; pc.lineWidth=1.2; pc.stroke();
  pc.shadowColor='#ff0088'; pc.shadowBlur=10;
  const lg=pc.createLinearGradient(-8,-5,8,5); lg.addColorStop(0,'#3a1025'); lg.addColorStop(1,'#1a0510');
  pc.fillStyle=lg; pc.beginPath(); pc.moveTo(-8,-5); pc.lineTo(4,-5); pc.lineTo(8,-2); pc.lineTo(8,2); pc.lineTo(4,5); pc.lineTo(-8,5); pc.closePath(); pc.fill(); pc.strokeStyle='#ff0088'; pc.lineWidth=1; pc.stroke();
  pc.fillStyle='#2a0818'; pc.fillRect(4,-2.5,14,5); pc.strokeStyle='#ff0088'; pc.lineWidth=0.8; pc.strokeRect(4,-2.5,14,5);
  pc.strokeStyle='rgba(255,0,136,0.5)'; pc.lineWidth=1;
  for(let cx=7;cx<18;cx+=4){pc.beginPath();pc.arc(cx,0,2.5,-Math.PI*0.6,Math.PI*0.6);pc.stroke();pc.beginPath();pc.arc(cx,0,2.5,Math.PI*0.4,Math.PI*1.6);pc.stroke();}
  const lens=pc.createRadialGradient(18,0,0,18,0,3); lens.addColorStop(0,'#ff88cc'); lens.addColorStop(0.5,'#ff0088'); lens.addColorStop(1,'transparent');
  pc.fillStyle=lens; pc.beginPath(); pc.arc(18,0,3,0,Math.PI*2); pc.fill();
  pc.restore();
}
function renderPreviewMissile(pc){
  pc.clearRect(0,0,44,44); pc.save(); pc.translate(22,22);
  pc.beginPath(); for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2-Math.PI/8,r=14;i===0?pc.moveTo(Math.cos(a)*r,Math.sin(a)*r):pc.lineTo(Math.cos(a)*r,Math.sin(a)*r);} pc.closePath();
  const bg=pc.createRadialGradient(0,0,2,0,0,14); bg.addColorStop(0,'#2a1800'); bg.addColorStop(1,'#0a0800');
  pc.fillStyle=bg; pc.fill(); pc.strokeStyle='#ff8800'; pc.lineWidth=1.2; pc.stroke();
  pc.shadowColor='#ff8800'; pc.shadowBlur=10;
  const mg=pc.createLinearGradient(-9,-9,9,9); mg.addColorStop(0,'#2a1800'); mg.addColorStop(1,'#150c00');
  pc.fillStyle=mg; pc.beginPath(); pc.roundRect(-9,-9,18,18,2); pc.fill(); pc.strokeStyle='#ff8800'; pc.lineWidth=1; pc.stroke();
  for(const [tx,ty] of [[-4,-4],[2,-4],[-4,2],[2,2]]){
    pc.fillStyle='#1a1000'; pc.beginPath(); pc.roundRect(tx,ty,4,4,1); pc.fill(); pc.strokeStyle='#aa5500'; pc.lineWidth=0.7; pc.strokeRect(tx,ty,4,4);
    pc.fillStyle='#cc6600'; pc.fillRect(tx+1,ty+0.5,2,3);
    pc.fillStyle='#ff2200'; pc.beginPath(); pc.moveTo(tx+1,ty+0.5); pc.lineTo(tx+2,ty-0.8); pc.lineTo(tx+3,ty+0.5); pc.closePath(); pc.fill();
  }
  pc.restore();
}
function renderPreviewCryo(pc){
  pc.clearRect(0,0,44,44); pc.save(); pc.translate(22,22);
  pc.beginPath(); for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2-Math.PI/8,r=14;i===0?pc.moveTo(Math.cos(a)*r,Math.sin(a)*r):pc.lineTo(Math.cos(a)*r,Math.sin(a)*r);} pc.closePath();
  const bg=pc.createRadialGradient(0,0,2,0,0,14); bg.addColorStop(0,'#0a1830'); bg.addColorStop(1,'#020810');
  pc.fillStyle=bg; pc.fill(); pc.strokeStyle='#88aaff'; pc.lineWidth=1.2; pc.stroke();
  pc.shadowColor='#aaccff'; pc.shadowBlur=14;
  const cg=pc.createRadialGradient(0,0,1,0,0,9); cg.addColorStop(0,'#b0d8ff'); cg.addColorStop(0.4,'#4488cc'); cg.addColorStop(1,'#0a1830');
  pc.fillStyle=cg; pc.beginPath(); pc.arc(0,0,9,0,Math.PI*2); pc.fill(); pc.strokeStyle='#88ccff'; pc.lineWidth=1; pc.stroke();
  pc.strokeStyle='rgba(200,230,255,0.8)'; pc.lineWidth=1;
  for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2; pc.beginPath(); pc.moveTo(0,0); pc.lineTo(Math.cos(a)*8,Math.sin(a)*8); pc.stroke();}
  const core=pc.createRadialGradient(0,0,0,0,0,3); core.addColorStop(0,'white'); core.addColorStop(1,'#44aaff');
  pc.fillStyle=core; pc.beginPath(); pc.arc(0,0,3,0,Math.PI*2); pc.fill();
  pc.restore();
}

// ══════════════════════════════════════════
// DEEP SPACE OPS — FACTION SELECT + REVEAL
// ══════════════════════════════════════════
let dsoSelectedFaction = null;
let dsoRevealRAF = null;
let dsoRevealFrame = 0;

// ── DRAW CHARACTERS ON SMALL FACTION CARDS ──
function drawCardCharacter(canvasEl, faction, hover){
  const c = canvasEl.getContext('2d');
  const W=180, H=220;
  c.clearRect(0,0,W,H);

  // background glow
  const bgColors = {shadow:'rgba(80,0,140,', prism:'rgba(0,180,220,', roboto:'rgba(200,100,0,'};
  const bg = c.createRadialGradient(W/2,H*0.55,0,W/2,H*0.55,90);
  bg.addColorStop(0, bgColors[faction]+(hover?'0.18':'0.1')+')');
  bg.addColorStop(1,'transparent');
  c.fillStyle=bg; c.fillRect(0,0,W,H);

  c.save(); c.translate(W/2, H*0.72);
  const sc = hover ? 1.04 : 1.0;
  c.scale(sc, sc);

  if(faction==='shadow') drawShadowChar(c, 0, 0, 0.6);
  else if(faction==='prism') drawPrismChar(c, 0, 0, 0.6);
  else if(faction==='roboto') drawRobotoChar(c, 0, 0, 0.6);

  c.restore();
}

// ── SHADOW ARMADA — DARK SWORDSMAN ──
function drawShadowChar(c, x, y, sc){
  c.save(); c.scale(sc,sc);
  const bob = Math.sin(dsoRevealFrame*0.04)*2;

  // ground shadow
  c.fillStyle='rgba(80,0,180,0.18)';
  c.beginPath(); c.ellipse(x,y+2,28,7,0,0,Math.PI*2); c.fill();

  // CAPE — sweeping dark fabric
  c.save();
  c.shadowColor='#8800ff'; c.shadowBlur=20;
  const capeGrad=c.createLinearGradient(x-30,y-80,x+20,y+10);
  capeGrad.addColorStop(0,'#0a0010'); capeGrad.addColorStop(0.5,'#1a0030'); capeGrad.addColorStop(1,'#000008');
  c.fillStyle=capeGrad;
  c.beginPath();
  c.moveTo(x-8,y-115+bob);
  c.bezierCurveTo(x-35,y-90+bob, x-50,y-40, x-38,y+bob);
  c.lineTo(x+12,y+bob);
  c.bezierCurveTo(x+5,y-30, x+10,y-80, x+8,y-115+bob);
  c.closePath(); c.fill();
  // cape edge glow
  c.strokeStyle='rgba(100,0,200,0.5)'; c.lineWidth=1;
  c.beginPath();
  c.moveTo(x-8,y-115+bob);
  c.bezierCurveTo(x-35,y-90+bob, x-50,y-40, x-38,y+bob);
  c.stroke();
  c.restore();

  // LEGS — armored greaves
  for(const [lx,lw] of [[-10,10],[2,10]]){
    const legGrad=c.createLinearGradient(x+lx,y-20,x+lx+lw,y);
    legGrad.addColorStop(0,'#1a1a2a'); legGrad.addColorStop(1,'#0a0a14');
    c.fillStyle=legGrad;
    c.fillRect(x+lx,y-22,lw,24);
    c.strokeStyle='rgba(120,0,255,0.4)'; c.lineWidth=0.8; c.strokeRect(x+lx,y-22,lw,24);
    // knee armor
    c.fillStyle='#2a1a3a';
    c.beginPath(); c.roundRect(x+lx-1,y-16,lw+2,6,2); c.fill();
    c.strokeStyle='rgba(180,80,255,0.5)'; c.lineWidth=0.7; c.stroke();
  }

  // TORSO — dark plate armor
  c.save();
  c.shadowColor='#6600cc'; c.shadowBlur=12;
  const torsoGrad=c.createLinearGradient(x-15,y-80,x+15,y-30);
  torsoGrad.addColorStop(0,'#1e1030'); torsoGrad.addColorStop(0.4,'#120820'); torsoGrad.addColorStop(1,'#080410');
  c.fillStyle=torsoGrad;
  c.beginPath();
  c.moveTo(x-14,y-22); c.lineTo(x-16,y-75+bob); c.lineTo(x+16,y-75+bob); c.lineTo(x+14,y-22);
  c.closePath(); c.fill();
  c.strokeStyle='rgba(120,40,220,0.5)'; c.lineWidth=1; c.stroke();
  // chest plate detail
  c.fillStyle='#2a1045';
  c.beginPath(); c.moveTo(x-8,y-72+bob); c.lineTo(x,y-58+bob); c.lineTo(x+8,y-72+bob);
  c.lineTo(x+10,y-50+bob); c.lineTo(x,y-44+bob); c.lineTo(x-10,y-50+bob);
  c.closePath(); c.fill();
  c.strokeStyle='rgba(160,60,255,0.6)'; c.lineWidth=0.8; c.stroke();
  // energy core in chest
  const core=c.createRadialGradient(x,y-56+bob,0,x,y-56+bob,5);
  core.addColorStop(0,'#dd88ff'); core.addColorStop(0.5,'#8800cc'); core.addColorStop(1,'transparent');
  c.fillStyle=core; c.beginPath(); c.arc(x,y-56+bob,5,0,Math.PI*2); c.fill();
  c.restore();

  // SHOULDERS — pauldrons
  for(const sx of [-1,1]){
    const shGrad=c.createLinearGradient(x+sx*12,y-82,x+sx*22,y-65);
    shGrad.addColorStop(0,'#1e1030'); shGrad.addColorStop(1,'#0a0618');
    c.fillStyle=shGrad;
    c.beginPath(); c.ellipse(x+sx*18,y-74+bob,9,7,sx*0.3,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(120,40,220,0.5)'; c.lineWidth=0.8; c.stroke();
    // spike
    c.fillStyle='#3a1060';
    c.beginPath(); c.moveTo(x+sx*14,y-76+bob); c.lineTo(x+sx*18,y-88+bob); c.lineTo(x+sx*22,y-76+bob); c.closePath(); c.fill();
    c.strokeStyle='rgba(180,80,255,0.5)'; c.lineWidth=0.7; c.stroke();
  }

  // SWORD ARM — extended to side holding great sword
  c.save();
  c.shadowColor='#aa44ff'; c.shadowBlur=16;
  // arm
  c.strokeStyle='#1a0a2a'; c.lineWidth=7;
  c.beginPath(); c.moveTo(x+14,y-70+bob); c.lineTo(x+36,y-50+bob); c.stroke();
  c.strokeStyle='rgba(100,40,180,0.3)'; c.lineWidth=5;
  c.beginPath(); c.moveTo(x+14,y-70+bob); c.lineTo(x+36,y-50+bob); c.stroke();
  // gauntlet
  c.fillStyle='#1a1030';
  c.beginPath(); c.arc(x+36,y-50+bob,6,0,Math.PI*2); c.fill();
  c.strokeStyle='rgba(150,60,255,0.5)'; c.lineWidth=0.8; c.stroke();

  // GREATSWORD — long diagonal blade
  const bx=x+38, by=y-46+bob;
  // blade glow
  c.shadowColor='#cc88ff'; c.shadowBlur=25;
  // crossguard
  c.strokeStyle='#3a2060'; c.lineWidth=10; c.lineCap='round';
  c.beginPath(); c.moveTo(bx-10,by+10); c.lineTo(bx+10,by-10); c.stroke();
  c.strokeStyle='rgba(180,100,255,0.5)'; c.lineWidth=8; c.stroke();
  // blade
  const bladeGrad=c.createLinearGradient(bx,by,bx-20,by-70);
  bladeGrad.addColorStop(0,'#ddb8ff'); bladeGrad.addColorStop(0.3,'#9944ff'); bladeGrad.addColorStop(0.7,'#4400aa'); bladeGrad.addColorStop(1,'#1a004a');
  c.strokeStyle=bladeGrad; c.lineWidth=5; c.lineCap='butt';
  c.beginPath(); c.moveTo(bx,by); c.lineTo(bx-20,by-72); c.stroke();
  // blade edge
  c.strokeStyle='rgba(255,200,255,0.5)'; c.lineWidth=1.5;
  c.beginPath(); c.moveTo(bx+1,by-1); c.lineTo(bx-18,by-71); c.stroke();
  // handle
  c.strokeStyle='#0a0010'; c.lineWidth=4;
  c.beginPath(); c.moveTo(bx,by); c.lineTo(bx+12,by+20); c.stroke();
  c.strokeStyle='rgba(100,0,180,0.5)'; c.lineWidth=3; c.stroke();
  c.restore();

  // OFF ARM
  c.strokeStyle='#1a0a2a'; c.lineWidth=7;
  c.beginPath(); c.moveTo(x-14,y-70+bob); c.lineTo(x-24,y-45+bob); c.stroke();

  // NECK + HEAD
  c.fillStyle='#0f0820';
  c.fillRect(x-5,y-90+bob,10,14);

  // HELMET — full face helm with visor
  c.save();
  c.shadowColor='#9933ff'; c.shadowBlur=20;
  const helmGrad=c.createLinearGradient(x-16,y-130+bob,x+16,y-95+bob);
  helmGrad.addColorStop(0,'#1e1035'); helmGrad.addColorStop(0.5,'#140a28'); helmGrad.addColorStop(1,'#080510');
  c.fillStyle=helmGrad;
  c.beginPath();
  c.moveTo(x-14,y-100+bob);
  c.lineTo(x-16,y-120+bob);
  c.bezierCurveTo(x-16,y-135+bob, x+16,y-135+bob, x+16,y-120+bob);
  c.lineTo(x+14,y-100+bob);
  c.closePath(); c.fill();
  c.strokeStyle='rgba(120,40,220,0.6)'; c.lineWidth=1; c.stroke();
  // visor slit
  const visGrad=c.createLinearGradient(x-10,y-118+bob,x+10,y-112+bob);
  visGrad.addColorStop(0,'rgba(180,80,255,0)');
  visGrad.addColorStop(0.5,'rgba(200,120,255,0.9)');
  visGrad.addColorStop(1,'rgba(180,80,255,0)');
  c.fillStyle=visGrad;
  c.beginPath(); c.roundRect(x-10,y-120+bob,20,6,3); c.fill();
  // crest
  c.fillStyle='#2a1050';
  c.beginPath(); c.moveTo(x-3,y-133+bob); c.lineTo(x,y-142+bob); c.lineTo(x+3,y-133+bob); c.closePath(); c.fill();
  c.strokeStyle='rgba(160,80,255,0.6)'; c.lineWidth=0.8; c.stroke();
  c.restore();

  c.restore();
}

// ── PRISM ARMADA — WHITE WITCH ──
function drawPrismChar(c, x, y, sc){
  c.save(); c.scale(sc,sc);
  const bob = Math.sin(dsoRevealFrame*0.04)*2;
  const t = dsoRevealFrame;

  // magic aura particles (orbiting sparks)
  for(let i=0;i<6;i++){
    const a = t*0.03 + (i/6)*Math.PI*2;
    const r = 38 + Math.sin(t*0.05+i)*6;
    const px=x+Math.cos(a)*r, py=y-70+bob+Math.sin(a)*r*0.4;
    c.save();
    c.shadowColor='#aaffff'; c.shadowBlur=10;
    c.fillStyle=`hsla(${180+i*20},100%,80%,${0.4+Math.sin(t*0.07+i)*0.3})`;
    c.beginPath(); c.arc(px,py,2,0,Math.PI*2); c.fill();
    c.restore();
  }

  // ground glow
  c.fillStyle='rgba(0,200,220,0.1)';
  c.beginPath(); c.ellipse(x,y+2,30,8,0,0,Math.PI*2); c.fill();

  // ROBE — flowing white gown
  c.save();
  c.shadowColor='#00ddff'; c.shadowBlur=18;
  const robeGrad=c.createLinearGradient(x-25,y-80,x+25,y);
  robeGrad.addColorStop(0,'#e8f8ff'); robeGrad.addColorStop(0.3,'#b8ecff'); robeGrad.addColorStop(0.7,'#80d8f0'); robeGrad.addColorStop(1,'#40a8d0');
  c.fillStyle=robeGrad;
  c.beginPath();
  c.moveTo(x-8,y-95+bob);
  c.bezierCurveTo(x-22,y-70+bob, x-30,y-30, x-28,y+bob);
  c.lineTo(x+28,y+bob);
  c.bezierCurveTo(x+30,y-30, x+22,y-70+bob, x+8,y-95+bob);
  c.closePath(); c.fill();
  c.strokeStyle='rgba(150,230,255,0.4)'; c.lineWidth=1; c.stroke();
  // robe shimmer folds
  c.strokeStyle='rgba(255,255,255,0.3)'; c.lineWidth=0.8;
  for(const fx of [-10,0,10]){
    c.beginPath(); c.moveTo(x+fx,y-70+bob); c.bezierCurveTo(x+fx-3,y-40+bob,x+fx+3,y-20,x+fx,y+bob); c.stroke();
  }
  c.restore();

  // hem glow (bottom of robe)
  const hemGrad=c.createLinearGradient(x-28,y,x+28,y);
  hemGrad.addColorStop(0,'transparent'); hemGrad.addColorStop(0.5,'rgba(0,220,255,0.4)'); hemGrad.addColorStop(1,'transparent');
  c.fillStyle=hemGrad;
  c.fillRect(x-28,y-4,56,6);

  // ARMS — sleeves
  for(const sx of [-1,1]){
    const slGrad=c.createLinearGradient(x+sx*8,y-90,x+sx*30,y-60);
    slGrad.addColorStop(0,'#d0f0ff'); slGrad.addColorStop(1,'#88ccee');
    c.fillStyle=slGrad;
    c.beginPath(); c.ellipse(x+sx*20,y-70+bob,9,14,sx*0.4,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(150,230,255,0.3)'; c.lineWidth=0.7; c.stroke();
    // hand
    c.fillStyle='#ffe8e0';
    c.beginPath(); c.ellipse(x+sx*26,y-60+bob,5,4,sx*0.3,0,Math.PI*2); c.fill();
  }

  // MAGIC STAFF — right hand
  c.save();
  c.shadowColor='#00ffff'; c.shadowBlur=20;
  // staff pole
  const staffGrad=c.createLinearGradient(x+26,y-60,x+30,y+10);
  staffGrad.addColorStop(0,'#ffffff'); staffGrad.addColorStop(0.5,'#88ccff'); staffGrad.addColorStop(1,'#4488aa');
  c.strokeStyle=staffGrad; c.lineWidth=3; c.lineCap='round';
  c.beginPath(); c.moveTo(x+26,y-58+bob); c.lineTo(x+32,y+10+bob); c.stroke();
  // crystal orb at top
  const orb=c.createRadialGradient(x+22,y-78+bob,0,x+22,y-74+bob,14);
  orb.addColorStop(0,'#ffffff'); orb.addColorStop(0.3,'#aaeeff'); orb.addColorStop(0.6,'#00ccff'); orb.addColorStop(1,'rgba(0,160,200,0)');
  c.fillStyle=orb; c.beginPath(); c.arc(x+22,y-74+bob,14,0,Math.PI*2); c.fill();
  // inner crystal
  c.fillStyle='rgba(255,255,255,0.8)';
  c.beginPath(); c.arc(x+22,y-74+bob,5,0,Math.PI*2); c.fill();
  // prism rays from orb
  for(let r=0;r<6;r++){
    const ra=(r/6)*Math.PI*2+t*0.02;
    const cols=['#ff88aa','#ffff44','#44ff88','#44aaff','#bb44ff','#ff8844'];
    c.strokeStyle=cols[r]; c.lineWidth=1; c.globalAlpha=0.5;
    c.beginPath();
    c.moveTo(x+22+Math.cos(ra)*6,y-74+bob+Math.sin(ra)*6);
    c.lineTo(x+22+Math.cos(ra)*22,y-74+bob+Math.sin(ra)*22);
    c.stroke();
    c.globalAlpha=1;
  }
  c.restore();

  // HAIR — long silver-white flowing
  c.save();
  c.shadowColor='#cceeff'; c.shadowBlur=10;
  const hairGrad=c.createLinearGradient(x,y-130+bob,x+15,y-80+bob);
  hairGrad.addColorStop(0,'#ffffff'); hairGrad.addColorStop(0.5,'#ddf0ff'); hairGrad.addColorStop(1,'#aad8f0');
  c.fillStyle=hairGrad;
  c.beginPath();
  c.moveTo(x-12,y-112+bob);
  c.bezierCurveTo(x-18,y-95+bob, x-22,y-70+bob, x-14,y-50+bob);
  c.lineTo(x-8,y-50+bob);
  c.bezierCurveTo(x-14,y-70+bob, x-8,y-95+bob, x-4,y-112+bob);
  c.closePath(); c.fill();
  // right side
  c.beginPath();
  c.moveTo(x+12,y-112+bob);
  c.bezierCurveTo(x+16,y-95+bob, x+12,y-70+bob, x+8,y-55+bob);
  c.lineTo(x+14,y-55+bob);
  c.bezierCurveTo(x+18,y-70+bob, x+20,y-95+bob, x+14,y-112+bob);
  c.closePath(); c.fill();
  c.restore();

  // FACE
  c.fillStyle='#fff0e8';
  c.beginPath(); c.ellipse(x,y-118+bob,10,12,0,0,Math.PI*2); c.fill();
  // glowing eyes
  for(const ex of [-4,4]){
    const eyeGrad=c.createRadialGradient(x+ex,y-119+bob,0,x+ex,y-119+bob,3);
    eyeGrad.addColorStop(0,'#ffffff'); eyeGrad.addColorStop(0.4,'#44ddff'); eyeGrad.addColorStop(1,'transparent');
    c.fillStyle=eyeGrad; c.beginPath(); c.arc(x+ex,y-119+bob,3,0,Math.PI*2); c.fill();
  }
  // crown
  c.save();
  c.shadowColor='#aaffff'; c.shadowBlur=14;
  c.fillStyle='#c0e8ff';
  c.beginPath();
  c.moveTo(x-10,y-128+bob); c.lineTo(x-10,y-134+bob);
  c.lineTo(x-5,y-130+bob); c.lineTo(x,y-138+bob);
  c.lineTo(x+5,y-130+bob); c.lineTo(x+10,y-134+bob);
  c.lineTo(x+10,y-128+bob); c.closePath(); c.fill();
  c.strokeStyle='rgba(100,220,255,0.7)'; c.lineWidth=0.8; c.stroke();
  c.restore();

  c.restore();
}

// ── ROBOTO ARMADA — GUNBOT ──
function drawRobotoChar(c, x, y, sc){
  c.save(); c.scale(sc,sc);
  const bob = Math.sin(dsoRevealFrame*0.04)*1;
  const t = dsoRevealFrame;

  // ground shadow
  c.fillStyle='rgba(160,80,0,0.15)';
  c.beginPath(); c.ellipse(x,y+2,30,7,0,0,Math.PI*2); c.fill();

  // LEGS — heavy mechanical
  for(const [lx, foot] of [[-11,-16],[3,12]]){
    // upper leg
    const legG=c.createLinearGradient(x+lx,y-25,x+lx+10,y);
    legG.addColorStop(0,'#3a3a3a'); legG.addColorStop(1,'#1a1a1a');
    c.fillStyle=legG; c.fillRect(x+lx,y-26,10,28);
    c.strokeStyle='rgba(255,140,0,0.3)'; c.lineWidth=0.7; c.strokeRect(x+lx,y-26,10,28);
    // knee joint
    c.fillStyle='#555';
    c.beginPath(); c.arc(x+lx+5,y-10,5,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(255,140,0,0.5)'; c.lineWidth=0.8; c.stroke();
    // foot
    c.fillStyle='#2a2a2a';
    c.beginPath(); c.roundRect(x+foot,y-2,18,6,2); c.fill();
    c.strokeStyle='rgba(255,140,0,0.3)'; c.lineWidth=0.7; c.stroke();
  }

  // TORSO — chunky armored box
  c.save();
  c.shadowColor='#ff8800'; c.shadowBlur=14;
  const torsoG=c.createLinearGradient(x-18,y-85+bob,x+18,y-26+bob);
  torsoG.addColorStop(0,'#3a3a40'); torsoG.addColorStop(0.4,'#28282e'); torsoG.addColorStop(1,'#161618');
  c.fillStyle=torsoG;
  c.beginPath(); c.roundRect(x-18,y-85+bob,36,60,3); c.fill();
  c.strokeStyle='rgba(200,100,0,0.4)'; c.lineWidth=1; c.stroke();
  // chest vent slats
  for(let vy=0;vy<4;vy++){
    c.fillStyle='#0a0a0a';
    c.fillRect(x-12,y-76+vy*7+bob,24,4);
    c.strokeStyle='rgba(255,100,0,0.2)'; c.lineWidth=0.5; c.strokeRect(x-12,y-76+vy*7+bob,24,4);
  }
  // power core
  const coreG=c.createRadialGradient(x,y-58+bob,0,x,y-58+bob,7);
  coreG.addColorStop(0,'#ffdd00'); coreG.addColorStop(0.5,'#ff8800'); coreG.addColorStop(1,'rgba(200,60,0,0)');
  c.fillStyle=coreG; c.beginPath(); c.arc(x,y-58+bob,7,0,Math.PI*2); c.fill();
  c.strokeStyle='rgba(255,200,0,0.6)'; c.lineWidth=0.8; c.stroke();
  // status lights
  for(let li=0;li<3;li++){
    c.fillStyle=li===0?'#00ff44':li===1?'#ff8800':'#ff0000';
    c.globalAlpha= li===2 ? (Math.sin(t*0.1)>0?0.9:0.2) : 0.9;
    c.beginPath(); c.arc(x-10+li*5,y-32+bob,2,0,Math.PI*2); c.fill();
    c.globalAlpha=1;
  }
  c.restore();

  // SHOULDER — left normal
  c.save();
  const shG=c.createLinearGradient(x-28,y-88,x-14,y-72);
  shG.addColorStop(0,'#3a3a40'); shG.addColorStop(1,'#1a1a1e');
  c.fillStyle=shG;
  c.beginPath(); c.roundRect(x-28,y-88+bob,16,18,3); c.fill();
  c.strokeStyle='rgba(180,80,0,0.4)'; c.lineWidth=0.8; c.stroke();
  // left arm
  c.fillStyle='#2a2a2e';
  c.fillRect(x-26,y-72+bob,10,28);
  c.strokeStyle='rgba(180,80,0,0.3)'; c.lineWidth=0.7; c.strokeRect(x-26,y-72+bob,10,28);
  // left hand
  c.fillStyle='#1e1e22';
  c.beginPath(); c.roundRect(x-28,y-46+bob,14,10,2); c.fill();
  c.restore();

  // ── GUN ARM — RIGHT SIDE ──
  c.save();
  c.shadowColor='#ff6600'; c.shadowBlur=16;
  // shoulder mount
  const gunShG=c.createLinearGradient(x+12,y-90,x+30,y-74);
  gunShG.addColorStop(0,'#4a3820'); gunShG.addColorStop(1,'#261c10');
  c.fillStyle=gunShG;
  c.beginPath(); c.roundRect(x+12,y-90+bob,18,20,3); c.fill();
  c.strokeStyle='rgba(255,140,0,0.5)'; c.lineWidth=0.9; c.stroke();
  // upper arm
  c.fillStyle='#302820';
  c.fillRect(x+16,y-72+bob,10,20);
  c.strokeStyle='rgba(255,120,0,0.3)'; c.lineWidth=0.7; c.strokeRect(x+16,y-72+bob,10,20);
  // elbow joint
  c.fillStyle='#3a2a14';
  c.beginPath(); c.arc(x+21,y-52+bob,7,0,Math.PI*2); c.fill();
  c.strokeStyle='rgba(255,140,0,0.5)'; c.lineWidth=0.8; c.stroke();
  // forearm — becomes the gun housing
  const faG=c.createLinearGradient(x+14,y-52,x+14,y-28);
  faG.addColorStop(0,'#3a3020'); faG.addColorStop(1,'#201c10');
  c.fillStyle=faG;
  c.beginPath(); c.roundRect(x+12,y-52+bob,18,24,2); c.fill();
  c.strokeStyle='rgba(255,140,0,0.4)'; c.lineWidth=0.8; c.stroke();

  // GUN BARREL ASSEMBLY protruding from forearm
  // outer housing / receiver
  const recG=c.createLinearGradient(x+28,y-50,x+28,y-34);
  recG.addColorStop(0,'#3a2a10'); recG.addColorStop(1,'#1a1208');
  c.fillStyle=recG;
  c.beginPath(); c.roundRect(x+28,y-51+bob,10,18,2); c.fill();
  c.strokeStyle='rgba(255,140,0,0.5)'; c.lineWidth=0.8; c.stroke();

  // THREE gun barrels in a cluster (minigun style)
  const barrelOffsets=[[-2,-3],[2,-3],[0,1]];
  for(const [box,boy] of barrelOffsets){
    const bx=x+38+box, by2=y-44+boy+bob;
    // barrel tube
    const bG=c.createLinearGradient(bx-1,by2,bx+1,by2);
    bG.addColorStop(0,'#4a3818'); bG.addColorStop(0.5,'#2a2010'); bG.addColorStop(1,'#1a1408');
    c.fillStyle=bG;
    c.fillRect(bx-1.5,by2-10,3,22);
    c.strokeStyle='rgba(200,100,0,0.4)'; c.lineWidth=0.5; c.strokeRect(bx-1.5,by2-10,3,22);
    // muzzle
    c.fillStyle='#0a0800';
    c.beginPath(); c.arc(bx,by2+12,2,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(255,100,0,0.6)'; c.lineWidth=0.5; c.stroke();
    // barrel ridge rings
    for(const ry of [-6,0,6]){
      c.strokeStyle='rgba(180,80,0,0.4)'; c.lineWidth=0.7;
      c.beginPath(); c.moveTo(bx-1.5,by2+ry); c.lineTo(bx+1.5,by2+ry); c.stroke();
    }
  }
  // muzzle glow (active)
  const muzzG=c.createRadialGradient(x+40,y-30+bob,0,x+40,y-30+bob,8);
  muzzG.addColorStop(0,`rgba(255,180,0,${0.3+Math.sin(t*0.2)*0.2})`);
  muzzG.addColorStop(1,'transparent');
  c.fillStyle=muzzG; c.beginPath(); c.arc(x+40,y-30+bob,8,0,Math.PI*2); c.fill();

  // ammo counter on side
  c.fillStyle='#0a0800';
  c.beginPath(); c.roundRect(x+13,y-50+bob,8,8,1); c.fill();
  c.fillStyle='#ff6600'; c.globalAlpha=0.9;
  c.font='bold 5px Orbitron,monospace'; c.textAlign='center'; c.textBaseline='middle';
  c.fillText('250',x+17,y-46+bob);
  c.globalAlpha=1;

  c.restore();

  // NECK
  c.fillStyle='#252525';
  c.fillRect(x-6,y-95+bob,12,12);
  c.strokeStyle='rgba(200,100,0,0.3)'; c.lineWidth=0.7; c.strokeRect(x-6,y-95+bob,12,12);

  // HEAD — angular robot head
  c.save();
  c.shadowColor='#ff8800'; c.shadowBlur=16;
  const headG=c.createLinearGradient(x-16,y-130+bob,x+16,y-95+bob);
  headG.addColorStop(0,'#3a3a40'); headG.addColorStop(0.4,'#25252a'); headG.addColorStop(1,'#141418');
  c.fillStyle=headG;
  c.beginPath(); c.roundRect(x-14,y-130+bob,28,34,3); c.fill();
  c.strokeStyle='rgba(180,80,0,0.4)'; c.lineWidth=1; c.stroke();
  // visor — wide glowing orange
  const visG=c.createLinearGradient(x-10,y-124+bob,x+10,y-116+bob);
  visG.addColorStop(0,'rgba(255,120,0,0.2)');
  visG.addColorStop(0.5,'rgba(255,180,0,0.95)');
  visG.addColorStop(1,'rgba(255,120,0,0.2)');
  c.fillStyle=visG;
  c.beginPath(); c.roundRect(x-10,y-124+bob,20,8,2); c.fill();
  // scan line across visor
  const scanX = x-10+((t*2)%20);
  c.fillStyle='rgba(255,255,200,0.6)';
  c.fillRect(scanX,y-124+bob,2,8);
  // side panel details
  for(const sx of [-1,1]){
    c.fillStyle='#1a1a1e';
    c.fillRect(x+sx*14,y-122+bob,sx*3,10);
    c.strokeStyle='rgba(180,80,0,0.3)'; c.lineWidth=0.5; c.strokeRect(x+sx*14,y-122+bob,sx*3,10);
  }
  // antenna
  c.strokeStyle='#555'; c.lineWidth=2;
  c.beginPath(); c.moveTo(x+8,y-130+bob); c.lineTo(x+10,y-140+bob); c.stroke();
  c.fillStyle='#ff4400';
  c.beginPath(); c.arc(x+10,y-140+bob,2,0,Math.PI*2); c.fill();
  c.shadowColor='#ff4400'; c.shadowBlur=8;
  c.beginPath(); c.arc(x+10,y-140+bob,2,0,Math.PI*2); c.fill();
  c.restore();

  c.restore();
}

// ── CARD PREVIEWS ──
let dsoPreviewRAF=null;
function dsoPreview(faction){
  if(dsoPreviewRAF) return;
  function loop(){
    dsoRevealFrame++;
    const canvases={shadow:'fc-canvas-shadow',prism:'fc-canvas-prism',roboto:'fc-canvas-roboto'};
    for(const [f,id] of Object.entries(canvases)){
      const el=document.getElementById(id);
      if(el) drawCardCharacter(el, f, f===faction);
    }
    dsoPreviewRAF=requestAnimationFrame(loop);
  }
  dsoPreviewRAF=requestAnimationFrame(loop);
}
function dsoPreviewClear(){
  if(dsoPreviewRAF){ cancelAnimationFrame(dsoPreviewRAF); dsoPreviewRAF=null; }
  const canvases={shadow:'fc-canvas-shadow',prism:'fc-canvas-prism',roboto:'fc-canvas-roboto'};
  for(const [f,id] of Object.entries(canvases)){
    const el=document.getElementById(id);
    if(el) drawCardCharacter(el, f, false);
  }
}
