function rtsDraw(){
  const rcCanvas=document.getElementById('rts-canvas');
  // Render at device resolution (capped at 2×) so units stay crisp on high-DPI
  // screens; everything below keeps drawing in VW×VH units.
  const dpr=Math.min(2, window.devicePixelRatio||1);
  if(rcCanvas.width!==Math.round(VW*dpr)){ rcCanvas.width=Math.round(VW*dpr); rcCanvas.height=Math.round(VH*dpr); }
  const rc=rcCanvas.getContext('2d');
  rc.setTransform(dpr,0,0,dpr,0,0);
  rc.clearRect(0,0,VW,VH);
  drawRTSDeepSpace(rc);

  // apply camera transform (zoom then pan)
  rc.save();
  rc.scale(S.camZoom, S.camZoom);
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
  drawRTSBeams(rc);
  drawRTSBaseHP(rc);

  rc.restore();

  // Drag-select marquee (screen space)
  if(dragSelActive){
    const canvas=document.getElementById('rts-canvas');
    if(canvas){
      const rect=canvas.getBoundingClientRect();
      const scX=VW/rect.width, scY=VH/rect.height;
      const x1=(Math.min(dragSelStartCX,dragSelCurCX)-rect.left)*scX;
      const y1=(Math.min(dragSelStartCY,dragSelCurCY)-rect.top)*scY;
      const bw=Math.abs(dragSelCurCX-dragSelStartCX)*scX;
      const bh=Math.abs(dragSelCurCY-dragSelStartCY)*scY;
      rc.save();
      rc.fillStyle='rgba(0,245,255,0.07)';
      rc.fillRect(x1,y1,bw,bh);
      rc.strokeStyle='rgba(0,245,255,0.85)';
      rc.lineWidth=1.5;
      rc.setLineDash([5,3]);
      rc.strokeRect(x1,y1,bw,bh);
      rc.setLineDash([]);
      rc.restore();
    }
  }

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
  if(S.map){ mc.fillStyle=hexAlpha(S.map.accent,.045); mc.fillRect(0,0,MW,MH); }
  // grid hint
  mc.strokeStyle='rgba(0,200,255,0.05)'; mc.lineWidth=0.5;
  for(let x2=0;x2<MW;x2+=MW/10){mc.beginPath();mc.moveTo(x2,0);mc.lineTo(x2,MH);mc.stroke();}
  for(let y2=0;y2<MH;y2+=MH/7){mc.beginPath();mc.moveTo(0,y2);mc.lineTo(MW,y2);mc.stroke();}

  // gold nodes
  for(const n of S.goldNodes){
    if(n.gold<=0) continue;
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
      const isElite=e.subtype==='elite'||e.subtype==='prism'||e.subtype==='gongui'||e.subtype==='capitalship'||e.subtype==='vanthel'||e.subtype==='arkship';
      mc.fillStyle=isElite?'#ffffff':isAerial?'#ffffff':pCfg.color;
      mc.globalAlpha=isAerial?0.7:1;
      mc.beginPath(); mc.arc(mx,my,isElite?2.5:isAerial?2.5:2,0,Math.PI*2); mc.fill();
      mc.globalAlpha=1;
    }
  }

  // projectiles
  for(const p of S.projectiles){
    mc.fillStyle=p.type==='bullet'?'rgba(255,220,80,0.8)':'rgba(0,220,255,0.8)';
    mc.beginPath(); mc.arc(p.x*scaleX,p.y*scaleY,1,0,Math.PI*2); mc.fill();
  }

  // viewport rect (accounts for zoom level)
  mc.strokeStyle='rgba(0,245,255,0.6)'; mc.lineWidth=1.5;
  mc.strokeRect(S.camX*scaleX, S.camY*scaleY, (VW/S.camZoom)*scaleX, (VH/S.camZoom)*scaleY);

  // border
  mc.strokeStyle='rgba(0,245,255,0.3)'; mc.lineWidth=1;
  mc.strokeRect(0,0,MW,MH);
}

// Render-only hash for scenery detail (never touches simulation RNG, so
// lockstep multiplayer stays deterministic).
function rtsFxHash(i, salt){
  let h=Math.imul(i|0,374761393)^Math.imul((salt|0)+1,668265263);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967296;
}

// Far starfield in screen space, drifting slower than the camera for parallax depth.
function drawRTSDeepSpace(rc){
  rc.fillStyle='#02050a'; rc.fillRect(0,0,VW,VH);
  const t=S.frame||0;
  for(let i=0;i<170;i++){
    const depth=0.06+rtsFxHash(i,21)*0.14;
    const x=((rtsFxHash(i,22)*VW*1.5 - S.camX*depth) % VW + VW) % VW;
    const y=((rtsFxHash(i,23)*VH*1.5 - S.camY*depth) % VH + VH) % VH;
    const tw=0.55+0.45*Math.sin(t*0.03+i*1.7);
    const big=rtsFxHash(i,24)>0.93;
    rc.fillStyle=`rgba(${big?255:200},${big?240:225},255,${(0.15+depth*2.4)*tw})`;
    rc.fillRect(x,y,big?1.8:1,big?1.8:1);
  }
}

// The static battlefield (nebulae, dust, stars, map decor, grid, territory
// glows) is painted once per match into a world-sized layer and blitted.
let rtsBgLayer=null, rtsBgKey='';
function buildRTSBgLayer(map){
  if(!rtsBgLayer) rtsBgLayer=document.createElement('canvas');
  rtsBgLayer.width=RW; rtsBgLayer.height=RH;
  const g=rtsBgLayer.getContext('2d');
  g.clearRect(0,0,RW,RH);

  const bg=g.createLinearGradient(0,0,RW,RH);
  bg.addColorStop(0,map.colors[0]); bg.addColorStop(0.5,map.colors[1]); bg.addColorStop(1,map.colors[2]);
  g.globalAlpha=0.8; g.fillStyle=bg; g.fillRect(0,0,RW,RH); g.globalAlpha=1;

  // Mirrored nebula clouds in the map's accent plus a cool secondary hue.
  const secondary=['#3b2a9a','#1a5a9a','#6a1f6a'];
  for(let i=0;i<9;i++){
    const x=rtsFxHash(i,1)*RW*0.5, y=rtsFxHash(i,2)*RH, r=220+rtsFxHash(i,3)*480;
    const col=i%3===0 ? secondary[i%secondary.length] : map.accent;
    const a=0.05+rtsFxHash(i,4)*0.09;
    for(const mx of [x, RW-x]){
      const n=g.createRadialGradient(mx,y,0,mx,y,r);
      n.addColorStop(0,hexAlpha(col,a)); n.addColorStop(0.5,hexAlpha(col,a*0.45)); n.addColorStop(1,hexAlpha(col,0));
      g.fillStyle=n; g.beginPath(); g.arc(mx,y,r,0,Math.PI*2); g.fill();
    }
  }
  // A contested-zone glow keeps the middle of the map from going flat.
  const mid=g.createRadialGradient(RW/2,RH/2,0,RW/2,RH/2,RH*0.7);
  mid.addColorStop(0,hexAlpha(map.accent,0.08)); mid.addColorStop(1,hexAlpha(map.accent,0));
  g.fillStyle=mid; g.fillRect(RW/2-RH*0.7,0,RH*1.4,RH);
  // Dark dust lanes add contrast so the glow doesn't flatten out.
  for(let i=0;i<6;i++){
    const x=rtsFxHash(i,5)*RW*0.5, y=rtsFxHash(i,6)*RH, r=160+rtsFxHash(i,7)*260;
    for(const mx of [x, RW-x]){
      const d=g.createRadialGradient(mx,y,0,mx,y,r);
      d.addColorStop(0,'rgba(0,0,0,0.35)'); d.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=d; g.beginPath(); g.arc(mx,y,r,0,Math.PI*2); g.fill();
    }
  }
  // Near stars, some with a soft halo.
  for(let i=0;i<900;i++){
    const x=rtsFxHash(i,8)*RW, y=rtsFxHash(i,9)*RH, b=rtsFxHash(i,10);
    g.fillStyle=`rgba(220,235,255,${0.15+b*0.55})`;
    const sz=b>0.97?2:b>0.85?1.4:1;
    g.fillRect(x,y,sz,sz);
    if(b>0.985){
      const h=g.createRadialGradient(x+1,y+1,0,x+1,y+1,9);
      h.addColorStop(0,'rgba(200,230,255,0.35)'); h.addColorStop(1,'rgba(200,230,255,0)');
      g.fillStyle=h; g.beginPath(); g.arc(x+1,y+1,9,0,Math.PI*2); g.fill();
    }
  }

  // Map-specific landmarks (positions come from the deterministic S.mapDecor).
  for(const d of S.mapDecor||[]){
    g.save(); g.translate(d.x,d.y); g.rotate(d.rotation);
    if(map.decor==='shards'){
      // floating crystal shard with a lit facet and bright edge
      g.globalAlpha=Math.min(1,d.alpha*2.4);
      const s=d.size;
      const f=g.createLinearGradient(-s,-s*.3,s,s*.3);
      f.addColorStop(0,hexAlpha(map.accent,.55)); f.addColorStop(1,'rgba(20,16,4,0.6)');
      g.fillStyle=f;
      g.beginPath(); g.moveTo(-s,6); g.lineTo(s*.2,-s*.32); g.lineTo(s,-4); g.lineTo(s*.25,s*.3); g.closePath(); g.fill();
      g.strokeStyle=hexAlpha(map.accent,.7); g.lineWidth=1;
      g.beginPath(); g.moveTo(-s,6); g.lineTo(s*.2,-s*.32); g.lineTo(s,-4); g.stroke();
      g.strokeStyle='rgba(255,255,255,0.18)';
      g.beginPath(); g.moveTo(-s*.6,4); g.lineTo(s*.2,-s*.18); g.stroke();
    } else if(map.decor==='rift'){
      // glowing spacetime fracture with a hot core and side branches
      g.globalAlpha=Math.min(1,d.alpha*2.6);
      g.globalCompositeOperation='lighter';
      g.lineCap='round';
      const s=d.size;
      for(const [w,a] of [[14,.08],[6,.22],[1.6,.8]]){
        g.strokeStyle=a>.5?'rgba(255,240,255,0.8)':hexAlpha(map.accent,a); g.lineWidth=w;
        g.beginPath(); g.moveTo(-s,0); g.quadraticCurveTo(0,s*.35,s,0); g.stroke();
      }
      g.strokeStyle=hexAlpha(map.accent,.5); g.lineWidth=1;
      g.beginPath(); g.moveTo(-s*.3,s*.12); g.lineTo(-s*.45,s*.4); g.moveTo(s*.4,s*.1); g.lineTo(s*.6,-s*.2); g.stroke();
    } else if(map.decor==='embers'){
      // smouldering ember field: warm haze with hot specks
      g.globalCompositeOperation='lighter';
      const haze=g.createRadialGradient(0,0,0,0,0,d.size*2);
      haze.addColorStop(0,hexAlpha(map.accent,d.alpha*.9)); haze.addColorStop(1,hexAlpha(map.accent,0));
      g.fillStyle=haze; g.beginPath(); g.arc(0,0,d.size*2,0,Math.PI*2); g.fill();
      for(let k=0;k<6;k++){
        const ex=(rtsFxHash(k+d.x|0,11)-.5)*d.size*2, ey=(rtsFxHash(k+d.y|0,12)-.5)*d.size*2;
        g.fillStyle=`rgba(255,${150+k*15},60,${0.4+d.alpha})`;
        g.fillRect(ex,ey,1.6,1.6);
      }
    } else {
      // drifting gas cloud
      g.globalAlpha=d.alpha;
      const haze=g.createRadialGradient(0,0,0,0,0,d.size*2.2);
      haze.addColorStop(0,hexAlpha(map.accent,.75)); haze.addColorStop(0.6,hexAlpha(map.accent,.18)); haze.addColorStop(1,hexAlpha(map.accent,0));
      g.fillStyle=haze; g.beginPath(); g.ellipse(0,0,d.size*2.6,d.size*1.6,0,0,Math.PI*2); g.fill();
    }
    g.restore();
  }

  // tactical grid
  g.strokeStyle='rgba(0,200,255,0.03)'; g.lineWidth=1;
  for(let x=0;x<=RW;x+=60){ g.beginPath(); g.moveTo(x+.5,0); g.lineTo(x+.5,RH); g.stroke(); }
  for(let y=0;y<=RH;y+=60){ g.beginPath(); g.moveTo(0,y+.5); g.lineTo(RW,y+.5); g.stroke(); }

  // center divider line
  g.strokeStyle='rgba(255,255,255,0.05)'; g.lineWidth=2; g.setLineDash([10,16]);
  g.beginPath(); g.moveTo(RW/2,0); g.lineTo(RW/2,RH); g.stroke();
  g.setLineDash([]);

  // territory glows
  const pCfg=FACTION_CFG[S.playerFaction], eCfg=FACTION_CFG[S.enemyFaction];
  const pg=g.createLinearGradient(0,0,RW*0.35,0);
  pg.addColorStop(0,hexAlpha(pCfg.color,0.09)); pg.addColorStop(1,hexAlpha(pCfg.color,0));
  g.fillStyle=pg; g.fillRect(0,0,RW*0.35,RH);
  const eg=g.createLinearGradient(RW,0,RW*0.65,0);
  eg.addColorStop(0,hexAlpha(eCfg.color,0.09)); eg.addColorStop(1,hexAlpha(eCfg.color,0));
  g.fillStyle=eg; g.fillRect(RW*0.65,0,RW*0.35,RH);

  // world border: energy barrier
  g.save();
  g.shadowColor=map.accent; g.shadowBlur=18;
  g.strokeStyle=hexAlpha(map.accent,0.45); g.lineWidth=3;
  g.strokeRect(4,4,RW-8,RH-8);
  g.restore();
}

function drawRTSBackground(rc){
  const map=S.map||{colors:['#060d18','#030a14','#060d18'],accent:'#00c8ff',decor:'nebula'};
  const key=`${map.id||'default'}|${S.playerFaction}|${S.enemyFaction}|${S.mapDecor&&S.mapDecor.length?S.mapDecor[0].x:0}`;
  if(!rtsBgLayer || key!==rtsBgKey){ buildRTSBgLayer(map); rtsBgKey=key; }
  // blit only the visible slice of the world
  const sx=Math.max(0,S.camX), sy=Math.max(0,S.camY);
  const sw=Math.min(RW-sx, VW/S.camZoom+2), sh=Math.min(RH-sy, VH/S.camZoom+2);
  if(sw>0 && sh>0) rc.drawImage(rtsBgLayer, sx,sy,sw,sh, sx,sy,sw,sh);
}
function hexAlpha(hex,a){
  if(!hex||!hex.startsWith('#')) return `rgba(100,100,200,${a})`;
  const r=parseInt(hex.slice(1,3),16)||0, g=parseInt(hex.slice(3,5),16)||0, b=parseInt(hex.slice(5,7),16)||0;
  return `rgba(${r},${g},${b},${a})`;
}

// Gold deposit: a faceted crystal cluster that shrinks as it's mined, with a
// ring showing how much is left.
const GOLD_CRYSTALS=[[-10,0.62,-0.35],[9,0.58,0.4],[-4,1,-0.12],[4,0.82,0.18],[0,0.5,0.02]];
function drawGoldNodes(rc){
  const t=S.frame||0;
  for(const node of S.goldNodes){
    if(node.gold<=0) continue;
    const frac=Math.max(0,Math.min(1,node.gold/(node.maxGold||GOLD_MINE_CAPACITY)));
    const pulse=0.8+Math.sin(t*0.05+node.x*0.013)*0.2;
    const x=node.x, y=node.y+4;
    rc.save();

    rc.globalCompositeOperation='lighter';
    const glow=rc.createRadialGradient(x,y-4,0,x,y-4,36);
    glow.addColorStop(0,`rgba(255,200,40,${0.30*pulse})`); glow.addColorStop(1,'rgba(255,200,40,0)');
    rc.fillStyle=glow; rc.beginPath(); rc.arc(x,y-4,36,0,Math.PI*2); rc.fill();
    rc.globalCompositeOperation='source-over';

    // rocky footing
    const rock=rc.createRadialGradient(x-3,y-1,1,x,y,17);
    rock.addColorStop(0,'#4a3a1c'); rock.addColorStop(1,'#140e05');
    rc.fillStyle=rock; rc.beginPath(); rc.ellipse(x,y,17,7,0,0,Math.PI*2); rc.fill();
    rc.strokeStyle='rgba(255,200,80,0.25)'; rc.lineWidth=1; rc.stroke();

    const scale=0.45+0.55*frac;
    for(const [dx,hf,lean] of GOLD_CRYSTALS){
      const cx=x+dx, h=20*hf*scale, w=4.2*(0.7+0.3*scale);
      const tipX=cx+lean*h, tipY=y-h;
      // lit facet
      const lf=rc.createLinearGradient(cx-w,y,tipX,tipY);
      lf.addColorStop(0,'#ffb400'); lf.addColorStop(1,'#fff6b0');
      rc.fillStyle=lf;
      rc.beginPath(); rc.moveTo(cx-w,y); rc.lineTo(tipX,tipY); rc.lineTo(cx+lean*2,y+1.5); rc.closePath(); rc.fill();
      // shaded facet
      const sf=rc.createLinearGradient(cx,y,tipX,tipY);
      sf.addColorStop(0,'#6a4200'); sf.addColorStop(1,'#d89a00');
      rc.fillStyle=sf;
      rc.beginPath(); rc.moveTo(cx+lean*2,y+1.5); rc.lineTo(tipX,tipY); rc.lineTo(cx+w,y); rc.closePath(); rc.fill();
      rc.strokeStyle='rgba(255,240,170,0.55)'; rc.lineWidth=0.7;
      rc.beginPath(); rc.moveTo(cx-w,y); rc.lineTo(tipX,tipY); rc.lineTo(cx+w,y); rc.stroke();
    }

    // twinkle that hops between crystal tips
    const tw=(t*0.02+node.x*0.007)%1;
    if(tw<0.35){
      const [dx,hf,lean]=GOLD_CRYSTALS[(Math.floor(Math.abs(node.y)+t/50)%GOLD_CRYSTALS.length)];
      const h=20*hf*scale, sx=x+dx+lean*h, sy=y-h, a=Math.sin(tw/0.35*Math.PI), r=5*a;
      rc.globalCompositeOperation='lighter';
      rc.strokeStyle=`rgba(255,255,220,${0.9*a})`; rc.lineWidth=1;
      rc.beginPath(); rc.moveTo(sx-r,sy); rc.lineTo(sx+r,sy); rc.moveTo(sx,sy-r); rc.lineTo(sx,sy+r); rc.stroke();
      rc.globalCompositeOperation='source-over';
    }

    // remaining-gold ring
    if(frac<1){
      rc.strokeStyle='rgba(0,0,0,0.5)'; rc.lineWidth=2.5;
      rc.beginPath(); rc.ellipse(x,y,22,10,0,0,Math.PI*2); rc.stroke();
      rc.strokeStyle='rgba(255,210,80,0.7)'; rc.lineWidth=1.5;
      rc.beginPath(); rc.ellipse(x,y,22,10,0,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); rc.stroke();
    }

    rc.font='7px Orbitron,sans-serif'; rc.textAlign='center'; rc.fillStyle='rgba(255,220,100,0.55)';
    rc.fillText('GOLD',x,y+20);
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
    rc.save(); rc.globalAlpha=fa*0.9; rc.globalCompositeOperation='lighter';
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
