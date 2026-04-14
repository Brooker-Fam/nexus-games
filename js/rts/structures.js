function drawRTSBase(rc, base){
  const cfg=FACTION_CFG[base.side==='player'?S.playerFaction:S.enemyFaction];
  const x=base.x, y=base.y;
  rc.save();
  rc.shadowColor=cfg.color; rc.shadowBlur=24;

  // popup-open highlight on player base
  if(S.buildPopupOpen && base.side==='player'){
    rc.save();
    const pulse=0.4+Math.sin(S.frame*0.15)*0.4;
    rc.strokeStyle=`rgba(0,255,136,${pulse})`;
    rc.lineWidth=4; rc.shadowColor='#00ff88'; rc.shadowBlur=20;
    rc.beginPath(); rc.arc(x,y,70,0,Math.PI*2); rc.stroke();
    rc.restore();
  }
  // selected ring
  if(base.selected){
    rc.save();
    rc.strokeStyle='#00ff88'; rc.lineWidth=3;
    rc.shadowColor='#00ff88'; rc.shadowBlur=14;
    rc.beginPath(); rc.ellipse(x,y,72,36,0,0,Math.PI*2); rc.stroke();
    rc.restore();
  }

  if(base.side==='player'?S.playerFaction==='roboto':S.enemyFaction==='roboto'){
    drawRTSFactory(rc,x,y,cfg);
  } else if(base.side==='player'?S.playerFaction==='shadow':S.enemyFaction==='shadow'){
    drawRTSTemple(rc,x,y,cfg,'shadow');
  } else {
    drawRTSTemple(rc,x,y,cfg,'prism');
  }

  rc.restore();
}

function drawRTSTemple(rc,x,y,cfg,variant){
  // base platform
  rc.fillStyle=variant==='shadow'?'#0a0015':'#e8f8ff';
  rc.beginPath(); rc.roundRect(x-30,y+28,60,10,2); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=1; rc.stroke();
  // main structure
  const tGrad=rc.createLinearGradient(x-25,y-40,x+25,y+30);
  if(variant==='shadow'){ tGrad.addColorStop(0,'#1a0030'); tGrad.addColorStop(1,'#05000f'); }
  else { tGrad.addColorStop(0,'#ddf4ff'); tGrad.addColorStop(1,'#a8dcf0'); }
  rc.fillStyle=tGrad;
  rc.beginPath(); rc.roundRect(x-25,y-36,50,66,3); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=1.2; rc.stroke();
  // columns
  for(const cx of [x-20,x,x+20]){
    const colGrad=rc.createLinearGradient(cx-3,y-34,cx+3,y+28);
    colGrad.addColorStop(0,variant==='shadow'?'#2a0050':'#ffffff');
    colGrad.addColorStop(1,variant==='shadow'?'#0a0020':'#b0d8ee');
    rc.fillStyle=colGrad; rc.fillRect(cx-3,y-34,6,60);
    rc.strokeStyle=variant==='shadow'?'rgba(140,0,255,0.3)':'rgba(100,200,255,0.4)'; rc.lineWidth=0.6; rc.strokeRect(cx-3,y-34,6,60);
  }
  // peaked roof
  rc.fillStyle=variant==='shadow'?'#220044':'#c0e8ff';
  rc.beginPath(); rc.moveTo(x-28,y-36); rc.lineTo(x,y-60); rc.lineTo(x+28,y-36); rc.closePath(); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=1; rc.stroke();
  // glow orb / totem at peak
  const orbGrad=rc.createRadialGradient(x,y-62,0,x,y-62,8);
  orbGrad.addColorStop(0,variant==='shadow'?'#cc44ff':'#ffffff');
  orbGrad.addColorStop(0.5,cfg.color); orbGrad.addColorStop(1,'transparent');
  rc.fillStyle=orbGrad; rc.beginPath(); rc.arc(x,y-62,8,0,Math.PI*2); rc.fill();
  // door
  rc.fillStyle='rgba(0,0,0,0.6)';
  rc.beginPath(); rc.roundRect(x-8,y+4,16,24,2); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=0.7; rc.stroke();
  // window
  rc.fillStyle=hexAlpha(cfg.color,0.4);
  rc.beginPath(); rc.arc(x,y-12,5,0,Math.PI*2); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=0.6; rc.stroke();
}

function drawRTSFactory(rc,x,y,cfg){
  // base slab
  rc.fillStyle='#111118';
  rc.beginPath(); rc.roundRect(x-32,y+26,64,12,2); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=1; rc.stroke();
  // main block
  const fGrad=rc.createLinearGradient(x-28,y-38,x+28,y+28);
  fGrad.addColorStop(0,'#2a2a30'); fGrad.addColorStop(1,'#0e0e14');
  rc.fillStyle=fGrad; rc.beginPath(); rc.roundRect(x-28,y-38,56,66,3); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=1.2; rc.stroke();
  // vent slats
  for(let vy=-22;vy<=10;vy+=8){
    rc.fillStyle='#050508'; rc.fillRect(x-22,y+vy,44,5);
    rc.strokeStyle='rgba(255,120,0,0.2)'; rc.lineWidth=0.5; rc.strokeRect(x-22,y+vy,44,5);
  }
  // chimney stacks
  for(const cx of [x-12,x+12]){
    rc.fillStyle='#1a1a20'; rc.fillRect(cx-4,y-60,8,24);
    rc.strokeStyle=cfg.color; rc.lineWidth=0.8; rc.strokeRect(cx-4,y-60,8,24);
    // smoke puff
    rc.fillStyle=`rgba(255,140,0,${0.15+Math.sin(S.frame*0.05+cx)*0.1})`;
    rc.beginPath(); rc.arc(cx,y-64,6,0,Math.PI*2); rc.fill();
  }
  // power core
  const cGrad=rc.createRadialGradient(x,y-4,0,x,y-4,9);
  cGrad.addColorStop(0,'#ffe066'); cGrad.addColorStop(0.5,'#ff8800'); cGrad.addColorStop(1,'transparent');
  rc.fillStyle=cGrad; rc.beginPath(); rc.arc(x,y-4,9,0,Math.PI*2); rc.fill();
  // door
  rc.fillStyle='rgba(0,0,0,0.7)'; rc.beginPath(); rc.roundRect(x-9,y+6,18,22,1); rc.fill();
  rc.strokeStyle=cfg.color; rc.lineWidth=0.7; rc.stroke();
}

function drawRTSStructure(rc, s){
  const cfg=FACTION_CFG[s.side==='player'?S.playerFaction:S.enemyFaction];
  const x=s.x, y=s.y;
  rc.save();
  rc.shadowColor=cfg.color; rc.shadowBlur=16;

  if(s.selected) drawSelectionRing(rc, x, y, 52, 26, 2.5);

  if(s.structType==='shrine'){
    // ── SHRINE (Prism) ── circular crystal altar
    // base ring
    rc.fillStyle='rgba(180,240,255,0.12)';
    rc.beginPath(); rc.ellipse(x,y+22,36,10,0,0,Math.PI*2); rc.fill();
    // outer pillars (4)
    for(let i=0;i<4;i++){
      const a=(i/4)*Math.PI*2, pr=26;
      const px2=x+Math.cos(a)*pr, py2=y+Math.sin(a)*pr*0.4-4;
      const pGrad=rc.createLinearGradient(px2-4,py2-18,px2+4,py2+4);
      pGrad.addColorStop(0,'#e8f8ff'); pGrad.addColorStop(1,'#88ccee');
      rc.fillStyle=pGrad; rc.fillRect(px2-3,py2-18,6,22);
      rc.strokeStyle='rgba(100,200,255,0.4)'; rc.lineWidth=0.6; rc.strokeRect(px2-3,py2-18,6,22);
    }
    // main altar disc
    const dGrad=rc.createRadialGradient(x,y-4,2,x,y-4,22);
    dGrad.addColorStop(0,'#ddf4ff'); dGrad.addColorStop(0.5,'#88ccee'); dGrad.addColorStop(1,'#2255aa');
    rc.fillStyle=dGrad; rc.beginPath(); rc.ellipse(x,y-4,22,10,0,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(100,200,255,0.6)'; rc.lineWidth=1; rc.stroke();
    // central crystal
    const cGrad=rc.createLinearGradient(x,y-28,x,y-4);
    cGrad.addColorStop(0,'#ffffff'); cGrad.addColorStop(0.4,'#88ddff'); cGrad.addColorStop(1,'#2266cc');
    rc.fillStyle=cGrad;
    rc.beginPath(); rc.moveTo(x,y-30); rc.lineTo(x-8,y-12); rc.lineTo(x,y-4); rc.lineTo(x+8,y-12); rc.closePath(); rc.fill();
    rc.strokeStyle='rgba(180,240,255,0.7)'; rc.lineWidth=0.8; rc.stroke();
    // orbiting spark
    const oa=(s.frame||0)*0.06;
    rc.fillStyle='rgba(180,240,255,0.9)'; rc.shadowColor='#aaffff'; rc.shadowBlur=12;
    rc.beginPath(); rc.arc(x+Math.cos(oa)*18,y-12+Math.sin(oa)*6,3,0,Math.PI*2); rc.fill();
    rc.beginPath(); rc.arc(x+Math.cos(oa+Math.PI)*18,y-12+Math.sin(oa+Math.PI)*6,2,0,Math.PI*2); rc.fill();
    // label
    rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=6;
    rc.fillText('SHRINE',x,y+30);

  } else if(s.structType==='darkgen'){
    // ── DARKNESS GENERATOR (Shadow) ── jagged dark obelisk
    rc.fillStyle='rgba(80,0,180,0.1)';
    rc.beginPath(); rc.ellipse(x,y+24,32,8,0,0,Math.PI*2); rc.fill();
    // crackling base ring
    rc.strokeStyle='rgba(100,0,200,0.5)'; rc.lineWidth=2;
    rc.beginPath(); rc.ellipse(x,y+20,28,7,0,0,Math.PI*2); rc.stroke();
    // main obelisk
    const oGrad=rc.createLinearGradient(x-14,y-36,x+14,y+20);
    oGrad.addColorStop(0,'#110020'); oGrad.addColorStop(0.5,'#1a0030'); oGrad.addColorStop(1,'#050008');
    rc.fillStyle=oGrad;
    rc.beginPath();
    rc.moveTo(x,y-40); rc.lineTo(x-14,y-20); rc.lineTo(x-18,y+20);
    rc.lineTo(x+18,y+20); rc.lineTo(x+14,y-20); rc.closePath();
    rc.fill(); rc.strokeStyle='rgba(120,0,255,0.6)'; rc.lineWidth=1.2; rc.stroke();
    // dark energy lines on obelisk
    rc.strokeStyle='rgba(100,0,180,0.4)'; rc.lineWidth=0.7;
    for(let vy=-28;vy<18;vy+=8){
      const wid=14-Math.abs(vy)*0.3;
      rc.beginPath(); rc.moveTo(x-wid,y+vy); rc.lineTo(x+wid,y+vy); rc.stroke();
    }
    // purple core orb
    const corG=rc.createRadialGradient(x,y-10,0,x,y-10,12);
    corG.addColorStop(0,'#dd88ff'); corG.addColorStop(0.5,'#8800cc'); corG.addColorStop(1,'transparent');
    rc.fillStyle=corG; rc.shadowColor='#aa00ff'; rc.shadowBlur=20;
    rc.beginPath(); rc.arc(x,y-10,12,0,Math.PI*2); rc.fill();
    // crackling arcs
    for(let i=0;i<3;i++){
      const a=(i/3)*Math.PI*2+(s.frame||0)*0.08;
      rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8;
      rc.beginPath(); rc.moveTo(x,y-10);
      rc.lineTo(x+Math.cos(a)*16+(Math.random()-0.5)*6,y-10+Math.sin(a)*10+(Math.random()-0.5)*4);
      rc.stroke();
    }
    rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=8;
    rc.fillText('DARK SHRINE',x,y+32);

  } else {
    // ── ARMORY (Roboto) ── chunky fortified building
    rc.fillStyle='rgba(120,60,0,0.15)';
    rc.beginPath(); rc.ellipse(x,y+26,34,9,0,0,Math.PI*2); rc.fill();
    // base slab
    const bGrad=rc.createLinearGradient(x-32,y+20,x+32,y+26);
    bGrad.addColorStop(0,'#1a1208'); bGrad.addColorStop(1,'#0a0804');
    rc.fillStyle=bGrad; rc.beginPath(); rc.roundRect(x-32,y+14,64,12,2); rc.fill();
    rc.strokeStyle='rgba(200,100,0,0.4)'; rc.lineWidth=0.8; rc.stroke();
    // main armory block
    const mGrad=rc.createLinearGradient(x-26,y-30,x+26,y+14);
    mGrad.addColorStop(0,'#2e2820'); mGrad.addColorStop(0.5,'#1e1810'); mGrad.addColorStop(1,'#0e0c08');
    rc.fillStyle=mGrad; rc.beginPath(); rc.roundRect(x-26,y-28,52,42,3); rc.fill();
    rc.strokeStyle='rgba(180,90,0,0.5)'; rc.lineWidth=1.2; rc.stroke();
    // weapon racks / vent slats
    for(let vy=-18;vy<8;vy+=7){
      rc.fillStyle='#080604'; rc.fillRect(x-20,y+vy,40,5);
      rc.strokeStyle='rgba(200,100,0,0.2)'; rc.lineWidth=0.4; rc.strokeRect(x-20,y+vy,40,5);
    }
    // turret on roof
    const tGrad=rc.createLinearGradient(x-12,y-42,x+12,y-28);
    tGrad.addColorStop(0,'#3a3020'); tGrad.addColorStop(1,'#1a1408');
    rc.fillStyle=tGrad; rc.beginPath(); rc.roundRect(x-12,y-42,24,14,2); rc.fill();
    rc.strokeStyle='rgba(255,130,0,0.5)'; rc.lineWidth=0.8; rc.stroke();
    // turret barrel pointing right
    rc.fillStyle='#0e0c08'; rc.fillRect(x+12,y-38,16,4);
    rc.strokeStyle='rgba(255,120,0,0.5)'; rc.lineWidth=0.6; rc.strokeRect(x+12,y-38,16,4);
    // power core
    const pGrad=rc.createRadialGradient(x,y-6,0,x,y-6,7);
    pGrad.addColorStop(0,'#ffe066'); pGrad.addColorStop(0.5,'#ff8800'); pGrad.addColorStop(1,'transparent');
    rc.fillStyle=pGrad; rc.shadowColor='#ff8800'; rc.shadowBlur=14;
    rc.beginPath(); rc.arc(x,y-6,7,0,Math.PI*2); rc.fill();
    // status light
    const bl=(s.frame||0)%40<20;
    rc.fillStyle=bl?'#ff4400':'#441100'; rc.beginPath(); rc.arc(x+18,y-36,2.5,0,Math.PI*2); rc.fill();
    rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=6;
    rc.fillText('ARMORY',x,y+32);
  }

  // ── BARRACKS (Roboto) ──
  if(s.structType==='barracks'){
    // slab
    rc.fillStyle='#111118'; rc.beginPath(); rc.roundRect(x-30,y+22,60,10,2); rc.fill();
    rc.strokeStyle=cfg.color; rc.lineWidth=0.8; rc.stroke();
    // main block
    const bGrad=rc.createLinearGradient(x-26,y-30,x+26,y+22);
    bGrad.addColorStop(0,'#2a2220'); bGrad.addColorStop(1,'#0e0c08');
    rc.fillStyle=bGrad; rc.beginPath(); rc.roundRect(x-26,y-28,52,50,3); rc.fill();
    rc.strokeStyle=cfg.color; rc.lineWidth=1; rc.stroke();
    // entrance arch
    rc.fillStyle='rgba(0,0,0,0.7)'; rc.beginPath(); rc.roundRect(x-10,y+2,20,20,4); rc.fill();
    rc.strokeStyle='rgba(255,120,0,0.4)'; rc.lineWidth=0.7; rc.stroke();
    // windows
    for(const wx of [-14,14]){
      rc.fillStyle='rgba(255,140,0,0.3)'; rc.beginPath(); rc.roundRect(x+wx-4,y-18,8,10,2); rc.fill();
      rc.strokeStyle='rgba(255,120,0,0.4)'; rc.lineWidth=0.5; rc.stroke();
    }
    // sign / banner
    rc.fillStyle='#ff8800'; rc.globalAlpha=0.8;
    rc.fillRect(x-12,y-28,24,6);
    rc.globalAlpha=1;
    rc.strokeStyle='rgba(200,80,0,0.5)'; rc.lineWidth=0.5; rc.strokeRect(x-12,y-28,24,6);
    // flag pole
    rc.strokeStyle='#664422'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(x,y-28); rc.lineTo(x,y-44); rc.stroke();
    // flag
    rc.fillStyle='#ff6600';
    rc.beginPath(); rc.moveTo(x,y-44); rc.lineTo(x+14,y-40); rc.lineTo(x,y-36); rc.closePath(); rc.fill();
    rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=6;
    rc.fillText('BARRACKS',x,y+38);
  }

  // ── PORTAL (Prism) ──
  if(s.structType==='portal'){
    const t2=s.frame||0;
    // base ring glow
    rc.fillStyle='rgba(0,200,255,0.08)';
    rc.beginPath(); rc.ellipse(x,y+20,34,10,0,0,Math.PI*2); rc.fill();
    // outer stone arch
    const aGrad=rc.createLinearGradient(x-24,y-44,x+24,y+20);
    aGrad.addColorStop(0,'#c0d8ee'); aGrad.addColorStop(0.5,'#88aac8'); aGrad.addColorStop(1,'#4466aa');
    rc.fillStyle=aGrad;
    rc.beginPath();
    rc.moveTo(x-22,y+20); rc.lineTo(x-22,y-20);
    rc.bezierCurveTo(x-22,y-48,x+22,y-48,x+22,y-20);
    rc.lineTo(x+22,y+20); rc.lineTo(x+14,y+20);
    rc.lineTo(x+14,y-18); rc.bezierCurveTo(x+14,y-38,x-14,y-38,x-14,y-18);
    rc.lineTo(x-14,y+20); rc.closePath(); rc.fill();
    rc.strokeStyle='rgba(100,200,255,0.6)'; rc.lineWidth=1; rc.stroke();
    // portal void interior — swirling
    const vGrad=rc.createRadialGradient(x,y-10,2,x,y-10,18);
    vGrad.addColorStop(0,'#aaeeff'); vGrad.addColorStop(0.3,'#0088cc'); vGrad.addColorStop(0.7,'#002244'); vGrad.addColorStop(1,'#000022');
    rc.fillStyle=vGrad;
    rc.beginPath();
    rc.moveTo(x-14,y+20); rc.lineTo(x-14,y-18);
    rc.bezierCurveTo(x-14,y-38,x+14,y-38,x+14,y-18);
    rc.lineTo(x+14,y+20); rc.closePath(); rc.fill();
    // swirl rings
    for(let i=0;i<3;i++){
      const a=(t2*0.04+i*2.1)%(Math.PI*2);
      rc.strokeStyle=`rgba(100,220,255,${0.3+i*0.1})`; rc.lineWidth=1.2;
      rc.beginPath(); rc.ellipse(x,y-10,14-i*3,8-i*2,a,0,Math.PI*2); rc.stroke();
    }
    // sparkle centre
    const sparkle=rc.createRadialGradient(x,y-10,0,x,y-10,6);
    sparkle.addColorStop(0,'rgba(255,255,255,0.9)'); sparkle.addColorStop(1,'transparent');
    rc.fillStyle=sparkle; rc.beginPath(); rc.arc(x,y-10,6,0,Math.PI*2); rc.fill();
    // rune stones on arch
    for(const rx of [-18,18]){
      rc.fillStyle='rgba(100,200,255,0.7)'; rc.shadowColor='#aaffff'; rc.shadowBlur=8;
      rc.beginPath(); rc.arc(x+rx,y-22,3,0,Math.PI*2); rc.fill();
    }
    rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=6;
    rc.fillText('PORTAL',x,y+35);
  }

  // ── TRAINING FIELD (Shadow) ──
  if(s.structType==='trainingfield'){
    // ── TRAINING FIELD (Shadow) ── grassy combat field
    // grassy ground — radial green gradient
    const gGrad=rc.createRadialGradient(x,y+8,4,x,y+8,36);
    gGrad.addColorStop(0,'#1a3a0a'); gGrad.addColorStop(1,'#0c1f05');
    rc.fillStyle=gGrad;
    rc.beginPath(); rc.ellipse(x,y+8,38,18,0,0,Math.PI*2); rc.fill();
    // dirt path down middle
    rc.fillStyle='rgba(80,50,20,0.5)';
    rc.beginPath(); rc.roundRect(x-4,y-20,8,36,2); rc.fill();
    // deterministic grass tufts using position seed
    const seed=(s.x+s.y)*7;
    for(let gi=0;gi<8;gi++){
      const gx=x-30+((seed*gi+gi*17)%58);
      const gy=y-2+((seed*gi*3+gi*11)%20);
      rc.strokeStyle='rgba(60,140,20,0.7)'; rc.lineWidth=1.5;
      rc.beginPath(); rc.moveTo(gx,gy+4); rc.lineTo(gx-2,gy); rc.stroke();
      rc.beginPath(); rc.moveTo(gx,gy+4); rc.lineTo(gx+2,gy-1); rc.stroke();
    }
    // wooden fence posts (4 corners + rails)
    rc.strokeStyle='rgba(120,80,30,0.8)'; rc.lineWidth=1.5;
    rc.beginPath(); rc.rect(x-26,y-18,52,34); rc.stroke();
    for(const [fx,fy] of [[-26,-18],[26,-18],[-26,16],[26,16]]){
      rc.fillStyle='#5a3810'; rc.fillRect(x+fx-2,y+fy-4,4,10);
      // glowing post-tops
      rc.fillStyle='rgba(160,60,255,0.8)'; rc.shadowColor='#8800cc'; rc.shadowBlur=8;
      rc.beginPath(); rc.arc(x+fx,y+fy-4,2.5,0,Math.PI*2); rc.fill(); rc.shadowBlur=0;
    }
    // 3 scarecrow-style dummies
    for(const [tx2,ty2] of [[-12,0],[0,-4],[12,0]]){
      // stake
      rc.strokeStyle='#6b4a20'; rc.lineWidth=2.5; rc.lineCap='round';
      rc.beginPath(); rc.moveTo(x+tx2,y+ty2+12); rc.lineTo(x+tx2,y+ty2-16); rc.stroke();
      // cross arms (straw body)
      rc.strokeStyle='#9b7a3a'; rc.lineWidth=2;
      rc.beginPath(); rc.moveTo(x+tx2-7,y+ty2-8); rc.lineTo(x+tx2+7,y+ty2-8); rc.stroke();
      // cloth head
      rc.fillStyle='#8b6a40';
      rc.beginPath(); rc.arc(x+tx2,y+ty2-20,4,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(120,0,200,0.5)'; rc.lineWidth=0.8; rc.stroke();
      // slash marks (battle damage)
      rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8;
      rc.beginPath(); rc.moveTo(x+tx2-3,y+ty2-12); rc.lineTo(x+tx2+3,y+ty2-8); rc.stroke();
    }
    rc.font='6px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=6;
    rc.fillText('TRAINING',x,y+38); rc.fillText('FIELD',x,y+46);
  }

  if(s.structType==='warpconduit'){
    // ── WARP CONDUIT (Prism/Shadow) ── swirling portal ring on a pedestal
    const t=S.frame*0.04;
    // base pedestal
    rc.fillStyle='rgba(40,0,80,0.5)';
    rc.beginPath(); rc.ellipse(x,y+22,30,10,0,0,Math.PI*2); rc.fill();
    // outer ring glow
    for(let r=3;r>=1;r--){
      rc.strokeStyle=`rgba(${cfg.color.startsWith('#00')?'0,221,255':'150,50,255'},${0.15*r})`;
      rc.lineWidth=r*4;
      rc.beginPath(); rc.ellipse(x,y-4,26,14,0,0,Math.PI*2); rc.stroke();
    }
    // spinning portal ring
    rc.strokeStyle=cfg.color; rc.lineWidth=3;
    rc.shadowColor=cfg.color; rc.shadowBlur=20;
    rc.beginPath(); rc.ellipse(x,y-4,24,12,t,0,Math.PI*2); rc.stroke();
    // inner vortex
    const vg=rc.createRadialGradient(x,y-4,2,x,y-4,14);
    vg.addColorStop(0,'rgba(255,255,255,0.5)');
    vg.addColorStop(0.4,`${cfg.color}cc`);
    vg.addColorStop(1,'transparent');
    rc.fillStyle=vg; rc.beginPath(); rc.ellipse(x,y-4,14,7,0,0,Math.PI*2); rc.fill();
    // support struts
    for(let i=0;i<3;i++){
      const a=i/3*Math.PI*2;
      rc.strokeStyle=`rgba(${cfg.color.startsWith('#00')?'0,180,220':'120,40,200'},0.7)`;
      rc.lineWidth=2;
      rc.beginPath(); rc.moveTo(x+Math.cos(a)*26,y-4+Math.sin(a)*13);
      rc.lineTo(x+Math.cos(a)*18,y+18); rc.stroke();
    }
    rc.shadowBlur=6; rc.font='6px Orbitron,sans-serif'; rc.textAlign='center';
    rc.fillStyle=cfg.color; rc.fillText('WARP',x,y+36); rc.fillText('CONDUIT',x,y+44);
  }

  if(s.structType==='shipyard'){
    // ── SHIPYARD (Roboto) ── launch pad with scaffolding
    const t=S.frame*0.03;
    // pad base
    rc.fillStyle='#1a1208';
    rc.beginPath(); rc.rect(x-30,y+8,60,16); rc.fill();
    rc.strokeStyle='rgba(255,140,0,0.3)'; rc.lineWidth=1; rc.stroke();
    // landing pad stripes
    for(let i=0;i<4;i++){
      rc.fillStyle=i%2===0?'rgba(255,140,0,0.2)':'rgba(0,0,0,0)';
      rc.fillRect(x-30+i*15,y+8,15,16);
    }
    // launch ramp
    rc.fillStyle='#2a1a08';
    rc.beginPath(); rc.moveTo(x-10,y+8); rc.lineTo(x+10,y+8); rc.lineTo(x+6,y-16); rc.lineTo(x-6,y-16); rc.closePath(); rc.fill();
    rc.strokeStyle='rgba(255,160,0,0.4)'; rc.lineWidth=1; rc.stroke();
    // scaffolding arms
    rc.strokeStyle='rgba(200,130,0,0.6)'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(x-20,y-4); rc.lineTo(x-8,y-16); rc.stroke();
    rc.beginPath(); rc.moveTo(x+20,y-4); rc.lineTo(x+8,y-16); rc.stroke();
    // beacon pulse
    const pulse=0.5+Math.sin(t*4)*0.5;
    rc.fillStyle=`rgba(255,160,0,${pulse})`;
    rc.shadowColor='#ff8800'; rc.shadowBlur=12;
    rc.beginPath(); rc.arc(x,y-22,4,0,Math.PI*2); rc.fill();
    // label
    rc.shadowBlur=6; rc.font='6px Orbitron,sans-serif'; rc.textAlign='center';
    rc.fillStyle=cfg.color; rc.fillText('SHIP',x,y+34); rc.fillText('YARD',x,y+42);
  }

  if(s.structType==='oilrig'){
    // ── OIL RIG (Roboto) ── pump-jack derrick with animated piston
    const t=S.frame*0.04;
    // ground base plate
    rc.fillStyle='#1a1208';
    rc.beginPath(); rc.roundRect(x-28,y+14,56,10,2); rc.fill();
    rc.strokeStyle='rgba(200,120,0,0.4)'; rc.lineWidth=1; rc.stroke();
    // oil puddle
    rc.fillStyle='rgba(20,10,0,0.55)';
    rc.beginPath(); rc.ellipse(x,y+20,24,6,0,0,Math.PI*2); rc.fill();
    // derrick legs (A-frame)
    rc.strokeStyle='#2a2010'; rc.lineWidth=4;
    rc.beginPath(); rc.moveTo(x-22,y+14); rc.lineTo(x,y-36); rc.stroke();
    rc.beginPath(); rc.moveTo(x+22,y+14); rc.lineTo(x,y-36); rc.stroke();
    rc.beginPath(); rc.moveTo(x-22,y+14); rc.lineTo(x+22,y+14); rc.stroke();
    // cross-brace struts
    rc.strokeStyle='rgba(150,100,30,0.7)'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(x-18,y+4); rc.lineTo(x+18,y+4); rc.stroke();
    rc.beginPath(); rc.moveTo(x-12,y-12); rc.lineTo(x+12,y-12); rc.stroke();
    // crown block (top cap)
    rc.fillStyle='#2a1a08';
    rc.beginPath(); rc.roundRect(x-8,y-40,16,6,2); rc.fill();
    rc.strokeStyle='rgba(255,140,0,0.5)'; rc.lineWidth=1; rc.stroke();
    // walking beam (pivoting arm) — animated
    const beamAngle=Math.sin(t)*0.4;
    rc.save();
    rc.translate(x, y-34);
    rc.rotate(beamAngle);
    rc.fillStyle='#3a2810';
    rc.beginPath(); rc.roundRect(-20,-3,40,6,2); rc.fill();
    rc.strokeStyle='rgba(255,140,0,0.4)'; rc.lineWidth=1; rc.stroke();
    rc.restore();
    // piston rod — moves with beam
    const pistonY=y-16+Math.sin(t)*8;
    rc.strokeStyle='#888'; rc.lineWidth=3;
    rc.beginPath(); rc.moveTo(x+18,y-34+Math.sin(t)*6); rc.lineTo(x+18,pistonY); rc.stroke();
    rc.fillStyle='#555';
    rc.beginPath(); rc.roundRect(x+14,pistonY,8,5,1); rc.fill();
    // pipe going down to ground
    rc.strokeStyle='rgba(100,80,40,0.8)'; rc.lineWidth=4;
    rc.beginPath(); rc.moveTo(x+18,pistonY+5); rc.lineTo(x+18,y+14); rc.stroke();
    // oil drum on side
    rc.fillStyle='#1a0a00';
    rc.beginPath(); rc.roundRect(x-38,y+4,14,18,3); rc.fill();
    rc.strokeStyle='rgba(255,120,0,0.5)'; rc.lineWidth=1.5; rc.stroke();
    rc.strokeStyle='rgba(255,120,0,0.25)'; rc.lineWidth=1;
    for(const ly of [y+8,y+13,y+18]){ rc.beginPath(); rc.moveTo(x-37,ly); rc.lineTo(x-25,ly); rc.stroke(); }
    // oil level indicator (fill based on s.oil / s.maxOil)
    const oilPct=(s.oil||0)/(s.maxOil||200);
    const lvlH=Math.round(14*oilPct);
    rc.fillStyle=`rgba(20,80,0,${0.4+oilPct*0.5})`;
    rc.beginPath(); rc.rect(x-37,y+22-lvlH,12,lvlH); rc.fill();
    // flame flicker at tip
    const flicker=0.6+Math.sin(t*7)*0.4;
    rc.fillStyle=`rgba(255,${Math.round(100+flicker*100)},0,${flicker*0.8})`;
    rc.shadowColor='#ff6600'; rc.shadowBlur=10;
    rc.beginPath(); rc.arc(x,y-40,3+Math.sin(t*9)*1.5,0,Math.PI*2); rc.fill();
    rc.shadowBlur=0;
    // label
    rc.font='6px Orbitron,sans-serif'; rc.textAlign='center';
    rc.fillStyle=cfg.color; rc.fillText('OIL',x,y+34); rc.fillText('RIG',x,y+42);
  }

  // HP bar
  const bw=48, bh=4;
  drawHealthBar(rc, x, y-52, bw, bh, s.hp, s.maxHp);

  // ── CONSTRUCTION OVERLAY ──
  if(s.underConstruction){
    drawConstructionOverlay(rc,x,y,s.buildProgress/s.buildTime,cfg.color,56);
  }
  // ── TRAIN QUEUE PROGRESS ──
  else if(s.queue && s.queue.length>0){
    drawQueueBar(rc,x,y-58,bw,s.trainTimer,s.queue[0].time,s.queue.length);
  }

  rc.restore();
}

// ── CANNON TURRET ──
function drawRTSCannon(rc, c){
  const x=c.x, y=c.y, angle=c.aimAngle||0;
  const faction=c.faction||'roboto';
  rc.save();
  if(faction==='prism')       _drawCannonPrism(rc,x,y,angle,c);
  else if(faction==='shadow') _drawCannonShadow(rc,x,y,angle,c);
  else                        _drawCannonRoboto(rc,x,y,angle,c);
  // selection ring
  if(c.selected){
    rc.strokeStyle='#00ff88'; rc.lineWidth=2; rc.shadowColor='#00ff88'; rc.shadowBlur=10;
    rc.beginPath(); rc.ellipse(x,y,26,14,0,0,Math.PI*2); rc.stroke();
  }
  // HP bar
  if(c.hp<c.maxHp) drawHealthBar(rc, x, y-30, 36, 4, c.hp, c.maxHp);
  const _cLabels={prism:'PRISM GUN',shadow:'VOID CANNON',roboto:'TURRET'};
  const _cLabelColors={prism:'rgba(0,220,255,0.8)',shadow:'rgba(180,80,255,0.8)',roboto:'rgba(255,160,50,0.8)'};
  rc.font='6px Orbitron,sans-serif'; rc.textAlign='center';
  rc.fillStyle=_cLabelColors[faction]||'rgba(200,160,80,0.8)'; rc.shadowBlur=0;
  rc.fillText(_cLabels[faction]||'CANNON',x,y+28);
  rc.restore();
  if(c.underConstruction){
    const _cBuildCol={prism:'#00ddff',shadow:'#9922ff',roboto:'#ff8800'};
    drawConstructionOverlay(rc,x,y,c.buildProgress/c.buildTime,_cBuildCol[faction]||'#886633',24);
  }
}

// ── Prism cannon: hexagonal crystal base + energy projector barrel ──
function _drawCannonPrism(rc,x,y,angle,c){
  rc.fillStyle='rgba(0,100,200,0.12)';
  rc.beginPath(); rc.ellipse(x+2,y+2,22,10,0,0,Math.PI*2); rc.fill();
  // hexagonal crystal base
  rc.shadowColor='#00ddff'; rc.shadowBlur=14;
  const bg=rc.createRadialGradient(x-3,y-3,2,x,y,20);
  bg.addColorStop(0,'#0a2a3a'); bg.addColorStop(0.5,'#051520'); bg.addColorStop(1,'#02080e');
  rc.fillStyle=bg;
  rc.beginPath();
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2-Math.PI/6, r=20;
    i===0?rc.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):rc.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
  }
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(0,220,255,0.65)'; rc.lineWidth=1.2; rc.stroke();
  // crystal lattice lines
  rc.strokeStyle='rgba(0,245,255,0.3)'; rc.lineWidth=0.7;
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2-Math.PI/6;
    rc.beginPath(); rc.moveTo(x+Math.cos(a)*8,y+Math.sin(a)*8); rc.lineTo(x+Math.cos(a)*17,y+Math.sin(a)*17); rc.stroke();
  }
  rc.strokeStyle='rgba(0,200,255,0.2)'; rc.lineWidth=1;
  rc.beginPath();
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2-Math.PI/6, r=11;
    i===0?rc.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):rc.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
  }
  rc.closePath(); rc.stroke();
  // rotating energy projector
  rc.save(); rc.translate(x,y); rc.rotate(angle);
  const pg=rc.createRadialGradient(-2,-2,1,0,0,10);
  pg.addColorStop(0,'#0a2840'); pg.addColorStop(1,'#020a14');
  rc.fillStyle=pg; rc.beginPath(); rc.arc(0,0,10,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(0,220,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // sleek energy barrel
  rc.shadowColor='#00f5ff'; rc.shadowBlur=6;
  const bar=rc.createLinearGradient(0,-4,0,4);
  bar.addColorStop(0,'#0a3050'); bar.addColorStop(0.5,'#051828'); bar.addColorStop(1,'#020a14');
  rc.fillStyle=bar;
  rc.beginPath(); rc.moveTo(-2,-3); rc.lineTo(26,-3); rc.lineTo(28,0); rc.lineTo(26,3); rc.lineTo(-2,3); rc.closePath();
  rc.fill(); rc.strokeStyle='rgba(0,220,255,0.6)'; rc.lineWidth=0.8; rc.stroke();
  // glowing conduit lines
  rc.strokeStyle='rgba(0,245,255,0.35)'; rc.lineWidth=0.6;
  rc.beginPath(); rc.moveTo(2,-1.5); rc.lineTo(25,-1.5); rc.stroke();
  rc.beginPath(); rc.moveTo(2,1.5);  rc.lineTo(25,1.5);  rc.stroke();
  // crystal emitter tip
  rc.fillStyle='#0af5ff'; rc.shadowColor='#00f5ff'; rc.shadowBlur=8;
  rc.beginPath(); rc.moveTo(26,-4); rc.lineTo(32,0); rc.lineTo(26,4); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(0,245,255,0.8)'; rc.lineWidth=0.6; rc.stroke();
  // firing glow
  if((c.cooldown||0)>c.rate*0.7){
    const mg=rc.createRadialGradient(34,0,0,34,0,10);
    mg.addColorStop(0,'rgba(255,255,255,0.95)'); mg.addColorStop(0.3,'rgba(0,245,255,0.7)'); mg.addColorStop(1,'transparent');
    rc.fillStyle=mg; rc.beginPath(); rc.arc(34,0,10,0,Math.PI*2); rc.fill();
  }
  rc.restore();
}

// ── Shadow cannon: jagged void/obsidian base + gnarled dark barrel ──
function _drawCannonShadow(rc,x,y,angle,c){
  rc.fillStyle='rgba(80,0,120,0.15)';
  rc.beginPath(); rc.ellipse(x+2,y+2,22,10,0,0,Math.PI*2); rc.fill();
  // jagged 12-point obsidian base
  rc.shadowColor='#9922ff'; rc.shadowBlur=16;
  const bg=rc.createRadialGradient(x-3,y-3,2,x,y,20);
  bg.addColorStop(0,'#1a0030'); bg.addColorStop(0.6,'#0e0020'); bg.addColorStop(1,'#04000c');
  rc.fillStyle=bg;
  rc.beginPath();
  for(let i=0;i<12;i++){
    const a=(i/12)*Math.PI*2-Math.PI/12, r=i%2===0?20:14;
    i===0?rc.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):rc.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
  }
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(150,30,255,0.55)'; rc.lineWidth=1.2; rc.stroke();
  // void rune veins
  rc.strokeStyle='rgba(140,20,240,0.3)'; rc.lineWidth=0.7;
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2;
    rc.beginPath(); rc.moveTo(x,y); rc.lineTo(x+Math.cos(a)*13,y+Math.sin(a)*13); rc.stroke();
  }
  rc.strokeStyle='rgba(120,0,200,0.4)'; rc.lineWidth=1;
  rc.beginPath(); rc.arc(x,y,8,0,Math.PI*2); rc.stroke();
  // rotating void platform
  rc.save(); rc.translate(x,y); rc.rotate(angle);
  const pg=rc.createRadialGradient(-2,-2,1,0,0,10);
  pg.addColorStop(0,'#280050'); pg.addColorStop(1,'#0c0020');
  rc.fillStyle=pg; rc.beginPath(); rc.arc(0,0,10,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(150,30,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // gnarled bone-like barrel
  rc.shadowColor='#9922ff'; rc.shadowBlur=8;
  const bar=rc.createLinearGradient(0,-5,0,5);
  bar.addColorStop(0,'#280050'); bar.addColorStop(0.5,'#14002a'); bar.addColorStop(1,'#04000c');
  rc.fillStyle=bar;
  rc.beginPath();
  rc.moveTo(-2,-5); rc.lineTo(8,-4); rc.lineTo(14,-5); rc.lineTo(20,-4); rc.lineTo(26,-5);
  rc.lineTo(26,5);  rc.lineTo(20,4); rc.lineTo(14,5);  rc.lineTo(8,4);  rc.lineTo(-2,5);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(130,0,220,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // shadow veins along barrel
  rc.strokeStyle='rgba(150,30,255,0.4)'; rc.lineWidth=0.6;
  for(const bx of [6,12,18,24]){
    rc.beginPath(); rc.moveTo(bx,-4.5); rc.lineTo(bx,4.5); rc.stroke();
  }
  // void maw
  rc.fillStyle='#06000e'; rc.beginPath(); rc.ellipse(26,0,4,5,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(120,0,200,0.6)'; rc.lineWidth=0.7; rc.stroke();
  // firing glow
  if((c.cooldown||0)>c.rate*0.7){
    const mg=rc.createRadialGradient(26,0,0,26,0,10);
    mg.addColorStop(0,'rgba(220,120,255,0.95)'); mg.addColorStop(0.4,'rgba(80,0,180,0.6)'); mg.addColorStop(1,'transparent');
    rc.fillStyle=mg; rc.beginPath(); rc.arc(26,0,10,0,Math.PI*2); rc.fill();
  }
  rc.restore();
}

// ── Roboto cannon: industrial metal plate base + heavy mechanical barrel ──
function _drawCannonRoboto(rc,x,y,angle,c){
  rc.fillStyle='rgba(0,0,0,0.3)';
  rc.beginPath(); rc.ellipse(x+2,y+2,22,10,0,0,Math.PI*2); rc.fill();
  // chamfered metal plate base
  rc.shadowColor='#ff8800'; rc.shadowBlur=8;
  const bg=rc.createRadialGradient(x-3,y-3,2,x,y,20);
  bg.addColorStop(0,'#3a2808'); bg.addColorStop(0.5,'#221604'); bg.addColorStop(1,'#100a02');
  rc.fillStyle=bg;
  const bs=17, cut=5;
  rc.beginPath();
  rc.moveTo(x-bs+cut,y-bs); rc.lineTo(x+bs-cut,y-bs);
  rc.lineTo(x+bs,y-bs+cut); rc.lineTo(x+bs,y+bs-cut);
  rc.lineTo(x+bs-cut,y+bs); rc.lineTo(x-bs+cut,y+bs);
  rc.lineTo(x-bs,y+bs-cut); rc.lineTo(x-bs,y-bs+cut);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,140,30,0.55)'; rc.lineWidth=1.2; rc.stroke();
  // panel lines
  rc.strokeStyle='rgba(255,100,0,0.2)'; rc.lineWidth=0.7;
  rc.beginPath(); rc.moveTo(x-bs+3,y-bs); rc.lineTo(x-bs+3,y+bs); rc.stroke();
  rc.beginPath(); rc.moveTo(x+bs-3,y-bs); rc.lineTo(x+bs-3,y+bs); rc.stroke();
  rc.beginPath(); rc.moveTo(x-bs,y-bs+3); rc.lineTo(x+bs,y-bs+3); rc.stroke();
  rc.beginPath(); rc.moveTo(x-bs,y+bs-3); rc.lineTo(x+bs,y+bs-3); rc.stroke();
  // rivet bolts
  rc.fillStyle='rgba(255,120,20,0.65)';
  for(const [bx,by] of [[-bs+5,-bs+5],[bs-5,-bs+5],[bs-5,bs-5],[-bs+5,bs-5]]){
    rc.beginPath(); rc.arc(x+bx,y+by,2,0,Math.PI*2); rc.fill();
  }
  rc.strokeStyle='rgba(255,120,20,0.4)'; rc.lineWidth=1;
  rc.beginPath(); rc.arc(x,y,10,0,Math.PI*2); rc.stroke();
  // rotating turret
  rc.save(); rc.translate(x,y); rc.rotate(angle);
  const pg=rc.createRadialGradient(-2,-2,1,0,0,10);
  pg.addColorStop(0,'#3a1e04'); pg.addColorStop(1,'#140a02');
  rc.fillStyle=pg; rc.beginPath(); rc.arc(0,0,10,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(255,140,30,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // heavy mechanical barrel
  rc.shadowColor='#ff8800'; rc.shadowBlur=5;
  const bar=rc.createLinearGradient(0,-5,0,5);
  bar.addColorStop(0,'#3a1e04'); bar.addColorStop(0.5,'#200e02'); bar.addColorStop(1,'#080400');
  rc.fillStyle=bar;
  rc.beginPath();
  rc.moveTo(-2,-6); rc.lineTo(22,-6); rc.lineTo(26,-4); rc.lineTo(26,4); rc.lineTo(22,6); rc.lineTo(-2,6); rc.closePath();
  rc.fill(); rc.strokeStyle='rgba(255,120,30,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // reinforcement bands
  for(const bx of [3,9,15,21]){
    rc.strokeStyle='rgba(255,130,40,0.6)'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(bx,-5.5); rc.lineTo(bx,5.5); rc.stroke();
  }
  // vent slits on top
  rc.fillStyle='rgba(0,0,0,0.55)';
  for(const bx of [6,10,14,18]){ rc.fillRect(bx-1,-5.5,2,2); }
  // muzzle brake
  rc.fillStyle='#050200';
  rc.beginPath(); rc.moveTo(24,-5); rc.lineTo(28,-4); rc.lineTo(28,4); rc.lineTo(24,5); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(200,100,20,0.5)'; rc.lineWidth=0.7; rc.stroke();
  // firing glow
  if((c.cooldown||0)>c.rate*0.7){
    const mg=rc.createRadialGradient(30,0,0,30,0,9);
    mg.addColorStop(0,'rgba(255,220,80,0.95)'); mg.addColorStop(0.4,'rgba(255,100,0,0.6)'); mg.addColorStop(1,'transparent');
    rc.fillStyle=mg; rc.beginPath(); rc.arc(30,0,9,0,Math.PI*2); rc.fill();
  }
  rc.restore();
}

// ── CONSTRUCTION & QUEUE DRAW HELPERS ──
function drawConstructionOverlay(rc, x, y, progress, color, halfH){
  // semi-transparent overlay with scaffolding
  rc.save();
  rc.globalAlpha=0.45+Math.sin(S.frame*0.15)*0.1;
  rc.fillStyle='rgba(0,0,0,0.55)';
  rc.fillRect(x-32,y-halfH,64,halfH+20);
  rc.globalAlpha=1;
  // scaffolding poles
  rc.strokeStyle='rgba(180,140,60,0.8)'; rc.lineWidth=1.5;
  for(const px of [-24,24]){
    rc.beginPath(); rc.moveTo(x+px,y+20); rc.lineTo(x+px,y-halfH); rc.stroke();
  }
  for(const py of [-halfH+10, -halfH*0.5, -halfH*0.15]){
    rc.beginPath(); rc.moveTo(x-24,y+py); rc.lineTo(x+24,y+py); rc.stroke();
  }
  // progress bar
  const bw=52;
  rc.fillStyle='rgba(0,0,0,0.7)'; rc.fillRect(x-bw/2,y-halfH-12,bw,6);
  rc.fillStyle='#ffcc44';
  rc.fillRect(x-bw/2,y-halfH-12,bw*progress,6);
  rc.strokeStyle='rgba(255,200,80,0.4)'; rc.lineWidth=0.5; rc.strokeRect(x-bw/2,y-halfH-12,bw,6);
  // "BUILDING" text
  rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle='#ffcc44';
  rc.shadowColor='#ffcc00'; rc.shadowBlur=6;
  rc.fillText(`BUILDING ${Math.floor(progress*100)}%`,x,y-halfH-16);
  rc.restore();
}

function drawQueueBar(rc, x, y, bw, timer, totalTime, count){
  // train progress bar
  const pct = totalTime>0 ? Math.min(1,(timer||0)/totalTime) : 0;
  rc.fillStyle='rgba(0,0,0,0.6)'; rc.fillRect(x-bw/2,y,bw,5);
  rc.fillStyle='#00ddff';
  rc.fillRect(x-bw/2,y,bw*pct,5);
  rc.strokeStyle='rgba(0,220,255,0.3)'; rc.lineWidth=0.5; rc.strokeRect(x-bw/2,y,bw,5);
  // queue count badge
  if(count>1){
    rc.fillStyle='rgba(0,20,40,0.9)';
    rc.fillRect(x+bw/2-14,y-1,14,8);
    rc.font='6px Orbitron,sans-serif'; rc.textAlign='center';
    rc.fillStyle='#00ddff'; rc.shadowBlur=0;
    rc.fillText(`×${count}`,x+bw/2-7,y+6);
  }
}


//# sourceMappingURL=structures.js.map
