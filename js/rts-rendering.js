function rtsDraw(){
  const rc=document.getElementById('rts-canvas').getContext('2d');
  rc.clearRect(0,0,VW,VH);

  // apply camera transform
  rc.save();
  rc.translate(-camX, -camY);

  drawRTSBackground(rc);
  drawGoldNodes(rc);

  // structure placement preview ring follows mouse
  if(buildStructureMode && rtsMouseWorld){
    rc.save();
    const pulse=0.3+Math.sin(rtsFrame*0.2)*0.3;
    rc.strokeStyle=`rgba(255,220,0,${0.5+pulse})`;
    rc.lineWidth=2; rc.setLineDash([8,6]);
    rc.shadowColor='#ffdd00'; rc.shadowBlur=16;
    rc.beginPath(); rc.arc(rtsMouseWorld.x, rtsMouseWorld.y, 40, 0, Math.PI*2); rc.stroke();
    rc.setLineDash([]);
    // cross
    rc.strokeStyle=`rgba(255,220,0,0.7)`; rc.lineWidth=1.5; rc.shadowBlur=8;
    rc.beginPath(); rc.moveTo(rtsMouseWorld.x-14,rtsMouseWorld.y); rc.lineTo(rtsMouseWorld.x+14,rtsMouseWorld.y); rc.stroke();
    rc.beginPath(); rc.moveTo(rtsMouseWorld.x,rtsMouseWorld.y-14); rc.lineTo(rtsMouseWorld.x,rtsMouseWorld.y+14); rc.stroke();
    rc.font='8px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle='rgba(255,220,80,0.8)'; rc.shadowBlur=0;
    rc.fillText('RIGHT-CLICK TO PLACE', rtsMouseWorld.x, rtsMouseWorld.y-48);
    rc.restore();
  }

  drawRTSParticles(rc);
  for(const e of rtsEntities){
    if(e.type==='base') drawRTSBase(rc,e);
    if(e.type==='structure') drawRTSStructure(rc,e);
    if(e.type==='cannon') drawRTSCannon(rc,e);
  }
  for(const e of rtsEntities){
    if(e.type==='worker') drawRTSWorker(rc,e);
    if(e.type==='warrior') drawRTSWarrior(rc,e);
  }
  drawRTSProjectiles(rc);
  drawRTSBaseHP(rc);

  rc.restore();

  // minimap (drawn in screen space, no camera transform)
  drawMinimap();
}

function drawMinimap(){
  const mm=document.getElementById('rts-minimap');
  if(!mm) return;
  const mc=mm.getContext('2d');
  const MW=240, MH=98;
  const scaleX=MW/RW, scaleY=MH/RH;

  mc.clearRect(0,0,MW,MH);
  // background
  mc.fillStyle='rgba(2,8,16,0.9)'; mc.fillRect(0,0,MW,MH);
  // grid hint
  mc.strokeStyle='rgba(0,200,255,0.05)'; mc.lineWidth=0.5;
  for(let x2=0;x2<MW;x2+=MW/10){mc.beginPath();mc.moveTo(x2,0);mc.lineTo(x2,MH);mc.stroke();}
  for(let y2=0;y2<MH;y2+=MH/7){mc.beginPath();mc.moveTo(0,y2);mc.lineTo(MW,y2);mc.stroke();}

  // gold nodes
  for(const n of rtsGoldNodes){
    mc.fillStyle='rgba(255,220,50,0.6)';
    mc.beginPath(); mc.arc(n.x*scaleX, n.y*scaleY, 2, 0, Math.PI*2); mc.fill();
  }

  // entities
  for(const e of rtsEntities){
    const mx=e.x*scaleX, my=e.y*scaleY;
    const pCfg=FACTION_CFG[e.side==='player'?rtsPlayerFaction:rtsEnemyFaction];
    if(e.type==='base'){
      mc.fillStyle=pCfg.color; mc.fillRect(mx-3,my-4,6,8);
    } else if(e.type==='structure'){
      mc.fillStyle=pCfg.color; mc.globalAlpha=0.9;
      mc.beginPath(); mc.moveTo(mx,my-4); mc.lineTo(mx+4,my); mc.lineTo(mx,my+4); mc.lineTo(mx-4,my); mc.closePath(); mc.fill();
      mc.globalAlpha=1;
    } else if(e.type==='cannon'){
      mc.fillStyle='rgba(180,140,60,0.9)';
      mc.beginPath(); mc.arc(mx,my,3,0,Math.PI*2); mc.fill();
    } else if(e.type==='worker'){
      mc.fillStyle=hexAlpha(pCfg.color,0.7);
      mc.beginPath(); mc.arc(mx,my,1.5,0,Math.PI*2); mc.fill();
    } else if(e.type==='warrior'){
      mc.fillStyle=e.subtype==='elite'?'#ffffff':pCfg.color;
      mc.beginPath(); mc.arc(mx,my,e.subtype==='elite'?2.5:2,0,Math.PI*2); mc.fill();
    }
  }

  // projectiles
  for(const p of rtsProjectiles){
    mc.fillStyle=p.type==='bullet'?'rgba(255,220,80,0.8)':'rgba(0,220,255,0.8)';
    mc.beginPath(); mc.arc(p.x*scaleX,p.y*scaleY,1,0,Math.PI*2); mc.fill();
  }

  // viewport rect
  mc.strokeStyle='rgba(0,245,255,0.6)'; mc.lineWidth=1.5;
  mc.strokeRect(camX*scaleX, camY*scaleY, VW*scaleX, VH*scaleY);

  // border
  mc.strokeStyle='rgba(0,245,255,0.3)'; mc.lineWidth=1;
  mc.strokeRect(0,0,MW,MH);
}

function drawRTSBackground(rc){
  // dark ground — full world size
  const bg=rc.createLinearGradient(0,0,RW,RH);
  bg.addColorStop(0,'#060d18'); bg.addColorStop(0.5,'#030a14'); bg.addColorStop(1,'#060d18');
  rc.fillStyle=bg; rc.fillRect(0,0,RW,RH);

  // grid — only draw visible portion for perf
  const gx0=Math.floor(camX/60)*60, gy0=Math.floor(camY/60)*60;
  rc.strokeStyle='rgba(0,200,255,0.035)'; rc.lineWidth=1;
  for(let x2=gx0;x2<camX+VW+60;x2+=60){rc.beginPath();rc.moveTo(x2,camY);rc.lineTo(x2,camY+VH);rc.stroke();}
  for(let y2=gy0;y2<camY+VH+60;y2+=60){rc.beginPath();rc.moveTo(camX,y2);rc.lineTo(camX+VW,y2);rc.stroke();}

  // center divider line
  rc.strokeStyle='rgba(255,255,255,0.04)'; rc.lineWidth=2; rc.setLineDash([10,16]);
  rc.beginPath(); rc.moveTo(RW/2,0); rc.lineTo(RW/2,RH); rc.stroke();
  rc.setLineDash([]);

  // territory glows
  const pCfg=FACTION_CFG[rtsPlayerFaction], eCfg=FACTION_CFG[rtsEnemyFaction];
  const pg=rc.createLinearGradient(0,0,RW*0.35,0);
  pg.addColorStop(0,hexAlpha(pCfg.color,0.07)); pg.addColorStop(1,'transparent');
  rc.fillStyle=pg; rc.fillRect(0,0,RW*0.35,RH);
  const eg=rc.createLinearGradient(RW,0,RW*0.65,0);
  eg.addColorStop(0,hexAlpha(eCfg.color,0.07)); eg.addColorStop(1,'transparent');
  rc.fillStyle=eg; rc.fillRect(RW*0.65,0,RW*0.35,RH);

  // world border glow
  rc.strokeStyle='rgba(0,100,160,0.3)'; rc.lineWidth=6;
  rc.strokeRect(3,3,RW-6,RH-6);
}
function hexAlpha(hex,a){
  if(!hex||!hex.startsWith('#')) return `rgba(100,100,200,${a})`;
  const r=parseInt(hex.slice(1,3),16)||0, g=parseInt(hex.slice(3,5),16)||0, b=parseInt(hex.slice(5,7),16)||0;
  return `rgba(${r},${g},${b},${a})`;
}

function drawGoldNodes(rc){
  for(const node of rtsGoldNodes){
    rc.save();
    rc.shadowColor='#ffdd00'; rc.shadowBlur=18;
    // pile of gold
    const gGrad=rc.createRadialGradient(node.x,node.y,2,node.x,node.y,16);
    gGrad.addColorStop(0,'#fff8a0'); gGrad.addColorStop(0.4,'#ffcc00'); gGrad.addColorStop(1,'#aa7700');
    rc.fillStyle=gGrad;
    rc.beginPath(); rc.ellipse(node.x,node.y,14,9,0,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(255,220,0,0.5)'; rc.lineWidth=1; rc.stroke();
    // crystals on top
    for(let i=0;i<5;i++){
      const a=(i/5)*Math.PI*2, cr=8;
      const cx=node.x+Math.cos(a)*cr*0.6, cy=node.y+Math.sin(a)*cr*0.35-4;
      rc.fillStyle='#ffe066';
      rc.beginPath(); rc.moveTo(cx,cy-5); rc.lineTo(cx-2,cy+2); rc.lineTo(cx+2,cy+2); rc.closePath(); rc.fill();
    }
    // label
    rc.font='8px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle='rgba(255,220,100,0.6)';
    rc.fillText('GOLD',node.x,node.y+20);
    rc.restore();
  }
}

function drawRTSBase(rc, base){
  const cfg=FACTION_CFG[base.side==='player'?rtsPlayerFaction:rtsEnemyFaction];
  const x=base.x, y=base.y;
  rc.save();
  rc.shadowColor=cfg.color; rc.shadowBlur=24;

  // popup-open highlight on player base
  if(rtsBuildPopupOpen && base.side==='player'){
    rc.save();
    const pulse=0.4+Math.sin(rtsFrame*0.15)*0.4;
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

  if(base.side==='player'?rtsPlayerFaction==='roboto':rtsEnemyFaction==='roboto'){
    drawRTSFactory(rc,x,y,cfg);
  } else if(base.side==='player'?rtsPlayerFaction==='shadow':rtsEnemyFaction==='shadow'){
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
    rc.fillStyle=`rgba(255,140,0,${0.15+Math.sin(rtsFrame*0.05+cx)*0.1})`;
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
  const cfg=FACTION_CFG[s.side==='player'?rtsPlayerFaction:rtsEnemyFaction];
  const x=s.x, y=s.y;
  rc.save();
  rc.shadowColor=cfg.color; rc.shadowBlur=16;

  // selection ring
  if(s.selected){
    rc.strokeStyle='#00ff88'; rc.lineWidth=2.5; rc.shadowColor='#00ff88'; rc.shadowBlur=12;
    rc.beginPath(); rc.ellipse(x,y,52,26,0,0,Math.PI*2); rc.stroke();
  }

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
    // ground area
    rc.fillStyle='rgba(40,20,60,0.3)';
    rc.beginPath(); rc.ellipse(x,y+18,36,12,0,0,Math.PI*2); rc.fill();
    // fence posts (4 corners)
    for(const [fx,fy] of [[-24,-10],[24,-10],[-24,18],[24,18]]){
      rc.fillStyle='#1a0028'; rc.fillRect(x+fx-3,y+fy-12,6,14);
      rc.strokeStyle='rgba(100,0,200,0.4)'; rc.lineWidth=0.6; rc.strokeRect(x+fx-3,y+fy-12,6,14);
      // torch on top
      rc.fillStyle='rgba(160,60,255,0.8)'; rc.shadowColor='#8800cc'; rc.shadowBlur=10;
      rc.beginPath(); rc.arc(x+fx,y+fy-12,3,0,Math.PI*2); rc.fill();
    }
    // fence rails
    rc.strokeStyle='rgba(80,0,140,0.5)'; rc.lineWidth=1.5; rc.setLineDash([4,4]);
    rc.beginPath(); rc.rect(x-24,y-10,48,28); rc.stroke();
    rc.setLineDash([]);
    // training dummy / target posts (3)
    for(const [tx2,ty2] of [[-10,4],[0,0],[10,4]]){
      rc.strokeStyle='#3a1050'; rc.lineWidth=3; rc.lineCap='round';
      rc.beginPath(); rc.moveTo(x+tx2,y+ty2+14); rc.lineTo(x+tx2,y+ty2-14); rc.stroke();
      // dummy cross bar
      rc.strokeStyle='#4a1a60'; rc.lineWidth=2;
      rc.beginPath(); rc.moveTo(x+tx2-6,y+ty2-6); rc.lineTo(x+tx2+6,y+ty2-6); rc.stroke();
      // dummy head
      rc.fillStyle='#2a0840'; rc.beginPath(); rc.arc(x+tx2,y+ty2-18,5,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(120,0,200,0.5)'; rc.lineWidth=0.7; rc.stroke();
      // damage marks
      rc.strokeStyle='rgba(180,80,255,0.4)'; rc.lineWidth=0.6;
      rc.beginPath(); rc.moveTo(x+tx2-3,y+ty2-10); rc.lineTo(x+tx2+3,y+ty2-6); rc.stroke();
    }
    // entrance gate
    rc.fillStyle='#1a0028'; rc.fillRect(x-6,y+4,12,16);
    rc.strokeStyle='rgba(100,0,180,0.5)'; rc.lineWidth=0.7; rc.strokeRect(x-6,y+4,12,16);
    rc.font='6px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle=cfg.color; rc.shadowBlur=6;
    rc.fillText('TRAINING',x,y+38); rc.fillText('FIELD',x,y+46);
  }

  // HP bar
  const hpFrac=Math.max(0,s.hp/s.maxHp);
  const bw=48, bh=4;
  rc.fillStyle='rgba(0,0,0,0.6)'; rc.fillRect(x-bw/2,y-52,bw,bh);
  rc.fillStyle=hpFrac>0.5?'#00ff88':hpFrac>0.25?'#ffaa00':'#ff2244';
  rc.fillRect(x-bw/2,y-52,bw*hpFrac,bh);

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
  if(c.hp<c.maxHp){
    const bw=36, bh=4;
    rc.fillStyle='rgba(0,0,0,0.6)'; rc.fillRect(x-bw/2,y-30,bw,bh);
    const hpF=c.hp/c.maxHp;
    rc.fillStyle=hpF>0.5?'#00ff88':hpF>0.25?'#ffaa00':'#ff2244';
    rc.fillRect(x-bw/2,y-30,bw*hpF,bh);
  }
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
  rc.globalAlpha=0.45+Math.sin(rtsFrame*0.15)*0.1;
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

function drawRTSBaseHP(rc){
  const bases=rtsEntities.filter(e=>e.type==='base');
  for(const base of bases){
    const cfg=FACTION_CFG[base.side==='player'?rtsPlayerFaction:rtsEnemyFaction];
    const bw=60, bh=6;
    rc.fillStyle='rgba(0,0,0,0.6)'; rc.fillRect(base.x-bw/2,base.y-80,bw,bh);
    const frac=Math.max(0,base.hp/base.maxHp);
    rc.fillStyle=frac>0.5?'#00ff88':frac>0.25?'#ffaa00':'#ff2244';
    rc.fillRect(base.x-bw/2,base.y-80,bw*frac,bh);
    rc.strokeStyle='rgba(255,255,255,0.1)'; rc.lineWidth=0.5; rc.strokeRect(base.x-bw/2,base.y-80,bw,bh);
    // queue bar above HP bar
    if(base.queue && base.queue.length>0){
      drawQueueBar(rc,base.x,base.y-90,bw,base.trainTimer,base.queue[0].time,base.queue.length);
    }
  }
}

function drawRTSParticles(rc){
  for(const p of rtsParticles){
    const fa=p.life/p.maxLife;
    rc.save(); rc.globalAlpha=fa*0.9;
    if(p.isRing){
      p.radius+=3;
      rc.strokeStyle=p.color; rc.lineWidth=2;
      rc.shadowColor=p.color; rc.shadowBlur=8;
      rc.beginPath(); rc.arc(p.x,p.y,p.radius,0,Math.PI*2); rc.stroke();
    } else {
      rc.shadowColor=p.color; rc.shadowBlur=8; rc.fillStyle=p.color;
      rc.beginPath(); rc.arc(p.x,p.y,p.size*fa,0,Math.PI*2); rc.fill();
    }
    rc.restore();
  }
}

