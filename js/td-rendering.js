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
    ctx.save();
    const r = e.boss ? 16 : 10;
    // glow
    ctx.shadowColor = e.boss ? '#ff8800' : (e.slow>0?'#8888ff':'#ff0044');
    ctx.shadowBlur = e.boss ? 20 : 12;
    ctx.fillStyle = e.boss ? '#ff6600' : (e.slow>0?'#8888ff':'#ff2244');
    ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = e.boss ? '#ffaa00' : '#ff6688';
    ctx.lineWidth=1.5; ctx.stroke();
    ctx.restore();
    // hp bar
    const bw=28, bh=4;
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(e.x-bw/2, e.y-r-8, bw, bh);
    const hp = Math.max(0,e.hp/e.maxHp);
    ctx.fillStyle = hp>0.5?'#00ff88':hp>0.25?'#ffaa00':'#ff2244';
    ctx.fillRect(e.x-bw/2, e.y-r-8, bw*hp, bh);
  }
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

