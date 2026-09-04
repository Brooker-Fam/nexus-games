// ── DRAW ──
function drawBg(){
  ctx.fillStyle = '#020810';
  ctx.fillRect(0,0,W,H);
  // grid
  ctx.strokeStyle='rgba(0,245,255,0.04)';
  ctx.lineWidth=1;
  for(let x=0;x<=W;x+=CELL){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
  for(let y=0;y<=H;y+=CELL){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
}

function drawPath(){
  const pts = PATH_WAYPOINTS.map(wpPx);
  // glow
  ctx.save();
  ctx.strokeStyle='rgba(0,136,255,0.15)';
  ctx.lineWidth = CELL;
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.stroke();
  // fill
  ctx.strokeStyle='rgba(0,30,60,0.9)';
  ctx.lineWidth = CELL-4;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.stroke();
  // edge lines
  ctx.strokeStyle='rgba(0,136,255,0.3)';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.stroke();
  ctx.restore();

  // base entrance / exit markers
  ctx.save();
  ctx.fillStyle='rgba(0,255,136,0.7)';
  ctx.fillRect(0, pts[0].y-6, 8, 12);
  ctx.fillStyle='rgba(255,0,136,0.7)';
  ctx.fillRect(W-8, pts[pts.length-1].y-6, 8, 12);
  ctx.restore();
}

function drawTowers(){
  if(!Array.isArray(state.towers)) return;
  for(const t of state.towers){
    // aim at nearest enemy or last known angle
    let angle = t.aimAngle || 0;
    let nearest = null, nd = Infinity;
    for(const e of state.enemies){
      const d = Math.hypot(e.x-t.x, e.y-t.y);
      if(d < t.range && d < nd){ nd=d; nearest=e; }
    }
    if(nearest){
      angle = Math.atan2(nearest.y - t.y, nearest.x - t.x);
      t.aimAngle = angle;
    }
    if(t.type==='gun')    drawGunTower(t.x, t.y, angle);
    else if(t.type==='laser')   drawLaserTower(t.x, t.y, angle);
    else if(t.type==='missile') drawMissileTower(t.x, t.y, angle);
    else if(t.type==='slow')    drawCryoTower(t.x, t.y, angle);
  }
}

function drawEnemies(){
  if(!Array.isArray(state.enemies)) return;
  for(const e of state.enemies){
    if(e.boss) drawBossEnemy(e); else drawGruntEnemy(e);
    drawEnemyHpBar(e);
  }
}

function drawEnemyHpBar(e){
  const r = e.boss ? 16 : 10;
  const bw=28, bh=4;
  ctx.fillStyle='rgba(0,0,0,0.6)';
  ctx.fillRect(e.x-bw/2, e.y-r-8, bw, bh);
  const hp = Math.max(0,e.hp/e.maxHp);
  ctx.fillStyle = hp>0.5?'#00ff88':hp>0.25?'#ffaa00':'#ff2244';
  ctx.fillRect(e.x-bw/2, e.y-r-8, bw*hp, bh);
}

// draws a jointed hexapod leg (hip -> knee -> foot) with a tripod-gait sweep
function drawMechLeg(baseAngle, r, phase, groupOffset, legLen, color, lineW){
  const p = phase + groupOffset;
  const sweep = Math.sin(p)*(r*0.28);
  const dirX=Math.cos(baseAngle), dirY=Math.sin(baseAngle);
  const tanX=-dirY, tanY=dirX;
  const hipX=dirX*r*0.6, hipY=dirY*r*0.6;
  const kneeX=hipX+dirX*legLen*0.55+tanX*sweep*0.5, kneeY=hipY+dirY*legLen*0.55+tanY*sweep*0.5;
  const footX=hipX+dirX*legLen+tanX*sweep, footY=hipY+dirY*legLen+tanY*sweep;
  ctx.strokeStyle=color; ctx.lineWidth=lineW; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(hipX,hipY); ctx.lineTo(kneeX,kneeY); ctx.lineTo(footX,footY); ctx.stroke();
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(footX,footY,lineW*0.7,0,Math.PI*2); ctx.fill();
}

// ── STANDARD ENEMY: small hexapod crawler bot ──
function drawGruntEnemy(e){
  const r = 10;
  const frozen = e.slow>0;
  const phase = (e.walkDist||0)*0.15;

  ctx.save();
  // ground shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y+r*0.7, r*1.1, r*0.5, 0, 0, Math.PI*2); ctx.fill();

  ctx.save();
  ctx.translate(e.x, e.y); ctx.rotate(e.angle||0);
  ctx.shadowColor = frozen?'#8888ff':'#ff0044';
  ctx.shadowBlur = 10;

  // 6 legs, alternating tripod gait
  const legAngles=[-2.35,-1.57,-0.78,0.78,1.57,2.35];
  const legColor = frozen?'rgba(150,200,255,0.85)':'rgba(255,80,100,0.85)';
  legAngles.forEach((ba,i)=>{
    drawMechLeg(ba, r, phase, (i%2===0?0:Math.PI), r*1.6, legColor, 1.4);
  });

  // hexagonal carapace body
  const bGrad=ctx.createRadialGradient(-2,-2,1,0,0,r);
  if(frozen){ bGrad.addColorStop(0,'#cfe8ff'); bGrad.addColorStop(0.5,'#6688cc'); bGrad.addColorStop(1,'#223a66'); }
  else { bGrad.addColorStop(0,'#ff6688'); bGrad.addColorStop(0.5,'#cc1133'); bGrad.addColorStop(1,'#4a0812'); }
  ctx.fillStyle=bGrad;
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2;
    const rr=r*(i%2===0?1:0.85);
    i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle= frozen?'#aaccff':'#ff6688'; ctx.lineWidth=1.3; ctx.stroke();

  // armor seam lines
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=0.6;
  for(let i=0;i<3;i++){
    const a=(i/3)*Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.2,Math.sin(a)*r*0.2); ctx.lineTo(Math.cos(a)*r*0.9,Math.sin(a)*r*0.9); ctx.stroke();
  }

  // single pulsing sensor eye facing direction of travel
  const eyePulse=0.6+Math.sin((state.frame||0)*0.15)*0.4;
  const eGrad=ctx.createRadialGradient(r*0.5,0,0,r*0.5,0,3);
  eGrad.addColorStop(0,`rgba(255,255,255,${eyePulse})`);
  eGrad.addColorStop(0.5, frozen?'rgba(180,220,255,0.9)':'rgba(255,60,60,0.9)');
  eGrad.addColorStop(1,'transparent');
  ctx.fillStyle=eGrad;
  ctx.beginPath(); ctx.arc(r*0.5,0,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle= frozen?'#dff4ff':'#fff';
  ctx.beginPath(); ctx.arc(r*0.5,0,1,0,Math.PI*2); ctx.fill();

  // frost crust overlay when slowed
  if(frozen){
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(180,220,255,0.25)';
    ctx.beginPath(); ctx.arc(0,0,r*1.05,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(220,240,255,0.6)'; ctx.lineWidth=0.6;
    [0.4,1.9,3.3,5.1].forEach(a=>{
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*r*0.9,Math.sin(a)*r*0.9); ctx.stroke();
    });
  }

  ctx.restore();
  ctx.restore();
}

// ── BOSS ENEMY: heavy 8-legged armored walker ──
function drawBossEnemy(e){
  const r = 16;
  const frozen = e.slow>0;
  const phase = (e.walkDist||0)*0.1;

  ctx.save();
  // ground shadow
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y+r*0.7, r*1.2, r*0.55, 0, 0, Math.PI*2); ctx.fill();

  ctx.save();
  ctx.translate(e.x, e.y); ctx.rotate(e.angle||0);
  ctx.shadowColor = frozen?'#8888ff':'#ff8800';
  ctx.shadowBlur = 20;

  // 8 heavy legs, slower gait
  const legAngles=[-2.6,-2.0,-1.4,-0.7,0.7,1.4,2.0,2.6];
  const legColor = frozen?'rgba(150,190,255,0.85)':'rgba(255,150,50,0.9)';
  legAngles.forEach((ba,i)=>{
    drawMechLeg(ba, r, phase, (i%2===0?0:Math.PI), r*1.7, legColor, 2.2);
  });

  // spiked armored carapace
  const bGrad=ctx.createRadialGradient(-3,-3,2,0,0,r);
  if(frozen){ bGrad.addColorStop(0,'#cfe4ff'); bGrad.addColorStop(0.5,'#5577bb'); bGrad.addColorStop(1,'#1a2c55'); }
  else { bGrad.addColorStop(0,'#ffaa55'); bGrad.addColorStop(0.5,'#cc4400'); bGrad.addColorStop(1,'#331400'); }
  ctx.fillStyle=bGrad;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2;
    const rr=r*(i%2===0?1.05:0.8);
    i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=frozen?'#aaccff':'#ffaa00'; ctx.lineWidth=1.6; ctx.stroke();

  // outer spikes
  for(let i=0;i<8;i+=2){
    const a=(i/8)*Math.PI*2;
    ctx.fillStyle= frozen? '#88aadd':'#992200';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r*0.9,Math.sin(a)*r*0.9);
    ctx.lineTo(Math.cos(a-0.1)*r*1.4,Math.sin(a-0.1)*r*1.4);
    ctx.lineTo(Math.cos(a+0.1)*r*1.4,Math.sin(a+0.1)*r*1.4);
    ctx.closePath(); ctx.fill();
  }

  // seam plating lines
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=0.8;
  for(let i=0;i<4;i++){
    const a=(i/4)*Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.2,Math.sin(a)*r*0.2); ctx.lineTo(Math.cos(a)*r*0.95,Math.sin(a)*r*0.95); ctx.stroke();
  }

  // twin glowing sensor eyes
  const eyePulse=0.6+Math.sin((state.frame||0)*0.12)*0.4;
  for(const ey of [-4,4]){
    const eGrad=ctx.createRadialGradient(r*0.55,ey,0,r*0.55,ey,3.2);
    eGrad.addColorStop(0,`rgba(255,255,255,${eyePulse})`);
    eGrad.addColorStop(0.5, frozen?'rgba(180,220,255,0.9)':'rgba(255,120,20,0.9)');
    eGrad.addColorStop(1,'transparent');
    ctx.fillStyle=eGrad;
    ctx.beginPath(); ctx.arc(r*0.55,ey,3.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=frozen?'#dff4ff':'#fff';
    ctx.beginPath(); ctx.arc(r*0.55,ey,1.1,0,Math.PI*2); ctx.fill();
  }

  // pulsing power core
  const core=ctx.createRadialGradient(0,0,0,0,0,5);
  core.addColorStop(0,'#ffffff'); core.addColorStop(0.4, frozen?'#88ccff':'#ffcc44'); core.addColorStop(1, frozen?'#2244aa':'#992200');
  ctx.globalAlpha=0.85;
  ctx.fillStyle=core; ctx.beginPath(); ctx.arc(0,0,4.5,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(255,220,180,0.6)'; ctx.lineWidth=0.8; ctx.stroke();

  // IFF antenna
  ctx.strokeStyle=frozen?'#88aadd':'#996622'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.9); ctx.lineTo(-r*0.6,-r*1.4); ctx.stroke();
  ctx.fillStyle= frozen? '#aaddff':'#ff4400';
  ctx.beginPath(); ctx.arc(-r*0.6,-r*1.4,1.5,0,Math.PI*2); ctx.fill();

  // frost crust overlay when slowed
  if(frozen){
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(180,220,255,0.22)';
    ctx.beginPath(); ctx.arc(0,0,r*1.15,0,Math.PI*2); ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

function drawBullets(){
  if(!Array.isArray(state.bullets)) return;
  for(const b of state.bullets){
    ctx.save();
    const tt = b.towerType;

    if(tt === 'gun'){
      // ── TRACER ROUND: elongated brass bullet with bright trail ──
      const angle = b.angle;
      // glowing trail (fading line behind)
      if(b.trailX.length > 1){
        for(let t=1;t<b.trailX.length;t++){
          const alpha = (t/b.trailX.length)*0.5;
          ctx.strokeStyle=`rgba(255,220,80,${alpha})`;
          ctx.lineWidth = 1.5*(t/b.trailX.length);
          ctx.beginPath(); ctx.moveTo(b.trailX[t-1],b.trailY[t-1]); ctx.lineTo(b.trailX[t],b.trailY[t]); ctx.stroke();
        }
      }
      // bullet body — elongated capsule pointing in direction of travel
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(angle);
      ctx.shadowColor='#ffdd44'; ctx.shadowBlur=8;
      // brass casing
      const bGrad=ctx.createLinearGradient(0,-2,0,2);
      bGrad.addColorStop(0,'#ffe066'); bGrad.addColorStop(0.5,'#cc8800'); bGrad.addColorStop(1,'#886600');
      ctx.fillStyle=bGrad;
      ctx.beginPath(); ctx.ellipse(0,0,6,2,0,0,Math.PI*2); ctx.fill();
      // tip glint
      ctx.fillStyle='#ffffff'; ctx.globalAlpha=0.7;
      ctx.beginPath(); ctx.ellipse(4,0,2,0.8,0,0,Math.PI*2); ctx.fill();
      ctx.restore();

    } else if(tt === 'laser'){
      // ── LASER BEAM: continuous glowing beam line from tower ──
      if(b.tx){
        const dx=b.tx.x-b.x, dy=b.tx.y-b.y;
        // outer glow beam
        ctx.strokeStyle='rgba(255,0,136,0.15)';
        ctx.lineWidth=12; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.tx.x,b.tx.y); ctx.stroke();
        // mid beam
        ctx.strokeStyle='rgba(255,0,136,0.5)';
        ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.tx.x,b.tx.y); ctx.stroke();
        // hot core
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=1.2;
        ctx.shadowColor='#ff0088'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.tx.x,b.tx.y); ctx.stroke();
        // impact point glow
        ctx.shadowBlur=20;
        ctx.fillStyle='rgba(255,100,180,0.8)';
        ctx.beginPath(); ctx.arc(b.tx.x,b.tx.y,4,0,Math.PI*2); ctx.fill();
      }

    } else if(tt === 'missile'){
      // ── ROCKET: drawn missile body with exhaust flame trail ──
      const angle = b.angle;
      // exhaust flame trail
      if(b.trailX.length > 1){
        for(let t=1;t<b.trailX.length;t++){
          const frac = t/b.trailX.length;
          const alpha = frac*0.7;
          const w = (1-frac)*5;
          const fireColors=['rgba(255,200,50,','rgba(255,100,0,','rgba(200,50,0,'];
          const fc = fireColors[Math.floor(frac*fireColors.length)]||fireColors[0];
          ctx.strokeStyle=fc+alpha+')';
          ctx.lineWidth=w;
          ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(b.trailX[t-1],b.trailY[t-1]); ctx.lineTo(b.trailX[t],b.trailY[t]); ctx.stroke();
        }
      }
      // rocket body
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(angle);
      ctx.shadowColor='#ff6600'; ctx.shadowBlur=10;
      // body
      const rGrad=ctx.createLinearGradient(0,-3,0,3);
      rGrad.addColorStop(0,'#cc5500'); rGrad.addColorStop(0.5,'#884400'); rGrad.addColorStop(1,'#441800');
      ctx.fillStyle=rGrad;
      ctx.beginPath(); ctx.roundRect(-6,-2.5,12,5,1); ctx.fill();
      ctx.strokeStyle='#ff8800'; ctx.lineWidth=0.6; ctx.stroke();
      // warhead cone
      ctx.fillStyle='#ff2200';
      ctx.beginPath(); ctx.moveTo(6,-2.5); ctx.lineTo(11,0); ctx.lineTo(6,2.5); ctx.closePath(); ctx.fill();
      // fin (small triangle at back)
      ctx.fillStyle='#553300';
      ctx.beginPath(); ctx.moveTo(-6,-2.5); ctx.lineTo(-10,-5); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6,2.5); ctx.lineTo(-10,5); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();
      // exhaust glow at nozzle
      const exGrad=ctx.createRadialGradient(-7,0,0,-7,0,5);
      exGrad.addColorStop(0,'rgba(255,200,50,0.9)'); exGrad.addColorStop(0.5,'rgba(255,80,0,0.5)'); exGrad.addColorStop(1,'transparent');
      ctx.fillStyle=exGrad;
      ctx.beginPath(); ctx.arc(-7,0,5,0,Math.PI*2); ctx.fill();
      ctx.restore();

    } else if(tt === 'slow'){
      // ── CRYO BOLT: crystalline ice shard with freezing aura ──
      const angle = b.angle;
      // frost trail
      if(b.trailX.length > 1){
        for(let t=1;t<b.trailX.length;t++){
          const alpha=(t/b.trailX.length)*0.4;
          ctx.strokeStyle=`rgba(160,220,255,${alpha})`;
          ctx.lineWidth=3*(t/b.trailX.length);
          ctx.beginPath(); ctx.moveTo(b.trailX[t-1],b.trailY[t-1]); ctx.lineTo(b.trailX[t],b.trailY[t]); ctx.stroke();
        }
      }
      // ice shard body
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(angle);
      ctx.shadowColor='#88ccff'; ctx.shadowBlur=12;
      // crystal shape (hexagonal elongated)
      const iGrad=ctx.createLinearGradient(0,-3,0,3);
      iGrad.addColorStop(0,'#ddf4ff'); iGrad.addColorStop(0.4,'#66aadd'); iGrad.addColorStop(1,'#224488');
      ctx.fillStyle=iGrad;
      ctx.beginPath();
      ctx.moveTo(7,0); ctx.lineTo(4,-3); ctx.lineTo(-4,-2.5); ctx.lineTo(-7,0); ctx.lineTo(-4,2.5); ctx.lineTo(4,3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(200,240,255,0.8)'; ctx.lineWidth=0.8; ctx.stroke();
      // inner shine line
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(5,-1.5); ctx.lineTo(-3,-1); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawParticles(){
  for(let i=state.particles.length-1;i>=0;i--){
    const p=state.particles[i];
    p.x+=p.vx; p.y+=p.vy;
    p.vx*=0.92; p.vy*=0.92;
    p.life--;
    if(p.life<=0){ state.particles.splice(i,1); continue; }
    const frac = p.life/p.maxLife;
    ctx.save();

    if(p.type==='spark'){
      // bright white/cyan sparks — thin fast streaks
      ctx.globalAlpha=frac;
      ctx.strokeStyle=p.color; ctx.lineWidth=1.5;
      ctx.shadowColor=p.color; ctx.shadowBlur=6;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.vx*3,p.y-p.vy*3); ctx.stroke();

    } else if(p.type==='energy'){
      // pink energy orbs that fade
      ctx.globalAlpha=frac*0.9;
      ctx.shadowColor='#ff0088'; ctx.shadowBlur=10;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,2.5*frac+0.5,0,Math.PI*2); ctx.fill();

    } else if(p.type==='ring'){
      // expanding ring
      p.radius += 2.5;
      ctx.globalAlpha=frac*0.8;
      ctx.strokeStyle=p.color; ctx.lineWidth=1.5;
      ctx.shadowColor=p.color; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.stroke();

    } else if(p.type==='fire'){
      // fiery explosion particles — circle that grows then fades
      ctx.globalAlpha=frac*0.9;
      ctx.shadowColor=p.color; ctx.shadowBlur=14;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,(1-frac)*8+1,0,Math.PI*2); ctx.fill();

    } else if(p.type==='shockwave'){
      // large expanding shockwave ring
      p.radius += 3.5;
      ctx.globalAlpha=frac*0.6;
      ctx.strokeStyle=p.color; ctx.lineWidth=2.5*(frac);
      ctx.shadowColor='#ff8800'; ctx.shadowBlur=15;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.stroke();

    } else if(p.type==='ice'){
      // ice fragment — small rotated rectangle
      ctx.globalAlpha=frac;
      ctx.save();
      ctx.translate(p.x,p.y); ctx.rotate(p.life*0.3);
      ctx.shadowColor='#88ccff'; ctx.shadowBlur=8;
      ctx.fillStyle=p.color;
      ctx.fillRect(-2,-1,4,2);
      ctx.restore();
    }

    ctx.restore();
  }
}


//# sourceMappingURL=rendering.js.map
