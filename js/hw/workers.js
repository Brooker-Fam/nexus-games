// ── HOMESTEAD WARS — WORKER DRAWING ──

function hwDrawWorker(rc, e){
  const cfg=HW_FACTIONS[e.faction]||HW_FACTIONS.barnyard;
  const isBuilding = e.state==='building';
  const isMining = e.state==='mining' || isBuilding;
  const isMoving = e.state==='moving'||e.state==='returning';
  const bob = isMoving ? Math.sin(e.frame*0.15)*2 : 0;
  const lean = isMoving ? Math.sin(e.frame*0.15)*0.08
             : isBuilding ? (e.hammerSwing||0)*0.18 : 0;

  rc.save();
  rc.translate(e.x, e.y+bob);
  rc.rotate(lean);
  rc.shadowColor=cfg.color; rc.shadowBlur=6;
  if(e.side==='enemy') rc.scale(-1,1);

  if(e.faction==='barnyard') hwDrawWorkerBarnyard(rc, cfg, e, isMining, isMoving);
  else if(e.faction==='creek') hwDrawWorkerCreek(rc, cfg, e, isMining, isMoving);
  else hwDrawWorkerWoodland(rc, cfg, e, isMining, isMoving);

  // building dust puffs
  if(isBuilding && (e.hammerSwing||0) < -0.7){
    rc.globalAlpha=0.5;
    for(let d=0;d<3;d++){
      rc.fillStyle='rgba(200,180,120,0.6)';
      rc.beginPath(); rc.arc(8+d*5,4+d*2,2,0,Math.PI*2); rc.fill();
    }
    rc.globalAlpha=1;
  }

  // hay carry indicator
  if(e.hayCarry>0){
    rc.fillStyle='#DAA520'; rc.shadowColor='#DAA520'; rc.shadowBlur=6;
    rc.beginPath(); rc.roundRect(-4,-22,8,5,1); rc.fill();
    rc.strokeStyle='#8B6914'; rc.lineWidth=0.5; rc.stroke();
    // straw wisps
    rc.strokeStyle='rgba(218,165,32,0.6)'; rc.lineWidth=0.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(-3,-22); rc.lineTo(-6,-25); rc.stroke();
    rc.beginPath(); rc.moveTo(3,-22); rc.lineTo(5,-24); rc.stroke();
  }

  rc.restore();

  // selection ring
  if(e.selected) hwDrawSelectionRing(rc, e.x, e.y, 14, 6);
  if(e.hp<e.maxHp) hwDrawHealthBar(rc, e.x, e.y-22, 16, 3, e.hp, e.maxHp, 'fixed');
}

// ═══════════════════════════════════════
//  BARNYARD FARMHAND
// ═══════════════════════════════════════
function hwDrawWorkerBarnyard(rc, cfg, w, isMining, isMoving){
  const t=w.frame;
  const legSwing = isMoving ? Math.sin(t*0.28)*3 : 0;

  // LEGS (blue overalls)
  rc.fillStyle='#4444aa';
  rc.fillRect(-3,2+legSwing,3,6);
  rc.fillRect(1,2-legSwing,3,6);
  // boots
  rc.fillStyle='#5a3a18';
  rc.fillRect(-4,7+legSwing,4,3);
  rc.fillRect(1,7-legSwing,4,3);

  // BODY (overalls)
  const bodyGrad=rc.createLinearGradient(-5,-8,5,4);
  bodyGrad.addColorStop(0,'#5555bb'); bodyGrad.addColorStop(1,'#3333aa');
  rc.fillStyle=bodyGrad;
  rc.fillRect(-5,-6,10,10);
  // shirt underneath
  rc.fillStyle='#cc8844';
  rc.fillRect(-4,-9,8,5);
  // overall straps
  rc.strokeStyle='#4444aa'; rc.lineWidth=1.5;
  rc.beginPath(); rc.moveTo(-3,-8); rc.lineTo(-3,-6); rc.stroke();
  rc.beginPath(); rc.moveTo(3,-8); rc.lineTo(3,-6); rc.stroke();

  // ARM + TOOL
  if(isMining){
    const swing = Math.sin(t*0.18)*0.9;
    rc.save(); rc.translate(6,-6); rc.rotate(swing-0.3);
    // arm
    rc.strokeStyle='#cc8844'; rc.lineWidth=2.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(0,0); rc.lineTo(5,7); rc.stroke();
    // pitchfork handle
    rc.strokeStyle='#6a4a2a'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(3,5); rc.lineTo(10,14); rc.stroke();
    // pitchfork tines
    rc.strokeStyle='#888'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(8,12); rc.lineTo(7,18); rc.stroke();
    rc.beginPath(); rc.moveTo(10,14); rc.lineTo(10,20); rc.stroke();
    rc.beginPath(); rc.moveTo(12,12); rc.lineTo(13,18); rc.stroke();
    rc.restore();
    // dust on dig
    if(Math.sin(t*0.18)<-0.8){
      rc.fillStyle='rgba(218,165,32,0.5)'; rc.globalAlpha=0.7;
      for(let d=0;d<3;d++){
        rc.beginPath(); rc.arc(14+d*3,12+d,1.5,0,Math.PI*2); rc.fill();
      }
      rc.globalAlpha=1;
    }
  } else {
    // walking/idle arm swing
    const armSwing = isMoving ? Math.sin(t*0.28)*5 : 0;
    rc.strokeStyle='#cc8844'; rc.lineWidth=2.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(5,-6); rc.lineTo(8+armSwing*0.3,-2+armSwing*0.1); rc.stroke();
  }

  // HEAD
  rc.fillStyle='#FFD5B0';
  rc.beginPath(); rc.arc(0,-14,5,0,Math.PI*2); rc.fill();

  // EYES — blink
  const blink = (t%120)<4 ? 0.2 : 1;
  rc.fillStyle=`rgba(40,30,20,${blink})`;
  rc.beginPath(); rc.ellipse(-2,-14,1,1*blink,0,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.ellipse(2,-14,1,1*blink,0,0,Math.PI*2); rc.fill();

  // STRAW HAT
  rc.fillStyle='#DAA520';
  rc.beginPath(); rc.ellipse(0,-18,8,2.5,0,0,Math.PI*2); rc.fill();
  // hat top
  rc.fillStyle='#c49a10';
  rc.beginPath(); rc.roundRect(-5,-22,10,5,2); rc.fill();
  // hat band
  rc.fillStyle='#8B4513';
  rc.fillRect(-5,-18,10,1.5);
}

// ═══════════════════════════════════════
//  CREEK DUCKLING
// ═══════════════════════════════════════
function hwDrawWorkerCreek(rc, cfg, w, isMining, isMoving){
  const t=w.frame;
  const waddle = isMoving ? Math.sin(t*0.25)*0.12 : 0;

  rc.save(); rc.rotate(waddle);

  // FEET (orange paddles)
  rc.fillStyle='#FF8C00';
  const lStep = isMoving ? Math.sin(t*0.25)*2 : 0;
  rc.beginPath(); rc.ellipse(-3,5+lStep,3,1.5,0,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.ellipse(3,5-lStep,3,1.5,0,0,Math.PI*2); rc.fill();

  // BODY (round yellow)
  const yGrad=rc.createRadialGradient(-1,-2,1,0,-1,7);
  yGrad.addColorStop(0,'#FFEE60'); yGrad.addColorStop(0.6,'#FFD700'); yGrad.addColorStop(1,'#E6B800');
  rc.fillStyle=yGrad;
  rc.beginPath(); rc.ellipse(0,-1,7,6,0,0,Math.PI*2); rc.fill();

  // WING (flaps when walking)
  const wingFlap = isMoving ? Math.sin(t*0.3)*0.25 : 0;
  rc.save(); rc.translate(-5,-2); rc.rotate(wingFlap+0.2);
  rc.fillStyle='#FFCC00';
  rc.beginPath(); rc.ellipse(0,0,4,3,0.3,0,Math.PI*2); rc.fill();
  rc.restore();

  // HEAD
  rc.fillStyle='#FFE44D';
  rc.beginPath(); rc.arc(1,-9,5,0,Math.PI*2); rc.fill();

  // BEAK (orange triangle)
  rc.fillStyle='#FF8C00';
  rc.beginPath();
  rc.moveTo(5,-10); rc.lineTo(10,-9); rc.lineTo(5,-8);
  rc.closePath(); rc.fill();

  // EYES (cute dots)
  const blink = (t%100)<3 ? 0.1 : 1;
  rc.fillStyle=`rgba(20,20,20,${blink})`;
  rc.beginPath(); rc.arc(2,-10,1.2,0,Math.PI*2); rc.fill();
  // eye highlight
  if(blink>0.5){
    rc.fillStyle='rgba(255,255,255,0.6)';
    rc.beginPath(); rc.arc(2.5,-10.5,0.5,0,Math.PI*2); rc.fill();
  }

  // MINING: reaching out with bucket
  if(isMining){
    const swing=Math.sin(t*0.18)*0.5;
    rc.save(); rc.translate(6,-4); rc.rotate(swing);
    rc.fillStyle='#8B6914';
    rc.fillRect(2,-1,5,5);
    rc.strokeStyle='#6a4a10'; rc.lineWidth=0.5; rc.strokeRect(2,-1,5,5);
    // handle
    rc.strokeStyle='#6a4a10'; rc.lineWidth=1;
    rc.beginPath(); rc.arc(4.5,-1,3,Math.PI,Math.PI*2); rc.stroke();
    rc.restore();
  }

  rc.restore();
}

// ═══════════════════════════════════════
//  WOODLAND SQUIRREL
// ═══════════════════════════════════════
function hwDrawWorkerWoodland(rc, cfg, w, isMining, isMoving){
  const t=w.frame;
  const scurry = isMoving ? Math.sin(t*0.35)*0.1 : 0;
  const fastBob = isMoving ? Math.sin(t*0.35)*1.5 : 0;

  rc.save(); rc.rotate(scurry);
  rc.translate(0, fastBob);

  // TAIL (large, bushy, curves up)
  rc.fillStyle='#8B6914';
  rc.beginPath();
  rc.moveTo(-4,0);
  rc.bezierCurveTo(-10,-4,-12,-14,-8,-18);
  rc.bezierCurveTo(-5,-20,-3,-16,-2,-6);
  rc.closePath(); rc.fill();
  // tail highlight
  rc.fillStyle='rgba(180,140,60,0.3)';
  rc.beginPath();
  rc.moveTo(-5,-2);
  rc.bezierCurveTo(-9,-6,-10,-14,-7,-16);
  rc.bezierCurveTo(-5,-17,-4,-12,-3,-4);
  rc.closePath(); rc.fill();

  // LEGS (small, fast)
  rc.fillStyle='#7a5a10';
  const lStep = isMoving ? Math.sin(t*0.35)*3 : 0;
  rc.fillRect(-3,4+lStep,3,4);
  rc.fillRect(1,4-lStep,3,4);
  // paws
  rc.fillStyle='#6a4a08';
  rc.fillRect(-4,7+lStep,4,2);
  rc.fillRect(1,7-lStep,4,2);

  // BODY (brown oval)
  const bGrad=rc.createRadialGradient(0,-1,1,0,0,6);
  bGrad.addColorStop(0,'#c49a40'); bGrad.addColorStop(0.5,'#A0722A'); bGrad.addColorStop(1,'#7a5a18');
  rc.fillStyle=bGrad;
  rc.beginPath(); rc.ellipse(0,-1,5,6,0,0,Math.PI*2); rc.fill();

  // BELLY (lighter)
  rc.fillStyle='#D4A860';
  rc.beginPath(); rc.ellipse(1,0,3,4,0,0,Math.PI*2); rc.fill();

  // ARMS (small reaching out when mining)
  if(isMining){
    const swing=Math.sin(t*0.2)*0.6;
    rc.save(); rc.translate(4,-4); rc.rotate(swing);
    rc.strokeStyle='#A0722A'; rc.lineWidth=2; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(0,0); rc.lineTo(6,3); rc.stroke();
    // acorn/nut
    rc.fillStyle='#8B6914';
    rc.beginPath(); rc.ellipse(7,4,2,2.5,0,0,Math.PI*2); rc.fill();
    rc.fillStyle='#6a4a10';
    rc.beginPath(); rc.ellipse(7,2,2.5,1,0,0,Math.PI*2); rc.fill();
    rc.restore();
  } else if(isMoving){
    const armSwing=Math.sin(t*0.35)*4;
    rc.strokeStyle='#A0722A'; rc.lineWidth=2; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(4,-4); rc.lineTo(7+armSwing*0.2,-3); rc.stroke();
  }

  // HEAD
  rc.fillStyle='#A0722A';
  rc.beginPath(); rc.arc(2,-9,4.5,0,Math.PI*2); rc.fill();

  // CHEEKS (rounder face)
  rc.fillStyle='#c4a050';
  rc.beginPath(); rc.ellipse(4,-8,2,2.5,0,0,Math.PI*2); rc.fill();

  // EARS (round, prominent)
  for(const ex of [0,5]){
    rc.fillStyle='#8B6914';
    rc.beginPath(); rc.arc(ex,-13,2.5,0,Math.PI*2); rc.fill();
    // inner ear
    rc.fillStyle='#c49a40';
    rc.beginPath(); rc.arc(ex,-13,1.5,0,Math.PI*2); rc.fill();
  }

  // EYE (large, alert)
  const blink=(t%80)<3?0.15:1;
  rc.fillStyle=`rgba(20,15,5,${blink})`;
  rc.beginPath(); rc.ellipse(3,-9,1.3,1.3*blink,0,0,Math.PI*2); rc.fill();
  if(blink>0.5){
    rc.fillStyle='rgba(255,255,255,0.5)';
    rc.beginPath(); rc.arc(3.5,-9.5,0.5,0,Math.PI*2); rc.fill();
  }

  // NOSE
  rc.fillStyle='#4a2a0a';
  rc.beginPath(); rc.arc(6,-8,1,0,Math.PI*2); rc.fill();

  rc.restore();
}
