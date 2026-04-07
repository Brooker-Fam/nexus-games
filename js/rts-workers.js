// ── DRAW WORKERS ──
function drawRTSWorker(rc,w){
  const cfg=FACTION_CFG[w.faction];
  const isBuilding = w.state==='building';
  const isMining = w.state==='mining' || isBuilding; // reuse mining anim for hammering
  const isMoving = w.state==='moving'||w.state==='returning';
  // walking bob / build lean
  const walkBob = isMoving ? Math.sin(w.frame*0.28)*3 : 0;
  const walkLean = isMoving ? Math.sin(w.frame*0.28)*0.12
                 : isBuilding ? (w.hammerSwing||0)*0.18 : 0;
  rc.save();
  rc.translate(w.x, w.y+walkBob);
  rc.rotate(walkLean);
  rc.shadowColor=cfg.color; rc.shadowBlur=8;
  if(w.side==='enemy') rc.scale(-1,1);

  if(w.faction==='prism') drawWorkerPrism(rc, cfg, w, isMining, isMoving);
  else if(w.faction==='shadow') drawWorkerShadow(rc, cfg, w, isMining, isMoving);
  else drawWorkerRoboto(rc, cfg, w, isMining, isMoving);

  // building dust puffs
  if(isBuilding && (w.hammerSwing||0) < -0.7){
    rc.globalAlpha=0.5;
    for(let d=0;d<3;d++){
      rc.fillStyle='rgba(200,180,120,0.6)';
      rc.beginPath(); rc.arc(8+d*5,4+d*2,2,0,Math.PI*2); rc.fill();
    }
    rc.globalAlpha=1;
  }

  // gold carry indicator
  if(w.goldCarry>0){
    rc.fillStyle='#ffe066'; rc.shadowColor='#ffdd00'; rc.shadowBlur=10;
    rc.beginPath(); rc.arc(0,-22,3+w.goldCarry*0.5,0,Math.PI*2); rc.fill();
    rc.fillStyle='rgba(255,255,150,0.6)'; rc.beginPath(); rc.arc(-1,-23,1.5,0,Math.PI*2); rc.fill();
  }
  rc.restore();

  // selection ring
  if(w.selected){
    rc.save();
    rc.strokeStyle='#00ff88'; rc.lineWidth=2;
    rc.shadowColor='#00ff88'; rc.shadowBlur=10;
    rc.beginPath(); rc.ellipse(w.x,w.y,14,6,0,0,Math.PI*2); rc.stroke();
    rc.restore();
  }

  // HP bar
  if(w.hp<w.maxHp){
    const bw=16,bh=3;
    rc.fillStyle='rgba(0,0,0,0.5)'; rc.fillRect(w.x-bw/2,w.y-22,bw,bh);
    rc.fillStyle='#00ff88'; rc.fillRect(w.x-bw/2,w.y-22,bw*(w.hp/w.maxHp),bh);
  }
}

function drawWorkerPrism(rc, cfg, w, isMining, isMoving){
  const t = w.frame;
  // leg swing when walking
  const legSwing = isMoving ? Math.sin(t*0.28)*8 : 0;

  // LEGS (two lines)
  rc.strokeStyle='#88c8e8'; rc.lineWidth=2.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-2,2); rc.lineTo(-3+Math.sin(t*0.28)*3, 8+Math.abs(Math.sin(t*0.28))*2); rc.stroke();
  rc.beginPath(); rc.moveTo(2,2);  rc.lineTo(3-Math.sin(t*0.28)*3, 8+Math.abs(Math.cos(t*0.28))*2); rc.stroke();

  // ROBE body
  const rGrad=rc.createLinearGradient(-6,-14,6,4);
  rGrad.addColorStop(0,'#e0f4ff'); rGrad.addColorStop(1,'#88c8e8');
  rc.fillStyle=rGrad;
  rc.beginPath(); rc.moveTo(-6,-2); rc.lineTo(-8,4); rc.lineTo(8,4); rc.lineTo(6,-2); rc.lineTo(0,-14); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,200,255,0.4)'; rc.lineWidth=0.6; rc.stroke();

  // STAFF ARM — mining: swing pickaxe, else hold staff up
  if(isMining){
    // mining animation: arm swings pick up and down
    const swing = Math.sin(t*0.18)*0.9; // full arc
    rc.save();
    rc.translate(7,-8);
    rc.rotate(swing - 0.3);
    // arm
    rc.strokeStyle='#c0e4f8'; rc.lineWidth=2.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(0,0); rc.lineTo(6,8); rc.stroke();
    // pick tool
    rc.strokeStyle='#ffdd88'; rc.lineWidth=2; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(4,6); rc.lineTo(12,4); rc.stroke();
    rc.beginPath(); rc.moveTo(4,6); rc.lineTo(6,14); rc.stroke();
    // pick head
    rc.fillStyle='#ffcc44'; rc.shadowColor='#ffaa00'; rc.shadowBlur=6;
    rc.beginPath(); rc.arc(12,4,2.5,0,Math.PI*2); rc.fill();
    rc.restore();
    // dust particles when pick hits
    if(Math.sin(t*0.18)<-0.8){
      rc.fillStyle='rgba(200,180,100,0.6)'; rc.globalAlpha=0.7;
      for(let d=0;d<3;d++){
        rc.beginPath(); rc.arc(14+d*3,12+d,1.5,0,Math.PI*2); rc.fill();
      }
      rc.globalAlpha=1;
    }
  } else {
    // walking/idle: hold staff at side
    const armSwing = isMoving ? Math.sin(t*0.28)*6 : 0;
    rc.strokeStyle='#c0e4f8'; rc.lineWidth=2.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(6,-12); rc.lineTo(8+armSwing*0.3,-2+armSwing*0.1); rc.stroke();
    // staff
    rc.strokeStyle='#88ccff'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(8,-14); rc.lineTo(10,3); rc.stroke();
    // orb
    rc.fillStyle='rgba(0,240,255,0.8)'; rc.shadowColor='#00ffff'; rc.shadowBlur=8;
    rc.beginPath(); rc.arc(8,-14,2.5,0,Math.PI*2); rc.fill();
  }

  // HEAD
  rc.fillStyle='#fff0e8'; rc.beginPath(); rc.arc(0,-18,5,0,Math.PI*2); rc.fill();
  // hair
  rc.fillStyle='#d0ecff'; rc.beginPath(); rc.arc(0,-21,4,Math.PI,Math.PI*2); rc.fill();
  // eyes — blink occasionally
  const blink = (t%120)<4 ? 0.2 : 1;
  rc.fillStyle=`rgba(100,220,255,${blink})`;
  rc.beginPath(); rc.ellipse(-2,-18,1.2,1.2*blink,0,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.ellipse(2,-18,1.2,1.2*blink,0,0,Math.PI*2); rc.fill();
}

function drawWorkerShadow(rc, cfg, w, isMining, isMoving){
  const t = w.frame;

  // LEGS
  rc.strokeStyle='#3a1060'; rc.lineWidth=2.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-2,2); rc.lineTo(-3+Math.sin(t*0.28)*3,8+Math.abs(Math.sin(t*0.28))*2); rc.stroke();
  rc.beginPath(); rc.moveTo(2,2);  rc.lineTo(3-Math.sin(t*0.28)*3,8+Math.abs(Math.cos(t*0.28))*2); rc.stroke();

  // CLOAK body
  const cGrad=rc.createLinearGradient(-6,-14,6,4);
  cGrad.addColorStop(0,'#1a0030'); cGrad.addColorStop(1,'#05000a');
  rc.fillStyle=cGrad;
  rc.beginPath(); rc.moveTo(-7,-2); rc.bezierCurveTo(-9,2,-8,4,0,4); rc.bezierCurveTo(8,4,9,2,7,-2); rc.lineTo(3,-14); rc.lineTo(-3,-14); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(120,0,200,0.4)'; rc.lineWidth=0.6; rc.stroke();

  // TOOL ARM
  if(isMining){
    const swing = Math.sin(t*0.18)*0.9;
    rc.save(); rc.translate(6,-8); rc.rotate(swing-0.3);
    // arm
    rc.strokeStyle='#4a1a70'; rc.lineWidth=2.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(0,0); rc.lineTo(6,8); rc.stroke();
    // dark blade pick
    rc.strokeStyle='#8833aa'; rc.lineWidth=2; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(4,6); rc.lineTo(12,3); rc.stroke();
    rc.beginPath(); rc.moveTo(4,6); rc.lineTo(7,14); rc.stroke();
    rc.fillStyle='#9944cc'; rc.shadowColor='#7700cc'; rc.shadowBlur=8;
    rc.beginPath(); rc.arc(12,3,2.5,0,Math.PI*2); rc.fill();
    // purple sparks on hit
    if(Math.sin(t*0.18)<-0.8){
      rc.fillStyle='rgba(180,80,255,0.7)'; rc.globalAlpha=0.8;
      for(let d=0;d<4;d++){
        rc.beginPath(); rc.arc(13+d*2,10+d*1.5,1.2,0,Math.PI*2); rc.fill();
      }
      rc.globalAlpha=1;
    }
    rc.restore();
  } else {
    // idle arm with small shadow dagger
    const armSwing = isMoving ? Math.sin(t*0.28)*5 : 0;
    rc.strokeStyle='#4a1a70'; rc.lineWidth=2.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(6,-10); rc.lineTo(8+armSwing*0.2,-2); rc.stroke();
    // dagger
    rc.strokeStyle='#6600cc'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(9,-4); rc.lineTo(14,2); rc.stroke();
    rc.fillStyle='rgba(140,60,255,0.6)'; rc.beginPath(); rc.arc(9,-4,1.5,0,Math.PI*2); rc.fill();
  }

  // HOOD
  rc.fillStyle='#0f0020'; rc.beginPath(); rc.ellipse(0,-18,5,6,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(100,0,180,0.4)'; rc.lineWidth=0.6; rc.stroke();
  // glowing eyes
  const pulse = 0.6+Math.sin(t*0.1)*0.4;
  rc.fillStyle=`rgba(160,80,255,${pulse})`; rc.shadowColor='#aa44ff'; rc.shadowBlur=6;
  rc.beginPath(); rc.arc(-2,-18,1.2,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.arc(2,-18,1.2,0,Math.PI*2); rc.fill();
}

function drawWorkerRoboto(rc, cfg, w, isMining, isMoving){
  const t = w.frame;
  const drillSpin = t * 0.3;

  // LEGS — pistons that step
  for(const [lx,side] of [[-4,-1],[2,1]]){
    const step = isMoving ? Math.sin(t*0.28+side*Math.PI)*3 : 0;
    rc.fillStyle='#1e1e1e'; rc.fillRect(lx,4+step,4,6); // upper leg
    rc.fillStyle='#141414'; rc.fillRect(lx-1,10+step,6,4); // foot pad
    rc.strokeStyle='rgba(200,80,0,0.3)'; rc.lineWidth=0.5;
    rc.strokeRect(lx,4+step,4,6);
  }

  // BODY BOX
  const bGrad=rc.createLinearGradient(-6,-12,6,4);
  bGrad.addColorStop(0,'#3a3a3a'); bGrad.addColorStop(1,'#181818');
  rc.fillStyle=bGrad; rc.beginPath(); rc.roundRect(-6,-12,12,16,2); rc.fill();
  rc.strokeStyle='rgba(255,120,0,0.4)'; rc.lineWidth=0.6; rc.stroke();
  // vent
  rc.fillStyle='rgba(0,0,0,0.5)'; rc.fillRect(-4,-6,8,4);
  // status light
  const blink2=(t%40)<20;
  rc.fillStyle=blink2?'#00ff66':'#004422';
  rc.beginPath(); rc.arc(4,-10,1.5,0,Math.PI*2); rc.fill();

  // DRILL ARM (mining) or normal arm (walking)
  if(isMining){
    rc.save(); rc.translate(8,-5);
    // arm
    rc.strokeStyle='#555'; rc.lineWidth=3; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(0,0); rc.lineTo(7,5); rc.stroke();
    // spinning drill bit
    rc.save(); rc.translate(8,6); rc.rotate(drillSpin);
    rc.fillStyle='#888'; rc.beginPath(); rc.moveTo(0,-4); rc.lineTo(3,0); rc.lineTo(0,4); rc.lineTo(-3,0); rc.closePath(); rc.fill();
    rc.strokeStyle='rgba(255,150,0,0.6)'; rc.lineWidth=0.7; rc.stroke();
    rc.restore();
    // drill tip
    rc.fillStyle='#ffaa00'; rc.shadowColor='#ff8800'; rc.shadowBlur=8;
    rc.beginPath(); rc.arc(8,6,2,0,Math.PI*2); rc.fill();
    // spark on hit
    if((t%20)<5){
      rc.fillStyle='rgba(255,200,50,0.9)'; rc.globalAlpha=0.8;
      for(let s=0;s<4;s++){
        const sa=s*Math.PI/2+drillSpin;
        rc.beginPath(); rc.arc(8+Math.cos(sa)*5,6+Math.sin(sa)*3,1.2,0,Math.PI*2); rc.fill();
      }
      rc.globalAlpha=1;
    }
    rc.restore();
  } else {
    // arm swings when walking
    const armSwing = isMoving ? Math.sin(t*0.28)*5 : 0;
    rc.strokeStyle='#555'; rc.lineWidth=3; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(6,-6); rc.lineTo(12+armSwing*0.3,-4+armSwing*0.2); rc.stroke();
    rc.fillStyle='#666'; rc.beginPath(); rc.arc(13,-4,3,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(255,150,0,0.5)'; rc.lineWidth=0.6; rc.stroke();
  }

  // HEAD BOX
  rc.fillStyle='#252525'; rc.beginPath(); rc.roundRect(-5,-22,10,12,2); rc.fill();
  rc.strokeStyle='rgba(255,120,0,0.3)'; rc.lineWidth=0.5; rc.stroke();
  // visor with scan line
  rc.fillStyle='rgba(255,150,0,0.85)'; rc.beginPath(); rc.roundRect(-3,-19,6,4,1); rc.fill();
  const scanX2=((t*0.8)%6)-3;
  rc.fillStyle='rgba(255,255,200,0.6)'; rc.fillRect(scanX2,-19,1.5,4);
}

