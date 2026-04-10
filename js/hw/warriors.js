// ── HOMESTEAD WARS — WARRIOR & PROJECTILE DRAWING ──

function hwDrawWarrior(rc, w){
  const cfg=HW_FACTIONS[w.faction]||HW_FACTIONS.barnyard;
  const bob=Math.sin(w.frame*0.15)*1.5;
  const facing = w.side==='player'?1:-1;
  rc.save(); rc.translate(w.x, w.y+bob);
  if(facing===-1) rc.scale(-1,1);
  rc.shadowColor=cfg.color; rc.shadowBlur=10;

  // dispatch by subtype first
  if(w.subtype==='elite'){
    hwDrawElite(rc,cfg,w);
  } else if(w.subtype==='wizard'){
    hwDrawPelicanUnit(rc,cfg,w);
  } else if(w.subtype==='tank'){
    if(w.faction==='barnyard') hwDrawBullUnit(rc,cfg,w);
    else if(w.faction==='woodland') hwDrawBearUnit(rc,cfg,w);
    else hwDrawBullUnit(rc,cfg,w);
  } else {
    // standard warriors
    if(w.faction==='barnyard') hwDrawWarriorBarnyard(rc,cfg,w);
    else if(w.faction==='creek') hwDrawWarriorCreek(rc,cfg,w);
    else hwDrawWarriorWoodland(rc,cfg,w);
  }

  rc.restore();
  // selection ring
  if(w.selected) hwDrawSelectionRing(rc, w.x, w.y, 18, 8, 2.5);
  if(w.hp<w.maxHp) hwDrawHealthBar(rc, w.x, w.y-26, 20, 3, w.hp, w.maxHp);
}

// ═══════════════════════════════════════
//  BARNYARD ROOSTER (melee, fast)
// ═══════════════════════════════════════
function hwDrawWarriorBarnyard(rc,cfg,w){
  const t=w.frame;
  const isAtt=w.state==='attack';
  const isMarch=w.state==='march'||w.state==='moving';
  const atkPeck = isAtt ? Math.sin(t*0.4)*4 : 0;

  // LEGS (yellow, clawed feet)
  const legSwing = isMarch ? Math.sin(t*0.25)*4 : 0;
  rc.strokeStyle='#FFAA00'; rc.lineWidth=2; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-2,6); rc.lineTo(-3+legSwing,14); rc.stroke();
  rc.beginPath(); rc.moveTo(3,6); rc.lineTo(4-legSwing,14); rc.stroke();
  // clawed feet
  for(const [fx,fs] of [[-3+legSwing,14],[4-legSwing,14]]){
    rc.strokeStyle='#cc8800'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(fx-2,fs); rc.lineTo(fx,fs+2); rc.lineTo(fx+2,fs); rc.stroke();
  }

  // TAIL FEATHERS (green/blue fan)
  rc.fillStyle='#226644';
  rc.beginPath();
  rc.moveTo(-5,2);
  rc.bezierCurveTo(-14,-2,-16,-10,-12,-16);
  rc.lineTo(-8,-12);
  rc.bezierCurveTo(-12,-4,-8,0,-5,0);
  rc.closePath(); rc.fill();
  rc.fillStyle='#2244aa';
  rc.beginPath();
  rc.moveTo(-4,0);
  rc.bezierCurveTo(-12,-2,-14,-10,-10,-14);
  rc.lineTo(-7,-10);
  rc.bezierCurveTo(-10,-4,-6,0,-4,-1);
  rc.closePath(); rc.fill();
  // iridescent shimmer
  rc.fillStyle='rgba(100,200,150,0.2)';
  rc.beginPath();
  rc.moveTo(-5,1);
  rc.bezierCurveTo(-10,-1,-12,-8,-8,-12);
  rc.lineTo(-6,-9);
  rc.closePath(); rc.fill();

  // BODY (proud red chest)
  const bGrad=rc.createRadialGradient(0,-1,2,0,0,9);
  bGrad.addColorStop(0,'#dd4433'); bGrad.addColorStop(0.7,'#cc3322'); bGrad.addColorStop(1,'#aa2211');
  rc.fillStyle=bGrad;
  rc.beginPath(); rc.ellipse(0,0,9,7,0,0,Math.PI*2); rc.fill();

  // WING
  rc.fillStyle='#aa2211';
  rc.beginPath(); rc.ellipse(-2,-1,6,4,0.15,0,Math.PI*2); rc.fill();
  // wing feather detail
  rc.strokeStyle='rgba(80,15,10,0.3)'; rc.lineWidth=0.5;
  for(let fy=-3;fy<=2;fy+=2){
    rc.beginPath(); rc.moveTo(-6,fy); rc.lineTo(2,fy); rc.stroke();
  }

  // NECK
  rc.fillStyle='#cc3322';
  rc.fillRect(5,-9,5,7);

  // HEAD
  rc.fillStyle='#cc3322';
  rc.beginPath(); rc.arc(8+atkPeck,-11,5,0,Math.PI*2); rc.fill();

  // COMB (red crown spikes)
  rc.fillStyle='#ff2211';
  rc.beginPath();
  rc.moveTo(5+atkPeck,-14);
  rc.lineTo(6+atkPeck,-19);
  rc.lineTo(8+atkPeck,-15);
  rc.lineTo(9+atkPeck,-20);
  rc.lineTo(11+atkPeck,-14);
  rc.closePath(); rc.fill();
  // wattle
  rc.fillStyle='#ee2211';
  rc.beginPath(); rc.ellipse(9+atkPeck,-7,2,3,0,0,Math.PI*2); rc.fill();

  // BEAK (sharp yellow)
  rc.fillStyle='#FFAA00';
  rc.beginPath();
  rc.moveTo(12+atkPeck,-12);
  rc.lineTo(18+atkPeck,-11);
  rc.lineTo(12+atkPeck,-10);
  rc.closePath(); rc.fill();
  // beak highlight
  rc.fillStyle='rgba(255,220,100,0.4)';
  rc.beginPath();
  rc.moveTo(12+atkPeck,-12);
  rc.lineTo(16+atkPeck,-11.5);
  rc.lineTo(12+atkPeck,-11);
  rc.closePath(); rc.fill();

  // EYE
  rc.fillStyle='#FFD700';
  rc.beginPath(); rc.arc(9+atkPeck,-12,1.5,0,Math.PI*2); rc.fill();
  rc.fillStyle='#111';
  rc.beginPath(); rc.arc(9+atkPeck,-12,0.8,0,Math.PI*2); rc.fill();

  // attack motion blur
  if(isAtt && atkPeck>2){
    rc.strokeStyle='rgba(255,100,50,0.3)'; rc.lineWidth=2;
    rc.beginPath(); rc.moveTo(14+atkPeck,-11); rc.lineTo(22+atkPeck,-11); rc.stroke();
  }
}

// ═══════════════════════════════════════
//  CREEK GOOSE (ranged, honk)
// ═══════════════════════════════════════
function hwDrawWarriorCreek(rc,cfg,w){
  const t=w.frame;
  const isAtt=w.state==='attack';
  const isMarch=w.state==='march'||w.state==='moving';
  const honk = isAtt ? Math.sin(t*0.3)*3 : 0;

  // LEGS (orange, waddle)
  const waddle = isMarch ? Math.sin(t*0.2)*3 : 0;
  rc.strokeStyle='#FF8C00'; rc.lineWidth=2; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-2,6); rc.lineTo(-2+waddle,14); rc.stroke();
  rc.beginPath(); rc.moveTo(3,6); rc.lineTo(3-waddle,14); rc.stroke();
  // webbed feet
  rc.fillStyle='#FF8C00';
  rc.beginPath(); rc.ellipse(-2+waddle,15,3,1.5,0,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.ellipse(3-waddle,15,3,1.5,0,0,Math.PI*2); rc.fill();

  // BODY (white/gray elongated)
  const bGrad=rc.createRadialGradient(0,0,2,0,0,10);
  bGrad.addColorStop(0,'#f8f8f0'); bGrad.addColorStop(0.6,'#eeeedd'); bGrad.addColorStop(1,'#ccccbb');
  rc.fillStyle=bGrad;
  rc.beginPath(); rc.ellipse(0,0,10,7,0,0,Math.PI*2); rc.fill();

  // WING (spread slightly when attacking)
  const wingSpread = isAtt ? 0.2 : 0;
  rc.fillStyle='#ddddc8';
  rc.save(); rc.translate(-4,-2); rc.rotate(wingSpread);
  rc.beginPath(); rc.ellipse(0,0,7,4,0.15,0,Math.PI*2); rc.fill();
  // feather lines
  rc.strokeStyle='rgba(180,180,160,0.3)'; rc.lineWidth=0.5;
  for(let fy=-2;fy<=2;fy+=2){
    rc.beginPath(); rc.moveTo(-5,fy); rc.lineTo(4,fy); rc.stroke();
  }
  rc.restore();

  // NECK (long S-curve)
  rc.strokeStyle='#eeeedd'; rc.lineWidth=5; rc.lineCap='round';
  rc.beginPath();
  rc.moveTo(7,-4);
  rc.bezierCurveTo(12,-10,8,-16,9+honk,-20);
  rc.stroke();
  // neck stripe
  rc.strokeStyle='rgba(200,200,180,0.3)'; rc.lineWidth=1.5;
  rc.beginPath();
  rc.moveTo(7,-5);
  rc.bezierCurveTo(11,-10,7,-15,8+honk,-19);
  rc.stroke();

  // HEAD
  rc.fillStyle='#eeeedd';
  rc.beginPath(); rc.arc(9+honk,-20,4,0,Math.PI*2); rc.fill();

  // black cap on head
  rc.fillStyle='#333';
  rc.beginPath(); rc.arc(9+honk,-22,3,Math.PI,Math.PI*2); rc.fill();

  // BEAK (orange, sturdy)
  rc.fillStyle='#FF8C00';
  rc.beginPath();
  rc.moveTo(12+honk,-21);
  rc.lineTo(18+honk,-20);
  rc.lineTo(12+honk,-18);
  rc.closePath(); rc.fill();
  // nostril bump
  rc.fillStyle='#cc7700';
  rc.beginPath(); rc.arc(13+honk,-20,1.5,0,Math.PI*2); rc.fill();

  // EYE
  rc.fillStyle='#111';
  rc.beginPath(); rc.arc(10+honk,-21,1.2,0,Math.PI*2); rc.fill();

  // HONK sound waves when attacking
  if(isAtt){
    rc.strokeStyle='rgba(255,255,255,0.25)'; rc.lineWidth=1.5;
    for(let i=1;i<=3;i++){
      const fade=1-i*0.25;
      rc.globalAlpha=fade;
      rc.beginPath(); rc.arc(18+honk,-20,i*5,-0.4,0.4); rc.stroke();
    }
    rc.globalAlpha=1;
  }
}

// ═══════════════════════════════════════
//  WOODLAND OWL (rapid fire ranged)
// ═══════════════════════════════════════
function hwDrawWarriorWoodland(rc,cfg,w){
  const t=w.frame;
  const isAtt=w.state==='attack';
  const isMarch=w.state==='march'||w.state==='moving';
  const wingFlap = isAtt ? Math.sin(t*0.35)*0.35 : (isMarch ? Math.sin(t*0.2)*0.1 : 0);

  // TALONS (brown, gripping)
  rc.strokeStyle='#5A3520'; rc.lineWidth=1.5; rc.lineCap='round';
  const legBob = isMarch ? Math.sin(t*0.25)*2 : 0;
  rc.beginPath(); rc.moveTo(-3,7); rc.lineTo(-4,12+legBob); rc.stroke();
  rc.beginPath(); rc.moveTo(3,7); rc.lineTo(4,12-legBob); rc.stroke();
  // claws
  for(const [cx,cy] of [[-4,12+legBob],[4,12-legBob]]){
    rc.strokeStyle='#3a2010'; rc.lineWidth=1;
    rc.beginPath(); rc.moveTo(cx-2,cy); rc.lineTo(cx,cy+2); rc.lineTo(cx+2,cy); rc.stroke();
  }

  // BODY (round brown)
  const bGrad=rc.createRadialGradient(0,0,2,0,0,8);
  bGrad.addColorStop(0,'#8B6040'); bGrad.addColorStop(0.6,'#6B4226'); bGrad.addColorStop(1,'#5A3520');
  rc.fillStyle=bGrad;
  rc.beginPath(); rc.ellipse(0,0,8,9,0,0,Math.PI*2); rc.fill();

  // BELLY (lighter speckled)
  rc.fillStyle='#D4A860';
  rc.beginPath(); rc.ellipse(0,2,5,5,0,0,Math.PI*2); rc.fill();
  // speckle pattern
  rc.fillStyle='rgba(90,50,30,0.25)';
  for(let sy=-1;sy<=4;sy+=2){
    for(let sx=-3;sx<=3;sx+=3){
      rc.beginPath(); rc.arc(sx,sy,0.8,0,Math.PI*2); rc.fill();
    }
  }

  // WINGS (spread during attack)
  for(const sx of [-1,1]){
    rc.save(); rc.translate(sx*6,-2); rc.rotate(sx*wingFlap);
    rc.fillStyle='#5A3520';
    rc.beginPath(); rc.ellipse(sx*4,0,6,3.5,sx*0.3,0,Math.PI*2); rc.fill();
    // wing tip feathers
    rc.fillStyle='#4a2a15';
    rc.beginPath(); rc.ellipse(sx*8,1,3,2,sx*0.4,0,Math.PI*2); rc.fill();
    // feather lines
    rc.strokeStyle='rgba(40,20,10,0.2)'; rc.lineWidth=0.4;
    for(let fy=-2;fy<=2;fy+=1.5){
      rc.beginPath(); rc.moveTo(sx*1,fy); rc.lineTo(sx*8,fy+sx*0.5); rc.stroke();
    }
    rc.restore();
  }

  // HEAD (round, large relative to body)
  rc.fillStyle='#6B4226';
  rc.beginPath(); rc.arc(0,-12,6,0,Math.PI*2); rc.fill();

  // facial disc (lighter ring around eyes)
  rc.fillStyle='rgba(210,170,100,0.35)';
  rc.beginPath(); rc.ellipse(0,-12,5.5,5,0,0,Math.PI*2); rc.fill();

  // EAR TUFTS (triangle feathers)
  for(const ex of [-4,4]){
    rc.fillStyle='#5A3520';
    rc.beginPath();
    rc.moveTo(ex,-15);
    rc.lineTo(ex+ex*0.4,-22);
    rc.lineTo(ex+2*Math.sign(ex),-15);
    rc.closePath(); rc.fill();
    // inner tuft
    rc.fillStyle='#7a5030';
    rc.beginPath();
    rc.moveTo(ex,-15);
    rc.lineTo(ex+ex*0.3,-20);
    rc.lineTo(ex+1.5*Math.sign(ex),-15);
    rc.closePath(); rc.fill();
  }

  // EYES (big circular yellow, watchful)
  for(const ex of [-2.5,2.5]){
    // outer glow
    rc.fillStyle='rgba(255,200,0,0.15)'; rc.shadowColor='#FFD700'; rc.shadowBlur=isAtt?8:4;
    rc.beginPath(); rc.arc(ex,-12,3,0,Math.PI*2); rc.fill();
    // iris
    rc.fillStyle='#FFD700'; rc.shadowBlur=0;
    rc.beginPath(); rc.arc(ex,-12,2.5,0,Math.PI*2); rc.fill();
    // pupil
    rc.fillStyle='#111';
    rc.beginPath(); rc.arc(ex,-12,1.2,0,Math.PI*2); rc.fill();
    // highlight
    rc.fillStyle='rgba(255,255,255,0.5)';
    rc.beginPath(); rc.arc(ex+0.5,-12.5,0.5,0,Math.PI*2); rc.fill();
  }

  // BEAK (small, sharp, downward)
  rc.fillStyle='#8B6914';
  rc.beginPath();
  rc.moveTo(-1.5,-9);
  rc.lineTo(0,-6);
  rc.lineTo(1.5,-9);
  rc.closePath(); rc.fill();

  // rapid attack flicker
  if(isAtt && t%6<3){
    rc.fillStyle='rgba(255,200,100,0.15)';
    rc.beginPath(); rc.arc(0,-12,8,0,Math.PI*2); rc.fill();
  }
}

// ═══════════════════════════════════════
//  PROJECTILE RENDERING
// ═══════════════════════════════════════
function hwDrawProjectiles(rc){
  for(const p of H.projectiles){
    rc.save();

    // draw trail (fading previous positions)
    if(p.trail && p.trail.length>1){
      for(let i=1;i<p.trail.length;i++){
        const frac=i/p.trail.length;
        rc.strokeStyle=hwHexAlpha(p.color||'#DAA520', frac*0.5);
        rc.lineWidth=frac*3; rc.lineCap='round';
        rc.beginPath();
        rc.moveTo(p.trail[i-1].x,p.trail[i-1].y);
        rc.lineTo(p.trail[i].x,p.trail[i].y);
        rc.stroke();
      }
    }

    if(p.type==='peck'){
      // small red triangle (beak shape)
      rc.fillStyle='#cc3322'; rc.shadowColor='#ff4400'; rc.shadowBlur=4;
      rc.beginPath();
      rc.moveTo(p.x+5,p.y);
      rc.lineTo(p.x-3,p.y-3);
      rc.lineTo(p.x-3,p.y+3);
      rc.closePath(); rc.fill();

    } else if(p.type==='honk'){
      // white circle with motion lines (sound wave)
      rc.fillStyle='rgba(255,255,255,0.6)'; rc.shadowColor='#fff'; rc.shadowBlur=6;
      rc.beginPath(); rc.arc(p.x,p.y,3,0,Math.PI*2); rc.fill();
      // sound waves
      rc.strokeStyle='rgba(255,255,255,0.3)'; rc.lineWidth=1.5;
      for(let i=1;i<=3;i++){
        rc.globalAlpha=1-i*0.25;
        rc.beginPath(); rc.arc(p.x,p.y,i*4,-0.5,0.5); rc.stroke();
      }
      rc.globalAlpha=1;

    } else if(p.type==='hoot'){
      // small brown feather
      const angle = p.trail && p.trail.length>1 ?
        Math.atan2(p.y-p.trail[p.trail.length-2].y, p.x-p.trail[p.trail.length-2].x) : 0;
      rc.save(); rc.translate(p.x,p.y); rc.rotate(angle);
      rc.fillStyle='#6B4226'; rc.shadowColor='#8B6040'; rc.shadowBlur=4;
      rc.beginPath(); rc.ellipse(0,0,5,2,0,0,Math.PI*2); rc.fill();
      // feather spine
      rc.strokeStyle='rgba(40,20,10,0.5)'; rc.lineWidth=0.5;
      rc.beginPath(); rc.moveTo(-5,0); rc.lineTo(5,0); rc.stroke();
      // barbs
      rc.strokeStyle='rgba(90,50,30,0.3)'; rc.lineWidth=0.4;
      for(let bx=-3;bx<=3;bx+=2){
        rc.beginPath(); rc.moveTo(bx,0); rc.lineTo(bx+1,-1.5); rc.stroke();
        rc.beginPath(); rc.moveTo(bx,0); rc.lineTo(bx+1,1.5); rc.stroke();
      }
      rc.restore();

    } else if(p.type==='charge'){
      // brown streak (ram charge)
      rc.strokeStyle='#8B4513'; rc.lineWidth=4; rc.lineCap='round';
      rc.shadowColor='#DAA520'; rc.shadowBlur=8;
      if(p.trail && p.trail.length>0){
        const last=p.trail[p.trail.length-1];
        rc.beginPath(); rc.moveTo(last.x,last.y); rc.lineTo(p.x,p.y); rc.stroke();
      }
      rc.fillStyle='#DAA520';
      rc.beginPath(); rc.arc(p.x,p.y,3,0,Math.PI*2); rc.fill();

    } else if(p.type==='feather'){
      // white feather (swan)
      const angle = p.trail && p.trail.length>1 ?
        Math.atan2(p.y-p.trail[p.trail.length-2].y, p.x-p.trail[p.trail.length-2].x) : 0;
      rc.save(); rc.translate(p.x,p.y); rc.rotate(angle);
      rc.fillStyle='#fff'; rc.shadowColor='#fff'; rc.shadowBlur=6;
      rc.beginPath(); rc.ellipse(0,0,6,2,0,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(200,200,200,0.5)'; rc.lineWidth=0.4;
      rc.beginPath(); rc.moveTo(-6,0); rc.lineTo(6,0); rc.stroke();
      // shimmer
      rc.fillStyle='rgba(255,215,0,0.3)';
      rc.beginPath(); rc.ellipse(2,-0.5,2,1,0,0,Math.PI*2); rc.fill();
      rc.restore();

    } else if(p.type==='talon'){
      // green claw mark
      rc.strokeStyle='#66aa22'; rc.lineWidth=2; rc.lineCap='round';
      rc.shadowColor='#88dd44'; rc.shadowBlur=6;
      rc.beginPath(); rc.moveTo(p.x-3,p.y-3); rc.lineTo(p.x+2,p.y+2); rc.stroke();
      rc.beginPath(); rc.moveTo(p.x,p.y-4); rc.lineTo(p.x+3,p.y+1); rc.stroke();
      rc.beginPath(); rc.moveTo(p.x+3,p.y-3); rc.lineTo(p.x-1,p.y+3); rc.stroke();

    } else if(p.type==='stampede'){
      // large brown boulder
      rc.shadowColor='#8B4513'; rc.shadowBlur=10;
      const bg=rc.createRadialGradient(p.x-2,p.y-2,1,p.x,p.y,8);
      bg.addColorStop(0,'#a07040'); bg.addColorStop(0.5,'#8B4513'); bg.addColorStop(1,'#5a2a08');
      rc.fillStyle=bg;
      rc.beginPath(); rc.arc(p.x,p.y,7,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(60,30,10,0.5)'; rc.lineWidth=0.8; rc.stroke();
      // crack lines
      rc.strokeStyle='rgba(40,20,5,0.4)'; rc.lineWidth=0.5;
      rc.beginPath(); rc.moveTo(p.x-3,p.y-2); rc.lineTo(p.x+2,p.y+3); rc.stroke();
      rc.beginPath(); rc.moveTo(p.x+1,p.y-4); rc.lineTo(p.x-2,p.y+1); rc.stroke();

    } else if(p.type==='splash'){
      // blue water droplet
      rc.fillStyle='#2299bb'; rc.shadowColor='#44bbdd'; rc.shadowBlur=8;
      rc.beginPath();
      rc.moveTo(p.x,p.y-5);
      rc.bezierCurveTo(p.x-4,p.y-1,p.x-4,p.y+3,p.x,p.y+4);
      rc.bezierCurveTo(p.x+4,p.y+3,p.x+4,p.y-1,p.x,p.y-5);
      rc.fill();
      // highlight
      rc.fillStyle='rgba(200,240,255,0.5)';
      rc.beginPath(); rc.ellipse(p.x-1,p.y-2,1.5,2,0,0,Math.PI*2); rc.fill();

    } else if(p.type==='cannonball'){
      // gray stone cannonball with smoke trail
      if(p.trail && p.trail.length>1){
        for(let i=1;i<p.trail.length;i++){
          const frac=i/p.trail.length;
          rc.strokeStyle=`rgba(100,90,80,${frac*0.4})`;
          rc.lineWidth=frac*5; rc.lineCap='round';
          rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
        }
      }
      rc.shadowColor='#888'; rc.shadowBlur=6;
      const cg=rc.createRadialGradient(p.x-1,p.y-1,1,p.x,p.y,6);
      cg.addColorStop(0,'#aaa'); cg.addColorStop(0.5,'#666'); cg.addColorStop(1,'#333');
      rc.fillStyle=cg;
      rc.beginPath(); rc.arc(p.x,p.y,6,0,Math.PI*2); rc.fill();
      rc.strokeStyle='rgba(80,80,80,0.4)'; rc.lineWidth=0.7; rc.stroke();

    } else {
      // default: colored circle
      rc.fillStyle=p.color||'#DAA520';
      rc.shadowColor=p.color||'#DAA520'; rc.shadowBlur=8;
      rc.beginPath(); rc.arc(p.x,p.y,4,0,Math.PI*2); rc.fill();
      // inner highlight
      rc.fillStyle='rgba(255,255,255,0.4)';
      rc.beginPath(); rc.arc(p.x-1,p.y-1,1.5,0,Math.PI*2); rc.fill();
    }

    rc.restore();
  }
}
