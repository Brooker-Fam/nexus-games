// ── DRAW WARRIORS ──
function drawRTSWarrior(rc,w){
  const cfg=FACTION_CFG[w.faction];
  if(!cfg) return;
  const bob=Math.sin(w.frame*0.15)*1.5;
  const facing = w.side==='player'?1:-1;
  rc.save(); rc.translate(w.x, w.y+bob);

  if(w.aerial){
    // Aerial units rotate to face their target.
    // Hover bob is applied in screen-space (before rotation) so it always moves up/down.
    const isHeavyAerial = w.subtype==='skyattacker'||w.subtype==='warship'||w.subtype==='destroyer';
    const hover = isHeavyAerial ? Math.sin(w.frame*0.1)*2.5 : Math.sin(w.frame*0.12)*3;
    // Ground shadow — drawn before rotation so it stays flat below the unit.
    rc.fillStyle='rgba(0,0,0,0.18)';
    rc.beginPath(); rc.ellipse(0, 20, isHeavyAerial?18:14, 5, 0, 0, Math.PI*2); rc.fill();
    // Move unit up by floating height (screen-space, pre-rotation).
    rc.translate(0, -8+hover);
    // Now rotate to face target. Default direction is right (0) for player, left (π) for enemy.
    const defaultAngle = w.side==='player' ? 0 : Math.PI;
    const angle = w.aimAngle !== undefined ? w.aimAngle : defaultAngle;
    rc.rotate(angle);
  } else {
    if(facing===-1) rc.scale(-1,1);
  }

  rc.shadowColor=cfg.color; rc.shadowBlur=12;

  if(w.subtype==='starfighter'){
    if(w.faction==='prism') drawPrismWarDrone(rc,cfg,w);
    else drawShadowWraith(rc,cfg,w);
  } else if(w.subtype==='skyattacker'){
    drawSkyAttackerUnit(rc,cfg,w);
  } else if(w.subtype==='warship'){
    drawWarshipUnit(rc,cfg,w);
  } else if(w.subtype==='lightfighter'){
    drawLightFighterUnit(rc,cfg,w);
  } else if(w.subtype==='destroyer'){
    drawDestroyerUnit(rc,cfg,w);
  } else if(w.subtype==='warbot'){
    drawWarbot(rc,cfg,w);
  } else if(w.subtype==='legionnaire'){
    drawLegionnaire(rc,cfg,w);
  } else if(w.subtype==='elite'||w.subtype==='princess'){
    if(w.faction==='prism') drawEliteOracle(rc,cfg,w);
    else if(w.faction==='shadow') drawEliteDarkWarrior(rc,cfg,w);
    else drawEliteShockbot(rc,cfg,w);
  } else if(w.subtype==='wizard'){
    drawWizard(rc,cfg,w);
  } else if(w.subtype==='necromancer'){
    drawNecromancer(rc,cfg,w);
  } else if(w.subtype==='tank'){
    drawTankUnit(rc,cfg,w);
  } else if(w.subtype==='bloodhound'){
    drawBloodhound(rc,cfg,w);
  } else if(w.subtype==='assaultbot'){
    drawAssaultBot(rc,cfg,w);
  } else if(w.subtype==='psionic'){
    drawPsionicWarrior(rc,cfg,w);
  } else {
    if(w.faction==='prism') drawWarriorPrism(rc,cfg,w);
    else if(w.faction==='shadow') drawWarriorShadow(rc,cfg,w);
    else drawWarriorRoboto(rc,cfg,w);
  }

  rc.restore();
  // selection ring
  if(w.selected) drawSelectionRing(rc, w.x, w.y, 18, 8, 2.5);
  if(w.hp<w.maxHp) drawHealthBar(rc, w.x, w.y-26, 20, 3, w.hp, w.maxHp);
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

  // CLOAK — streams behind when marching, stays flat (no sideways puff)
  const cTrail = isMarching ? 5 : isAttacking ? 2 : 0;
  const cGrad=rc.createLinearGradient(-10,-30,4,8);
  cGrad.addColorStop(0,'#120020'); cGrad.addColorStop(1,'#04000a');
  rc.fillStyle=cGrad;
  rc.beginPath();
  rc.moveTo(-5,-22);
  rc.quadraticCurveTo(-12-cTrail, -4, -10-cTrail, 8);
  rc.lineTo(7,8);
  rc.quadraticCurveTo(10,-4,6,-22);
  rc.closePath(); rc.fill();
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

// ── WARBOT (Roboto Barracks, tier 2) — bulkier, up-armored GunBot ──
function drawWarbot(rc,cfg,w){
  const t = w.frame;
  const isAttacking = w.state==='attack';
  const isMarching  = w.state==='march';

  // LEGS — heavy, wide stride
  for(const [lx, phase] of [[-7,0],[4,Math.PI]]){
    const step = isMarching ? Math.sin(t*0.2+phase)*4 : 0;
    rc.fillStyle='#22181a'; rc.fillRect(lx,-4+step,9,15); rc.strokeStyle='rgba(255,60,0,0.3)'; rc.lineWidth=0.6; rc.strokeRect(lx,-4+step,9,15);
    rc.fillStyle='#151011'; rc.beginPath(); rc.roundRect(lx-2,10+step,13,5,1); rc.fill();
  }

  // TORSO — thicker double-plated hull
  const lean = isMarching ? 0.1 : 0;
  rc.save(); rc.rotate(lean);
  const tGrad=rc.createLinearGradient(-13,-30,13,2);
  tGrad.addColorStop(0,'#42383a'); tGrad.addColorStop(1,'#161112');
  rc.fillStyle=tGrad; rc.beginPath(); rc.roundRect(-13,-30,26,32,3); rc.fill();
  rc.strokeStyle='rgba(255,60,0,0.5)'; rc.lineWidth=1; rc.stroke();
  for(let vy=-24;vy<=-4;vy+=7){ rc.fillStyle='#0a0808'; rc.fillRect(-9,vy,18,4.5); }
  // dual power core
  const coreFlash = isAttacking ? 0.5+Math.sin(t*0.5)*0.5 : 0.7;
  for(const cx of [-4,4]){
    const cG=rc.createRadialGradient(cx,-12,0,cx,-12,3.5+coreFlash*2);
    cG.addColorStop(0,'#ffe066'); cG.addColorStop(0.5,`rgba(255,${isAttacking?40:80},0,${coreFlash})`); cG.addColorStop(1,'transparent');
    rc.fillStyle=cG; rc.beginPath(); rc.arc(cx,-12,3.5+coreFlash*1.5,0,Math.PI*2); rc.fill();
  }
  rc.restore();

  // LEFT ARM — heavy shoulder guard
  const leftSwing = isMarching ? Math.sin(t*0.2+Math.PI)*5 : 0;
  rc.fillStyle='#241a1a'; rc.fillRect(-17,-26+leftSwing,7,20); rc.strokeStyle='rgba(255,60,0,0.35)'; rc.lineWidth=0.6; rc.strokeRect(-17,-26+leftSwing,7,20);
  rc.fillStyle='#332222'; rc.beginPath(); rc.roundRect(-19,-30,11,10,2); rc.fill();

  // DUAL-BARREL CANNON ARM — heavy recoil
  const recoil = isAttacking ? Math.max(0,Math.sin(t*0.5))*5 : 0;
  rc.fillStyle='#221512'; rc.fillRect(11-recoil,-26,8,18); rc.strokeStyle='rgba(255,80,0,0.5)'; rc.lineWidth=0.6; rc.strokeRect(11-recoil,-26,8,18);
  for(const [gx,gy] of [[13,-26],[20,-26]]){
    rc.fillStyle='#181010'; rc.fillRect(gx-recoil,gy,4,22); rc.strokeStyle='rgba(255,80,0,0.45)'; rc.lineWidth=0.5; rc.strokeRect(gx-recoil,gy,4,22);
  }
  const flashSize = isAttacking ? 8+Math.sin(t*0.5)*6 : 3;
  for(const gx of [15,22]){
    const mg=rc.createRadialGradient(gx-recoil,-4,0,gx-recoil,-4,flashSize);
    mg.addColorStop(0,`rgba(255,200,140,${isAttacking?0.95:0.25})`);
    mg.addColorStop(0.5,`rgba(255,60,0,${isAttacking?0.7:0.1})`);
    mg.addColorStop(1,'transparent');
    rc.fillStyle=mg; rc.beginPath(); rc.arc(gx-recoil,-4,flashSize,0,Math.PI*2); rc.fill();
  }

  // HEAD — heavier browplate, twin antennae
  const hG=rc.createLinearGradient(-9,-42,9,-26);
  hG.addColorStop(0,'#403436'); hG.addColorStop(1,'#181416');
  rc.fillStyle=hG; rc.beginPath(); rc.roundRect(-9,-42,18,16,3); rc.fill();
  rc.strokeStyle='rgba(255,60,0,0.5)'; rc.lineWidth=0.8; rc.stroke();
  rc.fillStyle='#1a1212'; rc.fillRect(-9,-42,18,4);
  const vG=rc.createLinearGradient(-7,-38,7,-32);
  const vc = isAttacking ? 'rgba(255,40,0,' : 'rgba(255,120,0,';
  vG.addColorStop(0,vc+'0.2)'); vG.addColorStop(0.5,vc+'0.95)'); vG.addColorStop(1,vc+'0.2)');
  rc.fillStyle=vG; rc.beginPath(); rc.roundRect(-7,-38,14,6,1); rc.fill();
  const sx2=(t*2)%14-7;
  rc.fillStyle='rgba(255,255,200,0.6)'; rc.fillRect(sx2,-38,2,6);
  for(const ax of [-4,4]){
    rc.strokeStyle='#555'; rc.lineWidth=1.4;
    rc.beginPath(); rc.moveTo(ax,-42); rc.lineTo(ax*1.3,-49); rc.stroke();
    const blink = isAttacking ? (t%8<4) : (t%60<30);
    rc.fillStyle=blink?'#ff3300':'#440000'; rc.shadowColor='#ff3300'; rc.shadowBlur=blink?8:2;
    rc.beginPath(); rc.arc(ax*1.3,-49,1.6,0,Math.PI*2); rc.fill();
  }
}

// ── LEGIONNAIRE (Prism Portal, tier 2) — sword-and-shield squad soldier ──
function drawLegionnaire(rc,cfg,w){
  const t = w.frame;
  const isAttacking = w.state==='attack';
  const isMarching  = w.state==='march';

  // LEGS — armored greaves
  rc.strokeStyle='#446688'; rc.lineWidth=3.5; rc.lineCap='round';
  rc.beginPath(); rc.moveTo(-3,6); rc.lineTo(-4+Math.sin(t*0.25)*5,17); rc.stroke();
  rc.beginPath(); rc.moveTo(3,6);  rc.lineTo(4-Math.sin(t*0.25)*5,17); rc.stroke();

  // CUIRASS — short soldier's tunic, not a full robe
  const rGrad=rc.createLinearGradient(-9,-20,9,8);
  rGrad.addColorStop(0,'#eaf8ff'); rGrad.addColorStop(1,'#5a9ac0');
  rc.fillStyle=rGrad;
  rc.beginPath(); rc.moveTo(-8,-18); rc.lineTo(-9,4); rc.quadraticCurveTo(-9,9,-4,9); rc.lineTo(4,9); rc.quadraticCurveTo(9,9,9,4); rc.lineTo(8,-18); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(100,200,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  rc.fillStyle='rgba(0,220,255,0.6)'; rc.shadowColor='#00ddff'; rc.shadowBlur=6;
  rc.beginPath(); rc.arc(0,-9,3,0,Math.PI*2); rc.fill();

  // SHIELD ARM
  const shieldBob = isMarching ? Math.sin(t*0.25)*2 : 0;
  rc.save(); rc.translate(-9,-10+shieldBob);
  const shG=rc.createRadialGradient(0,0,0,0,0,9);
  shG.addColorStop(0,'#dff4ff'); shG.addColorStop(0.6,'#7ab8dd'); shG.addColorStop(1,'#33607f');
  rc.fillStyle=shG; rc.beginPath(); rc.ellipse(0,0,6,9,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(200,240,255,0.6)'; rc.lineWidth=1; rc.stroke();
  rc.strokeStyle='rgba(0,200,255,0.5)'; rc.lineWidth=0.8;
  rc.beginPath(); rc.moveTo(0,-7); rc.lineTo(0,7); rc.moveTo(-4,0); rc.lineTo(4,0); rc.stroke();
  rc.restore();

  // WEAPON ARM — legionnaires can trade their sword for a ranged light bow
  if(w.bowMode){
    const draw = isAttacking ? Math.sin(t*0.45)*2 : 0;
    rc.save(); rc.translate(8,-13); rc.rotate(-0.2);
    rc.strokeStyle='#dff8ff'; rc.lineWidth=3; rc.lineCap='round';
    rc.beginPath(); rc.arc(8+draw,0,13,-Math.PI/2,Math.PI/2); rc.stroke();
    rc.strokeStyle='rgba(0,220,255,0.85)'; rc.lineWidth=1.2;
    rc.beginPath(); rc.moveTo(8+draw,-13); rc.lineTo(isAttacking?-2:2,0); rc.lineTo(8+draw,13); rc.stroke();
    rc.strokeStyle='#ffffff'; rc.lineWidth=1.5;
    rc.beginPath(); rc.moveTo(isAttacking?-4:1,0); rc.lineTo(28,0); rc.stroke();
    rc.fillStyle='#00ddff'; rc.beginPath(); rc.moveTo(30,0); rc.lineTo(25,-3); rc.lineTo(25,3); rc.closePath(); rc.fill();
    rc.restore();
  } else if(isAttacking){
    const slashAngle = Math.sin(t*0.35)*0.7-0.3;
    rc.save(); rc.rotate(slashAngle);
    rc.strokeStyle='#c8e8ff'; rc.lineWidth=5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(7,-16); rc.lineTo(19,-4); rc.stroke();
    rc.shadowColor='#00eeff'; rc.shadowBlur=18;
    const sGrad=rc.createLinearGradient(19,-4,40,-24);
    sGrad.addColorStop(0,'#ffffff'); sGrad.addColorStop(0.35,'#88eeff'); sGrad.addColorStop(1,'#0077aa');
    rc.strokeStyle=sGrad; rc.lineWidth=3.5;
    rc.beginPath(); rc.moveTo(19,-4); rc.lineTo(40,-24); rc.stroke();
    rc.strokeStyle='rgba(255,255,255,0.7)'; rc.lineWidth=1.2;
    rc.beginPath(); rc.moveTo(20,-5); rc.lineTo(41,-25); rc.stroke();
    rc.strokeStyle='rgba(120,220,255,0.25)'; rc.lineWidth=7;
    rc.beginPath(); rc.arc(9,-13,20,-Math.PI*0.6+slashAngle,-Math.PI*0.1+slashAngle); rc.stroke();
    rc.restore();
  } else {
    const armBob = isMarching ? Math.sin(t*0.25)*4 : 0;
    rc.strokeStyle='#c8e8ff'; rc.lineWidth=4.5; rc.lineCap='round';
    rc.beginPath(); rc.moveTo(8,-16); rc.lineTo(16+armBob,-9+armBob*0.3); rc.stroke();
    rc.save(); rc.shadowColor='#00eeff'; rc.shadowBlur=12;
    const sGrad2=rc.createLinearGradient(16,-9,32,-27);
    sGrad2.addColorStop(0,'#dff8ff'); sGrad2.addColorStop(0.5,'#33bbee'); sGrad2.addColorStop(1,'#005577');
    rc.strokeStyle=sGrad2; rc.lineWidth=3;
    rc.beginPath(); rc.moveTo(16+armBob,-9); rc.lineTo(32+armBob,-27); rc.stroke();
    rc.restore();
  }

  // HEAD
  rc.fillStyle='#fff0e8'; rc.beginPath(); rc.ellipse(0,-25,6,7,0,0,Math.PI*2); rc.fill();
  for(const ex of [-2,2]){
    const eg=rc.createRadialGradient(ex,-25,0,ex,-25,isAttacking?3.5:2.2);
    eg.addColorStop(0,'#fff'); eg.addColorStop(0.5,'#44ddff'); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(ex,-25,isAttacking?3.5:2.2,0,Math.PI*2); rc.fill();
  }

  // HELMET — crested, legion-styled
  const hmG=rc.createLinearGradient(-7,-36,7,-24);
  hmG.addColorStop(0,'#dff0ff'); hmG.addColorStop(1,'#5a9ac0');
  rc.fillStyle=hmG; rc.beginPath(); rc.ellipse(0,-30,7,8,0,Math.PI,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(0,200,255,0.5)'; rc.lineWidth=0.8; rc.stroke();
  rc.fillStyle='#a8ccdd'; rc.beginPath(); rc.moveTo(-7,-30); rc.lineTo(-7,-22); rc.lineTo(-4,-24); rc.closePath(); rc.fill();
  rc.beginPath(); rc.moveTo(7,-30); rc.lineTo(7,-22); rc.lineTo(4,-24); rc.closePath(); rc.fill();
  // crest plume
  rc.fillStyle='#00ddff'; rc.shadowColor='#00eeff'; rc.shadowBlur=10;
  rc.beginPath();
  rc.moveTo(-1,-36); rc.quadraticCurveTo(-6,-44,-2,-50); rc.quadraticCurveTo(2,-44,1,-36);
  rc.closePath(); rc.fill();
}

function drawRTSProjectiles(rc){
  for(const p of S.projectiles){
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
        const a=(i/4)*Math.PI*2+S.frame*0.3;
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
      const oa=S.frame*0.25;
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
        const ra=(ri/6)*Math.PI*2+S.frame*0.1;
        const cols=['#ff88aa','#ffff44','#44ff88','#44aaff','#bb44ff','#ff8844'];
        rc.strokeStyle=cols[ri]; rc.lineWidth=0.8; rc.globalAlpha=0.6;
        rc.beginPath(); rc.arc(p.x,p.y,14,ra,ra+0.8); rc.stroke();
        rc.globalAlpha=1;
      }
    } else if(p.type==='beam'){
      // light fighter — bright laser bolt
      if(p.trail.length>1){
        for(let i=1;i<p.trail.length;i++){
          const frac=i/p.trail.length;
          rc.strokeStyle=`rgba(255,255,255,${frac*0.7})`;
          rc.lineWidth=frac*4; rc.lineCap='round';
          rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
        }
        const last=p.trail[p.trail.length-1];
        rc.shadowColor='#ffffff'; rc.shadowBlur=18;
        rc.strokeStyle='rgba(180,255,255,0.5)'; rc.lineWidth=5; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(last.x,last.y); rc.lineTo(p.x,p.y); rc.stroke();
        rc.strokeStyle='rgba(255,255,255,0.95)'; rc.lineWidth=2.5;
        rc.beginPath(); rc.moveTo(last.x,last.y); rc.lineTo(p.x,p.y); rc.stroke();
      }
      const bg=rc.createRadialGradient(p.x,p.y,0,p.x,p.y,7);
      bg.addColorStop(0,'#ffffff'); bg.addColorStop(0.5,'#aaffff'); bg.addColorStop(1,'transparent');
      rc.fillStyle=bg; rc.beginPath(); rc.arc(p.x,p.y,7,0,Math.PI*2); rc.fill();
    } else if(p.type==='darkorb'){
      // destroyer — slow void orb with orbiting particles
      for(let i=1;i<p.trail.length;i++){
        const frac=i/p.trail.length;
        rc.strokeStyle=`rgba(60,0,100,${frac*0.4})`;
        rc.lineWidth=frac*7; rc.lineCap='round';
        rc.beginPath(); rc.moveTo(p.trail[i-1].x,p.trail[i-1].y); rc.lineTo(p.trail[i].x,p.trail[i].y); rc.stroke();
      }
      rc.shadowColor='#7700cc'; rc.shadowBlur=20;
      const dg=rc.createRadialGradient(p.x,p.y,0,p.x,p.y,13);
      dg.addColorStop(0,'#2a0044'); dg.addColorStop(0.5,'#5500aa'); dg.addColorStop(1,'transparent');
      rc.fillStyle=dg; rc.beginPath(); rc.arc(p.x,p.y,13,0,Math.PI*2); rc.fill();
      for(let oi=0;oi<3;oi++){
        const oa=S.frame*0.15+oi*(Math.PI*2/3);
        rc.fillStyle='rgba(180,80,255,0.8)';
        rc.beginPath(); rc.arc(p.x+Math.cos(oa)*8,p.y+Math.sin(oa)*8,2,0,Math.PI*2); rc.fill();
      }
      rc.fillStyle='#0a0014'; rc.beginPath(); rc.arc(p.x,p.y,5,0,Math.PI*2); rc.fill();
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
      const a=S.frame*0.18;
      rc.fillStyle='rgba(255,255,255,0.9)';
      rc.beginPath(); rc.arc(p.x+Math.cos(a)*6,p.y+Math.sin(a)*4,2,0,Math.PI*2); rc.fill();
    }
    rc.restore();
  }
}

// ── AERIAL UNIT DRAWING ──
// Star Fighter — sleek prism/shadow fighter, angled delta silhouette, glows faction color
// Drawn at origin facing right; rotation + hover applied by caller (drawRTSWarrior).
// ── PRISM WAR DRONE — crystalline interceptor, swept X-wings, prismatic core ──
function drawPrismWarDrone(rc,cfg,w){
  rc.shadowColor=cfg.color; rc.shadowBlur=22;

  // engine glow (rear)
  const pulse=0.5+Math.sin(w.frame*0.28)*0.5;
  const eg=rc.createRadialGradient(-12,0,0,-12,0,7);
  eg.addColorStop(0,`rgba(0,245,255,${pulse})`); eg.addColorStop(1,'transparent');
  rc.fillStyle=eg; rc.beginPath(); rc.arc(-12,0,7,0,Math.PI*2); rc.fill();

  // upper crystal wing
  const wg1=rc.createLinearGradient(-10,-14,6,-2);
  wg1.addColorStop(0,'rgba(200,255,255,0.9)'); wg1.addColorStop(1,'rgba(0,200,220,0.6)');
  rc.fillStyle=wg1;
  rc.beginPath(); rc.moveTo(-4,-2); rc.lineTo(6,-2); rc.lineTo(-2,-15); rc.lineTo(-11,-10); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,255,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // lower crystal wing (mirrored)
  const wg2=rc.createLinearGradient(-10,14,6,2);
  wg2.addColorStop(0,'rgba(200,255,255,0.9)'); wg2.addColorStop(1,'rgba(0,200,220,0.6)');
  rc.fillStyle=wg2;
  rc.beginPath(); rc.moveTo(-4,2); rc.lineTo(6,2); rc.lineTo(-2,15); rc.lineTo(-11,10); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,255,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // central hull — crystal shard
  const hg=rc.createLinearGradient(-8,0,16,0);
  hg.addColorStop(0,'#aaffff'); hg.addColorStop(0.5,'#ffffff'); hg.addColorStop(1,cfg.color);
  rc.fillStyle=hg;
  rc.beginPath(); rc.moveTo(17,0); rc.lineTo(4,-5); rc.lineTo(-8,-4); rc.lineTo(-8,4); rc.lineTo(4,5); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,255,255,0.6)'; rc.lineWidth=0.8; rc.stroke();

  // prismatic cockpit gem
  const cg=rc.createRadialGradient(8,0,0,8,0,4);
  cg.addColorStop(0,'#ffffff'); cg.addColorStop(0.5,cfg.color); cg.addColorStop(1,'transparent');
  rc.fillStyle=cg; rc.beginPath(); rc.arc(8,0,4,0,Math.PI*2); rc.fill();

  // shimmer facet lines on wings
  rc.strokeStyle=`rgba(255,255,255,${0.3+Math.sin(w.frame*0.1)*0.2})`; rc.lineWidth=0.7;
  rc.beginPath(); rc.moveTo(2,-3); rc.lineTo(-7,-11); rc.stroke();
  rc.beginPath(); rc.moveTo(2,3); rc.lineTo(-7,11); rc.stroke();
}

// ── SHADOW WRAITH — crescent scythe-wings, void eye, ghostly energy ──
function drawShadowWraith(rc,cfg,w){
  rc.shadowColor=cfg.color; rc.shadowBlur=22;

  // void energy trail
  const trailA=0.25+Math.sin(w.frame*0.14)*0.12;
  rc.fillStyle=`rgba(60,0,120,${trailA})`;
  rc.beginPath(); rc.ellipse(-10,0,14,6,0,0,Math.PI*2); rc.fill();

  // upper scythe wing
  const ug=rc.createLinearGradient(0,-16,6,0);
  ug.addColorStop(0,'#3a0066'); ug.addColorStop(0.5,cfg.color); ug.addColorStop(1,'#080010');
  rc.fillStyle=ug;
  rc.beginPath();
  rc.moveTo(8,-2);
  rc.bezierCurveTo(2,-7,-6,-14,-12,-16);
  rc.bezierCurveTo(-8,-10,-3,-5,8,-2);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // lower scythe wing (mirrored)
  const lg=rc.createLinearGradient(0,16,6,0);
  lg.addColorStop(0,'#3a0066'); lg.addColorStop(0.5,cfg.color); lg.addColorStop(1,'#080010');
  rc.fillStyle=lg;
  rc.beginPath();
  rc.moveTo(8,2);
  rc.bezierCurveTo(2,7,-6,14,-12,16);
  rc.bezierCurveTo(-8,10,-3,5,8,2);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // void core hull
  const cc=rc.createLinearGradient(-6,0,14,0);
  cc.addColorStop(0,'#080010'); cc.addColorStop(0.5,cfg.color); cc.addColorStop(1,'#1a0030');
  rc.fillStyle=cc;
  rc.beginPath(); rc.moveTo(15,0); rc.lineTo(4,-4); rc.lineTo(-6,-3); rc.lineTo(-6,3); rc.lineTo(4,4); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.6)'; rc.lineWidth=0.8; rc.stroke();

  // void eye
  const ve=rc.createRadialGradient(6,0,0,6,0,4);
  ve.addColorStop(0,'#ff88ff'); ve.addColorStop(0.5,'#8800cc'); ve.addColorStop(1,'transparent');
  rc.fillStyle=ve; rc.shadowColor='#dd00ff'; rc.shadowBlur=16;
  rc.beginPath(); rc.arc(6,0,4,0,Math.PI*2); rc.fill();

  // crackling void lines
  rc.strokeStyle=`rgba(180,80,255,${0.35+Math.sin(w.frame*0.12)*0.25})`; rc.lineWidth=0.8;
  rc.beginPath(); rc.moveTo(2,-2); rc.lineTo(-5,-9); rc.stroke();
  rc.beginPath(); rc.moveTo(2,2); rc.lineTo(-5,9); rc.stroke();
}

// ── ROBOTO SKY ATTACKER — armoured gunship, missile pods, engine jets ──
// Drawn at origin facing right; rotation + hover applied by caller (drawRTSWarrior).
function drawSkyAttackerUnit(rc,cfg,w){
  rc.shadowColor=cfg.color; rc.shadowBlur=18;

  // twin engine jets (rear)
  const pulse=0.5+Math.sin(w.frame*0.3)*0.5;
  for(const ey of [-3,3]){
    const eg=rc.createRadialGradient(-15,ey,0,-15,ey,5);
    eg.addColorStop(0,`rgba(255,180,0,${pulse})`); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(-15,ey,5,0,Math.PI*2); rc.fill();
  }

  // armoured hull
  const bg=rc.createLinearGradient(-16,0,18,0);
  bg.addColorStop(0,'#2a2010'); bg.addColorStop(0.5,cfg.color); bg.addColorStop(1,'#1a1008');
  rc.fillStyle=bg;
  rc.beginPath();
  rc.moveTo(19,0);
  rc.lineTo(10,-6); rc.lineTo(-14,-8); rc.lineTo(-18,-4); rc.lineTo(-18,4); rc.lineTo(-14,8); rc.lineTo(10,6);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,160,0,0.5)'; rc.lineWidth=1; rc.stroke();

  // armour panel seam lines
  rc.strokeStyle='rgba(80,50,0,0.7)'; rc.lineWidth=0.8;
  rc.beginPath(); rc.moveTo(-8,-7); rc.lineTo(8,-5); rc.stroke();
  rc.beginPath(); rc.moveTo(-8,7); rc.lineTo(8,5); rc.stroke();
  rc.beginPath(); rc.moveTo(-2,-7); rc.lineTo(-2,7); rc.stroke();

  // missile pods
  rc.fillStyle='#2a1a08';
  rc.beginPath(); rc.roundRect(-14,-14,13,5,2); rc.fill();
  rc.beginPath(); rc.roundRect(-14,9,13,5,2); rc.fill();
  rc.strokeStyle='rgba(255,120,0,0.45)'; rc.lineWidth=0.7;
  rc.beginPath(); rc.roundRect(-14,-14,13,5,2); rc.stroke();
  rc.beginPath(); rc.roundRect(-14,9,13,5,2); rc.stroke();
  // missile warhead glow
  rc.fillStyle=`rgba(255,160,0,${0.7+pulse*0.3})`;
  rc.beginPath(); rc.arc(-1,-11,2.5,0,Math.PI*2); rc.fill();
  rc.beginPath(); rc.arc(-1,11,2.5,0,Math.PI*2); rc.fill();

  // cockpit visor
  const cg=rc.createLinearGradient(6,-4,16,4);
  cg.addColorStop(0,'rgba(255,220,100,0.95)'); cg.addColorStop(1,'rgba(200,100,0,0.7)');
  rc.fillStyle=cg; rc.beginPath(); rc.ellipse(11,0,5,3.5,0,0,Math.PI*2); rc.fill();
}


//# sourceMappingURL=warriors.js.map
