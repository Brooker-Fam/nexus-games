// ── HOMESTEAD WARS — MAIN RENDERING ──

function hwDraw(){
  const cvs=document.getElementById('hw-canvas');
  if(!cvs) return;
  const rc=cvs.getContext('2d');
  rc.clearRect(0,0,HW_VW,HW_VH);

  rc.save();
  rc.translate(-H.camX, -H.camY);

  hwDrawBackground(rc);
  hwDrawHayNodes(rc);

  // build placement preview
  if(H.buildStructureMode && H.mouseWorld){
    rc.save();
    const pulse=0.3+Math.sin(H.frame*0.2)*0.3;
    rc.strokeStyle=`rgba(255,220,0,${0.5+pulse})`;
    rc.lineWidth=2; rc.setLineDash([8,6]);
    rc.shadowColor='#ffdd00'; rc.shadowBlur=16;
    rc.beginPath(); rc.arc(H.mouseWorld.x, H.mouseWorld.y, 40, 0, Math.PI*2); rc.stroke();
    rc.setLineDash([]);
    // crosshair
    rc.strokeStyle='rgba(255,220,0,0.7)'; rc.lineWidth=1.5; rc.shadowBlur=8;
    rc.beginPath(); rc.moveTo(H.mouseWorld.x-14,H.mouseWorld.y); rc.lineTo(H.mouseWorld.x+14,H.mouseWorld.y); rc.stroke();
    rc.beginPath(); rc.moveTo(H.mouseWorld.x,H.mouseWorld.y-14); rc.lineTo(H.mouseWorld.x,H.mouseWorld.y+14); rc.stroke();
    rc.font='8px sans-serif'; rc.textAlign='center'; rc.fillStyle='rgba(255,220,80,0.8)'; rc.shadowBlur=0;
    rc.fillText('CLICK TO PLACE', H.mouseWorld.x, H.mouseWorld.y-48);
    rc.restore();
  }

  // draw non-ring particles
  hwDrawParticles(rc, false);

  // draw entities in order: bases, structures, cannons, workers, warriors
  for(const e of H.entities){
    if(e.x < H.camX-100 || e.x > H.camX+HW_VW+100 ||
       e.y < H.camY-100 || e.y > H.camY+HW_VH+100) continue;
    if(e.type==='base') hwDrawBase(rc,e);
    if(e.type==='structure') hwDrawStructure(rc,e);
    if(e.type==='cannon') hwDrawCannon(rc,e);
  }
  for(const e of H.entities){
    if(e.x < H.camX-100 || e.x > H.camX+HW_VW+100 ||
       e.y < H.camY-100 || e.y > H.camY+HW_VH+100) continue;
    if(e.type==='worker') hwDrawWorker(rc,e);
    if(e.type==='warrior') hwDrawWarrior(rc,e);
  }

  hwDrawProjectiles(rc);

  // draw ring particles on top
  hwDrawParticles(rc, true);

  // base HP bars
  hwDrawBaseHP(rc);

  rc.restore();

  // minimap in screen space
  hwDrawMinimap();
}

// ── BACKGROUND ──
function hwDrawBackground(rc){
  // sky-to-grass gradient
  const bg=rc.createLinearGradient(0,0,0,HW_RH);
  bg.addColorStop(0,'#87CEEB');
  bg.addColorStop(0.35,'#a8d8ea');
  bg.addColorStop(0.5,'#7ab648');
  bg.addColorStop(1,'#4a7c34');
  rc.fillStyle=bg; rc.fillRect(0,0,HW_RW,HW_RH);

  // plowed field grid — only draw visible portion
  const gx0=Math.floor(H.camX/60)*60, gy0=Math.floor(H.camY/60)*60;
  rc.strokeStyle='rgba(255,255,255,0.03)'; rc.lineWidth=1;
  for(let x2=gx0;x2<H.camX+HW_VW+60;x2+=60){
    rc.beginPath(); rc.moveTo(x2,H.camY); rc.lineTo(x2,H.camY+HW_VH); rc.stroke();
  }
  for(let y2=gy0;y2<H.camY+HW_VH+60;y2+=60){
    rc.beginPath(); rc.moveTo(H.camX,y2); rc.lineTo(H.camX+HW_VW,y2); rc.stroke();
  }

  // center dirt path divider
  rc.strokeStyle='rgba(139,90,43,0.2)'; rc.lineWidth=4; rc.setLineDash([12,18]);
  rc.beginPath(); rc.moveTo(HW_RW/2,0); rc.lineTo(HW_RW/2,HW_RH); rc.stroke();
  rc.setLineDash([]);

  // territory glows
  const pCfg=HW_FACTIONS[H.playerFaction], eCfg=HW_FACTIONS[H.enemyFaction];
  const pg=rc.createLinearGradient(0,0,HW_RW*0.35,0);
  pg.addColorStop(0,hwHexAlpha(pCfg.color,0.06)); pg.addColorStop(1,'transparent');
  rc.fillStyle=pg; rc.fillRect(0,0,HW_RW*0.35,HW_RH);
  const eg=rc.createLinearGradient(HW_RW,0,HW_RW*0.65,0);
  eg.addColorStop(0,hwHexAlpha(eCfg.color,0.06)); eg.addColorStop(1,'transparent');
  rc.fillStyle=eg; rc.fillRect(HW_RW*0.65,0,HW_RW*0.35,HW_RH);

  // scattered grass tufts — only in visible area
  const tx0=Math.floor(H.camX/120)*120, ty0=Math.floor(H.camY/90)*90;
  for(let gx=tx0;gx<H.camX+HW_VW+120;gx+=120){
    for(let gy=ty0;gy<H.camY+HW_VH+90;gy+=90){
      // pseudorandom offset from grid
      const ox=((gx*7+gy*13)%47)-23, oy=((gx*11+gy*3)%31)-15;
      const px=gx+ox, py=gy+oy;
      if(py < HW_RH*0.4) continue; // only on grass area
      rc.strokeStyle='rgba(80,140,40,0.15)'; rc.lineWidth=1.5; rc.lineCap='round';
      rc.beginPath(); rc.arc(px,py,4,Math.PI*1.1,Math.PI*1.9); rc.stroke();
      rc.beginPath(); rc.arc(px+3,py+1,3,Math.PI*1.0,Math.PI*1.7); rc.stroke();
    }
  }

  // fence-line world border
  rc.strokeStyle='rgba(139,90,43,0.25)'; rc.lineWidth=3;
  rc.strokeRect(3,3,HW_RW-6,HW_RH-6);
}

// ── HAY NODES ──
function hwDrawHayNodes(rc){
  for(const node of H.hayNodes){
    if(node.hay<=0) continue;
    const x=node.x, y=node.y;
    const frac=node.hay/node.maxHay;

    rc.save();
    rc.shadowColor='#DAA520'; rc.shadowBlur=8;

    // hay bale body — golden rounded rectangle
    const bw=22*frac+6, bh=14*frac+4;
    const bg=rc.createLinearGradient(x-bw/2,y-bh/2,x+bw/2,y+bh/2);
    bg.addColorStop(0,'#e8c840'); bg.addColorStop(0.5,'#DAA520'); bg.addColorStop(1,'#b8860b');
    rc.fillStyle=bg;
    rc.beginPath(); rc.roundRect(x-bw/2,y-bh/2,bw,bh,3); rc.fill();
    rc.strokeStyle='rgba(139,90,43,0.5)'; rc.lineWidth=1; rc.stroke();

    // horizontal straw bands
    rc.strokeStyle='rgba(139,90,43,0.3)'; rc.lineWidth=0.7;
    for(let by=-bh/2+4;by<bh/2;by+=4){
      rc.beginPath(); rc.moveTo(x-bw/2+2,y+by); rc.lineTo(x+bw/2-2,y+by); rc.stroke();
    }

    // crossed straw sticks on top
    rc.strokeStyle='#c9a830'; rc.lineWidth=1.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(x-5,y-bh/2-3); rc.lineTo(x+5,y-bh/2+2); rc.stroke();
    rc.beginPath(); rc.moveTo(x+5,y-bh/2-3); rc.lineTo(x-5,y-bh/2+2); rc.stroke();

    // label
    rc.font='7px sans-serif'; rc.textAlign='center';
    rc.fillStyle='rgba(218,165,32,0.6)'; rc.shadowBlur=0;
    rc.fillText('HAY',x,y+bh/2+10);

    rc.restore();
  }
}

// ── PARTICLES ──
function hwDrawParticles(rc, ringsOnly){
  for(const p of H.particles){
    if(ringsOnly && !p.isRing) continue;
    if(!ringsOnly && p.isRing) continue;
    const fa=p.life/p.maxLife;
    rc.save(); rc.globalAlpha=fa*0.9;
    if(p.isRing){
      rc.strokeStyle=p.color; rc.lineWidth=2;
      rc.shadowColor=p.color; rc.shadowBlur=8;
      rc.beginPath(); rc.arc(p.x,p.y,p.radius,0,Math.PI*2); rc.stroke();
    } else {
      rc.shadowColor=p.color; rc.shadowBlur=6; rc.fillStyle=p.color;
      rc.beginPath(); rc.arc(p.x,p.y,p.size*fa,0,Math.PI*2); rc.fill();
    }
    rc.restore();
  }
}

// ── BASE DRAWING ──
function hwDrawBase(rc, base){
  const faction=base.side==='player'?H.playerFaction:H.enemyFaction;
  const cfg=HW_FACTIONS[faction];
  const x=base.x, y=base.y;
  rc.save();
  rc.shadowColor=cfg.color; rc.shadowBlur=18;

  // popup-open highlight
  if(H.buildPopupOpen && base.side==='player'){
    rc.save();
    const pulse=0.4+Math.sin(H.frame*0.15)*0.4;
    rc.strokeStyle=`rgba(80,200,80,${pulse})`;
    rc.lineWidth=4; rc.shadowColor='#44cc44'; rc.shadowBlur=20;
    rc.beginPath(); rc.arc(x,y,70,0,Math.PI*2); rc.stroke();
    rc.restore();
  }
  // selected ring
  if(base.selected){
    rc.save();
    rc.strokeStyle='#44cc44'; rc.lineWidth=3;
    rc.shadowColor='#44cc44'; rc.shadowBlur=14;
    rc.beginPath(); rc.ellipse(x,y,72,36,0,0,Math.PI*2); rc.stroke();
    rc.restore();
  }

  // ── Farmhouse ──
  // stone foundation
  rc.fillStyle='#7a7a6a';
  rc.beginPath(); rc.roundRect(x-30,y+22,60,10,2); rc.fill();
  rc.strokeStyle='rgba(100,100,80,0.4)'; rc.lineWidth=0.8; rc.stroke();

  // wooden body
  const wGrad=rc.createLinearGradient(x-26,y-30,x+26,y+22);
  wGrad.addColorStop(0,'#8B6914'); wGrad.addColorStop(0.5,'#6B4914'); wGrad.addColorStop(1,'#5a3a10');
  rc.fillStyle=wGrad;
  rc.beginPath(); rc.roundRect(x-26,y-30,52,54,2); rc.fill();
  rc.strokeStyle='rgba(90,60,20,0.6)'; rc.lineWidth=1.2; rc.stroke();

  // wood plank lines
  rc.strokeStyle='rgba(60,40,10,0.25)'; rc.lineWidth=0.7;
  for(let py=-24;py<18;py+=8){
    rc.beginPath(); rc.moveTo(x-24,y+py); rc.lineTo(x+24,y+py); rc.stroke();
  }

  // peaked roof triangle
  rc.fillStyle='#8B4513';
  rc.beginPath(); rc.moveTo(x-30,y-30); rc.lineTo(x,y-60); rc.lineTo(x+30,y-30); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,50,10,0.6)'; rc.lineWidth=1; rc.stroke();
  // roof shingles
  rc.strokeStyle='rgba(60,30,5,0.3)'; rc.lineWidth=0.5;
  for(let ry=-50;ry<-30;ry+=6){
    const w2=30*(1-(ry+60)/30);
    rc.beginPath(); rc.moveTo(x-w2,y+ry+6); rc.lineTo(x+w2,y+ry+6); rc.stroke();
  }

  // stone chimney on right side
  rc.fillStyle='#6a6a6a';
  rc.fillRect(x+16,y-55,8,26);
  rc.strokeStyle='rgba(80,80,80,0.5)'; rc.lineWidth=0.6; rc.strokeRect(x+16,y-55,8,26);
  // chimney bricks
  rc.strokeStyle='rgba(50,50,50,0.3)'; rc.lineWidth=0.4;
  for(let cy=-52;cy<-30;cy+=5){
    rc.beginPath(); rc.moveTo(x+16,y+cy); rc.lineTo(x+24,y+cy); rc.stroke();
  }
  // smoke puff
  rc.fillStyle=`rgba(200,200,200,${0.12+Math.sin(H.frame*0.04)*0.06})`;
  rc.beginPath(); rc.arc(x+20,y-58,5,0,Math.PI*2); rc.fill();

  // door
  rc.fillStyle='#3a2010';
  rc.beginPath(); rc.roundRect(x-7,y+4,14,20,2); rc.fill();
  rc.strokeStyle='rgba(200,150,80,0.4)'; rc.lineWidth=0.7; rc.stroke();
  // door knob
  rc.fillStyle='#DAA520'; rc.beginPath(); rc.arc(x+4,y+14,1.5,0,Math.PI*2); rc.fill();

  // windows
  for(const wx of [-16,12]){
    rc.fillStyle='rgba(255,240,180,0.35)';
    rc.beginPath(); rc.roundRect(x+wx,y-16,8,10,1); rc.fill();
    rc.strokeStyle='rgba(139,90,43,0.5)'; rc.lineWidth=0.6; rc.stroke();
    // cross pane
    rc.strokeStyle='rgba(90,60,20,0.4)'; rc.lineWidth=0.5;
    rc.beginPath(); rc.moveTo(x+wx+4,y-16); rc.lineTo(x+wx+4,y-6); rc.stroke();
    rc.beginPath(); rc.moveTo(x+wx,y-11); rc.lineTo(x+wx+8,y-11); rc.stroke();
  }

  rc.restore();
}

// ── BASE HP BARS ──
function hwDrawBaseHP(rc){
  const bases=H.entities.filter(e=>e.type==='base');
  for(const base of bases){
    const faction=base.side==='player'?H.playerFaction:H.enemyFaction;
    const cfg=HW_FACTIONS[faction];
    const bw=60, bh=6;
    hwDrawHealthBar(rc, base.x, base.y-80, bw, bh, base.hp, base.maxHp);
    rc.strokeStyle='rgba(255,255,255,0.1)'; rc.lineWidth=0.5;
    rc.strokeRect(base.x-bw/2,base.y-80,bw,bh);

    if(base.underConstruction){
      hwDrawConstructionOverlay(rc,base.x,base.y,base.buildProgress/base.buildTime,cfg.color,60);
    } else if(base.queue && base.queue.length>0){
      hwDrawQueueBar(rc,base.x,base.y-90,bw,base.trainTimer,base.queue[0].time,base.queue.length);
    }
  }
}

// ── CONSTRUCTION OVERLAY ──
function hwDrawConstructionOverlay(rc, x, y, progress, color, halfH){
  rc.save();
  rc.globalAlpha=0.45+Math.sin(H.frame*0.15)*0.1;
  rc.fillStyle='rgba(0,0,0,0.45)';
  rc.fillRect(x-32,y-halfH,64,halfH+20);
  rc.globalAlpha=1;
  // scaffolding poles (wooden)
  rc.strokeStyle='rgba(139,90,43,0.8)'; rc.lineWidth=1.5;
  for(const px of [-24,24]){
    rc.beginPath(); rc.moveTo(x+px,y+20); rc.lineTo(x+px,y-halfH); rc.stroke();
  }
  for(const py of [-halfH+10, -halfH*0.5, -halfH*0.15]){
    rc.beginPath(); rc.moveTo(x-24,y+py); rc.lineTo(x+24,y+py); rc.stroke();
  }
  // progress bar
  const bw=52;
  rc.fillStyle='rgba(0,0,0,0.7)'; rc.fillRect(x-bw/2,y-halfH-12,bw,6);
  rc.fillStyle='#DAA520';
  rc.fillRect(x-bw/2,y-halfH-12,bw*progress,6);
  rc.strokeStyle='rgba(218,165,32,0.4)'; rc.lineWidth=0.5; rc.strokeRect(x-bw/2,y-halfH-12,bw,6);
  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle='#DAA520';
  rc.shadowColor='#DAA520'; rc.shadowBlur=6;
  rc.fillText(`BUILDING ${Math.floor(progress*100)}%`,x,y-halfH-16);
  rc.restore();
}

// ── QUEUE BAR ──
function hwDrawQueueBar(rc, x, y, bw, timer, totalTime, count){
  const pct = totalTime>0 ? Math.min(1,(timer||0)/totalTime) : 0;
  rc.fillStyle='rgba(0,0,0,0.6)'; rc.fillRect(x-bw/2,y,bw,5);
  rc.fillStyle='#DAA520';
  rc.fillRect(x-bw/2,y,bw*pct,5);
  rc.strokeStyle='rgba(218,165,32,0.3)'; rc.lineWidth=0.5; rc.strokeRect(x-bw/2,y,bw,5);
  if(count>1){
    rc.fillStyle='rgba(40,30,10,0.9)';
    rc.fillRect(x+bw/2-14,y-1,14,8);
    rc.font='6px sans-serif'; rc.textAlign='center';
    rc.fillStyle='#DAA520'; rc.shadowBlur=0;
    rc.fillText(`x${count}`,x+bw/2-7,y+6);
  }
}

// ── MINIMAP ──
function hwDrawMinimap(){
  const mm=document.getElementById('hw-minimap');
  if(!mm) return;
  const mc=mm.getContext('2d');
  const MW=240, MH=98;
  const scaleX=MW/HW_RW, scaleY=MH/HW_RH;

  mc.clearRect(0,0,MW,MH);
  // dark green background
  mc.fillStyle='rgba(20,50,20,0.9)'; mc.fillRect(0,0,MW,MH);
  // grid hint
  mc.strokeStyle='rgba(100,160,60,0.08)'; mc.lineWidth=0.5;
  for(let x2=0;x2<MW;x2+=MW/10){ mc.beginPath(); mc.moveTo(x2,0); mc.lineTo(x2,MH); mc.stroke(); }
  for(let y2=0;y2<MH;y2+=MH/7){ mc.beginPath(); mc.moveTo(0,y2); mc.lineTo(MW,y2); mc.stroke(); }

  // hay nodes as yellow dots
  for(const n of H.hayNodes){
    if(n.hay<=0) continue;
    mc.fillStyle='rgba(218,165,32,0.6)';
    mc.beginPath(); mc.arc(n.x*scaleX, n.y*scaleY, 2, 0, Math.PI*2); mc.fill();
  }

  // entities
  for(const e of H.entities){
    const mx=e.x*scaleX, my=e.y*scaleY;
    const faction=e.side==='player'?H.playerFaction:H.enemyFaction;
    const cfg=HW_FACTIONS[faction];
    if(e.type==='base'){
      mc.fillStyle=cfg.color; mc.fillRect(mx-3,my-4,6,8);
    } else if(e.type==='structure'){
      mc.fillStyle=cfg.color; mc.globalAlpha=0.9;
      mc.beginPath(); mc.moveTo(mx,my-4); mc.lineTo(mx+4,my); mc.lineTo(mx,my+4); mc.lineTo(mx-4,my); mc.closePath(); mc.fill();
      mc.globalAlpha=1;
    } else if(e.type==='cannon'){
      mc.fillStyle='rgba(139,90,43,0.9)';
      mc.beginPath(); mc.arc(mx,my,3,0,Math.PI*2); mc.fill();
    } else if(e.type==='worker'){
      mc.fillStyle=hwHexAlpha(cfg.color,0.7);
      mc.beginPath(); mc.arc(mx,my,1.5,0,Math.PI*2); mc.fill();
    } else if(e.type==='warrior'){
      mc.fillStyle=e.subtype==='elite'?'#ffffff':cfg.color;
      mc.beginPath(); mc.arc(mx,my,e.subtype==='elite'?2.5:2,0,Math.PI*2); mc.fill();
    }
  }

  // projectiles
  for(const p of H.projectiles){
    mc.fillStyle='rgba(218,165,32,0.7)';
    mc.beginPath(); mc.arc(p.x*scaleX,p.y*scaleY,1,0,Math.PI*2); mc.fill();
  }

  // viewport rectangle
  mc.strokeStyle='rgba(255,255,255,0.6)'; mc.lineWidth=1.5;
  mc.strokeRect(H.camX*scaleX, H.camY*scaleY, HW_VW*scaleX, HW_VH*scaleY);

  // border
  mc.strokeStyle='rgba(139,90,43,0.4)'; mc.lineWidth=1;
  mc.strokeRect(0,0,MW,MH);
}

// ── UTILITY ──
function hwHexAlpha(hex,a){
  if(!hex||!hex.startsWith('#')) return `rgba(139,90,43,${a})`;
  const r=parseInt(hex.slice(1,3),16)||0, g=parseInt(hex.slice(3,5),16)||0, b=parseInt(hex.slice(5,7),16)||0;
  return `rgba(${r},${g},${b},${a})`;
}
