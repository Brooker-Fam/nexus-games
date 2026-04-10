// ── HOMESTEAD WARS — ELITE UNIT RENDERING ──

function hwDrawEliteUnit(rc, e){
  const x=e.x, y=e.y;
  const bob=Math.sin(e.frame*0.1)*2;

  // Shadow
  rc.fillStyle='rgba(0,0,0,0.2)';
  rc.beginPath();
  rc.ellipse(x,y+2,14,5,0,0,Math.PI*2);
  rc.fill();

  rc.save();
  rc.translate(x,y+bob);

  if(e.faction==='barnyard') hwDrawEliteRam(rc, e);
  else if(e.faction==='creek') hwDrawEliteSwan(rc, e);
  else hwDrawEliteHawk(rc, e);

  rc.restore();

  if(e.selected) hwDrawSelectionRing(rc, x, y+2, 16, 7, 2);
  if(e.hp<e.maxHp) hwDrawHealthBar(rc, x, y-22+bob, 24, 2, e.hp, e.maxHp);
}

function hwDrawEliteRam(rc, e){
  // Ram — gray woolly body with curved horns
  const charge = e.state==='attack' ? Math.sin(e.frame*0.3)*2 : 0;

  // Body
  rc.fillStyle='#999';
  rc.beginPath();
  rc.ellipse(0+charge,0,12,8,0,0,Math.PI*2);
  rc.fill();

  // Wool texture
  rc.fillStyle='#bbb';
  for(let i=0;i<6;i++){
    const wx=-6+i*3+charge, wy=-4+Math.sin(i*1.5)*3;
    rc.beginPath();
    rc.arc(wx,wy,3,0,Math.PI*2);
    rc.fill();
  }

  // Head
  rc.fillStyle='#777';
  rc.beginPath();
  rc.arc(10+charge,-4,5,0,Math.PI*2);
  rc.fill();

  // Horns (curved)
  rc.strokeStyle='#DAA520';
  rc.lineWidth=3;
  rc.lineCap='round';
  for(const sy of [-1,1]){
    rc.beginPath();
    rc.moveTo(8+charge,-6+sy*2);
    rc.quadraticCurveTo(4+charge,-12+sy*6,8+charge,-14+sy*8);
    rc.stroke();
  }

  // Eye
  rc.fillStyle='#FFD700';
  rc.beginPath();
  rc.arc(12+charge,-5,1.5,0,Math.PI*2);
  rc.fill();
  rc.fillStyle='#111';
  rc.beginPath();
  rc.arc(12+charge,-5,0.8,0,Math.PI*2);
  rc.fill();

  // Legs
  rc.fillStyle='#666';
  rc.fillRect(-6,6,3,6);
  rc.fillRect(-1,6,3,6);
  rc.fillRect(4,6,3,6);
  rc.fillRect(9,6,3,6);
}

function hwDrawEliteSwan(rc, e){
  // Swan — elegant white with long neck and small crown
  const graceful = Math.sin(e.frame*0.08)*1;

  // Body
  rc.fillStyle='#fff';
  rc.beginPath();
  rc.ellipse(0,0,10,7,0,0,Math.PI*2);
  rc.fill();

  // Wing
  rc.fillStyle='#eee';
  rc.save();
  rc.translate(-3,-2);
  rc.rotate(Math.sin(e.frame*0.1)*0.1);
  rc.beginPath();
  rc.ellipse(0,0,8,5,0.2,0,Math.PI*2);
  rc.fill();
  rc.restore();

  // Neck (long elegant S-curve)
  rc.strokeStyle='#fff';
  rc.lineWidth=4;
  rc.beginPath();
  rc.moveTo(8,-4);
  rc.bezierCurveTo(12,-12,6,-18,8+graceful,-22);
  rc.stroke();

  // Head
  rc.fillStyle='#fff';
  rc.beginPath();
  rc.arc(8+graceful,-22,3.5,0,Math.PI*2);
  rc.fill();

  // Crown/tiara
  rc.fillStyle='#FFD700';
  rc.beginPath();
  rc.moveTo(6+graceful,-25);
  rc.lineTo(7+graceful,-28);
  rc.lineTo(8+graceful,-25.5);
  rc.lineTo(9+graceful,-28);
  rc.lineTo(10+graceful,-25);
  rc.closePath();
  rc.fill();

  // Beak
  rc.fillStyle='#FF8C00';
  rc.beginPath();
  rc.moveTo(10+graceful,-23);
  rc.lineTo(14+graceful,-22);
  rc.lineTo(10+graceful,-21);
  rc.closePath();
  rc.fill();

  // Eye
  rc.fillStyle='#111';
  rc.beginPath();
  rc.arc(9+graceful,-23,1,0,Math.PI*2);
  rc.fill();
}

function hwDrawEliteHawk(rc, e){
  // Hawk — sleek dark bird with sharp features
  const dive = e.state==='attack' ? Math.sin(e.frame*0.25)*3 : 0;

  // Body
  rc.fillStyle='#4a3020';
  rc.beginPath();
  rc.ellipse(0+dive,0,9,6,0,0,Math.PI*2);
  rc.fill();

  // Wings (spread)
  rc.fillStyle='#3a2515';
  for(const sx of [-1,1]){
    rc.save();
    rc.translate(sx*4,-2);
    rc.rotate(sx*(0.3+Math.sin(e.frame*0.15)*0.15));
    rc.beginPath();
    rc.ellipse(sx*6,0,8,3,sx*0.3,0,Math.PI*2);
    rc.fill();
    // Wing tips
    rc.fillStyle='#2a1a10';
    rc.beginPath();
    rc.ellipse(sx*12,-1,4,2,sx*0.4,0,Math.PI*2);
    rc.fill();
    rc.restore();
  }

  // Head
  rc.fillStyle='#4a3020';
  rc.beginPath();
  rc.arc(8+dive,-4,4,0,Math.PI*2);
  rc.fill();

  // Beak (sharp, curved)
  rc.fillStyle='#8B6914';
  rc.beginPath();
  rc.moveTo(11+dive,-5);
  rc.lineTo(16+dive,-4);
  rc.lineTo(11+dive,-3);
  rc.closePath();
  rc.fill();

  // Eye (keen)
  rc.fillStyle='#FFD700';
  rc.beginPath();
  rc.arc(9+dive,-5,1.5,0,Math.PI*2);
  rc.fill();
  rc.fillStyle='#111';
  rc.beginPath();
  rc.arc(9+dive,-5,0.8,0,Math.PI*2);
  rc.fill();

  // Tail
  rc.fillStyle='#3a2515';
  rc.beginPath();
  rc.moveTo(-8,0);
  rc.lineTo(-14,2);
  rc.lineTo(-14,-2);
  rc.closePath();
  rc.fill();
}

// ── ELITE2: TANK-TYPE UNITS ──

function hwDrawTankUnit(rc, e){
  const x=e.x, y=e.y;
  const bob=Math.sin(e.frame*0.08)*1;

  rc.fillStyle='rgba(0,0,0,0.25)';
  rc.beginPath();
  rc.ellipse(x,y+2,18,6,0,0,Math.PI*2);
  rc.fill();

  rc.save();
  rc.translate(x,y+bob);

  if(e.faction==='barnyard') hwDrawBullBody(rc, e);
  else if(e.faction==='woodland') hwDrawBearBody(rc, e);
  else hwDrawBullBody(rc, e); // fallback

  rc.restore();

  if(e.selected) hwDrawSelectionRing(rc, x, y+2, 20, 8, 2);
  if(e.hp<e.maxHp) hwDrawHealthBar(rc, x, y-28+bob, 30, 3, e.hp, e.maxHp);
}

function hwDrawBullBody(rc, e){
  // Bull — massive brown body with horns and nose ring
  const stomp = e.state==='attack' ? Math.sin(e.frame*0.2)*2 : 0;

  // Body
  rc.fillStyle='#6B3A1F';
  rc.beginPath();
  rc.ellipse(0+stomp,0,15,10,0,0,Math.PI*2);
  rc.fill();

  // Muscles
  rc.fillStyle='#5A2E18';
  rc.beginPath();
  rc.ellipse(-3+stomp,-2,8,6,0.1,0,Math.PI*2);
  rc.fill();

  // Head
  rc.fillStyle='#5A2E18';
  rc.beginPath();
  rc.arc(14+stomp,-2,6,0,Math.PI*2);
  rc.fill();

  // Horns (wide)
  rc.strokeStyle='#DAA520';
  rc.lineWidth=3;
  rc.lineCap='round';
  for(const sy of [-1,1]){
    rc.beginPath();
    rc.moveTo(12+stomp,-4+sy*4);
    rc.quadraticCurveTo(16+stomp,-10+sy*10,10+stomp,-12+sy*12);
    rc.stroke();
  }

  // Nose ring
  rc.strokeStyle='#FFD700';
  rc.lineWidth=1.5;
  rc.beginPath();
  rc.arc(18+stomp,0,3,0.3,Math.PI-0.3);
  rc.stroke();

  // Eyes
  rc.fillStyle='#ff2211';
  rc.beginPath();
  rc.arc(16+stomp,-4,1.5,0,Math.PI*2);
  rc.fill();

  // Legs
  rc.fillStyle='#4a2010';
  for(const [lx,ly] of [[-8,8],[-3,8],[4,8],[10,8]]){
    rc.fillRect(lx+stomp,ly,4,8);
  }

  // Steam from nostrils when attacking
  if(e.state==='attack'){
    rc.fillStyle='rgba(200,200,200,0.3)';
    for(let i=0;i<3;i++){
      rc.beginPath();
      rc.arc(22+stomp+i*3,-1+Math.sin(e.frame*0.5+i)*2,1.5-i*0.3,0,Math.PI*2);
      rc.fill();
    }
  }
}

function hwDrawBearBody(rc, e){
  // Bear — massive dark brown with powerful arms
  const swipe = e.state==='attack' ? Math.sin(e.frame*0.25)*3 : 0;

  // Body (standing upright-ish)
  rc.fillStyle='#4a2a15';
  rc.beginPath();
  rc.ellipse(0,0,13,14,0,0,Math.PI*2);
  rc.fill();

  // Belly
  rc.fillStyle='#6a4a30';
  rc.beginPath();
  rc.ellipse(0,3,8,8,0,0,Math.PI*2);
  rc.fill();

  // Arms
  for(const sx of [-1,1]){
    rc.fillStyle='#4a2a15';
    rc.save();
    rc.translate(sx*12,-4);
    rc.rotate(sx*0.3+sx*swipe*0.1);
    rc.beginPath();
    rc.ellipse(0,4,5,8,0,0,Math.PI*2);
    rc.fill();
    // Claws
    rc.fillStyle='#222';
    for(let c=0;c<3;c++){
      rc.beginPath();
      rc.arc(sx*2,10+c*2,1,0,Math.PI*2);
      rc.fill();
    }
    rc.restore();
  }

  // Head
  rc.fillStyle='#4a2a15';
  rc.beginPath();
  rc.arc(0,-16,7,0,Math.PI*2);
  rc.fill();

  // Ears
  for(const ex of [-5,5]){
    rc.fillStyle='#3a1a0a';
    rc.beginPath();
    rc.arc(ex,-22,3,0,Math.PI*2);
    rc.fill();
    rc.fillStyle='#6a4a30';
    rc.beginPath();
    rc.arc(ex,-22,1.5,0,Math.PI*2);
    rc.fill();
  }

  // Eyes
  rc.fillStyle='#111';
  for(const ex of [-3,3]){
    rc.beginPath();
    rc.arc(ex,-16,1.5,0,Math.PI*2);
    rc.fill();
  }

  // Nose
  rc.fillStyle='#222';
  rc.beginPath();
  rc.ellipse(0,-13,2.5,1.5,0,0,Math.PI*2);
  rc.fill();

  // Legs
  rc.fillStyle='#3a1a0a';
  rc.fillRect(-8,12,5,6);
  rc.fillRect(3,12,5,6);
}

// ── ELITE2: WIZARD-TYPE (PELICAN) ──

function hwDrawPelicanUnit(rc, e){
  const x=e.x, y=e.y;
  const bob=Math.sin(e.frame*0.1)*2;

  rc.fillStyle='rgba(0,0,0,0.2)';
  rc.beginPath();
  rc.ellipse(x,y+2,14,5,0,0,Math.PI*2);
  rc.fill();

  rc.save();
  rc.translate(x,y+bob);

  const splash = e.state==='attack' ? Math.sin(e.frame*0.3)*2 : 0;

  // Body
  rc.fillStyle='#ddd';
  rc.beginPath();
  rc.ellipse(0,0,10,8,0,0,Math.PI*2);
  rc.fill();

  // Wings
  for(const sx of [-1,1]){
    rc.fillStyle='#ccc';
    rc.save();
    rc.translate(sx*5,-3);
    rc.rotate(sx*Math.sin(e.frame*0.12)*0.2);
    rc.beginPath();
    rc.ellipse(sx*5,0,7,3,sx*0.3,0,Math.PI*2);
    rc.fill();
    rc.restore();
  }

  // Neck
  rc.strokeStyle='#ddd';
  rc.lineWidth=5;
  rc.beginPath();
  rc.moveTo(6,-5);
  rc.quadraticCurveTo(10,-12,8+splash,-18);
  rc.stroke();

  // Head
  rc.fillStyle='#eee';
  rc.beginPath();
  rc.arc(8+splash,-18,4,0,Math.PI*2);
  rc.fill();

  // Giant beak with pouch
  rc.fillStyle='#FF8C00';
  rc.beginPath();
  rc.moveTo(10+splash,-20);
  rc.lineTo(20+splash,-18);
  rc.lineTo(10+splash,-14);
  rc.closePath();
  rc.fill();

  // Pouch
  rc.fillStyle='#cc7700';
  rc.beginPath();
  rc.moveTo(10+splash,-16);
  rc.quadraticCurveTo(15+splash,-12,10+splash,-14);
  rc.fill();

  // Eye
  rc.fillStyle='#111';
  rc.beginPath();
  rc.arc(9+splash,-19,1.2,0,Math.PI*2);
  rc.fill();

  rc.restore();

  if(e.selected) hwDrawSelectionRing(rc, x, y+2, 16, 7, 2);
  if(e.hp<e.maxHp) hwDrawHealthBar(rc, x, y-24+bob, 24, 2, e.hp, e.maxHp);
}
