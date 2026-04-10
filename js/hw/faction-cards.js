// ── HOMESTEAD WARS — FACTION CARDS ──

function hwDrawCardCharacter(canvasEl, faction, hover){
  const c = canvasEl.getContext('2d');
  const W=180, H2=220;
  c.clearRect(0,0,W,H2);

  const bgColors = {barnyard:'rgba(204,68,34,', creek:'rgba(34,153,187,', woodland:'rgba(102,170,34,'};
  const bg = c.createRadialGradient(W/2,H2*0.55,0,W/2,H2*0.55,90);
  bg.addColorStop(0, bgColors[faction]+(hover?'0.18':'0.1')+')');
  bg.addColorStop(1,'transparent');
  c.fillStyle=bg; c.fillRect(0,0,W,H2);

  c.save(); c.translate(W/2, H2*0.72);
  const sc = hover ? 1.04 : 1.0;
  c.scale(sc, sc);

  if(faction==='barnyard') hwDrawBarnyardChar(c, 0, 0, 0.6);
  else if(faction==='creek') hwDrawCreekChar(c, 0, 0, 0.6);
  else if(faction==='woodland') hwDrawWoodlandChar(c, 0, 0, 0.6);

  c.restore();
}

// ── BARNYARD — THE ROOSTER KING ──
function hwDrawBarnyardChar(c, x, y, sc){
  c.save(); c.scale(sc,sc);
  const bob = Math.sin(hwRevealFrame*0.04)*2;

  // Ground shadow
  c.fillStyle='rgba(204,68,34,0.18)';
  c.beginPath(); c.ellipse(x,y+2,28,7,0,0,Math.PI*2); c.fill();

  // Magnificent tail feathers
  c.save();
  c.shadowColor='#226644'; c.shadowBlur=10;
  const colors=['#226644','#2244aa','#114433','#1133aa','#226644'];
  for(let i=0;i<5;i++){
    c.fillStyle=colors[i];
    c.beginPath();
    c.moveTo(x-5,y-30+bob);
    c.quadraticCurveTo(x-40-i*8,y-60-i*15+bob, x-20-i*6,y-90-i*10+bob);
    c.quadraticCurveTo(x-15-i*4,y-70-i*8+bob, x-5,y-40+bob);
    c.closePath();
    c.fill();
  }
  c.restore();

  // Body
  c.save();
  c.shadowColor='#cc4422'; c.shadowBlur=15;
  const bodyGrad=c.createRadialGradient(x,y-50+bob,5,x,y-40+bob,40);
  bodyGrad.addColorStop(0,'#ee5533');
  bodyGrad.addColorStop(1,'#aa2211');
  c.fillStyle=bodyGrad;
  c.beginPath();
  c.ellipse(x,y-40+bob,20,28,0,0,Math.PI*2);
  c.fill();
  c.restore();

  // Wing
  c.fillStyle='#cc3322';
  c.beginPath();
  c.ellipse(x-8,y-38+bob,14,18,0.15,0,Math.PI*2);
  c.fill();

  // Neck
  c.fillStyle='#dd4433';
  c.fillRect(x-6,y-80+bob,12,16);

  // Head
  c.fillStyle='#dd4433';
  c.beginPath();
  c.arc(x,y-88+bob,10,0,Math.PI*2);
  c.fill();

  // Magnificent comb (crown)
  c.save();
  c.shadowColor='#ff2211'; c.shadowBlur=12;
  c.fillStyle='#ff2211';
  c.beginPath();
  c.moveTo(x-8,y-96+bob);
  c.lineTo(x-6,y-108+bob);
  c.lineTo(x-2,y-100+bob);
  c.lineTo(x,y-112+bob);
  c.lineTo(x+2,y-100+bob);
  c.lineTo(x+6,y-108+bob);
  c.lineTo(x+8,y-96+bob);
  c.closePath();
  c.fill();
  c.restore();

  // Wattle
  c.fillStyle='#ff3322';
  c.beginPath();
  c.ellipse(x+2,y-78+bob,4,6,0,0,Math.PI*2);
  c.fill();

  // Beak
  c.fillStyle='#FFD700';
  c.beginPath();
  c.moveTo(x+8,y-90+bob);
  c.lineTo(x+16,y-88+bob);
  c.lineTo(x+8,y-86+bob);
  c.closePath();
  c.fill();

  // Eye
  c.fillStyle='#FFD700';
  c.beginPath();
  c.arc(x+4,y-90+bob,2.5,0,Math.PI*2);
  c.fill();
  c.fillStyle='#111';
  c.beginPath();
  c.arc(x+4,y-90+bob,1.2,0,Math.PI*2);
  c.fill();

  // Legs with spurs
  c.strokeStyle='#FFD700';
  c.lineWidth=3;
  for(const lx of [-6,6]){
    c.beginPath();
    c.moveTo(x+lx,y-12+bob);
    c.lineTo(x+lx,y+2);
    c.stroke();
    // Spur
    c.lineWidth=2;
    c.beginPath();
    c.moveTo(x+lx-3,y-2);
    c.lineTo(x+lx+3,y-2);
    c.stroke();
    c.lineWidth=3;
  }

  c.restore();
}

// ── CREEK — MOTHER GOOSE ──
function hwDrawCreekChar(c, x, y, sc){
  c.save(); c.scale(sc,sc);
  const bob = Math.sin(hwRevealFrame*0.04)*2;
  const t = hwRevealFrame;

  // Water reflection
  c.fillStyle='rgba(34,153,187,0.1)';
  c.beginPath(); c.ellipse(x,y+4,35,8,0,0,Math.PI*2); c.fill();

  // Body (large, white)
  c.save();
  c.shadowColor='#2299bb'; c.shadowBlur=15;
  c.fillStyle='#f0f0ee';
  c.beginPath();
  c.ellipse(x,y-30+bob,22,18,0,0,Math.PI*2);
  c.fill();
  c.restore();

  // Wing feathers
  c.fillStyle='#ddddd8';
  c.beginPath();
  c.ellipse(x-8,y-28+bob,16,12,0.1,0,Math.PI*2);
  c.fill();

  // Long elegant neck (S-curve)
  c.strokeStyle='#f0f0ee';
  c.lineWidth=8;
  c.beginPath();
  c.moveTo(x+10,y-42+bob);
  c.bezierCurveTo(x+18,y-60+bob, x+6,y-80+bob, x+8,y-100+bob);
  c.stroke();

  // Head
  c.fillStyle='#f0f0ee';
  c.beginPath();
  c.arc(x+8,y-102+bob,7,0,Math.PI*2);
  c.fill();

  // Crown/tiara
  c.save();
  c.shadowColor='#FFD700'; c.shadowBlur=10;
  c.fillStyle='#FFD700';
  c.beginPath();
  c.moveTo(x+2,y-108+bob);
  c.lineTo(x+4,y-114+bob);
  c.lineTo(x+6,y-109+bob);
  c.lineTo(x+8,y-116+bob);
  c.lineTo(x+10,y-109+bob);
  c.lineTo(x+12,y-114+bob);
  c.lineTo(x+14,y-108+bob);
  c.closePath();
  c.fill();
  c.restore();

  // Beak
  c.fillStyle='#FF8C00';
  c.beginPath();
  c.moveTo(x+14,y-104+bob);
  c.lineTo(x+22,y-102+bob);
  c.lineTo(x+14,y-100+bob);
  c.closePath();
  c.fill();

  // Eye
  c.fillStyle='#2299bb';
  c.beginPath();
  c.arc(x+10,y-104+bob,2.5,0,Math.PI*2);
  c.fill();
  c.fillStyle='#111';
  c.beginPath();
  c.arc(x+10,y-104+bob,1.2,0,Math.PI*2);
  c.fill();

  // Feet in water
  c.fillStyle='#FF8C00';
  c.fillRect(x-8,y-12+bob,6,3);
  c.fillRect(x+4,y-12+bob,6,3);

  // Water ripples
  c.strokeStyle='rgba(34,153,187,0.3)';
  c.lineWidth=1;
  for(let i=1;i<=3;i++){
    c.beginPath();
    c.ellipse(x,y+2,12+i*6+Math.sin(t*0.03)*2,3+i*1.5,0,0,Math.PI*2);
    c.stroke();
  }

  c.restore();
}

// ── WOODLAND — THE GREAT OWL ──
function hwDrawWoodlandChar(c, x, y, sc){
  c.save(); c.scale(sc,sc);
  const bob = Math.sin(hwRevealFrame*0.04)*2;
  const t = hwRevealFrame;

  // Moon glow behind
  const moonGrad=c.createRadialGradient(x,y-70+bob,10,x,y-70+bob,60);
  moonGrad.addColorStop(0,'rgba(200,200,150,0.08)');
  moonGrad.addColorStop(1,'transparent');
  c.fillStyle=moonGrad;
  c.beginPath();
  c.arc(x,y-70+bob,60,0,Math.PI*2);
  c.fill();

  // Branch
  c.strokeStyle='#4a3020';
  c.lineWidth=6;
  c.beginPath();
  c.moveTo(x-40,y+2);
  c.quadraticCurveTo(x,y-4,x+40,y+2);
  c.stroke();

  // Body
  c.save();
  c.shadowColor='#66aa22'; c.shadowBlur=12;
  c.fillStyle='#5a4030';
  c.beginPath();
  c.ellipse(x,y-30+bob,18,24,0,0,Math.PI*2);
  c.fill();
  c.restore();

  // Belly pattern
  c.fillStyle='#8a7060';
  c.beginPath();
  c.ellipse(x,y-24+bob,12,16,0,0,Math.PI*2);
  c.fill();
  // Belly stripes
  c.strokeStyle='#6a5040';
  c.lineWidth=1;
  for(let i=0;i<5;i++){
    c.beginPath();
    c.moveTo(x-10,y-34+i*5+bob);
    c.lineTo(x+10,y-34+i*5+bob);
    c.stroke();
  }

  // Wings (spread wide)
  for(const sx of [-1,1]){
    c.save();
    c.translate(x+sx*16,y-36+bob);
    c.rotate(sx*0.4+sx*Math.sin(t*0.03)*0.05);
    c.fillStyle='#4a3020';
    c.beginPath();
    c.ellipse(sx*10,4,14,8,sx*0.3,0,Math.PI*2);
    c.fill();
    // Feather tips
    c.fillStyle='#3a2515';
    for(let f=0;f<4;f++){
      c.beginPath();
      c.ellipse(sx*(16+f*3),6+f*2,4,2,sx*0.5,0,Math.PI*2);
      c.fill();
    }
    c.restore();
  }

  // Head
  c.fillStyle='#5a4030';
  c.beginPath();
  c.arc(x,y-58+bob,12,0,Math.PI*2);
  c.fill();

  // Facial disc
  c.fillStyle='#8a7060';
  c.beginPath();
  c.ellipse(x,y-58+bob,10,10,0,0,Math.PI*2);
  c.fill();

  // Ear tufts
  for(const ex of [-8,8]){
    c.fillStyle='#4a3020';
    c.beginPath();
    c.moveTo(x+ex-3,y-68+bob);
    c.lineTo(x+ex,y-80+bob);
    c.lineTo(x+ex+3,y-68+bob);
    c.closePath();
    c.fill();
  }

  // Great golden eyes
  for(const ex of [-5,5]){
    c.save();
    c.shadowColor='#FFD700'; c.shadowBlur=8;
    const eyeGrad=c.createRadialGradient(x+ex,y-58+bob,0,x+ex,y-58+bob,5);
    eyeGrad.addColorStop(0,'#FFD700');
    eyeGrad.addColorStop(0.6,'#cc9900');
    eyeGrad.addColorStop(1,'#886600');
    c.fillStyle=eyeGrad;
    c.beginPath();
    c.arc(x+ex,y-58+bob,5,0,Math.PI*2);
    c.fill();
    // Pupil
    c.fillStyle='#111';
    c.beginPath();
    c.arc(x+ex,y-58+bob,2,0,Math.PI*2);
    c.fill();
    c.restore();
  }

  // Beak
  c.fillStyle='#8B6914';
  c.beginPath();
  c.moveTo(x-2,y-54+bob);
  c.lineTo(x,y-50+bob);
  c.lineTo(x+2,y-54+bob);
  c.closePath();
  c.fill();

  // Talons on branch
  c.fillStyle='#3a2515';
  for(const tx of [-6,6]){
    for(let t2=0;t2<3;t2++){
      c.beginPath();
      c.arc(x+tx+t2*2-2,y+2,1.5,0,Math.PI*2);
      c.fill();
    }
  }

  c.restore();
}

// ── CARD PREVIEW ANIMATION ──
function hwPreview(faction){
  if(hwPreviewRAF) return;
  function loop(){
    hwRevealFrame++;
    for(const [f,id] of Object.entries({barnyard:'hw-fc-canvas-barnyard',creek:'hw-fc-canvas-creek',woodland:'hw-fc-canvas-woodland'})){
      const el=document.getElementById(id);
      if(el) hwDrawCardCharacter(el, f, f===faction);
    }
    hwPreviewRAF=requestAnimationFrame(loop);
  }
  hwPreviewRAF=requestAnimationFrame(loop);
}

function hwPreviewClear(){
  if(hwPreviewRAF){ cancelAnimationFrame(hwPreviewRAF); hwPreviewRAF=null; }
  for(const [f,id] of Object.entries({barnyard:'hw-fc-canvas-barnyard',creek:'hw-fc-canvas-creek',woodland:'hw-fc-canvas-woodland'})){
    const el=document.getElementById(id);
    if(el) hwDrawCardCharacter(el, f, false);
  }
}
