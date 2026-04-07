function drawTowerBase(x, y, color, glowColor){
  ctx.save();
  ctx.shadowColor = glowColor; ctx.shadowBlur = 14;
  // concrete pad shadow
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/8, r=17;
    i===0?ctx.moveTo(x+Math.cos(a)*r+1,y+Math.sin(a)*r+1):ctx.lineTo(x+Math.cos(a)*r+1,y+Math.sin(a)*r+1);
  }
  ctx.closePath(); ctx.fill();
  // base plate
  const baseGrad = ctx.createRadialGradient(x-3,y-3,1,x,y,18);
  baseGrad.addColorStop(0,'#243444'); baseGrad.addColorStop(0.6,'#152030'); baseGrad.addColorStop(1,'#080f18');
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/8, r=17;
    i===0?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fillStyle=baseGrad; ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=1.3; ctx.stroke();
  // bolt holes at corners
  ctx.fillStyle='rgba(0,0,0,0.6)';
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/8, r=13;
    ctx.beginPath(); ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,1.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.5; ctx.stroke();
  }
  // pivot ring
  ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2);
  const ringGrad=ctx.createRadialGradient(x-1,y-1,0,x,y,6);
  ringGrad.addColorStop(0,'#3a5060'); ringGrad.addColorStop(1,'#111d28');
  ctx.fillStyle=ringGrad; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=0.8; ctx.stroke();
  ctx.restore();
}

// ── MACHINE GUN TOWER ──
function drawGunTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#00f5ff','#00f5ff');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#00c8ff'; ctx.shadowBlur=10;

  // === TURRET BODY — boxy armored housing ===
  const hGrad = ctx.createLinearGradient(-11,-9,11,9);
  hGrad.addColorStop(0,'#2e4e68'); hGrad.addColorStop(0.4,'#1d3550'); hGrad.addColorStop(1,'#0d1e30');
  ctx.fillStyle=hGrad;
  ctx.beginPath();
  ctx.moveTo(-11,-9); ctx.lineTo(6,-9); ctx.lineTo(10,-6);
  ctx.lineTo(10,6);   ctx.lineTo(6,9);  ctx.lineTo(-11,9); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle='#00a8cc'; ctx.lineWidth=1.2; ctx.stroke();

  // armor plate highlight (top-left bevel)
  ctx.beginPath(); ctx.moveTo(-11,-9); ctx.lineTo(6,-9); ctx.lineTo(10,-6);
  ctx.strokeStyle='rgba(150,220,255,0.25)'; ctx.lineWidth=1; ctx.stroke();

  // side vent slits
  ctx.strokeStyle='rgba(0,200,220,0.3)'; ctx.lineWidth=0.8;
  for(let vx=-8;vx<2;vx+=2.5){
    ctx.beginPath(); ctx.moveTo(vx,-8); ctx.lineTo(vx,8); ctx.stroke();
  }

  // ammo belt box (left side)
  const aGrad=ctx.createLinearGradient(-11,-5,-4,5);
  aGrad.addColorStop(0,'#1a3040'); aGrad.addColorStop(1,'#0c1820');
  ctx.fillStyle=aGrad;
  ctx.beginPath(); ctx.roundRect(-11,-5,7,10,1); ctx.fill();
  ctx.strokeStyle='#2a5070'; ctx.lineWidth=0.8; ctx.stroke();
  // ammo rounds inside box
  for(let ay=-3.5;ay<=3.5;ay+=1.8){
    ctx.fillStyle='#d4a800'; ctx.globalAlpha=0.8;
    ctx.fillRect(-9.5,ay-0.6,4,1.2);
    ctx.fillStyle='#a07800'; ctx.globalAlpha=1;
    ctx.fillRect(-9.5,ay-0.6,1,1.2);
  }

  // === DUAL MACHINE GUN BARRELS ===
  for(const yo of [-4, 4]){
    // receiver / breach
    ctx.fillStyle='#1a3040';
    ctx.beginPath(); ctx.roundRect(0,yo-2.2,6,4.4,1); ctx.fill();
    ctx.strokeStyle='#00b8d4'; ctx.lineWidth=0.7; ctx.stroke();

    // main barrel (long, tapered)
    const bGrad=ctx.createLinearGradient(6,yo-2,6,yo+2);
    bGrad.addColorStop(0,'#3a5c72'); bGrad.addColorStop(0.5,'#1e3e54'); bGrad.addColorStop(1,'#0e1e2c');
    ctx.fillStyle=bGrad;
    ctx.beginPath();
    ctx.moveTo(6,yo-2); ctx.lineTo(20,yo-1.3); ctx.lineTo(20,yo+1.3); ctx.lineTo(6,yo+2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#00c8dd'; ctx.lineWidth=0.6; ctx.stroke();

    // heat shroud (perforated sleeve over barrel)
    ctx.strokeStyle='rgba(0,200,220,0.4)'; ctx.lineWidth=0.5;
    for(let hx=8;hx<18;hx+=2){
      ctx.beginPath(); ctx.moveTo(hx,yo-1.8); ctx.lineTo(hx,yo+1.8); ctx.stroke();
    }
    // barrel ridge rings
    for(const rx of [9,12,15,18]){
      ctx.strokeStyle='rgba(0,180,210,0.5)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(rx,yo-1.5); ctx.lineTo(rx,yo+1.5); ctx.stroke();
    }

    // muzzle brake (end piece)
    ctx.fillStyle='#0d1e2c';
    ctx.beginPath();
    ctx.moveTo(20,yo-1.3); ctx.lineTo(22,yo-2.2); ctx.lineTo(23,yo); ctx.lineTo(22,yo+2.2); ctx.lineTo(20,yo+1.3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=0.7; ctx.stroke();
    // muzzle slots
    ctx.fillStyle='rgba(0,0,0,0.8)';
    ctx.fillRect(20.5,yo-1.8,1.5,1.2);
    ctx.fillRect(20.5,yo+0.6,1.5,1.2);
  }

  // === GUN BRIDGE / YOKE connecting barrels ===
  ctx.fillStyle='rgba(30,60,80,0.9)';
  ctx.beginPath(); ctx.roundRect(5,-5,4,10,1); ctx.fill();
  ctx.strokeStyle='#004455'; ctx.lineWidth=0.6; ctx.stroke();

  // targeting sensor on top
  ctx.fillStyle='#0d2030';
  ctx.beginPath(); ctx.roundRect(-3,-12,6,4,1); ctx.fill();
  ctx.strokeStyle='#00f5ff'; ctx.lineWidth=0.7; ctx.stroke();
  // sensor lens
  const lens=ctx.createRadialGradient(0,-10,0,0,-10,2);
  lens.addColorStop(0,'#88ffff'); lens.addColorStop(1,'#004466');
  ctx.fillStyle=lens; ctx.beginPath(); ctx.arc(0,-10,2,0,Math.PI*2); ctx.fill();

  ctx.restore(); ctx.restore();
}

// ── LASER TOWER ──
function drawLaserTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#ff0088','#ff0088');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#ff0088'; ctx.shadowBlur=12;

  // === HOUSING — same boxy gun shape but sleeker ===
  const hGrad=ctx.createLinearGradient(-11,-8,11,8);
  hGrad.addColorStop(0,'#3a0f22'); hGrad.addColorStop(0.4,'#250a18'); hGrad.addColorStop(1,'#100408');
  ctx.fillStyle=hGrad;
  ctx.beginPath();
  ctx.moveTo(-11,-8); ctx.lineTo(6,-8); ctx.lineTo(10,-5);
  ctx.lineTo(10,5);   ctx.lineTo(6,8);  ctx.lineTo(-11,8); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle='#cc0066'; ctx.lineWidth=1.2; ctx.stroke();
  // highlight bevel
  ctx.beginPath(); ctx.moveTo(-11,-8); ctx.lineTo(6,-8); ctx.lineTo(10,-5);
  ctx.strokeStyle='rgba(255,120,180,0.2)'; ctx.lineWidth=1; ctx.stroke();

  // power conduits (vertical lines on body)
  ctx.strokeStyle='rgba(255,0,120,0.25)'; ctx.lineWidth=0.7;
  for(let vx=-8;vx<2;vx+=2.5){
    ctx.beginPath(); ctx.moveTo(vx,-7); ctx.lineTo(vx,7); ctx.stroke();
  }

  // energy capacitor bank (left)
  ctx.fillStyle='#1a0510';
  ctx.beginPath(); ctx.roundRect(-11,-6,6,12,1); ctx.fill();
  ctx.strokeStyle='#550033'; ctx.lineWidth=0.8; ctx.stroke();
  // capacitor cells
  for(let cy=-5;cy<=4;cy+=2.2){
    const capGrad=ctx.createLinearGradient(-10,cy,-5,cy);
    capGrad.addColorStop(0,'#ff0066'); capGrad.addColorStop(1,'#330022');
    ctx.fillStyle=capGrad; ctx.globalAlpha=0.8;
    ctx.fillRect(-10,cy,5,1.5);
    ctx.globalAlpha=1;
  }

  // === SINGLE LASER BARREL — same profile as gun barrel but with coils ===
  // receiver
  ctx.fillStyle='#200812';
  ctx.beginPath(); ctx.roundRect(0,-3,7,6,1); ctx.fill();
  ctx.strokeStyle='#cc0066'; ctx.lineWidth=0.8; ctx.stroke();

  // barrel body (same taper as gun)
  const bGrad=ctx.createLinearGradient(7,-3,7,3);
  bGrad.addColorStop(0,'#3a1020'); bGrad.addColorStop(0.5,'#220810'); bGrad.addColorStop(1,'#100408');
  ctx.fillStyle=bGrad;
  ctx.beginPath();
  ctx.moveTo(7,-3); ctx.lineTo(21,-2); ctx.lineTo(21,2); ctx.lineTo(7,3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#ff0077'; ctx.lineWidth=0.7; ctx.stroke();

  // EM acceleration rings (the gun-barrel rings, but glowing pink)
  for(const rx of [9,12,15,18,21]){
    const ringGrad=ctx.createLinearGradient(rx,-3,rx,3);
    ringGrad.addColorStop(0,'rgba(255,0,120,0.6)');
    ringGrad.addColorStop(0.5,'rgba(255,0,120,0.2)');
    ringGrad.addColorStop(1,'rgba(255,0,120,0.6)');
    ctx.strokeStyle=ringGrad; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(rx,-2.5); ctx.lineTo(rx,2.5); ctx.stroke();
    // ring glow dot
    ctx.fillStyle='rgba(255,0,136,0.4)';
    ctx.beginPath(); ctx.arc(rx,-2.5,0.8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx,2.5,0.8,0,Math.PI*2); ctx.fill();
  }

  // emitter lens at tip (instead of muzzle brake)
  const lens=ctx.createRadialGradient(22,0,0,22,0,3.5);
  lens.addColorStop(0,'#ffffff'); lens.addColorStop(0.3,'#ff44aa'); lens.addColorStop(0.7,'#ff0088'); lens.addColorStop(1,'transparent');
  ctx.fillStyle=lens;
  ctx.beginPath(); ctx.arc(22,0,3.5,0,Math.PI*2); ctx.fill();
  // outer lens ring
  ctx.strokeStyle='rgba(255,0,136,0.8)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.arc(22,0,3.5,0,Math.PI*2); ctx.stroke();

  // targeting scope on top (same as gun)
  ctx.fillStyle='#120408';
  ctx.beginPath(); ctx.roundRect(-3,-11,6,4,1); ctx.fill();
  ctx.strokeStyle='#ff0088'; ctx.lineWidth=0.7; ctx.stroke();
  const sLens=ctx.createRadialGradient(0,-9,0,0,-9,2);
  sLens.addColorStop(0,'#ffaacc'); sLens.addColorStop(1,'#440022');
  ctx.fillStyle=sLens; ctx.beginPath(); ctx.arc(0,-9,2,0,Math.PI*2); ctx.fill();

  ctx.restore(); ctx.restore();
}

// ── MISSILE TOWER ──
function drawMissileTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#ff8800','#ff8800');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;

  // === ROTATING LAUNCHER ARM ===
  // central pivot yoke
  const yGrad=ctx.createLinearGradient(-5,-8,5,8);
  yGrad.addColorStop(0,'#2a1a08'); yGrad.addColorStop(1,'#120c04');
  ctx.fillStyle=yGrad;
  ctx.beginPath(); ctx.roundRect(-5,-8,10,16,2); ctx.fill();
  ctx.strokeStyle='#884400'; ctx.lineWidth=1; ctx.stroke();

  // elevation pivot knuckle
  ctx.fillStyle='#3a2a14';
  ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#ff8800'; ctx.lineWidth=0.8; ctx.stroke();
  ctx.fillStyle='#1a1008';
  ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();

  // === TWIN ROCKET POD ARMS ===
  for(const yo of [-5, 5]){
    // arm strut
    ctx.fillStyle='#1a1008';
    ctx.fillRect(0,yo-1,8,2);
    ctx.strokeStyle='#553300'; ctx.lineWidth=0.5; ctx.strokeRect(0,yo-1,8,2);

    // === ROCKET POD (3 tubes side by side) ===
    // pod housing
    const podGrad=ctx.createLinearGradient(7,yo-5,20,yo+5);
    podGrad.addColorStop(0,'#2a1800'); podGrad.addColorStop(1,'#150c00');
    ctx.fillStyle=podGrad;
    ctx.beginPath();
    ctx.moveTo(8,yo-5); ctx.lineTo(18,yo-5); ctx.lineTo(20,yo-3);
    ctx.lineTo(20,yo+3); ctx.lineTo(18,yo+5); ctx.lineTo(8,yo+5); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='#cc5500'; ctx.lineWidth=0.8; ctx.stroke();

    // 3 missile tubes in a row
    for(let ti=0;ti<3;ti++){
      const ty=yo-3+ti*3;
      // tube barrel (circular opening)
      ctx.fillStyle='#0a0500';
      ctx.beginPath(); ctx.ellipse(20,ty,2,1.2,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#884400'; ctx.lineWidth=0.6; ctx.stroke();

      // missile body inside tube
      const rGrad=ctx.createLinearGradient(11,ty-1,19,ty+1);
      rGrad.addColorStop(0,'#cc5500'); rGrad.addColorStop(1,'#884400');
      ctx.fillStyle=rGrad;
      ctx.fillRect(11,ty-1,8,2);

      // warhead cone (pointy tip)
      ctx.fillStyle='#ff2200';
      ctx.beginPath(); ctx.moveTo(19,ty-1); ctx.lineTo(22,ty); ctx.lineTo(19,ty+1); ctx.closePath(); ctx.fill();

      // exhaust bell at back
      ctx.fillStyle='#222';
      ctx.beginPath(); ctx.ellipse(11,ty,1.5,1,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#555'; ctx.lineWidth=0.4; ctx.stroke();
    }

    // pod detail stripe
    ctx.strokeStyle='rgba(255,100,0,0.3)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(8,yo); ctx.lineTo(18,yo); ctx.stroke();
  }

  // IFF antenna on top
  ctx.strokeStyle='#996622'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,-14); ctx.stroke();
  ctx.fillStyle='#ff4400';
  ctx.beginPath(); ctx.arc(0,-14,1.5,0,Math.PI*2); ctx.fill();
  ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(0,-14,1.5,0,Math.PI*2); ctx.fill();

  ctx.restore(); ctx.restore();
}

// ── CRYO TOWER ── (same design, just polished)
function drawCryoTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#88aaff','#88aaff');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#aaccff'; ctx.shadowBlur=16;

  // dome housing
  const cGrad=ctx.createRadialGradient(-2,-2,1,0,0,12);
  cGrad.addColorStop(0,'#c8e8ff'); cGrad.addColorStop(0.35,'#5599cc'); cGrad.addColorStop(0.7,'#1a3060'); cGrad.addColorStop(1,'#060e20');
  ctx.fillStyle=cGrad;
  ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#66aaee'; ctx.lineWidth=1.2; ctx.stroke();

  // dome highlight
  ctx.fillStyle='rgba(220,240,255,0.12)';
  ctx.beginPath(); ctx.ellipse(-3,-4,6,4,Math.PI/5,0,Math.PI*2); ctx.fill();

  // ice crystal lattice (6-fold symmetry)
  ctx.save();
  for(let i=0;i<6;i++){
    ctx.save(); ctx.rotate((i/6)*Math.PI*2);
    // main arm
    ctx.strokeStyle='rgba(180,220,255,0.75)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-10); ctx.stroke();
    // branch pairs
    for(const br of [0.35,0.6,0.8]){
      const by=-10*br;
      ctx.strokeStyle='rgba(160,210,255,0.5)'; ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.moveTo(0,by); ctx.lineTo(-2.5,by-2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,by); ctx.lineTo(2.5,by-2); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // glowing core
  const core=ctx.createRadialGradient(0,0,0,0,0,5);
  core.addColorStop(0,'#ffffff'); core.addColorStop(0.4,'#88ccff'); core.addColorStop(1,'#2244aa');
  ctx.fillStyle=core; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(180,230,255,0.6)'; ctx.lineWidth=0.8; ctx.stroke();

  // === FREEZE NOZZLE (barrel-style, same profile as gun barrel) ===
  // receiver block
  ctx.fillStyle='#0a1830';
  ctx.beginPath(); ctx.roundRect(7,-3.5,5,7,1); ctx.fill();
  ctx.strokeStyle='#4477aa'; ctx.lineWidth=0.7; ctx.stroke();

  // nozzle barrel (tapered like gun)
  const nGrad=ctx.createLinearGradient(12,-3,12,3);
  nGrad.addColorStop(0,'#2a4060'); nGrad.addColorStop(0.5,'#162030'); nGrad.addColorStop(1,'#0a1020');
  ctx.fillStyle=nGrad;
  ctx.beginPath();
  ctx.moveTo(12,-3); ctx.lineTo(22,-2); ctx.lineTo(22,2); ctx.lineTo(12,3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#5599cc'; ctx.lineWidth=0.7; ctx.stroke();

  // cryo rings on nozzle
  for(const rx of [13,16,19,22]){
    ctx.strokeStyle='rgba(100,180,255,0.5)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(rx,-2.5); ctx.lineTo(rx,2.5); ctx.stroke();
  }

  // flared tip emitter
  ctx.fillStyle='rgba(140,210,255,0.35)';
  ctx.beginPath(); ctx.moveTo(22,-2); ctx.lineTo(26,0); ctx.lineTo(22,2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(140,210,255,0.7)'; ctx.lineWidth=0.7; ctx.stroke();

  ctx.restore(); ctx.restore();
}

