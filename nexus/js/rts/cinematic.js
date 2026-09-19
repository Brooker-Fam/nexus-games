// ── CINEMATIC REVEAL ANIMATION ──
let revealParticles=[];
function startRevealAnimation(faction){
  dsoRevealFrame=0;
  revealParticles=[];
  const canvas=document.getElementById('rv-canvas');
  const rc=canvas.getContext('2d');
  const RW=900,RH=460;
  const fd=FACTION_DATA[faction];

  function spawnRevealParticle(){
    const a=Math.random()*Math.PI*2, r=Math.random()*60+20;
    revealParticles.push({
      x:RW/2+Math.cos(a)*r, y:RH*0.72+Math.sin(a)*r*0.3,
      vx:Math.cos(a)*0.3, vy:Math.sin(a)*0.3-0.5,
      life:80+Math.random()*60, maxLife:140,
      size:1+Math.random()*2.5,
      color:fd.accentColor,
    });
  }

  // Pre-parse accent color
  const hex=fd.accentColor;
  const r2=parseInt(hex.slice(1,3),16),g2=parseInt(hex.slice(3,5),16),b2=parseInt(hex.slice(5,7),16);

  function drawReveal(){
    dsoRevealFrame++;
    rc.clearRect(0,0,RW,RH);

    // background
    const bgGrad=rc.createRadialGradient(RW/2,RH*0.65,0,RW/2,RH*0.5,400);
    bgGrad.addColorStop(0,`rgba(${r2},${g2},${b2},0.12)`);
    bgGrad.addColorStop(0.5,`rgba(${r2},${g2},${b2},0.04)`);
    bgGrad.addColorStop(1,'rgba(2,8,16,0)');
    rc.fillStyle=bgGrad; rc.fillRect(0,0,RW,RH);

    // grid lines radiating
    rc.save();
    rc.strokeStyle=`rgba(${r2},${g2},${b2},0.06)`;
    rc.lineWidth=1;
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      rc.beginPath(); rc.moveTo(RW/2,RH*0.72); rc.lineTo(RW/2+Math.cos(a)*600,RH*0.72+Math.sin(a)*300); rc.stroke();
    }
    rc.restore();

    // ground ring
    rc.save();
    rc.shadowColor=fd.accentColor; rc.shadowBlur=30;
    const ringA=Math.min(1, dsoRevealFrame/40);
    rc.strokeStyle=`rgba(${r2},${g2},${b2},${ringA*0.5})`;
    rc.lineWidth=2;
    rc.beginPath(); rc.ellipse(RW/2,RH*0.72+2,120*ringA,30*ringA,0,0,Math.PI*2); rc.stroke();
    rc.strokeStyle=`rgba(${r2},${g2},${b2},${ringA*0.2})`;
    rc.lineWidth=8;
    rc.beginPath(); rc.ellipse(RW/2,RH*0.72+2,120*ringA,30*ringA,0,0,Math.PI*2); rc.stroke();
    rc.restore();

    // particles
    if(dsoRevealFrame%3===0) spawnRevealParticle();
    for(let i=revealParticles.length-1;i>=0;i--){
      const p=revealParticles[i];
      p.x+=p.vx; p.y+=p.vy; p.life--;
      if(p.life<=0){revealParticles.splice(i,1);continue;}
      const fa=p.life/p.maxLife;
      rc.save();
      rc.globalAlpha=fa*0.8;
      rc.shadowColor=p.color; rc.shadowBlur=8;
      rc.fillStyle=p.color;
      rc.beginPath(); rc.arc(p.x,p.y,p.size*fa,0,Math.PI*2); rc.fill();
      rc.restore();
    }

    // draw character — large scale
    const enterProgress = Math.min(1, dsoRevealFrame/50);
    const easeIn = 1-Math.pow(1-enterProgress,3);
    rc.save();
    rc.globalAlpha=easeIn;
    rc.translate(RW/2, RH*0.72 - (1-easeIn)*40);
    if(faction==='shadow') drawShadowChar(rc,0,0,2.2);
    else if(faction==='prism') drawPrismChar(rc,0,0,2.2);
    else if(faction==='roboto') drawRobotoChar(rc,0,0,2.2);
    rc.restore();

    // name plate at bottom
    if(dsoRevealFrame>30){
      const textAlpha=Math.min(1,(dsoRevealFrame-30)/20);
      rc.save();
      rc.globalAlpha=textAlpha;
      rc.fillStyle=`rgba(${r2},${g2},${b2},0.08)`;
      rc.fillRect(RW/2-150,RH*0.84,300,32);
      rc.strokeStyle=`rgba(${r2},${g2},${b2},0.3)`;
      rc.lineWidth=1; rc.strokeRect(RW/2-150,RH*0.84,300,32);
      rc.font='bold 13px Orbitron,sans-serif';
      rc.textAlign='center'; rc.textBaseline='middle';
      rc.fillStyle=fd.accentColor;
      rc.shadowColor=fd.accentColor; rc.shadowBlur=15;
      rc.fillText(FACTION_DATA[faction].champion, RW/2, RH*0.84+16);
      rc.restore();
    }

    dsoRevealRAF=requestAnimationFrame(drawReveal);
  }
  if(dsoRevealRAF) cancelAnimationFrame(dsoRevealRAF);
  dsoRevealRAF=requestAnimationFrame(drawReveal);
}

//# sourceMappingURL=cinematic.js.map
