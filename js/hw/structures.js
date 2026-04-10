// ── HOMESTEAD WARS — STRUCTURE & CANNON DRAWING ──

function hwDrawStructure(rc, s){
  const faction=s.side==='player'?H.playerFaction:H.enemyFaction;
  const cfg=HW_FACTIONS[faction];
  const x=s.x, y=s.y;
  rc.save();
  rc.shadowColor=cfg.color; rc.shadowBlur=12;

  // selection ring
  if(s.selected) hwDrawSelectionRing(rc, x, y, 52, 26, 2.5);

  if(s.isBarracks){
    if(faction==='barnyard') _hwDrawBarnyard(rc,x,y,cfg,s);
    else if(faction==='creek') _hwDrawCoop(rc,x,y,cfg,s);
    else _hwDrawPerch(rc,x,y,cfg,s);
  } else {
    if(faction==='barnyard') _hwDrawPaddock(rc,x,y,cfg,s);
    else if(faction==='creek') _hwDrawRookery(rc,x,y,cfg,s);
    else _hwDrawDen(rc,x,y,cfg,s);
  }

  // HP bar
  const bw=48, bh=4;
  hwDrawHealthBar(rc, x, y-52, bw, bh, s.hp, s.maxHp);

  // construction overlay
  if(s.underConstruction){
    hwDrawConstructionOverlay(rc,x,y,s.buildProgress/s.buildTime,cfg.color,56);
  } else if(s.queue && s.queue.length>0){
    hwDrawQueueBar(rc,x,y-58,bw,s.trainTimer,s.queue[0].time,s.queue.length);
  }

  rc.restore();
}

// ═══════════════════════════════════════
//  BARRACKS
// ═══════════════════════════════════════

// ── BARNYARD (Red Barn) ──
function _hwDrawBarnyard(rc,x,y,cfg,s){
  // ground shadow
  rc.fillStyle='rgba(0,0,0,0.12)';
  rc.beginPath(); rc.ellipse(x,y+26,36,8,0,0,Math.PI*2); rc.fill();

  // barn body — red
  const bGrad=rc.createLinearGradient(x-28,y-24,x+28,y+24);
  bGrad.addColorStop(0,'#cc3322'); bGrad.addColorStop(0.5,'#aa2211'); bGrad.addColorStop(1,'#881a0e');
  rc.fillStyle=bGrad;
  rc.beginPath(); rc.roundRect(x-28,y-24,56,48,2); rc.fill();
  rc.strokeStyle='rgba(80,20,10,0.5)'; rc.lineWidth=1; rc.stroke();

  // white trim lines
  rc.strokeStyle='rgba(255,255,255,0.25)'; rc.lineWidth=0.7;
  for(let py=-18;py<20;py+=8){
    rc.beginPath(); rc.moveTo(x-26,y+py); rc.lineTo(x+26,y+py); rc.stroke();
  }

  // gambrel roof
  rc.fillStyle='#6a2210';
  rc.beginPath();
  rc.moveTo(x-32,y-24);
  rc.lineTo(x-20,y-40);
  rc.lineTo(x,y-50);
  rc.lineTo(x+20,y-40);
  rc.lineTo(x+32,y-24);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(60,15,5,0.6)'; rc.lineWidth=1; rc.stroke();

  // hay loft window
  rc.fillStyle='rgba(255,240,180,0.4)';
  rc.beginPath(); rc.arc(x,y-34,5,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(80,20,10,0.5)'; rc.lineWidth=0.6; rc.stroke();

  // big barn door
  rc.fillStyle='#5a1808';
  rc.beginPath(); rc.roundRect(x-14,y,28,24,2); rc.fill();
  rc.strokeStyle='rgba(200,150,80,0.35)'; rc.lineWidth=0.7; rc.stroke();
  // door X brace
  rc.strokeStyle='rgba(200,150,80,0.25)'; rc.lineWidth=1;
  rc.beginPath(); rc.moveTo(x-12,y+2); rc.lineTo(x+12,y+22); rc.stroke();
  rc.beginPath(); rc.moveTo(x+12,y+2); rc.lineTo(x-12,y+22); rc.stroke();
  // center divide
  rc.beginPath(); rc.moveTo(x,y); rc.lineTo(x,y+24); rc.stroke();

  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=4;
  rc.fillText('BARNYARD',x,y+38);
}

// ── CREEK COOP (Chicken Coop) ──
function _hwDrawCoop(rc,x,y,cfg,s){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+22,32,7,0,0,Math.PI*2); rc.fill();

  // coop body — light wood
  const cGrad=rc.createLinearGradient(x-24,y-18,x+24,y+20);
  cGrad.addColorStop(0,'#c4a060'); cGrad.addColorStop(0.5,'#a88840'); cGrad.addColorStop(1,'#8a7030');
  rc.fillStyle=cGrad;
  rc.beginPath(); rc.roundRect(x-24,y-18,48,38,2); rc.fill();
  rc.strokeStyle='rgba(80,60,20,0.5)'; rc.lineWidth=1; rc.stroke();

  // peaked roof
  rc.fillStyle='#5a4020';
  rc.beginPath(); rc.moveTo(x-28,y-18); rc.lineTo(x,y-42); rc.lineTo(x+28,y-18); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(50,30,10,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // wire mesh front (grid pattern)
  rc.strokeStyle='rgba(150,150,150,0.35)'; rc.lineWidth=0.5;
  for(let gx=-18;gx<=18;gx+=6){
    rc.beginPath(); rc.moveTo(x+gx,y-12); rc.lineTo(x+gx,y+8); rc.stroke();
  }
  for(let gy=-12;gy<=8;gy+=5){
    rc.beginPath(); rc.moveTo(x-18,y+gy); rc.lineTo(x+18,y+gy); rc.stroke();
  }

  // nesting boxes on side
  for(let ny=0;ny<3;ny++){
    rc.fillStyle='#6a5020';
    rc.fillRect(x+22,y-10+ny*10,8,8);
    rc.strokeStyle='rgba(80,50,10,0.4)'; rc.lineWidth=0.5;
    rc.strokeRect(x+22,y-10+ny*10,8,8);
    // straw in nest
    rc.fillStyle='#DAA520'; rc.globalAlpha=0.4;
    rc.beginPath(); rc.arc(x+26,y-6+ny*10,2,0,Math.PI*2); rc.fill();
    rc.globalAlpha=1;
  }

  // small door
  rc.fillStyle='#4a3018';
  rc.beginPath(); rc.roundRect(x-6,y+8,12,12,1); rc.fill();
  rc.strokeStyle='rgba(120,80,30,0.4)'; rc.lineWidth=0.5; rc.stroke();

  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=4;
  rc.fillText('COOP',x,y+34);
}

// ── WOODLAND PERCH (Tall post with platforms) ──
function _hwDrawPerch(rc,x,y,cfg,s){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+24,20,6,0,0,Math.PI*2); rc.fill();

  // main trunk
  rc.fillStyle='#5a4020';
  rc.fillRect(x-4,y-40,8,64);
  rc.strokeStyle='rgba(60,30,10,0.5)'; rc.lineWidth=0.8;
  rc.strokeRect(x-4,y-40,8,64);
  // bark texture
  rc.strokeStyle='rgba(40,25,10,0.3)'; rc.lineWidth=0.5;
  for(let ty=-36;ty<20;ty+=6){
    rc.beginPath(); rc.moveTo(x-3,y+ty); rc.lineTo(x+3,y+ty+3); rc.stroke();
  }

  // platforms at different heights
  for(const [py,pw] of [[-36,28],[-18,24],[-2,20]]){
    rc.fillStyle='#6a5028';
    rc.beginPath(); rc.roundRect(x-pw/2,y+py,pw,5,1); rc.fill();
    rc.strokeStyle='rgba(80,50,15,0.5)'; rc.lineWidth=0.6; rc.stroke();
    // small railing posts
    rc.strokeStyle='rgba(100,70,30,0.5)'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(x-pw/2+2,y+py); rc.lineTo(x-pw/2+2,y+py-6); rc.stroke();
    rc.beginPath(); rc.moveTo(x+pw/2-2,y+py); rc.lineTo(x+pw/2-2,y+py-6); rc.stroke();
  }

  // leaf canopy at top
  rc.fillStyle='rgba(60,120,30,0.5)';
  rc.beginPath(); rc.ellipse(x,y-44,18,10,0,0,Math.PI*2); rc.fill();
  rc.fillStyle='rgba(80,140,40,0.4)';
  rc.beginPath(); rc.ellipse(x-6,y-46,10,7,0,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.ellipse(x+8,y-42,10,7,0,0,Math.PI*2); rc.fill();

  // branches
  rc.strokeStyle='#5a4020'; rc.lineWidth=2; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(x-2,y-30); rc.lineTo(x-16,y-36); rc.stroke();
  rc.beginPath(); rc.moveTo(x+2,y-26); rc.lineTo(x+14,y-32); rc.stroke();

  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=4;
  rc.fillText('PERCH',x,y+34);
}

// ═══════════════════════════════════════
//  ELITE STRUCTURES
// ═══════════════════════════════════════

// ── BARNYARD PADDOCK (Fenced enclosure with trough) ──
function _hwDrawPaddock(rc,x,y,cfg,s){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+20,38,10,0,0,Math.PI*2); rc.fill();

  // ground (dirt)
  rc.fillStyle='rgba(139,90,43,0.2)';
  rc.beginPath(); rc.ellipse(x,y+10,34,18,0,0,Math.PI*2); rc.fill();

  // fence posts (6 corners)
  const posts=[[-30,-12],[30,-12],[-30,18],[30,18],[-10,-18],[10,-18]];
  for(const [fx,fy] of posts){
    rc.fillStyle='#6a5020'; rc.fillRect(x+fx-2,y+fy-14,4,16);
    rc.strokeStyle='rgba(80,50,15,0.5)'; rc.lineWidth=0.5; rc.strokeRect(x+fx-2,y+fy-14,4,16);
  }
  // fence rails
  rc.strokeStyle='rgba(120,80,30,0.6)'; rc.lineWidth=2;
  rc.beginPath(); rc.moveTo(x-30,y-18); rc.lineTo(x-10,y-24); rc.lineTo(x+10,y-24); rc.lineTo(x+30,y-18); rc.stroke();
  rc.beginPath(); rc.moveTo(x-30,y+10); rc.lineTo(x+30,y+10); rc.stroke();
  rc.beginPath(); rc.moveTo(x-30,y-12); rc.lineTo(x-30,y+18); rc.stroke();
  rc.beginPath(); rc.moveTo(x+30,y-12); rc.lineTo(x+30,y+18); rc.stroke();

  // feeding trough
  rc.fillStyle='#5a4020';
  rc.beginPath(); rc.roundRect(x-12,y+2,24,8,2); rc.fill();
  rc.strokeStyle='rgba(80,50,15,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // hay in trough
  rc.fillStyle='#DAA520'; rc.globalAlpha=0.5;
  rc.beginPath(); rc.roundRect(x-10,y,20,4,1); rc.fill();
  rc.globalAlpha=1;

  // wooden gate
  rc.fillStyle='#7a6030';
  rc.beginPath(); rc.roundRect(x-6,y+10,12,10,1); rc.fill();
  rc.strokeStyle='rgba(100,70,20,0.5)'; rc.lineWidth=0.6; rc.stroke();
  rc.fillStyle='#555'; rc.beginPath(); rc.arc(x-5,y+12,1.5,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.arc(x-5,y+18,1.5,0,Math.PI*2); rc.fill();

  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=4;
  rc.fillText('PADDOCK',x,y+34);
}

// ── CREEK ROOKERY (Tall nest structure) ──
function _hwDrawRookery(rc,x,y,cfg,s){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+24,24,7,0,0,Math.PI*2); rc.fill();

  // central pole
  rc.fillStyle='#5a4a2a';
  rc.fillRect(x-3,y-38,6,62);
  rc.strokeStyle='rgba(60,40,15,0.5)'; rc.lineWidth=0.6;
  rc.strokeRect(x-3,y-38,6,62);

  // multiple nest levels (3 tiers)
  for(const [ny,nw] of [[-34,30],[-16,26],[2,22]]){
    rc.fillStyle='#8a7040';
    rc.beginPath(); rc.ellipse(x,y+ny+4,nw/2,6,0,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(100,70,30,0.4)'; rc.lineWidth=0.7; rc.stroke();
    // twigs sticking out
    rc.strokeStyle='rgba(120,90,40,0.5)'; rc.lineWidth=1; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(x-nw/2+2,y+ny+3); rc.lineTo(x-nw/2-4,y+ny); rc.stroke();
    rc.beginPath(); rc.moveTo(x+nw/2-2,y+ny+3); rc.lineTo(x+nw/2+4,y+ny); rc.stroke();
    // nest bowl
    rc.fillStyle='rgba(100,80,40,0.35)';
    rc.beginPath(); rc.ellipse(x,y+ny+2,nw/2-3,4,0,0,Math.PI); rc.fill();
  }

  // top feather decoration
  rc.strokeStyle='#5a4a2a'; rc.lineWidth=1.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(x,y-38); rc.lineTo(x,y-48); rc.stroke();
  rc.fillStyle='rgba(180,220,255,0.6)';
  rc.beginPath(); rc.moveTo(x,y-48); rc.lineTo(x+8,y-44); rc.lineTo(x,y-42); rc.closePath(); rc.fill();

  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=4;
  rc.fillText('ROOKERY',x,y+36);
}

// ── WOODLAND DEN (Burrow entrance) ──
function _hwDrawDen(rc,x,y,cfg,s){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+22,36,8,0,0,Math.PI*2); rc.fill();

  // earth mound
  const mGrad=rc.createRadialGradient(x,y+8,4,x,y+8,36);
  mGrad.addColorStop(0,'#6a5a30'); mGrad.addColorStop(0.5,'#4a3a20'); mGrad.addColorStop(1,'rgba(60,80,30,0.3)');
  rc.fillStyle=mGrad;
  rc.beginPath(); rc.ellipse(x,y+8,36,22,0,0,Math.PI*2); rc.fill();

  // grass on top of mound
  rc.strokeStyle='rgba(80,140,40,0.4)'; rc.lineWidth=1.5; rc.lineCap='round';
  for(let gx=-20;gx<=20;gx+=8){
    rc.beginPath(); rc.arc(x+gx,y-10,5,Math.PI*1.1,Math.PI*1.9); rc.stroke();
  }

  // burrow entrance
  rc.fillStyle='#1a1208';
  rc.beginPath(); rc.ellipse(x,y+6,14,12,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(80,50,15,0.5)'; rc.lineWidth=1; rc.stroke();

  // log framing around entrance
  rc.fillStyle='#5a4020';
  rc.save();
  rc.translate(x,y-5);
  rc.beginPath(); rc.ellipse(0,0,18,3,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(60,30,10,0.4)'; rc.lineWidth=0.5; rc.stroke();
  rc.restore();
  for(const sx of [-1,1]){
    rc.fillStyle='#5a4020';
    rc.beginPath(); rc.ellipse(x+sx*14,y+4,3,14,0.1*sx,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(60,30,10,0.4)'; rc.lineWidth=0.5; rc.stroke();
  }

  // decorative bone
  rc.fillStyle='#d8d0c0'; rc.globalAlpha=0.4;
  rc.beginPath(); rc.ellipse(x+18,y+14,4,3,0,0,Math.PI*2); rc.fill();
  rc.globalAlpha=1;

  // small mushroom
  rc.fillStyle='#cc6644';
  rc.beginPath(); rc.ellipse(x-22,y+12,4,2.5,0,0,Math.PI); rc.fill();
  rc.fillStyle='#8a6a40';
  rc.fillRect(x-23,y+12,2,5);

  rc.font='7px sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=4;
  rc.fillText('DEN',x,y+36);
}

// ═══════════════════════════════════════
//  CANNON / DEFENSIVE STRUCTURE
// ═══════════════════════════════════════

function hwDrawCannon(rc, c){
  const x=c.x, y=c.y, angle=c.aimAngle||0;
  const faction=c.faction||'barnyard';
  const cfg=HW_FACTIONS[faction];
  rc.save();

  if(faction==='barnyard') _hwDrawScarecrow(rc,x,y,angle,c);
  else if(faction==='creek') _hwDrawEggCatapult(rc,x,y,angle,c);
  else _hwDrawBeehive(rc,x,y,angle,c);

  // selection ring
  if(c.selected){
    rc.strokeStyle='#44cc44'; rc.lineWidth=2; rc.shadowColor='#44cc44'; rc.shadowBlur=10;
    rc.beginPath(); rc.ellipse(x,y,26,14,0,0,Math.PI*2); rc.stroke();
  }
  // HP bar
  if(c.hp<c.maxHp) hwDrawHealthBar(rc, x, y-30, 36, 4, c.hp, c.maxHp);

  const labels={barnyard:'SCARECROW',creek:'CATAPULT',woodland:'BEEHIVE'};
  rc.font='6px sans-serif'; rc.textAlign='center';
  rc.fillStyle=hwHexAlpha(cfg.color,0.8); rc.shadowBlur=0;
  rc.fillText(labels[faction]||'CANNON',x,y+28);
  rc.restore();

  if(c.underConstruction){
    hwDrawConstructionOverlay(rc,x,y,c.buildProgress/c.buildTime,cfg.color,24);
  }
}

// ── Scarecrow (Barnyard cannon) ──
function _hwDrawScarecrow(rc,x,y,angle,c){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+16,14,5,0,0,Math.PI*2); rc.fill();

  // post
  rc.fillStyle='#6a5020';
  rc.fillRect(x-2,y-20,4,36);
  rc.strokeStyle='rgba(60,30,10,0.4)'; rc.lineWidth=0.5; rc.strokeRect(x-2,y-20,4,36);

  // crossbar (rotates with aim)
  rc.save(); rc.translate(x,y-12); rc.rotate(angle);
  rc.fillStyle='#5a4018';
  rc.fillRect(-18,-2,36,4);
  rc.strokeStyle='rgba(60,30,10,0.4)'; rc.lineWidth=0.5; rc.strokeRect(-18,-2,36,4);
  // gloves at ends
  rc.fillStyle='#8a6a30';
  rc.beginPath(); rc.arc(-18,0,4,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.arc(18,0,4,0,Math.PI*2); rc.fill();
  rc.restore();

  // head (burlap sack)
  rc.fillStyle='#c4a060';
  rc.beginPath(); rc.arc(x,y-24,8,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(100,70,30,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // stitch eyes
  rc.strokeStyle='#5a4020'; rc.lineWidth=1.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(x-4,y-26); rc.lineTo(x-2,y-24); rc.stroke();
  rc.beginPath(); rc.moveTo(x-2,y-26); rc.lineTo(x-4,y-24); rc.stroke();
  rc.beginPath(); rc.moveTo(x+2,y-26); rc.lineTo(x+4,y-24); rc.stroke();
  rc.beginPath(); rc.moveTo(x+4,y-26); rc.lineTo(x+2,y-24); rc.stroke();
  // stitch mouth
  rc.beginPath(); rc.moveTo(x-3,y-20); rc.lineTo(x+3,y-20); rc.stroke();

  // straw hat
  rc.fillStyle='#DAA520';
  rc.beginPath(); rc.ellipse(x,y-30,12,3,0,0,Math.PI*2); rc.fill();
  rc.fillStyle='#c49a10';
  rc.beginPath(); rc.moveTo(x-8,y-30); rc.lineTo(x,y-40); rc.lineTo(x+8,y-30); rc.closePath(); rc.fill();

  // firing glow
  if((c.cooldown||0)>c.rate*0.7){
    rc.fillStyle='rgba(255,100,50,0.4)'; rc.shadowColor='#ff4400'; rc.shadowBlur=12;
    rc.beginPath(); rc.arc(x,y-24,12,0,Math.PI*2); rc.fill();
  }
}

// ── Egg Catapult (Creek cannon) ──
function _hwDrawEggCatapult(rc,x,y,angle,c){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+14,18,5,0,0,Math.PI*2); rc.fill();

  // base frame
  rc.fillStyle='#6a5a30';
  rc.beginPath(); rc.roundRect(x-16,y+2,32,12,2); rc.fill();
  rc.strokeStyle='rgba(80,50,15,0.4)'; rc.lineWidth=0.7; rc.stroke();

  // wheels
  for(const wx of [-12,12]){
    rc.fillStyle='#4a3a18';
    rc.beginPath(); rc.arc(x+wx,y+14,5,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(60,40,10,0.5)'; rc.lineWidth=0.7; rc.stroke();
    rc.strokeStyle='rgba(80,50,15,0.4)'; rc.lineWidth=0.5;
    for(let sp=0;sp<4;sp++){
      const sa=(sp/4)*Math.PI*2;
      rc.beginPath(); rc.moveTo(x+wx,y+14); rc.lineTo(x+wx+Math.cos(sa)*4,y+14+Math.sin(sa)*4); rc.stroke();
    }
  }

  // arm (rotates with aim)
  rc.save(); rc.translate(x,y);
  rc.rotate(angle-Math.PI/4);
  rc.fillStyle='#7a6030';
  rc.fillRect(-2,-24,4,28);
  rc.strokeStyle='rgba(80,50,15,0.4)'; rc.lineWidth=0.5; rc.strokeRect(-2,-24,4,28);
  // basket at end
  rc.fillStyle='#8a7040';
  rc.beginPath(); rc.arc(0,-24,6,0,Math.PI); rc.fill();
  rc.strokeStyle='rgba(100,70,25,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // egg in basket
  rc.fillStyle='#f0ead0';
  rc.beginPath(); rc.ellipse(0,-26,3,4,0,0,Math.PI*2); rc.fill();
  rc.restore();

  // rope/spring
  rc.strokeStyle='rgba(120,100,60,0.4)'; rc.lineWidth=1;
  rc.beginPath(); rc.moveTo(x-8,y+2); rc.lineTo(x,y-6); rc.stroke();
  rc.beginPath(); rc.moveTo(x+8,y+2); rc.lineTo(x,y-6); rc.stroke();

  // firing flash
  if((c.cooldown||0)>c.rate*0.7){
    rc.fillStyle='rgba(255,255,200,0.4)'; rc.shadowColor='#ffdd44'; rc.shadowBlur=12;
    rc.beginPath(); rc.arc(x,y-20,10,0,Math.PI*2); rc.fill();
  }
}

// ── Beehive (Woodland cannon) ──
function _hwDrawBeehive(rc,x,y,angle,c){
  rc.fillStyle='rgba(0,0,0,0.1)';
  rc.beginPath(); rc.ellipse(x,y+16,14,5,0,0,Math.PI*2); rc.fill();

  // pole
  rc.fillStyle='#5a4a28';
  rc.fillRect(x-2,y-8,4,24);
  rc.strokeStyle='rgba(50,35,10,0.4)'; rc.lineWidth=0.5; rc.strokeRect(x-2,y-8,4,24);

  // hive body — layered domes
  const hGrad=rc.createRadialGradient(x,y-16,2,x,y-16,14);
  hGrad.addColorStop(0,'#e8c840'); hGrad.addColorStop(0.6,'#DAA520'); hGrad.addColorStop(1,'#b8860b');
  rc.fillStyle=hGrad;
  for(let hy=0;hy<4;hy++){
    const rw=12-hy*1.5, ryy=y-8-hy*5;
    rc.beginPath(); rc.ellipse(x,ryy,rw,4,0,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(139,100,20,0.4)'; rc.lineWidth=0.5; rc.stroke();
  }
  // top dome
  rc.beginPath(); rc.arc(x,y-26,6,Math.PI,Math.PI*2); rc.fill();

  // entrance hole
  rc.fillStyle='#3a2a08';
  rc.beginPath(); rc.ellipse(x,y-12,3,4,0,0,Math.PI*2); rc.fill();

  // buzzing bees (orbit around hive, angle-influenced)
  const t=H.frame||0;
  for(let b=0;b<3;b++){
    const ba=(b/3)*Math.PI*2+t*0.12+angle;
    const br=16+Math.sin(t*0.08+b)*4;
    const bx=x+Math.cos(ba)*br, by=y-16+Math.sin(ba)*br*0.5;
    rc.fillStyle='#ffdd00'; rc.shadowColor='#ffdd00'; rc.shadowBlur=4;
    rc.beginPath(); rc.arc(bx,by,1.5,0,Math.PI*2); rc.fill();
    rc.fillStyle='rgba(255,255,255,0.5)';
    rc.beginPath(); rc.ellipse(bx+1,by-1,1.5,0.8,0,0,Math.PI*2); rc.fill();
  }

  // firing glow
  if((c.cooldown||0)>c.rate*0.7){
    rc.fillStyle='rgba(255,200,50,0.4)'; rc.shadowColor='#ffaa00'; rc.shadowBlur=14;
    rc.beginPath(); rc.arc(x,y-16,14,0,Math.PI*2); rc.fill();
  }
}
