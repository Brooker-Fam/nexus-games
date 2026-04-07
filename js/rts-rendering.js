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

// ── DRAW WARRIORS ──
function drawRTSWarrior(rc,w){
  const cfg=FACTION_CFG[w.faction];
  const bob=Math.sin(w.frame*0.15)*1.5;
  const facing = w.side==='player'?1:-1;
  rc.save(); rc.translate(w.x, w.y+bob);
  if(facing===-1) rc.scale(-1,1);
  rc.shadowColor=cfg.color; rc.shadowBlur=12;

  if(w.subtype==='elite'){
    if(w.faction==='prism') drawEliteOracle(rc,cfg,w);
    else if(w.faction==='shadow') drawEliteDarkWarrior(rc,cfg,w);
    else drawEliteShockbot(rc,cfg,w);
  } else if(w.subtype==='wizard'){
    drawWizard(rc,cfg,w);
  } else if(w.subtype==='necromancer'){
    drawNecromancer(rc,cfg,w);
  } else if(w.subtype==='tank'){
    drawTankUnit(rc,cfg,w);
  } else {
    if(w.faction==='prism') drawWarriorPrism(rc,cfg,w);
    else if(w.faction==='shadow') drawWarriorShadow(rc,cfg,w);
    else drawWarriorRoboto(rc,cfg,w);
  }

  rc.restore();
  // selection ring
  if(w.selected){
    rc.save();
    rc.strokeStyle='#00ff88'; rc.lineWidth=2.5;
    rc.shadowColor='#00ff88'; rc.shadowBlur=12;
    rc.beginPath(); rc.ellipse(w.x,w.y,18,8,0,0,Math.PI*2); rc.stroke();
    rc.restore();
  }
  // HP bar
  if(w.hp<w.maxHp){
    const bw=20,bh=3;
    rc.fillStyle='rgba(0,0,0,0.5)'; rc.fillRect(w.x-bw/2,w.y-26,bw,bh);
    const frac=w.hp/w.maxHp;
    rc.fillStyle=frac>0.5?'#00ff88':frac>0.25?'#ffaa00':'#ff2244';
    rc.fillRect(w.x-bw/2,w.y-26,bw*frac,bh);
  }
}

function drawWarriorPrism(rc,cfg,w){
  const t = w.frame;
  const isAttacking = w.state==='attack';
  const isMarching  = w.state==='march';

  // leg swing while marching
  const legSwing = isMarching ? Math.sin(t*0.2)*12 : 0;

  // LEGS
  rc.strokeStyle='#88b8d0'; rc.lineWidth=3; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-3,8); rc.lineTo(-4+Math.sin(t*0.2)*4,18); rc.stroke();
  rc.beginPath(); rc.moveTo(3,8);  rc.lineTo(4-Math.sin(t*0.2)*4,18); rc.stroke();

  // ROBE — sways while marching
  const robeSway = isMarching ? Math.sin(t*0.2)*2 : 0;
  const rGrad=rc.createLinearGradient(-8,-20,8,8);
  rGrad.addColorStop(0,'#f0faff'); rGrad.addColorStop(1,'#70b8d8');
  rc.fillStyle=rGrad;
  rc.beginPath();
  rc.moveTo(-8,-4); rc.bezierCurveTo(-12+robeSway,0,-11+robeSway,8,-6+robeSway,8);
  rc.lineTo(6-robeSway,8); rc.bezierCurveTo(11-robeSway,8,12-robeSway,0,8,-4);
  rc.lineTo(4,-20); rc.lineTo(-4,-20); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,200,255,0.4)'; rc.lineWidth=0.7; rc.stroke();

  // STAFF + CAST ARM
  if(isAttacking){
    // casting pose: both arms extended forward, orb pulsing
    const castPulse = 1 + Math.sin(t*0.3)*0.3;
    rc.strokeStyle='#c0e4f8'; rc.lineWidth=3; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(-6,-14); rc.lineTo(-2,-4); rc.stroke();
    rc.beginPath(); rc.moveTo(6,-14); rc.lineTo(16,-8); rc.stroke();
    // staff thrust forward
    rc.strokeStyle='#88ccff'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(16,-8); rc.lineTo(28,-4); rc.stroke();
    // charging orb — bigger + flaring
    rc.shadowColor='#00ffff'; rc.shadowBlur=20*castPulse;
    const og=rc.createRadialGradient(28,-4,0,28,-4,10*castPulse);
    og.addColorStop(0,'#ffffff'); og.addColorStop(0.4,'#44ddff'); og.addColorStop(1,'transparent');
    rc.fillStyle=og; rc.beginPath(); rc.arc(28,-4,10*castPulse,0,Math.PI*2); rc.fill();
    // cast arcs
    for(let i=0;i<4;i++){
      const a=(i/4)*Math.PI*2+t*0.15;
      const cols=['#ff88cc','#88ffcc','#ffff66','#88aaff'];
      rc.strokeStyle=cols[i]; rc.lineWidth=1.2; rc.globalAlpha=0.7;
      rc.beginPath(); rc.arc(28,-4,14*castPulse,a,a+0.7); rc.stroke();
      rc.globalAlpha=1;
    }
  } else {
    // idle/march arms: one holds staff, other swings
    const armSwing = isMarching ? Math.sin(t*0.2)*8 : 0;
    rc.strokeStyle='#c0e4f8'; rc.lineWidth=3; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(-6,-14); rc.lineTo(-14+armSwing*0.3,-6+armSwing*0.1); rc.stroke();
    rc.beginPath(); rc.moveTo(6,-14);  rc.lineTo(14-armSwing*0.3,-6-armSwing*0.1); rc.stroke();
    // staff at side
    rc.strokeStyle='#88ccff'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(14,-6); rc.lineTo(18,8); rc.stroke();
    const og2=rc.createRadialGradient(13,-8,0,13,-8,7);
    og2.addColorStop(0,'#fff'); og2.addColorStop(0.4,'#44aaff'); og2.addColorStop(1,'transparent');
    rc.fillStyle=og2; rc.beginPath(); rc.arc(13,-8,7,0,Math.PI*2); rc.fill();
    // idle prism rays
    for(let ri=0;ri<4;ri++){
      const a=(ri/4)*Math.PI*2+t*0.04;
      const cols=['#ff88aa','#ffff44','#44ff88','#44aaff'];
      rc.strokeStyle=cols[ri]; rc.lineWidth=0.8; rc.globalAlpha=0.5;
      rc.beginPath(); rc.moveTo(13+Math.cos(a)*4,-8+Math.sin(a)*4); rc.lineTo(13+Math.cos(a)*12,-8+Math.sin(a)*12); rc.stroke();
      rc.globalAlpha=1;
    }
  }

  // HEAD
  rc.fillStyle='#fff0e8'; rc.beginPath(); rc.ellipse(0,-26,6,7,0,0,Math.PI*2); rc.fill();
  // silver hair
  rc.fillStyle='#cce8ff'; rc.beginPath(); rc.arc(0,-30,5,Math.PI,Math.PI*2); rc.fill();
  rc.beginPath(); rc.moveTo(-5,-28); rc.bezierCurveTo(-9,-20,-8,-10,-5,0); rc.lineTo(-3,0); rc.bezierCurveTo(-6,-10,-7,-20,-3,-28); rc.closePath(); rc.fill();
  // eyes — glow brighter when casting
  for(const ex of [-2,2]){
    const eg=rc.createRadialGradient(ex,-26,0,ex,-26,isAttacking?4:2.5);
    eg.addColorStop(0,'#fff'); eg.addColorStop(0.5,'#44ddff'); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-26,isAttacking?4:2.5,0,Math.PI*2); rc.fill();
  }
  // crown
  rc.fillStyle='#b0d8ff'; rc.shadowColor='#aaffff'; rc.shadowBlur=isAttacking?20:10;
  rc.beginPath(); rc.moveTo(-6,-32); rc.lineTo(-6,-36); rc.lineTo(-2,-34); rc.lineTo(0,-38); rc.lineTo(2,-34); rc.lineTo(6,-36); rc.lineTo(6,-32); rc.closePath(); rc.fill();
}

function drawWarriorShadow(rc,cfg,w){
  const t = w.frame;
  const isAttacking = w.state==='attack';
  const isMarching  = w.state==='march';

  // running legs — fast stride
  rc.strokeStyle='#1a0a2a'; rc.lineWidth=4; rc.lineCap='round';
  if(isMarching){
    const s=Math.sin(t*0.3);
    rc.beginPath(); rc.moveTo(-4,4); rc.lineTo(-8+s*8,16); rc.stroke();
    rc.beginPath(); rc.moveTo(4,4);  rc.lineTo(8-s*8,16); rc.stroke();
  } else {
    rc.beginPath(); rc.moveTo(-4,4); rc.lineTo(-6,14); rc.stroke();
    rc.beginPath(); rc.moveTo(4,4);  rc.lineTo(6,14);  rc.stroke();
  }

  // CAPE — billows behind while marching, swings on attack
  const capeBlow = isMarching ? -8 : isAttacking ? Math.sin(t*0.25)*6 : 0;
  const cGrad=rc.createLinearGradient(-10,-30,10,8);
  cGrad.addColorStop(0,'#120020'); cGrad.addColorStop(1,'#04000a');
  rc.fillStyle=cGrad;
  rc.beginPath();
  rc.moveTo(-6,-22);
  rc.bezierCurveTo(-18+capeBlow,-15,-20+capeBlow,0,-14+capeBlow,8);
  rc.lineTo(8,8); rc.bezierCurveTo(10,0,6,-14,6,-22); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,0,200,0.4)'; rc.lineWidth=0.7; rc.stroke();

  // BODY ARMOUR
  const aGrad=rc.createLinearGradient(-7,-22,7,6);
  aGrad.addColorStop(0,'#1e1030'); aGrad.addColorStop(1,'#0a0618');
  rc.fillStyle=aGrad;
  rc.beginPath(); rc.moveTo(-7,-4); rc.lineTo(-8,-20); rc.lineTo(8,-20); rc.lineTo(7,-4); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(120,40,220,0.5)'; rc.lineWidth=0.8; rc.stroke();
  // chest gem — pulses red on attack
  const gemPulse = isAttacking ? 0.6+Math.sin(t*0.4)*0.4 : 0.7;
  const gemG=rc.createRadialGradient(0,-13,0,0,-13,4);
  gemG.addColorStop(0,isAttacking?`rgba(255,50,50,${gemPulse})`:`rgba(200,100,255,${gemPulse})`);
  gemG.addColorStop(1,'rgba(100,0,200,0)');
  rc.fillStyle=gemG; rc.beginPath(); rc.arc(0,-13,4,0,Math.PI*2); rc.fill();

  // SWORD ARM + BLADE
  if(isAttacking){
    // slash animation: arm sweeps forward and down
    const slashAngle = Math.sin(t*0.3)*0.7 - 0.3;
    rc.save(); rc.rotate(slashAngle);
    // arm
    rc.strokeStyle='#1a0a2a'; rc.lineWidth=6; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(6,-18); rc.lineTo(20,-4); rc.stroke();
    // blade — full slash arc
    rc.shadowColor='#dd88ff'; rc.shadowBlur=20;
    const sGrad=rc.createLinearGradient(20,-4,42,-26);
    sGrad.addColorStop(0,'#ffffff'); sGrad.addColorStop(0.3,'#cc88ff'); sGrad.addColorStop(1,'#2a0080');
    rc.strokeStyle=sGrad; rc.lineWidth=4;
    rc.beginPath(); rc.moveTo(20,-4); rc.lineTo(42,-26); rc.stroke();
    rc.strokeStyle='rgba(255,220,255,0.7)'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(21,-5); rc.lineTo(43,-27); rc.stroke();
    // motion blur arc
    rc.strokeStyle='rgba(180,80,255,0.25)'; rc.lineWidth=8;
    rc.beginPath(); rc.arc(10,-14,22,  -Math.PI*0.6+slashAngle, -Math.PI*0.1+slashAngle); rc.stroke();
    // crossguard
    rc.strokeStyle='#3a1060'; rc.lineWidth=7; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(15,-10); rc.lineTo(24,-2); rc.stroke();
    rc.restore();
  } else {
    // sword at side, arm position depends on march vs idle
    const armBob = isMarching ? Math.sin(t*0.3)*4 : 0;
    rc.strokeStyle='#1a0a2a'; rc.lineWidth=5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(8,-18); rc.lineTo(18+armBob,-10+armBob*0.3); rc.stroke();
    rc.save(); rc.shadowColor='#cc88ff'; rc.shadowBlur=14;
    const sGrad2=rc.createLinearGradient(18,-10,36,-30);
    sGrad2.addColorStop(0,'#ddb8ff'); sGrad2.addColorStop(0.5,'#8833ee'); sGrad2.addColorStop(1,'#2a0080');
    rc.strokeStyle=sGrad2; rc.lineWidth=3;
    rc.beginPath(); rc.moveTo(18+armBob,-10); rc.lineTo(36+armBob,-30); rc.stroke();
    rc.strokeStyle='rgba(240,200,255,0.5)'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(19+armBob,-11); rc.lineTo(37+armBob,-31); rc.stroke();
    rc.restore();
    rc.strokeStyle='#3a1060'; rc.lineWidth=6; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(14+armBob,-14); rc.lineTo(22+armBob,-6); rc.stroke();
  }

  // HELMET
  const hGrad=rc.createLinearGradient(-8,-38,8,-24);
  hGrad.addColorStop(0,'#1e1035'); hGrad.addColorStop(1,'#0a0618');
  rc.fillStyle=hGrad; rc.beginPath(); rc.ellipse(0,-32,8,10,isMarching?Math.sin(t*0.3)*0.1:0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(120,40,220,0.6)'; rc.lineWidth=0.8; rc.stroke();
  // visor — brighter red on attack
  const vGrad=rc.createLinearGradient(-6,-33,6,-29);
  const vc = isAttacking ? 'rgba(255,50,50,' : 'rgba(200,120,255,';
  vGrad.addColorStop(0,vc+'0)'); vGrad.addColorStop(0.5,vc+'0.95)'); vGrad.addColorStop(1,vc+'0)');
  rc.fillStyle=vGrad; rc.beginPath(); rc.roundRect(-6,-34,12,5,2); rc.fill();
}

function drawWarriorRoboto(rc,cfg,w){
  const t = w.frame;
  const isAttacking = w.state==='attack';
  const isMarching  = w.state==='march';

  // LEGS — mechanical stride
  const stride = isMarching ? Math.sin(t*0.25)*10 : 0;
  for(const [lx, phase] of [[-5,0],[3,Math.PI]]){
    const step = isMarching ? Math.sin(t*0.25+phase)*4 : 0;
    rc.fillStyle='#2a2a2a'; rc.fillRect(lx,-4+step,6,12); rc.strokeStyle='rgba(200,80,0,0.3)'; rc.lineWidth=0.5; rc.strokeRect(lx,-4+step,6,12);
    rc.fillStyle='#1a1a1a'; rc.beginPath(); rc.roundRect(lx-2,8+step,10,4,1); rc.fill();
  }

  // TORSO — leans forward when marching
  const lean = isMarching ? 0.15 : 0;
  rc.save(); rc.rotate(lean);
  const tGrad=rc.createLinearGradient(-10,-24,10,0);
  tGrad.addColorStop(0,'#3a3a40'); tGrad.addColorStop(1,'#141416');
  rc.fillStyle=tGrad; rc.beginPath(); rc.roundRect(-10,-24,20,24,2); rc.fill();
  rc.strokeStyle='rgba(200,100,0,0.4)'; rc.lineWidth=0.8; rc.stroke();
  for(let vy=-18;vy<=-4;vy+=6){ rc.fillStyle='#050508'; rc.fillRect(-7,vy,14,4); }
  // power core — flashes on attack
  const coreFlash = isAttacking ? 0.5+Math.sin(t*0.5)*0.5 : 0.7;
  const cG=rc.createRadialGradient(0,-10,0,0,-10,5+coreFlash*3);
  cG.addColorStop(0,'#ffe066'); cG.addColorStop(0.5,`rgba(255,${isAttacking?50:136},0,${coreFlash})`); cG.addColorStop(1,'transparent');
  rc.fillStyle=cG; rc.beginPath(); rc.arc(0,-10,5+coreFlash*2,0,Math.PI*2); rc.fill();
  rc.restore();

  // LEFT ARM — swings when marching
  const leftSwing = isMarching ? Math.sin(t*0.25+Math.PI)*6 : 0;
  rc.fillStyle='#222'; rc.fillRect(-14,-22+leftSwing,5,16); rc.strokeStyle='rgba(180,80,0,0.3)'; rc.lineWidth=0.5; rc.strokeRect(-14,-22+leftSwing,5,16);

  // GUN ARM — recoil when attacking
  const recoil = isAttacking ? Math.max(0,Math.sin(t*0.6))*4 : 0;
  rc.fillStyle='#302010'; rc.fillRect(10-recoil,-22,6,14); rc.strokeStyle='rgba(255,120,0,0.4)'; rc.lineWidth=0.5; rc.strokeRect(10-recoil,-22,6,14);
  // 3 barrel cluster — recoil back and forth
  for(const [gx,gy] of [[14,-22],[16,-19],[18,-22]]){
    rc.fillStyle='#1a1008'; rc.fillRect(gx-recoil,gy,2,20); rc.strokeStyle='rgba(200,100,0,0.4)'; rc.lineWidth=0.4; rc.strokeRect(gx-recoil,gy,2,20);
  }
  // muzzle flash — bright when firing
  const flashSize = isAttacking ? 6+Math.sin(t*0.6)*5 : 3;
  const mg=rc.createRadialGradient(20-recoil,-1,0,20-recoil,-1,flashSize);
  mg.addColorStop(0,`rgba(255,230,150,${isAttacking?0.95:0.3})`);
  mg.addColorStop(0.5,`rgba(255,120,0,${isAttacking?0.7:0.1})`);
  mg.addColorStop(1,'transparent');
  rc.fillStyle=mg; rc.beginPath(); rc.arc(20-recoil,-1,flashSize,0,Math.PI*2); rc.fill();
  if(isAttacking && Math.sin(t*0.6)>0.6){
    // muzzle spike
    rc.strokeStyle='rgba(255,220,100,0.8)'; rc.lineWidth=2; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(20-recoil,-1); rc.lineTo(32-recoil,-1); rc.stroke();
  }

  // HEAD
  const hG=rc.createLinearGradient(-8,-38,8,-24);
  hG.addColorStop(0,'#3a3a40'); hG.addColorStop(1,'#181820');
  rc.fillStyle=hG; rc.beginPath(); rc.roundRect(-8,-38,16,14,2); rc.fill();
  rc.strokeStyle='rgba(180,80,0,0.4)'; rc.lineWidth=0.7; rc.stroke();
  // visor — orange normally, red flash when attacking
  const vG=rc.createLinearGradient(-6,-35,6,-29);
  const vc2 = isAttacking ? `rgba(255,60,0,` : `rgba(255,180,0,`;
  vG.addColorStop(0,vc2+'0.2)'); vG.addColorStop(0.5,vc2+'0.95)'); vG.addColorStop(1,vc2+'0.2)');
  rc.fillStyle=vG; rc.beginPath(); rc.roundRect(-6,-35,12,6,1); rc.fill();
  // scan line
  const sx2=(t*2.5)%12-6;
  rc.fillStyle='rgba(255,255,200,0.6)'; rc.fillRect(sx2,-35,2,6);
  // antenna
  rc.strokeStyle='#555'; rc.lineWidth=1.5;
  rc.beginPath(); rc.moveTo(4,-38); rc.lineTo(5,-45); rc.stroke();
  const antBlink=isAttacking?(t%8<4):(t%60<30);
  rc.fillStyle=antBlink?'#ff4400':'#440000';
  rc.shadowColor='#ff4400'; rc.shadowBlur=antBlink?8:2;
  rc.beginPath(); rc.arc(5,-45,1.8,0,Math.PI*2); rc.fill();
}

function drawRTSProjectiles(rc){
  for(const p of rtsProjectiles){
    rc.save();
    if(p.type==='cannonball'){
      // iron ball with smoke trail
      if(p.trail.length>1){
        for(let i=1;i<p.trail.length;i++){
          const frac=i/p.trail.length;
          rc.strokeStyle=`rgba(100,90,80,${frac*0.5})`;
          rc.lineWidth=frac*6; rc.lineCap='round';
          rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
        }
      }
      rc.shadowColor='#ff8800'; rc.shadowBlur=12;
      const cg=rc.createRadialGradient(p.x-2,p.y-2,1,p.x,p.y,8);
      cg.addColorStop(0,'#888888'); cg.addColorStop(0.5,'#333333'); cg.addColorStop(1,'#111111');
      rc.fillStyle=cg; rc.beginPath(); rc.arc(p.x,p.y,8,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(60,60,60,0.6)'; rc.lineWidth=1; rc.stroke();
    } else if(p.type==='shell'){
      // tank shell — large elongated projectile with smoke trail
      if(p.trail.length>1){
        for(let i=1;i<p.trail.length;i++){
          const frac=i/p.trail.length;
          rc.strokeStyle=`rgba(150,100,50,${frac*0.5})`;
          rc.lineWidth=frac*5; rc.lineCap='round';
          rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
        }
        const last=p.trail[p.trail.length-1];
        const angle=Math.atan2(p.y-last.y,p.x-last.x);
        rc.save(); rc.translate(p.x,p.y); rc.rotate(angle);
        rc.shadowColor='#ff8800'; rc.shadowBlur=14;
        // shell body — large elongated oval
        const sg=rc.createLinearGradient(-10,-3,10,3);
        sg.addColorStop(0,'#ffcc44'); sg.addColorStop(0.4,'#cc6600'); sg.addColorStop(1,'#441a00');
        rc.fillStyle=sg; rc.beginPath(); rc.ellipse(0,0,10,3.5,0,0,Math.PI*2); rc.fill();
        // nose cone
        rc.fillStyle='#ff4400';
        rc.beginPath(); rc.moveTo(10,-3.5); rc.lineTo(15,0); rc.lineTo(10,3.5); rc.closePath(); rc.fill();
        // tail fins
        rc.fillStyle='#883300';
        rc.beginPath(); rc.moveTo(-10,-3.5); rc.lineTo(-14,-7); rc.lineTo(-10,0); rc.closePath(); rc.fill();
        rc.beginPath(); rc.moveTo(-10,3.5); rc.lineTo(-14,7); rc.lineTo(-10,0); rc.closePath(); rc.fill();
        rc.restore();
      }
    } else if(p.type==='bullet'){
      for(let i=1;i<p.trail.length;i++){
        const frac=i/p.trail.length;
        rc.strokeStyle=`rgba(255,220,80,${frac*0.6})`;
        rc.lineWidth=frac*3; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
      }
      if(p.trail.length>1){
        const last=p.trail[p.trail.length-1];
        const angle=Math.atan2(p.y-last.y,p.x-last.x);
        rc.save(); rc.translate(p.x,p.y); rc.rotate(angle);
        rc.shadowColor='#ffdd44'; rc.shadowBlur=8;
        const bg=rc.createLinearGradient(-6,-2,6,2);
        bg.addColorStop(0,'#ffe066'); bg.addColorStop(0.5,'#cc8800'); bg.addColorStop(1,'#885500');
        rc.fillStyle=bg; rc.beginPath(); rc.ellipse(0,0,6,2,0,0,Math.PI*2); rc.fill();
        rc.fillStyle='rgba(255,255,200,0.7)'; rc.beginPath(); rc.ellipse(3,0,2,0.8,0,0,Math.PI*2); rc.fill();
        rc.restore();
      }
    } else if(p.type==='lightning'){
      for(let i=1;i<p.trail.length;i++){
        rc.strokeStyle=`rgba(100,220,255,${(i/p.trail.length)*0.5})`;
        rc.lineWidth=(i/p.trail.length)*4; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
      }
      rc.shadowColor='#44ddff'; rc.shadowBlur=20;
      const lg=rc.createRadialGradient(p.x,p.y,0,p.x,p.y,11);
      lg.addColorStop(0,'#ffffff'); lg.addColorStop(0.4,'#44aaff'); lg.addColorStop(1,'transparent');
      rc.fillStyle=lg; rc.beginPath(); rc.arc(p.x,p.y,11,0,Math.PI*2); rc.fill();
      // arc spikes
      for(let i=0;i<4;i++){
        const a=(i/4)*Math.PI*2+rtsFrame*0.3;
        rc.strokeStyle='rgba(180,240,255,0.6)'; rc.lineWidth=1;
        rc.beginPath(); rc.moveTo(p.x,p.y); rc.lineTo(p.x+Math.cos(a)*16+(Math.random()-0.5)*6,p.y+Math.sin(a)*16+(Math.random()-0.5)*6); rc.stroke();
      }
    } else if(p.type==='darkmagic'){
      for(let i=1;i<p.trail.length;i++){
        const frac=i/p.trail.length;
        rc.strokeStyle=`rgba(150,0,255,${frac*0.5})`;
        rc.lineWidth=frac*6; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
      }
      rc.shadowColor='#aa00ff'; rc.shadowBlur=22;
      const dg=rc.createRadialGradient(p.x,p.y,0,p.x,p.y,12);
      dg.addColorStop(0,'#ffffff'); dg.addColorStop(0.3,'#cc44ff'); dg.addColorStop(0.7,'#220044'); dg.addColorStop(1,'transparent');
      rc.fillStyle=dg; rc.beginPath(); rc.arc(p.x,p.y,12,0,Math.PI*2); rc.fill();
      const oa=rtsFrame*0.25;
      rc.fillStyle='#cc44ff'; rc.beginPath(); rc.arc(p.x+Math.cos(oa)*9,p.y+Math.sin(oa)*9,3,0,Math.PI*2); rc.fill();
    } else if(p.type==='prismblast'){
      for(let i=1;i<p.trail.length;i++){
        const frac=i/p.trail.length;
        rc.strokeStyle=`rgba(180,255,240,${frac*0.5})`;
        rc.lineWidth=frac*6; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
      }
      rc.shadowColor='#aaffee'; rc.shadowBlur=22;
      const pg=rc.createRadialGradient(p.x,p.y,0,p.x,p.y,12);
      pg.addColorStop(0,'#ffffff'); pg.addColorStop(0.3,'#88ffee'); pg.addColorStop(0.7,'#004433'); pg.addColorStop(1,'transparent');
      rc.fillStyle=pg; rc.beginPath(); rc.arc(p.x,p.y,12,0,Math.PI*2); rc.fill();
      // prism rainbow ring
      for(let ri=0;ri<6;ri++){
        const ra=(ri/6)*Math.PI*2+rtsFrame*0.1;
        const cols=['#ff88aa','#ffff44','#44ff88','#44aaff','#bb44ff','#ff8844'];
        rc.strokeStyle=cols[ri]; rc.lineWidth=0.8; rc.globalAlpha=0.6;
        rc.beginPath(); rc.arc(p.x,p.y,14,ra,ra+0.8); rc.stroke();
        rc.globalAlpha=1;
      }
    } else {
      // standard magic orb
      for(let i=1;i<p.trail.length;i++){
        const frac=i/p.trail.length;
        rc.strokeStyle=`rgba(0,221,255,${frac*0.4})`;
        rc.lineWidth=frac*5; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
      }
      rc.shadowColor=p.color; rc.shadowBlur=18;
      const mg=rc.createRadialGradient(p.x,p.y,0,p.x,p.y,9);
      mg.addColorStop(0,'#ffffff'); mg.addColorStop(0.4,p.color); mg.addColorStop(1,'transparent');
      rc.fillStyle=mg; rc.beginPath(); rc.arc(p.x,p.y,9,0,Math.PI*2); rc.fill();
      const a=rtsFrame*0.18;
      rc.fillStyle='rgba(255,255,255,0.9)';
      rc.beginPath(); rc.arc(p.x+Math.cos(a)*6,p.y+Math.sin(a)*4,2,0,Math.PI*2); rc.fill();
    }
    rc.restore();
  }
}

// ── ELITE DRAW FUNCTIONS ──

function drawEliteOracle(rc,cfg,w){
  // Oracle — taller witch with white/gold robes, bigger crown, twin orbs
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
  // billowing dark robe
  const capeBlow=w.state==='march'?-10:0;
  const cGrad=rc.createLinearGradient(-12,-26,12,10);
  cGrad.addColorStop(0,'#0a0015'); cGrad.addColorStop(0.6,'#110022'); cGrad.addColorStop(1,'#04000a');
  rc.fillStyle=cGrad;
  rc.beginPath(); rc.moveTo(-8,-4); rc.bezierCurveTo(-14+capeBlow,0,-13+capeBlow,10,-8+capeBlow,10); rc.lineTo(8,10); rc.bezierCurveTo(13,10,14,0,10,-4); rc.lineTo(5,-26); rc.lineTo(-5,-26); rc.closePath(); rc.fill();
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

