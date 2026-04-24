function rtsDraw(){
  const rc=document.getElementById('rts-canvas').getContext('2d');
  rc.clearRect(0,0,VW,VH);

  // apply camera transform
  rc.save();
  rc.translate(-S.camX, -S.camY);

  drawRTSBackground(rc);
  drawGoldNodes(rc);

  // structure placement preview ring follows mouse
  if(S.buildStructureMode && S.mouseWorld){
    rc.save();
    const pulse=0.3+Math.sin(S.frame*0.2)*0.3;
    rc.strokeStyle=`rgba(255,220,0,${0.5+pulse})`;
    rc.lineWidth=2; rc.setLineDash([8,6]);
    rc.shadowColor='#ffdd00'; rc.shadowBlur=16;
    rc.beginPath(); rc.arc(S.mouseWorld.x, S.mouseWorld.y, 40, 0, Math.PI*2); rc.stroke();
    rc.setLineDash([]);
    // cross
    rc.strokeStyle=`rgba(255,220,0,0.7)`; rc.lineWidth=1.5; rc.shadowBlur=8;
    rc.beginPath(); rc.moveTo(S.mouseWorld.x-14,S.mouseWorld.y); rc.lineTo(S.mouseWorld.x+14,S.mouseWorld.y); rc.stroke();
    rc.beginPath(); rc.moveTo(S.mouseWorld.x,S.mouseWorld.y-14); rc.lineTo(S.mouseWorld.x,S.mouseWorld.y+14); rc.stroke();
    rc.font='8px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle='rgba(255,220,80,0.8)'; rc.shadowBlur=0;
    rc.fillText('CLICK TO PLACE', S.mouseWorld.x, S.mouseWorld.y-48);
    rc.restore();
  }

  drawRTSParticles(rc);
  for(const e of S.entities){
    if(e.type==='base') drawRTSBase(rc,e);
    if(e.type==='structure') drawRTSStructure(rc,e);
    if(e.type==='cannon') drawRTSCannon(rc,e);
  }
  for(const e of S.entities){
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
  for(const n of S.goldNodes){
    mc.fillStyle='rgba(255,220,50,0.6)';
    mc.beginPath(); mc.arc(n.x*scaleX, n.y*scaleY, 2, 0, Math.PI*2); mc.fill();
  }

  // entities
  for(const e of S.entities){
    const mx=e.x*scaleX, my=e.y*scaleY;
    const pCfg=FACTION_CFG[e.side==='player'?S.playerFaction:S.enemyFaction];
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
      const isAerial=e.aerial;
      mc.fillStyle=e.subtype==='elite'?'#ffffff':isAerial?'#ffffff':pCfg.color;
      mc.globalAlpha=isAerial?0.7:1;
      mc.beginPath(); mc.arc(mx,my,e.subtype==='elite'?2.5:isAerial?2.5:2,0,Math.PI*2); mc.fill();
      mc.globalAlpha=1;
    }
  }

  // projectiles
  for(const p of S.projectiles){
    mc.fillStyle=p.type==='bullet'?'rgba(255,220,80,0.8)':'rgba(0,220,255,0.8)';
    mc.beginPath(); mc.arc(p.x*scaleX,p.y*scaleY,1,0,Math.PI*2); mc.fill();
  }

  // viewport rect
  mc.strokeStyle='rgba(0,245,255,0.6)'; mc.lineWidth=1.5;
  mc.strokeRect(S.camX*scaleX, S.camY*scaleY, VW*scaleX, VH*scaleY);

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
  const gx0=Math.floor(S.camX/60)*60, gy0=Math.floor(S.camY/60)*60;
  rc.strokeStyle='rgba(0,200,255,0.035)'; rc.lineWidth=1;
  for(let x2=gx0;x2<S.camX+VW+60;x2+=60){rc.beginPath();rc.moveTo(x2,S.camY);rc.lineTo(x2,S.camY+VH);rc.stroke();}
  for(let y2=gy0;y2<S.camY+VH+60;y2+=60){rc.beginPath();rc.moveTo(S.camX,y2);rc.lineTo(S.camX+VW,y2);rc.stroke();}

  // center divider line
  rc.strokeStyle='rgba(255,255,255,0.04)'; rc.lineWidth=2; rc.setLineDash([10,16]);
  rc.beginPath(); rc.moveTo(RW/2,0); rc.lineTo(RW/2,RH); rc.stroke();
  rc.setLineDash([]);

  // territory glows
  const pCfg=FACTION_CFG[S.playerFaction], eCfg=FACTION_CFG[S.enemyFaction];
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
  for(const node of S.goldNodes){
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

function drawRTSBaseHP(rc){
  const bases=S.entities.filter(e=>e.type==='base');
  for(const base of bases){
    const cfg=FACTION_CFG[base.side==='player'?S.playerFaction:S.enemyFaction];
    const bw=60, bh=6;
    drawHealthBar(rc, base.x, base.y-80, bw, bh, base.hp, base.maxHp);
    rc.strokeStyle='rgba(255,255,255,0.1)'; rc.lineWidth=0.5; rc.strokeRect(base.x-bw/2,base.y-80,bw,bh);
    // construction overlay for bases being built
    if(base.underConstruction){
      drawConstructionOverlay(rc,base.x,base.y,base.buildProgress/base.buildTime,cfg.color,60);
    }
    // queue bar above HP bar
    else if(base.queue && base.queue.length>0){
      drawQueueBar(rc,base.x,base.y-90,bw,base.trainTimer,base.queue[0].time,base.queue.length);
    }
  }
}

function drawRTSParticles(rc){
  for(const p of S.particles){
    const fa=p.life/p.maxLife;
    rc.save(); rc.globalAlpha=fa*0.9;
    if(p.isRing){
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


//# sourceMappingURL=rendering.js.map
