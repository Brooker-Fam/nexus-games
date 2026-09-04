// ── ELITE DRAW FUNCTIONS ──

function drawElitePrincess(rc,cfg,w){
  // Princess — a crowned Prism summoner whose twin orbs call her Legionnaires
  const t=w.frame, isAtt=w.state==='attack';
  // legs
  rc.strokeStyle='#aad0e8'; rc.lineWidth=3; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-3,8); rc.lineTo(-4+Math.sin(t*0.2)*4,20); rc.stroke();
  rc.beginPath(); rc.moveTo(3,8); rc.lineTo(4-Math.sin(t*0.2)*4,20); rc.stroke();
  // grand robe
  const rGrad=rc.createLinearGradient(-10,-24,10,10);
  rGrad.addColorStop(0,'#ffffff'); rGrad.addColorStop(0.5,'#ddf8ff'); rGrad.addColorStop(1,'#88c8e8');
  rc.fillStyle=rGrad;
  rc.beginPath(); rc.moveTo(-10,-6); rc.bezierCurveTo(-14,0,-13,10,-8,10); rc.lineTo(8,10); rc.bezierCurveTo(13,10,14,0,10,-6); rc.lineTo(5,-24); rc.lineTo(-5,-24); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(150,240,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // gold trim at hem
  rc.strokeStyle='rgba(255,220,80,0.6)'; rc.lineWidth=1.5;
  rc.beginPath(); rc.moveTo(-8,10); rc.bezierCurveTo(-13,10,-14,0,-10,-6); rc.stroke();
  rc.beginPath(); rc.moveTo(8,10); rc.bezierCurveTo(13,10,14,0,10,-6); rc.stroke();
  // twin staff arms
  const castPulse=isAtt?1+Math.sin(t*0.3)*0.4:1;
  rc.strokeStyle='#c0e4f8'; rc.lineWidth=3; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-7,-18); rc.lineTo(isAtt?-20:(-14),-8); rc.stroke();
  rc.beginPath(); rc.moveTo(7,-18); rc.lineTo(isAtt?20:14,-8); rc.stroke();
  // twin orbs (left and right)
  for(const [ox,oa] of [[-18,0],[18,Math.PI]]){
    const og=rc.createRadialGradient(ox,-8,0,ox,-8,8*castPulse);
    og.addColorStop(0,'#ffffff'); og.addColorStop(0.4,'#88ffee'); og.addColorStop(1,'transparent');
    rc.fillStyle=og; rc.shadowColor='#aaffee'; rc.shadowBlur=isAtt?20:10;
    rc.beginPath(); rc.arc(ox,-8,8*castPulse,0,Math.PI*2); rc.fill();
  }
  // head
  rc.fillStyle='#fff5f0'; rc.beginPath(); rc.ellipse(0,-30,7,8,0,0,Math.PI*2); rc.fill();
  // silver hair long
  rc.fillStyle='#ddf4ff';
  rc.beginPath(); rc.moveTo(-6,-36); rc.bezierCurveTo(-12,-24,-10,-8,-7,5); rc.lineTo(-4,5); rc.bezierCurveTo(-7,-8,-8,-24,-3,-36); rc.closePath(); rc.fill();
  // eyes
  for(const ex of [-2.5,2.5]){
    const eg=rc.createRadialGradient(ex,-30,0,ex,-30,isAtt?5:3);
    eg.addColorStop(0,'#ffffff'); eg.addColorStop(0.5,'#44ffcc'); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-30,isAtt?5:3,0,Math.PI*2); rc.fill();
  }
  // grand crown with 5 points
  rc.fillStyle='#ffe066'; rc.shadowColor='#ffcc00'; rc.shadowBlur=14;
  rc.beginPath();
  rc.moveTo(-8,-37); rc.lineTo(-8,-42); rc.lineTo(-4,-39); rc.lineTo(0,-45);
  rc.lineTo(4,-39); rc.lineTo(8,-42); rc.lineTo(8,-37); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,200,50,0.7)'; rc.lineWidth=0.8; rc.stroke();
  // elite glow aura
  rc.strokeStyle=`rgba(180,255,220,${0.2+Math.sin(t*0.05)*0.1})`; rc.lineWidth=3;
  rc.beginPath(); rc.ellipse(0,-10,28,38,0,0,Math.PI*2); rc.stroke();
}

function drawEliteDarkWarrior(rc,cfg,w){
  // Dark Warrior — like a witch but black robes, purple/black magic
  const t=w.frame, isAtt=w.state==='attack';
  // fast running legs
  rc.strokeStyle='#220033'; rc.lineWidth=4; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-4,6); rc.lineTo(-6+Math.sin(t*0.25)*8,18); rc.stroke();
  rc.beginPath(); rc.moveTo(4,6); rc.lineTo(6-Math.sin(t*0.25)*8,18); rc.stroke();
  // dark robe — trails behind when marching, no sideways puff
  const capeTrail=w.state==='march'?4:0;
  const cGrad=rc.createLinearGradient(-12,-26,12,10);
  cGrad.addColorStop(0,'#0a0015'); cGrad.addColorStop(0.6,'#110022'); cGrad.addColorStop(1,'#04000a');
  rc.fillStyle=cGrad;
  rc.beginPath();
  rc.moveTo(-5,-26);
  rc.lineTo(-6-capeTrail,-4);
  rc.lineTo(-8-capeTrail,10);
  rc.lineTo(8,10);
  rc.lineTo(6,-4);
  rc.lineTo(5,-26);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(120,0,200,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // void trim swirling
  rc.strokeStyle='rgba(100,0,180,0.3)'; rc.lineWidth=0.8;
  for(const fx of [-6,0,6]){
    rc.beginPath(); rc.moveTo(fx,-22); rc.bezierCurveTo(fx-3,-14,fx+3,-6,fx,10); rc.stroke();
  }
  // arms casting
  const pulse=isAtt?1+Math.sin(t*0.3)*0.5:1;
  rc.strokeStyle='#3a0050'; rc.lineWidth=4; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-6,-18); rc.lineTo(isAtt?-22:-14,-8); rc.stroke();
  rc.beginPath(); rc.moveTo(6,-18); rc.lineTo(isAtt?22:14,-8); rc.stroke();
  // black magic orbs
  for(const ox of [isAtt?-22:-14, isAtt?22:14]){
    const vg=rc.createRadialGradient(ox,-8,0,ox,-8,9*pulse);
    vg.addColorStop(0,'#cc44ff'); vg.addColorStop(0.3,'#440088'); vg.addColorStop(0.7,'#110022'); vg.addColorStop(1,'transparent');
    rc.fillStyle=vg; rc.shadowColor='#8800cc'; rc.shadowBlur=isAtt?22:12;
    rc.beginPath(); rc.arc(ox,-8,9*pulse,0,Math.PI*2); rc.fill();
    // void crack lines
    if(isAtt) for(let cr=0;cr<3;cr++){
      const ca=(cr/3)*Math.PI*2+t*0.2;
      rc.strokeStyle='rgba(200,100,255,0.6)'; rc.lineWidth=0.8;
      rc.beginPath(); rc.moveTo(ox,-8); rc.lineTo(ox+Math.cos(ca)*14,-8+Math.sin(ca)*10); rc.stroke();
    }
  }
  // head with deep hood
  rc.fillStyle='#080010'; rc.beginPath(); rc.ellipse(0,-34,8,10,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(100,0,180,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // glowing eyes — larger, more menacing
  for(const ex of [-3,3]){
    const eg=rc.createRadialGradient(ex,-34,0,ex,-34,isAtt?5:3.5);
    eg.addColorStop(0,'#ff88ff'); eg.addColorStop(0.4,'#aa00ff'); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-34,isAtt?5:3.5,0,Math.PI*2); rc.fill();
  }
  // dark crown / horns
  rc.fillStyle='#1a0030'; rc.shadowColor='#aa00ff'; rc.shadowBlur=16;
  rc.beginPath();
  rc.moveTo(-8,-42); rc.lineTo(-10,-52); rc.lineTo(-5,-44);
  rc.moveTo(8,-42); rc.lineTo(10,-52); rc.lineTo(5,-44);
  rc.lineTo(-5,-44); rc.lineTo(-8,-42); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(150,0,255,0.6)'; rc.lineWidth=0.8; rc.stroke();
  // dark aura
  rc.strokeStyle=`rgba(80,0,160,${0.15+Math.sin(t*0.06)*0.1})`; rc.lineWidth=4;
  rc.beginPath(); rc.ellipse(0,-12,30,42,0,0,Math.PI*2); rc.stroke();
}

function drawEliteShockbot(rc,cfg,w){
  // Shockbot — bigger, electric-themed robot with lightning coils
  const t=w.frame, isAtt=w.state==='attack';
  // heavy legs
  for(const [lx,ph] of [[-7,0],[5,Math.PI]]){
    const step=w.state==='march'?Math.sin(t*0.25+ph)*5:0;
    rc.fillStyle='#1a1a22'; rc.fillRect(lx,-6+step,8,14); rc.strokeStyle='rgba(100,200,255,0.3)'; rc.lineWidth=0.5; rc.strokeRect(lx,-6+step,8,14);
    rc.fillStyle='#111'; rc.beginPath(); rc.roundRect(lx-2,8+step,12,5,1); rc.fill();
  }
  // torso — bigger than normal gunbot
  const tGrad=rc.createLinearGradient(-14,-30,14,4);
  tGrad.addColorStop(0,'#22222a'); tGrad.addColorStop(0.5,'#14141c'); tGrad.addColorStop(1,'#0a0a10');
  rc.fillStyle=tGrad; rc.beginPath(); rc.roundRect(-14,-30,28,34,3); rc.fill();
  rc.strokeStyle='rgba(80,200,255,0.5)'; rc.lineWidth=1.2; rc.stroke();
  // lightning coil rings on torso
  for(const ry of [-22,-12,-2]){
    rc.strokeStyle=`rgba(80,220,255,${isAtt?0.8:0.35})`; rc.lineWidth=1.5;
    rc.beginPath(); rc.roundRect(-12,ry,24,8,2); rc.stroke();
    if(isAtt && t%12<6){
      rc.strokeStyle='rgba(200,240,255,0.6)'; rc.lineWidth=0.6;
      for(let cx=-10;cx<10;cx+=5){
        rc.beginPath(); rc.moveTo(cx,ry+1); rc.lineTo(cx+(Math.random()-0.5)*6,ry+7); rc.stroke();
      }
    }
  }
  // electric core
  const eGrad=rc.createRadialGradient(0,-14,0,0,-14,isAtt?10:7);
  eGrad.addColorStop(0,'#ffffff'); eGrad.addColorStop(0.3,'#44ddff'); eGrad.addColorStop(0.7,'#0044aa'); eGrad.addColorStop(1,'transparent');
  rc.fillStyle=eGrad; rc.shadowColor='#44aaff'; rc.shadowBlur=isAtt?24:12;
  rc.beginPath(); rc.arc(0,-14,isAtt?10:7,0,Math.PI*2); rc.fill();
  // shock discharge arcs when attacking
  if(isAtt) for(let i=0;i<4;i++){
    const a=(i/4)*Math.PI*2+t*0.15;
    rc.strokeStyle=`rgba(150,220,255,${0.4+Math.random()*0.4})`; rc.lineWidth=1.2;
    rc.beginPath(); rc.moveTo(0,-14);
    const ex=Math.cos(a)*(18+Math.random()*8), ey=-14+Math.sin(a)*(12+Math.random()*6);
    rc.lineTo(ex,ey); rc.stroke();
    rc.fillStyle='rgba(180,240,255,0.8)'; rc.beginPath(); rc.arc(ex,ey,1.5,0,Math.PI*2); rc.fill();
  }
  // shoulder pads with antenna coils
  for(const sx of [-1,1]){
    rc.fillStyle='#1e1e28'; rc.beginPath(); rc.roundRect(sx*14-5,-30,10,14,2); rc.fill();
    rc.strokeStyle='rgba(80,200,255,0.4)'; rc.lineWidth=0.8; rc.stroke();
    rc.strokeStyle='rgba(100,220,255,0.6)'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(sx*19,-30); rc.lineTo(sx*21,-40); rc.stroke();
    const ballG=rc.createRadialGradient(sx*21,-40,0,sx*21,-40,4);
    ballG.addColorStop(0,'#aaeeff'); ballG.addColorStop(1,'rgba(0,150,255,0)');
    rc.fillStyle=ballG; rc.beginPath(); rc.arc(sx*21,-40,4,0,Math.PI*2); rc.fill();
  }
  // head — wider, angular
  const hG=rc.createLinearGradient(-10,-46,10,-32);
  hG.addColorStop(0,'#22222c'); hG.addColorStop(1,'#0e0e18');
  rc.fillStyle=hG; rc.beginPath(); rc.roundRect(-10,-46,20,14,3); rc.fill();
  rc.strokeStyle='rgba(80,200,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // visor — electric blue
  const vG=rc.createLinearGradient(-8,-43,8,-37);
  vG.addColorStop(0,'rgba(0,200,255,0.2)'); vG.addColorStop(0.5,'rgba(100,240,255,0.95)'); vG.addColorStop(1,'rgba(0,200,255,0.2)');
  rc.fillStyle=vG; rc.beginPath(); rc.roundRect(-8,-43,16,6,1); rc.fill();
  // electric scan line
  const esx=(t*3)%16-8;
  rc.fillStyle='rgba(255,255,255,0.8)'; rc.fillRect(esx,-43,2,6);
}

// ── WIZARD (Prism Shrine) ──
function drawWizard(rc,cfg,w){
  const t=w.frame, isAtt=w.state==='attack', isMarch=w.state==='march';
  // legs — flowing robe hem
  rc.strokeStyle='#88ccee'; rc.lineWidth=2.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-3,6); rc.lineTo(-4+Math.sin(t*0.2)*3,16); rc.stroke();
  rc.beginPath(); rc.moveTo(3,6);  rc.lineTo(4-Math.sin(t*0.2)*3,16); rc.stroke();

  // robe — electric blue/white, slightly shorter than oracle
  const rGrad=rc.createLinearGradient(-9,-20,9,8);
  rGrad.addColorStop(0,'#cceeff'); rGrad.addColorStop(0.5,'#88ccff'); rGrad.addColorStop(1,'#4488bb');
  rc.fillStyle=rGrad;
  rc.beginPath(); rc.moveTo(-8,-4); rc.bezierCurveTo(-11,0,-10,8,-6,8); rc.lineTo(6,8); rc.bezierCurveTo(10,8,11,0,8,-4); rc.lineTo(4,-20); rc.lineTo(-4,-20); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,200,255,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // silver trim
  rc.strokeStyle='rgba(200,240,255,0.5)'; rc.lineWidth=1;
  for(const fx of [-5,0,5]){rc.beginPath();rc.moveTo(fx,-18);rc.bezierCurveTo(fx-2,-10,fx+2,-2,fx,8);rc.stroke();}

  // STAFF ARM — raises and arcs when attacking
  const staffSwing = isAtt ? -0.5 : isMarch ? Math.sin(t*0.2)*0.1 : 0;
  rc.save(); rc.translate(7,-12); rc.rotate(staffSwing);
  // staff pole
  rc.strokeStyle='#88aacc'; rc.lineWidth=2.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(0,0); rc.lineTo(5,14); rc.stroke();
  // lightning orb tip
  const lPulse = isAtt ? 1.2+Math.sin(t*0.4)*0.4 : 1;
  const lOrb=rc.createRadialGradient(0,0,0,0,0,10*lPulse);
  lOrb.addColorStop(0,'#ffffff'); lOrb.addColorStop(0.35,'#88ffff'); lOrb.addColorStop(0.7,'#0088cc'); lOrb.addColorStop(1,'transparent');
  rc.fillStyle=lOrb; rc.shadowColor='#44ddff'; rc.shadowBlur=isAtt?24:12;
  rc.beginPath(); rc.arc(0,0,10*lPulse,0,Math.PI*2); rc.fill();
  // crackling arcs on the orb when attacking
  if(isAtt){
    rc.strokeStyle='rgba(200,255,255,0.7)'; rc.lineWidth=0.8;
    for(let i=0;i<5;i++){
      const a=(i/5)*Math.PI*2+t*0.3;
      rc.beginPath(); rc.moveTo(Math.cos(a)*4,Math.sin(a)*4);
      rc.lineTo(Math.cos(a)*(11+Math.random()*5),Math.sin(a)*(11+Math.random()*5)); rc.stroke();
    }
  }
  rc.restore();

  // off-arm: gestures outward when casting
  rc.strokeStyle='#aaccee'; rc.lineWidth=3; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-6,-14); rc.lineTo(isAtt?-18:-12,-6+(isMarch?Math.sin(t*0.2)*3:0)); rc.stroke();

  // head — pointed wizard hat
  rc.fillStyle='#fff5ff'; rc.beginPath(); rc.ellipse(0,-24,6,7,0,0,Math.PI*2); rc.fill();
  // eyes
  for(const ex of [-2,2]){
    const eg=rc.createRadialGradient(ex,-24,0,ex,-24,isAtt?4:2.5);
    eg.addColorStop(0,'#ffffff'); eg.addColorStop(0.5,'#44ffdd'); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-24,isAtt?4:2.5,0,Math.PI*2); rc.fill();
  }
  // pointed hat
  rc.fillStyle='#224488'; rc.shadowColor='#44aaff'; rc.shadowBlur=10;
  rc.beginPath(); rc.moveTo(-9,-30); rc.lineTo(0,-48); rc.lineTo(9,-30); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,200,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // hat brim
  rc.fillStyle='#1a3366';
  rc.beginPath(); rc.ellipse(0,-30,10,3,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(100,180,255,0.4)'; rc.lineWidth=0.7; rc.stroke();
  // star on hat
  rc.fillStyle='rgba(180,240,255,0.8)'; rc.shadowColor='#aaffff'; rc.shadowBlur=6;
  rc.beginPath(); rc.arc(0,-40,2,0,Math.PI*2); rc.fill();
}

// ── NECROMANCER (Shadow Dark Shrine) ──
function drawNecromancer(rc,cfg,w){
  const t=w.frame, isAtt=w.state==='attack', isMarch=w.state==='march';
  // ragged legs
  rc.strokeStyle='#220033'; rc.lineWidth=3; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-3,6); rc.lineTo(-4+Math.sin(t*0.18)*3,16); rc.stroke();
  rc.beginPath(); rc.moveTo(3,6);  rc.lineTo(4-Math.sin(t*0.18)*3,16); rc.stroke();

  // tattered dark robe — ragged hem
  const rGrad=rc.createLinearGradient(-8,-18,8,10);
  rGrad.addColorStop(0,'#0a0015'); rGrad.addColorStop(0.5,'#160028'); rGrad.addColorStop(1,'#04000a');
  rc.fillStyle=rGrad;
  rc.beginPath(); rc.moveTo(-7,-4); rc.bezierCurveTo(-10,0,-10,6,-7,8); rc.lineTo(-4,6); rc.lineTo(-5,10); rc.lineTo(-2,7); rc.lineTo(0,10); rc.lineTo(2,7); rc.lineTo(5,10); rc.lineTo(4,6); rc.lineTo(7,8); rc.bezierCurveTo(10,6,10,0,7,-4); rc.lineTo(4,-18); rc.lineTo(-4,-18); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,0,160,0.4)'; rc.lineWidth=0.7; rc.stroke();
  // bone-white robe trim
  rc.strokeStyle='rgba(200,180,220,0.2)'; rc.lineWidth=0.6;
  for(const fx of [-4,0,4]){ rc.beginPath(); rc.moveTo(fx,-16); rc.bezierCurveTo(fx-2,-8,fx+2,0,fx,8); rc.stroke(); }

  // STAFF — bone skull atop it
  const staffTilt = isAtt ? Math.sin(t*0.3)*0.4 : 0;
  rc.save(); rc.translate(7,-10); rc.rotate(staffTilt);
  // staff shaft
  rc.strokeStyle='#4a3a2a'; rc.lineWidth=2.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(0,0); rc.lineTo(3,14); rc.stroke();
  // skull head
  rc.fillStyle='#d8ccc0'; rc.shadowColor='#aa00cc'; rc.shadowBlur=isAtt?18:8;
  rc.beginPath(); rc.ellipse(0,-5,5,6,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(140,80,180,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // skull eye sockets — glowing purple when attacking
  for(const sx of [-2,2]){
    const pGrad=rc.createRadialGradient(sx,-5,0,sx,-5,isAtt?2.5:1.5);
    pGrad.addColorStop(0,isAtt?'#ff88ff':'#aa44cc'); pGrad.addColorStop(1,'rgba(80,0,120,0)');
    rc.fillStyle=pGrad; rc.beginPath(); rc.ellipse(sx,-5,isAtt?2.5:1.5,2,0,0,Math.PI*2); rc.fill();
  }
  // skull jaw
  rc.fillStyle='#b8a8a0'; rc.beginPath(); rc.roundRect(-3,-1,6,4,1); rc.fill();
  // raise-dead aura when attacking
  if(isAtt){
    rc.strokeStyle='rgba(140,0,200,0.4)'; rc.lineWidth=1.5;
    for(let i=0;i<3;i++){
      const a=(i/3)*Math.PI*2+t*0.15;
      rc.beginPath(); rc.arc(0,-5,8+i*4,a,a+1.5); rc.stroke();
    }
  }
  rc.restore();

  // off-arm gesture
  rc.strokeStyle='#2a0044'; rc.lineWidth=3.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-6,-14); rc.lineTo(isAtt?-16:-11,-4+(isMarch?Math.sin(t*0.18)*2:0)); rc.stroke();
  // bony hand glow when casting
  if(isAtt){
    const hGrad=rc.createRadialGradient(-16,-4,0,-16,-4,8);
    hGrad.addColorStop(0,'rgba(180,80,255,0.6)'); hGrad.addColorStop(1,'transparent');
    rc.fillStyle=hGrad; rc.beginPath(); rc.arc(-16,-4,8,0,Math.PI*2); rc.fill();
    // soul orbs drifting down
    for(let i=0;i<3;i++){
      const sAngle=(t*0.05+i*2.1)%(Math.PI*2);
      rc.fillStyle=`rgba(180,120,255,${0.4+Math.sin(t*0.08+i)*0.3})`;
      rc.beginPath(); rc.arc(-16+Math.cos(sAngle)*12,-4+Math.sin(sAngle)*8,2,0,Math.PI*2); rc.fill();
    }
  }

  // head — deep hood, no face visible
  rc.fillStyle='#060010'; rc.beginPath(); rc.ellipse(0,-23,7,9,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(80,0,140,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // just glowing eyes in the darkness
  const eyePulse=isAtt?0.9:0.5+Math.sin(t*0.08)*0.3;
  for(const ex of [-2.5,2.5]){
    rc.fillStyle=`rgba(200,80,255,${eyePulse})`;
    rc.shadowColor='#cc00ff'; rc.shadowBlur=isAtt?12:6;
    rc.beginPath(); rc.arc(ex,-23,isAtt?2:1.5,0,Math.PI*2); rc.fill();
  }
  // hood peak
  rc.fillStyle='#04000a';
  rc.beginPath(); rc.moveTo(-7,-30); rc.lineTo(0,-42); rc.lineTo(7,-30); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(80,0,120,0.4)'; rc.lineWidth=0.7; rc.stroke();
}

// ── TANK (Roboto Armory) ──
function drawTankUnit(rc,cfg,w){
  const t=w.frame, isAtt=w.state==='attack', isMarch=w.state==='march';
  // treads (left and right)
  for(const ty of [-1,1]){
    const tGrad=rc.createLinearGradient(-20,ty*12,20,ty*18);
    tGrad.addColorStop(0,'#222222'); tGrad.addColorStop(1,'#111111');
    rc.fillStyle=tGrad;
    rc.beginPath(); rc.roundRect(-22,ty*10,44,8,3); rc.fill();
    rc.strokeStyle='rgba(180,90,0,0.3)'; rc.lineWidth=0.7; rc.stroke();
    // tread segments
    rc.strokeStyle='rgba(80,60,40,0.6)'; rc.lineWidth=0.5;
    for(let sx=-20;sx<20;sx+=6){ rc.beginPath(); rc.moveTo(sx,ty*10); rc.lineTo(sx,ty*18); rc.stroke(); }
    // tread wheels
    for(const wx of [-14,-5,5,14]){
      rc.fillStyle='#1a1a1a'; rc.beginPath(); rc.arc(wx,ty*14,4,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(180,90,0,0.4)'; rc.lineWidth=0.6; rc.stroke();
      rc.fillStyle='#333'; rc.beginPath(); rc.arc(wx,ty*14,2,0,Math.PI*2); rc.fill();
    }
  }

  // main hull body
  const hGrad=rc.createLinearGradient(-18,-10,18,10);
  hGrad.addColorStop(0,'#2e2a20'); hGrad.addColorStop(0.5,'#1e1c14'); hGrad.addColorStop(1,'#0e0c08');
  rc.fillStyle=hGrad;
  rc.beginPath();
  rc.moveTo(-20,-10); rc.lineTo(-22,8); rc.lineTo(22,8); rc.lineTo(20,-10);
  rc.lineTo(14,-14); rc.lineTo(-14,-14); rc.closePath();
  rc.fill(); rc.strokeStyle='rgba(200,100,0,0.5)'; rc.lineWidth=1.2; rc.stroke();
  // hull armor plates
  rc.strokeStyle='rgba(150,80,0,0.3)'; rc.lineWidth=0.7;
  rc.beginPath(); rc.moveTo(-20,-10); rc.lineTo(-14,-14); rc.stroke();
  rc.beginPath(); rc.moveTo(20,-10); rc.lineTo(14,-14); rc.stroke();
  rc.beginPath(); rc.moveTo(-10,-14); rc.lineTo(-10,8); rc.stroke();
  rc.beginPath(); rc.moveTo(10,-14); rc.lineTo(10,8); rc.stroke();

  // turret base — circular rotating platform
  const turretRot = isAtt ? Math.sin(t*0.1)*0.08 : 0;
  rc.save(); rc.rotate(turretRot);
  const tBase=rc.createRadialGradient(0,-14,2,0,-14,12);
  tBase.addColorStop(0,'#2e2820'); tBase.addColorStop(1,'#0e0c08');
  rc.fillStyle=tBase; rc.beginPath(); rc.ellipse(0,-14,12,9,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(200,120,0,0.5)'; rc.lineWidth=0.9; rc.stroke();

  // turret body
  const turGrad=rc.createLinearGradient(-9,-26,9,-10);
  turGrad.addColorStop(0,'#3a3020'); turGrad.addColorStop(1,'#1a1810');
  rc.fillStyle=turGrad;
  rc.beginPath(); rc.roundRect(-9,-26,18,13,3); rc.fill();
  rc.strokeStyle='rgba(200,130,0,0.5)'; rc.lineWidth=0.9; rc.stroke();

  // main cannon barrel — long, heavy
  const recoil = isAtt ? Math.max(0,Math.sin(t*0.2))*8 : 0;
  const bGrad=rc.createLinearGradient(0,-23,0,-19);
  bGrad.addColorStop(0,'#3a3020'); bGrad.addColorStop(1,'#1a1408');
  rc.fillStyle=bGrad;
  rc.fillRect(8-recoil,-23,28+recoil,5);
  rc.strokeStyle='rgba(200,120,0,0.5)'; rc.lineWidth=0.8; rc.strokeRect(8-recoil,-23,28+recoil,5);
  // barrel rings
  for(const rx of [14,20,26,34]){
    rc.strokeStyle='rgba(160,90,0,0.4)'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(rx-recoil,-23); rc.lineTo(rx-recoil,-18); rc.stroke();
  }
  // muzzle flash when firing
  const flashA = isAtt ? 0.5+Math.sin(t*0.4)*0.5 : 0;
  if(flashA>0.1){
    const mGrad=rc.createRadialGradient(36-recoil,-20,0,36-recoil,-20,12*flashA);
    mGrad.addColorStop(0,'rgba(255,200,80,0.95)'); mGrad.addColorStop(0.4,`rgba(255,100,0,${flashA*0.7})`); mGrad.addColorStop(1,'transparent');
    rc.fillStyle=mGrad; rc.beginPath(); rc.arc(36-recoil,-20,12*flashA,0,Math.PI*2); rc.fill();
    // muzzle spike
    if(flashA>0.5){ rc.strokeStyle='rgba(255,200,50,0.7)'; rc.lineWidth=2.5; rc.lineCap='round';
      rc.beginPath(); rc.moveTo(36-recoil,-20); rc.lineTo(52-recoil,-20); rc.stroke(); }
  }

  // commander hatch on top
  rc.fillStyle='#1e1c10'; rc.beginPath(); rc.ellipse(0,-26,5,4,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(180,100,0,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // periscope
  rc.fillStyle='#141208'; rc.fillRect(-1,-32,2,7); rc.strokeStyle='rgba(180,100,0,0.4)'; rc.lineWidth=0.5; rc.strokeRect(-1,-32,2,7);
  const perLens=rc.createRadialGradient(0,-33,0,0,-33,2);
  perLens.addColorStop(0,'#ff8800'); perLens.addColorStop(1,'rgba(100,50,0,0)');
  rc.fillStyle=perLens; rc.beginPath(); rc.arc(0,-33,2,0,Math.PI*2); rc.fill();

  rc.restore();

  // power core glow on hull
  const cGrad=rc.createRadialGradient(-5,0,0,-5,0,5);
  cGrad.addColorStop(0,'#ffe066'); cGrad.addColorStop(0.5,'#ff8800'); cGrad.addColorStop(1,'transparent');
  rc.fillStyle=cGrad; rc.shadowColor='#ff8800'; rc.shadowBlur=10;
  rc.beginPath(); rc.arc(-5,0,5,0,Math.PI*2); rc.fill();
}

function drawBloodhound(rc,cfg,w){
  const t=w.frame, isAtt=w.state==='attack', isMarching=w.state==='march';
  const isBow=w.bowMode;

  // LEGS — striding in gold armour
  for(const [lx,ph] of [[-5,0],[4,Math.PI]]){
    const step=isMarching?Math.sin(t*0.3+ph)*5:0;
    const lGrad=rc.createLinearGradient(lx,-4+step,lx+6,14+step);
    lGrad.addColorStop(0,'#ffe066'); lGrad.addColorStop(1,'#cc6600');
    rc.fillStyle=lGrad; rc.beginPath(); rc.roundRect(lx,-4+step,6,16,2); rc.fill();
    rc.strokeStyle='rgba(255,200,50,0.4)'; rc.lineWidth=0.5; rc.stroke();
  }

  // BODY — full gold suit, fire-bright gradient
  const bGrad=rc.createLinearGradient(-10,-24,10,4);
  bGrad.addColorStop(0,'#ffe066'); bGrad.addColorStop(0.4,'#ffaa00'); bGrad.addColorStop(1,'#cc5500');
  rc.fillStyle=bGrad; rc.beginPath(); rc.roundRect(-10,-24,20,28,3); rc.fill();
  rc.strokeStyle='rgba(255,220,80,0.6)'; rc.lineWidth=1; rc.stroke();

  // SHIMMER DOTS — tiny gold & silver specks on the suit, staggered shimmer animation
  const dotPositions=[[-6,-20],[-2,-16],[5,-14],[-7,-8],[3,-6],[0,-18],[-4,-12],[6,-10],[-8,-4],[4,-2]];
  for(let i=0;i<dotPositions.length;i++){
    const [dx,dy]=dotPositions[i];
    const shimmer=Math.sin(t*0.15+i*2.1)*0.5+0.5;
    const silver=(i+((w.id||0)%3))%3===0;
    rc.fillStyle=silver?`rgba(220,230,255,${0.4+shimmer*0.6})`:`rgba(255,240,100,${0.4+shimmer*0.6})`;
    rc.shadowColor=silver?'#aaddff':'#ffdd44'; rc.shadowBlur=shimmer*8;
    rc.beginPath(); rc.arc(dx,dy,1.2,0,Math.PI*2); rc.fill();
  }
  rc.shadowBlur=0;

  // WEAPON — bow or sword
  if(isBow){
    const bowAngle=isAtt?-0.4:0;
    rc.save(); rc.translate(14,-12); rc.rotate(bowAngle);
    rc.strokeStyle='#a07030'; rc.lineWidth=2.5;
    rc.beginPath(); rc.arc(0,0,12,-Math.PI*0.5,Math.PI*0.5); rc.stroke();
    rc.strokeStyle=isAtt?'rgba(255,220,100,0.9)':'rgba(200,180,80,0.6)'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(0,-12); rc.lineTo(isAtt?-5:0,0); rc.lineTo(0,12); rc.stroke();
    if(isAtt){
      rc.strokeStyle='#ffcc44'; rc.lineWidth=1.5;
      rc.beginPath(); rc.moveTo(-5,0); rc.lineTo(-18,0); rc.stroke();
    }
    rc.restore();
  } else if(isAtt){
    const slash=Math.sin(t*0.3)*0.7-0.3;
    rc.save(); rc.rotate(slash);
    rc.strokeStyle='#cc6600'; rc.lineWidth=6; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(6,-18); rc.lineTo(20,-4); rc.stroke();
    rc.shadowColor='#ffcc00'; rc.shadowBlur=22;
    const sGrad=rc.createLinearGradient(20,-4,44,-28);
    sGrad.addColorStop(0,'#ffffff'); sGrad.addColorStop(0.3,'#ffee88'); sGrad.addColorStop(1,'#cc6600');
    rc.strokeStyle=sGrad; rc.lineWidth=4;
    rc.beginPath(); rc.moveTo(20,-4); rc.lineTo(44,-28); rc.stroke();
    rc.strokeStyle='rgba(255,240,150,0.8)'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(21,-5); rc.lineTo(45,-29); rc.stroke();
    rc.strokeStyle='rgba(255,160,0,0.3)'; rc.lineWidth=10;
    rc.beginPath(); rc.arc(10,-14,22,-Math.PI*0.6+slash,-Math.PI*0.1+slash); rc.stroke();
    rc.restore();
  } else {
    const armBob=isMarching?Math.sin(t*0.3)*4:0;
    rc.strokeStyle='#cc6600'; rc.lineWidth=5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(8,-18); rc.lineTo(18+armBob,-10+armBob*0.3); rc.stroke();
    rc.save(); rc.shadowColor='#ffcc00'; rc.shadowBlur=14;
    const sGrad2=rc.createLinearGradient(18,-10,36,-30);
    sGrad2.addColorStop(0,'#ffe099'); sGrad2.addColorStop(0.5,'#cc8800'); sGrad2.addColorStop(1,'#663300');
    rc.strokeStyle=sGrad2; rc.lineWidth=3;
    rc.beginPath(); rc.moveTo(18+armBob,-10); rc.lineTo(36+armBob,-30); rc.stroke();
    rc.restore();
  }

  // HEAD — smooth black skin
  rc.fillStyle='#050010'; rc.beginPath(); rc.ellipse(0,-32,7,9,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(255,180,0,0.4)'; rc.lineWidth=0.7; rc.stroke();

  // GOLD CROWN
  const hGrad=rc.createLinearGradient(-7,-44,7,-32);
  hGrad.addColorStop(0,'#ffe066'); hGrad.addColorStop(1,'#cc6600');
  rc.fillStyle=hGrad; rc.beginPath(); rc.ellipse(0,-38,6,7,0,0,Math.PI,true); rc.fill();
  rc.strokeStyle='rgba(255,220,50,0.5)'; rc.lineWidth=0.7; rc.stroke();

  // DARK FLOWING HAIR — trails behind when moving
  const hairTrail=isMarching?8:isAtt?4:0;
  rc.fillStyle='#100018';
  rc.beginPath();
  rc.moveTo(-5,-40);
  rc.bezierCurveTo(-10-hairTrail,-36,-13-hairTrail,-20,-9-hairTrail,-12);
  rc.lineTo(-4,-16); rc.bezierCurveTo(-5,-24,-3,-32,-3,-40); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(40,0,80,0.5)'; rc.lineWidth=0.8;
  for(let hi=0;hi<3;hi++){
    rc.beginPath();
    rc.moveTo(-3+hi*2,-40);
    rc.bezierCurveTo(-7-hairTrail*0.8+hi,-32,-10-hairTrail+hi,-18,-6-hairTrail+hi*2,-12);
    rc.stroke();
  }

  // GOLDEN EYES
  for(const ex of [-2.5,2.5]){
    const eg=rc.createRadialGradient(ex,-32,0,ex,-32,isAtt?4:2.5);
    eg.addColorStop(0,'#ffee88'); eg.addColorStop(0.4,'#ffaa00'); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-32,isAtt?4:2.5,0,Math.PI*2); rc.fill();
  }

  // GOLD AURA
  rc.strokeStyle=`rgba(255,180,0,${0.12+Math.sin(t*0.06)*0.05})`; rc.lineWidth=5;
  rc.beginPath(); rc.ellipse(0,-14,22,36,0,0,Math.PI*2); rc.stroke();
}

function drawAssaultBot(rc, cfg, w){
  const t=w.frame, isAtt=w.state==='attack', isMarch=w.state==='march';

  // HEAVY LEGS — thick plated treads
  for(const [lx,ph] of [[-8,0],[5,Math.PI]]){
    const step=isMarch?Math.sin(t*0.25+ph)*4:0;
    rc.fillStyle='#441100';
    rc.beginPath(); rc.roundRect(lx,2+step,9,18,2); rc.fill();
    rc.fillStyle='#993300';
    rc.beginPath(); rc.roundRect(lx+1,2+step,7,5,1); rc.fill();
    rc.strokeStyle='rgba(255,100,0,0.3)'; rc.lineWidth=0.7; rc.stroke();
  }

  // MAIN BODY — heavy plate armor
  const bGrad=rc.createLinearGradient(-14,-28,14,6);
  bGrad.addColorStop(0,'#ff7700'); bGrad.addColorStop(0.5,'#cc3300'); bGrad.addColorStop(1,'#661100');
  rc.fillStyle=bGrad;
  rc.beginPath(); rc.roundRect(-13,-28,26,34,3); rc.fill();
  rc.strokeStyle='rgba(255,120,0,0.5)'; rc.lineWidth=1.5; rc.stroke();

  // ARMOR SEAMS
  rc.strokeStyle='rgba(0,0,0,0.35)'; rc.lineWidth=1;
  rc.beginPath(); rc.moveTo(-13,-10); rc.lineTo(13,-10); rc.stroke();
  rc.beginPath(); rc.moveTo(-11,2); rc.lineTo(11,2); rc.stroke();

  // SHOULDER SPIKES
  rc.fillStyle='#ff6600';
  for(const [sx,dx] of [[-13,-6],[13,6]]){
    rc.beginPath(); rc.moveTo(sx,-28); rc.lineTo(sx+dx,-36); rc.lineTo(sx+dx*0.4,-28); rc.closePath(); rc.fill();
  }

  // ARM CANNONS — massive dual barrels
  const recoil=isAtt?Math.sin(t*0.5)*3:0;
  for(const [ax,dir] of [[13,1],[-13,-1]]){
    rc.fillStyle='#552200';
    rc.beginPath(); rc.roundRect(ax+(dir>0?0:-6),-20,6,12,2); rc.fill();
    rc.fillStyle='#1a0500';
    rc.beginPath(); rc.roundRect(ax+(dir>0?4:-8)+recoil*dir,-18,10,5,1); rc.fill();
    rc.fillStyle='#331100';
    rc.beginPath(); rc.roundRect(ax+(dir>0?4:-8)+recoil*dir,-14,10,5,1); rc.fill();
    if(isAtt){
      const mg=rc.createRadialGradient(ax+(dir>0?14:-8)+recoil*dir,-15,0,ax+(dir>0?14:-8)+recoil*dir,-15,6);
      mg.addColorStop(0,'rgba(255,200,50,0.95)'); mg.addColorStop(1,'transparent');
      rc.fillStyle=mg; rc.beginPath(); rc.arc(ax+(dir>0?14:-8)+recoil*dir,-15,6,0,Math.PI*2); rc.fill();
    }
  }

  // HEAD — angular robot skull
  rc.fillStyle='#441100';
  rc.beginPath(); rc.roundRect(-10,-44,20,17,2); rc.fill();
  rc.fillStyle='#cc3300';
  rc.beginPath(); rc.roundRect(-10,-44,20,6,1); rc.fill();

  // EYES — glowing red combat sensors
  for(const ex of [-3.5,3.5]){
    const eg=rc.createRadialGradient(ex,-36,0,ex,-36,isAtt?5:3);
    eg.addColorStop(0,isAtt?'#ffee00':'#ff3300');
    eg.addColorStop(0.5,isAtt?'#ff8800':'#990000');
    eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-36,isAtt?5:3,0,Math.PI*2); rc.fill();
  }

  // BATTLE DAMAGE SCRATCHES
  rc.strokeStyle='rgba(0,0,0,0.4)'; rc.lineWidth=0.8;
  rc.beginPath(); rc.moveTo(-7,-22); rc.lineTo(-3,-15); rc.stroke();
  rc.beginPath(); rc.moveTo(3,-20); rc.lineTo(7,-13); rc.stroke();

  // POWER CORE GLOW on chest
  const pulse=0.6+Math.sin(t*0.08)*0.4;
  const cg=rc.createRadialGradient(0,-14,0,0,-14,8);
  cg.addColorStop(0,`rgba(255,150,0,${pulse})`); cg.addColorStop(1,'transparent');
  rc.fillStyle=cg; rc.beginPath(); rc.arc(0,-14,8,0,Math.PI*2); rc.fill();
  rc.strokeStyle=`rgba(255,100,0,${pulse*0.8})`; rc.lineWidth=1;
  rc.beginPath(); rc.arc(0,-14,5,0,Math.PI*2); rc.stroke();
}

function drawPsionicWarrior(rc, cfg, w){
  const t=w.frame, isAtt=w.state==='attack', isMarch=w.state==='march';
  const sway=isMarch?Math.sin(t*0.2)*2:0;

  // PSIONIC AURA — outer glow rings
  const pulse=0.5+Math.sin(t*0.07)*0.3;
  for(const [r,a] of [[30,0.10],[22,0.18],[15,0.28]]){
    rc.strokeStyle=`rgba(180,80,255,${a*pulse})`; rc.lineWidth=3;
    rc.beginPath(); rc.ellipse(0,-14,r,r*1.5,0,0,Math.PI*2); rc.stroke();
  }

  // LEGS — flowing psionic energy wisps
  rc.strokeStyle='rgba(160,80,255,0.5)'; rc.lineWidth=2.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-3,8); rc.lineTo(-4+Math.sin(t*0.2)*3,18); rc.stroke();
  rc.beginPath(); rc.moveTo(3,8);  rc.lineTo(4-Math.sin(t*0.2)*3,18); rc.stroke();

  // ROBE — white/violet with psionic shimmer
  const rGrad=rc.createLinearGradient(-8,-22,8,8);
  rGrad.addColorStop(0,'#f8f0ff'); rGrad.addColorStop(0.5,'#cc88ff'); rGrad.addColorStop(1,'#7722cc');
  rc.fillStyle=rGrad;
  rc.beginPath();
  rc.moveTo(-8,-6); rc.bezierCurveTo(-11+sway,0,-10+sway,8,-6+sway,8);
  rc.lineTo(6-sway,8); rc.bezierCurveTo(10-sway,8,11-sway,0,8,-6);
  rc.lineTo(4,-22); rc.lineTo(-4,-22); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(200,120,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // ENERGY TENDRILS radiating outward
  const tendrils=isAtt?5:3;
  for(let i=0;i<tendrils;i++){
    const angle=(t*0.04+i*(Math.PI*2/tendrils));
    const r=isAtt?26:18;
    rc.strokeStyle=`rgba(${isAtt?'220,100,255':'160,80,255'},${0.4+Math.sin(t*0.1+i)*0.3})`; rc.lineWidth=1.5;
    rc.beginPath();
    rc.moveTo(Math.cos(angle)*6,-14+Math.sin(angle)*8);
    rc.quadraticCurveTo(Math.cos(angle+0.5)*r*0.7,-14+Math.sin(angle+0.5)*r*0.5,
      Math.cos(angle)*r,-14+Math.sin(angle)*r);
    rc.stroke();
  }

  // HEAD
  rc.fillStyle='#f0e8ff';
  rc.beginPath(); rc.ellipse(0,-30,7,9,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // THIRD EYE — center of forehead, blazing violet
  const eyePulse=isAtt?1:0.5+Math.sin(t*0.12)*0.3;
  const teg=rc.createRadialGradient(0,-34,0,0,-34,isAtt?7:4);
  teg.addColorStop(0,`rgba(255,255,255,${eyePulse})`);
  teg.addColorStop(0.3,`rgba(220,100,255,${eyePulse*0.9})`);
  teg.addColorStop(1,'transparent');
  rc.fillStyle=teg; rc.beginPath(); rc.arc(0,-34,isAtt?7:4,0,Math.PI*2); rc.fill();

  // NORMAL EYES
  for(const ex of [-2.5,2.5]){
    rc.fillStyle=`rgba(180,80,255,0.8)`; rc.beginPath(); rc.arc(ex,-29,1.5,0,Math.PI*2); rc.fill();
  }

  // HAIR — white flowing locks
  const hairDrift=isMarch?-4:0;
  rc.fillStyle='#eedcff';
  rc.beginPath();
  rc.moveTo(-5,-38);
  rc.bezierCurveTo(-9+hairDrift,-33,-11+hairDrift,-20,-7+hairDrift,-14);
  rc.lineTo(-3,-18); rc.bezierCurveTo(-4,-27,-2,-34,-3,-38); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(200,160,255,0.4)'; rc.lineWidth=0.7;
  for(let hi=0;hi<2;hi++){
    rc.beginPath();
    rc.moveTo(-3+hi*2,-38);
    rc.bezierCurveTo(-6+hairDrift*0.7+hi,-30,-8+hairDrift+hi,-18,-4+hairDrift+hi*2,-14);
    rc.stroke();
  }

  // CRYSTAL ORBITING SHARDS
  for(let i=0;i<3;i++){
    const a=t*0.05+i*(Math.PI*2/3);
    const cx=Math.cos(a)*20, cy=-14+Math.sin(a)*12;
    rc.save(); rc.translate(cx,cy); rc.rotate(a+t*0.08);
    const cGrad=rc.createLinearGradient(-3,-5,3,5);
    cGrad.addColorStop(0,'#ffffff'); cGrad.addColorStop(0.5,'#cc88ff'); cGrad.addColorStop(1,'#6622cc');
    rc.fillStyle=cGrad;
    rc.beginPath(); rc.moveTo(0,-5); rc.lineTo(2.5,0); rc.lineTo(0,5); rc.lineTo(-2.5,0); rc.closePath(); rc.fill();
    rc.restore();
  }
}

//# sourceMappingURL=elites.js.map
