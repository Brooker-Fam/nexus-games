// ── 2ND-TIER AERIAL UNIT DRAWING ──
// Drawn at origin facing right; rotation + hover applied by caller (drawRTSWarrior).

// ── ROBOTO WARSHIP — bulky triple-barrel gunship, fires a spread of bullets at once ──
function drawWarshipUnit(rc,cfg,w){
  rc.shadowColor=cfg.color; rc.shadowBlur=18;

  // twin rear engine jets
  const pulse=0.5+Math.sin(w.frame*0.28)*0.5;
  for(const ey of [-6,6]){
    const eg=rc.createRadialGradient(-19,ey,0,-19,ey,6);
    eg.addColorStop(0,`rgba(255,180,0,${pulse})`); eg.addColorStop(1,'transparent');
    rc.fillStyle=eg; rc.beginPath(); rc.arc(-19,ey,6,0,Math.PI*2); rc.fill();
  }

  // heavy armoured hull
  const bg=rc.createLinearGradient(-20,0,22,0);
  bg.addColorStop(0,'#2a2010'); bg.addColorStop(0.5,cfg.color); bg.addColorStop(1,'#1a1008');
  rc.fillStyle=bg;
  rc.beginPath();
  rc.moveTo(22,0);
  rc.lineTo(12,-9); rc.lineTo(-16,-11); rc.lineTo(-22,-5); rc.lineTo(-22,5); rc.lineTo(-16,11); rc.lineTo(12,9);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,160,0,0.55)'; rc.lineWidth=1.2; rc.stroke();

  // hull plating seams
  rc.strokeStyle='rgba(80,50,0,0.7)'; rc.lineWidth=0.8;
  rc.beginPath(); rc.moveTo(-10,-9); rc.lineTo(10,-7); rc.stroke();
  rc.beginPath(); rc.moveTo(-10,9); rc.lineTo(10,7); rc.stroke();
  rc.beginPath(); rc.moveTo(-3,-10); rc.lineTo(-3,10); rc.stroke();

  // triple gun barrel cluster (fans out toward the nose — sells the multi-bullet volley)
  const recoil = w.state==='attack' ? Math.max(0,Math.sin(w.frame*0.6))*3 : 0;
  for(const [gy,spread] of [[-6,-2],[0,0],[6,2]]){
    rc.fillStyle='#1a1008';
    rc.beginPath(); rc.moveTo(10-recoil,gy-1.5); rc.lineTo(24-recoil+spread,gy-1); rc.lineTo(24-recoil+spread,gy+1); rc.lineTo(10-recoil,gy+1.5); rc.closePath(); rc.fill();
    rc.strokeStyle='rgba(255,140,0,0.5)'; rc.lineWidth=0.5; rc.stroke();
    const mFlash = w.state==='attack' ? 0.5+Math.sin(w.frame*0.6+gy)*0.5 : 0.15;
    const mg=rc.createRadialGradient(24-recoil+spread,gy,0,24-recoil+spread,gy,4);
    mg.addColorStop(0,`rgba(255,230,150,${mFlash})`); mg.addColorStop(1,'transparent');
    rc.fillStyle=mg; rc.beginPath(); rc.arc(24-recoil+spread,gy,4,0,Math.PI*2); rc.fill();
  }

  // side missile pods
  rc.fillStyle='#2a1a08';
  rc.beginPath(); rc.roundRect(-18,-17,14,5,2); rc.fill();
  rc.beginPath(); rc.roundRect(-18,12,14,5,2); rc.fill();
  rc.strokeStyle='rgba(255,120,0,0.4)'; rc.lineWidth=0.6;
  rc.beginPath(); rc.roundRect(-18,-17,14,5,2); rc.stroke();
  rc.beginPath(); rc.roundRect(-18,12,14,5,2); rc.stroke();

  // command bridge / cockpit
  const cg=rc.createLinearGradient(4,-5,16,5);
  cg.addColorStop(0,'rgba(255,220,100,0.95)'); cg.addColorStop(1,'rgba(200,100,0,0.7)');
  rc.fillStyle=cg; rc.beginPath(); rc.ellipse(9,0,6,4.5,0,0,Math.PI*2); rc.fill();
  rc.strokeStyle='rgba(255,200,120,0.6)'; rc.lineWidth=0.7; rc.stroke();
}

// ── PRISM LIGHT FIGHTER — slender interceptor with a forward light-beam emitter ──
function drawLightFighterUnit(rc,cfg,w){
  rc.shadowColor=cfg.color; rc.shadowBlur=22;

  const pulse=0.5+Math.sin(w.frame*0.3)*0.5;
  const isAttacking = w.state==='attack';

  // rear thruster glow
  const eg=rc.createRadialGradient(-13,0,0,-13,0,6);
  eg.addColorStop(0,`rgba(0,245,255,${pulse})`); eg.addColorStop(1,'transparent');
  rc.fillStyle=eg; rc.beginPath(); rc.arc(-13,0,6,0,Math.PI*2); rc.fill();

  // swept upper wing
  const wg1=rc.createLinearGradient(-9,-12,4,-2);
  wg1.addColorStop(0,'rgba(220,255,255,0.95)'); wg1.addColorStop(1,'rgba(0,200,220,0.6)');
  rc.fillStyle=wg1;
  rc.beginPath(); rc.moveTo(-2,-2); rc.lineTo(5,-2); rc.lineTo(-3,-13); rc.lineTo(-10,-9); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,255,255,0.5)'; rc.lineWidth=0.7; rc.stroke();

  // swept lower wing
  const wg2=rc.createLinearGradient(-9,12,4,2);
  wg2.addColorStop(0,'rgba(220,255,255,0.95)'); wg2.addColorStop(1,'rgba(0,200,220,0.6)');
  rc.fillStyle=wg2;
  rc.beginPath(); rc.moveTo(-2,2); rc.lineTo(5,2); rc.lineTo(-3,13); rc.lineTo(-10,9); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,255,255,0.5)'; rc.lineWidth=0.7; rc.stroke();

  // slim fuselage tapering to a nose-mounted emitter
  const hg=rc.createLinearGradient(-7,0,19,0);
  hg.addColorStop(0,'#aaffff'); hg.addColorStop(0.5,'#ffffff'); hg.addColorStop(1,cfg.color);
  rc.fillStyle=hg;
  rc.beginPath(); rc.moveTo(19,0); rc.lineTo(6,-3.5); rc.lineTo(-7,-3); rc.lineTo(-7,3); rc.lineTo(6,3.5); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(255,255,255,0.6)'; rc.lineWidth=0.7; rc.stroke();

  // light emitter lens at the nose — brighter and flaring while firing
  const lensR = isAttacking ? 5+pulse*2 : 3;
  rc.shadowColor='#ffffff'; rc.shadowBlur=isAttacking?24:10;
  const lg=rc.createRadialGradient(17,0,0,17,0,lensR);
  lg.addColorStop(0,'#ffffff'); lg.addColorStop(0.5,'#aaffff'); lg.addColorStop(1,'transparent');
  rc.fillStyle=lg; rc.beginPath(); rc.arc(17,0,lensR,0,Math.PI*2); rc.fill();

  // shimmer facets
  rc.strokeStyle=`rgba(255,255,255,${0.3+Math.sin(w.frame*0.12)*0.2})`; rc.lineWidth=0.6;
  rc.beginPath(); rc.moveTo(1,-2); rc.lineTo(-6,-8); rc.stroke();
  rc.beginPath(); rc.moveTo(1,2); rc.lineTo(-6,8); rc.stroke();
}

// ── SHADOW DESTROYER — heavy void warship, launches slow orbs of darkness ──
function drawDestroyerUnit(rc,cfg,w){
  rc.shadowColor=cfg.color; rc.shadowBlur=20;

  const pulse=0.4+Math.sin(w.frame*0.1)*0.3;

  // trailing void mist
  rc.fillStyle=`rgba(50,0,90,${0.22+Math.sin(w.frame*0.14)*0.1})`;
  rc.beginPath(); rc.ellipse(-14,0,17,8,0,0,Math.PI*2); rc.fill();

  // upper hull wing (crescent, void-forged)
  const ug=rc.createLinearGradient(0,-19,8,0);
  ug.addColorStop(0,'#2a0050'); ug.addColorStop(0.5,cfg.color); ug.addColorStop(1,'#080010');
  rc.fillStyle=ug;
  rc.beginPath();
  rc.moveTo(10,-3);
  rc.bezierCurveTo(2,-9,-8,-17,-15,-19);
  rc.bezierCurveTo(-10,-12,-4,-6,10,-3);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // lower hull wing (mirrored)
  const lg=rc.createLinearGradient(0,19,8,0);
  lg.addColorStop(0,'#2a0050'); lg.addColorStop(0.5,cfg.color); lg.addColorStop(1,'#080010');
  rc.fillStyle=lg;
  rc.beginPath();
  rc.moveTo(10,3);
  rc.bezierCurveTo(2,9,-8,17,-15,19);
  rc.bezierCurveTo(-10,12,-4,6,10,3);
  rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.5)'; rc.lineWidth=0.8; rc.stroke();

  // reinforced void-core hull
  const cc=rc.createLinearGradient(-8,0,17,0);
  cc.addColorStop(0,'#080010'); cc.addColorStop(0.5,cfg.color); cc.addColorStop(1,'#1a0030');
  rc.fillStyle=cc;
  rc.beginPath(); rc.moveTo(18,0); rc.lineTo(5,-6); rc.lineTo(-9,-5); rc.lineTo(-9,5); rc.lineTo(5,6); rc.closePath(); rc.fill();
  rc.strokeStyle='rgba(180,80,255,0.6)'; rc.lineWidth=0.9; rc.stroke();

  // orb-launcher maw at the nose — charges up between slow shots
  const chargeT = w.attackTimer!==undefined && w.fireRate ? Math.min(1,w.attackTimer/w.fireRate) : pulse;
  const maw=rc.createRadialGradient(10,0,0,10,0,5+chargeT*3);
  maw.addColorStop(0,'#ff88ff'); maw.addColorStop(0.4,'#8800cc'); maw.addColorStop(1,'transparent');
  rc.fillStyle=maw; rc.shadowColor='#dd00ff'; rc.shadowBlur=16;
  rc.beginPath(); rc.arc(10,0,5+chargeT*3,0,Math.PI*2); rc.fill();
  rc.fillStyle='#0a0014'; rc.beginPath(); rc.arc(10,0,3,0,Math.PI*2); rc.fill();

  // crackling void lines along the hull
  rc.strokeStyle=`rgba(180,80,255,${0.35+Math.sin(w.frame*0.12)*0.25})`; rc.lineWidth=0.9;
  rc.beginPath(); rc.moveTo(2,-3); rc.lineTo(-7,-11); rc.stroke();
  rc.beginPath(); rc.moveTo(2,3); rc.lineTo(-7,11); rc.stroke();
}

//# sourceMappingURL=aerial2.js.map
