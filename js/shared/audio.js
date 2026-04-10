// ══════════════════════════════════════════════
//  SOUND ENGINE  (Web Audio API — no files)
// ══════════════════════════════════════════════
let _ac=null;
function getAC(){
  if(!_ac) _ac=new(window.AudioContext||window.webkitAudioContext)();
  if(_ac.state==='suspended') _ac.resume();
  return _ac;
}

function sfxTone(freq,type,vol,attack,decay,pitch2){
  try{
    const ac=getAC(), t=ac.currentTime;
    const g=ac.createGain(); g.connect(ac.destination);
    const o=ac.createOscillator(); o.connect(g);
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(pitch2) o.frequency.exponentialRampToValueAtTime(pitch2,t+attack+decay*0.7);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+attack);
    g.gain.exponentialRampToValueAtTime(0.001,t+attack+decay);
    o.start(t); o.stop(t+attack+decay+0.05);
  }catch(e){}
}

function sfxNoise(vol,dur,lowpass){
  try{
    const ac=getAC(), t=ac.currentTime;
    const buf=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const src=ac.createBufferSource(); src.buffer=buf;
    const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lowpass;
    const g=ac.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(f); f.connect(g); g.connect(ac.destination);
    src.start(t); src.stop(t+dur);
  }catch(e){}
}

// ── SOUND DEFINITIONS ──
const SFX={
  // Tower Defense
  tdPlace:   ()=>{ sfxTone(440,'sine',0.3,0.01,0.15,880); sfxTone(660,'sine',0.15,0.02,0.1); },
  tdShoot:   ()=>{ sfxNoise(0.12,0.06,2000); sfxTone(180,'square',0.08,0.001,0.05); },
  tdLaser:   ()=>{ sfxTone(800,'sawtooth',0.1,0.005,0.12,200); },
  tdMissile: ()=>{ sfxNoise(0.15,0.15,800); sfxTone(120,'sawtooth',0.12,0.01,0.15,60); },
  tdCryo:    ()=>{ sfxTone(1200,'sine',0.08,0.01,0.2,600); sfxTone(900,'sine',0.05,0.02,0.15,300); },
  tdHit:     ()=>{ sfxNoise(0.1,0.05,3000); },
  tdExplode: ()=>{ sfxNoise(0.35,0.35,600); sfxTone(80,'sawtooth',0.2,0.005,0.3,40); },
  tdWave:    ()=>{ sfxTone(330,'square',0.2,0.02,0.1); setTimeout(()=>sfxTone(440,'square',0.2,0.02,0.1),120); setTimeout(()=>sfxTone(550,'square',0.2,0.02,0.2),240); },
  tdVictory: ()=>{ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>sfxTone(f,'sine',0.25,0.02,0.3),i*120)); },
  tdDead:    ()=>{ sfxTone(330,'sawtooth',0.2,0.02,0.1); setTimeout(()=>sfxTone(220,'sawtooth',0.2,0.02,0.15),120); setTimeout(()=>sfxTone(110,'sawtooth',0.25,0.02,0.4),250); },
  tdEnemy:   ()=>{ sfxNoise(0.08,0.04,1500); },

  // RTS
  rtsCannonFire:   ()=>{ sfxNoise(0.4,0.4,500); sfxTone(90,'sawtooth',0.25,0.005,0.35,45); },
  rtsMagicFire:    ()=>{ sfxTone(600,'sine',0.12,0.01,0.18,1200); sfxTone(400,'sine',0.08,0.02,0.15,800); },
  rtsLightning:    ()=>{ sfxNoise(0.2,0.12,4000); sfxTone(1800,'square',0.1,0.001,0.1,400); },
  rtsDarkMagic:    ()=>{ sfxTone(200,'sawtooth',0.15,0.01,0.2,80); sfxNoise(0.1,0.1,600); },
  rtsBullet:       ()=>{ sfxNoise(0.1,0.04,3000); sfxTone(300,'square',0.06,0.001,0.03); },
  rtsExplode:      ()=>{ sfxNoise(0.4,0.5,400); sfxTone(70,'sawtooth',0.2,0.005,0.4,35); },
  rtsSwordHit:     ()=>{ sfxNoise(0.15,0.08,2500); sfxTone(280,'square',0.1,0.001,0.06); },
  rtsUnitDie:      ()=>{ sfxNoise(0.2,0.2,800); sfxTone(150,'sawtooth',0.12,0.005,0.2,80); },
  rtsBuild:        ()=>{ sfxTone(440,'sine',0.15,0.02,0.1,550); sfxTone(660,'sine',0.1,0.03,0.15,880); },
  rtsBuildDone:    ()=>{ [523,659,784].forEach((f,i)=>setTimeout(()=>sfxTone(f,'sine',0.2,0.02,0.2),i*80)); },
  rtsQueueUnit:    ()=>{ sfxTone(550,'sine',0.12,0.01,0.08); },
  rtsAttackOrder:  ()=>{ sfxTone(880,'square',0.12,0.005,0.06); setTimeout(()=>sfxTone(1100,'square',0.1,0.005,0.08),60); },
  rtsVictory:      ()=>{ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>sfxTone(f,'sine',0.25,0.02,0.35),i*100)); },
  rtsDefeat:       ()=>{ sfxTone(440,'sawtooth',0.2,0.02,0.15); setTimeout(()=>sfxTone(330,'sawtooth',0.2,0.02,0.2),150); setTimeout(()=>sfxTone(220,'sawtooth',0.25,0.02,0.5),320); },
  rtsGoldIn:       ()=>{ sfxTone(1047,'sine',0.1,0.005,0.1); sfxTone(1319,'sine',0.07,0.01,0.08); },
  rtsHammer:       ()=>{ sfxNoise(0.08,0.06,1200); sfxTone(220,'square',0.06,0.001,0.04); },
  rtsPrismCannon:  ()=>{ sfxTone(900,'sine',0.15,0.005,0.18,1800); sfxTone(600,'sine',0.1,0.01,0.14,1200); sfxNoise(0.04,0.08,5000); },
  rtsShadowCannon: ()=>{ sfxTone(55,'sawtooth',0.22,0.01,0.45,28); sfxNoise(0.18,0.38,280); },

  // Homestead Wars
  hwHammer:        ()=>{ sfxNoise(0.1,0.07,1000); sfxTone(180,'square',0.07,0.001,0.05); },
  hwBuildDone:     ()=>{ [392,494,587].forEach((f,i)=>setTimeout(()=>sfxTone(f,'sine',0.2,0.02,0.2),i*80)); },
  hwQueueUnit:     ()=>{ sfxTone(440,'sine',0.12,0.01,0.08); },
  hwUnitDie:       ()=>{ sfxNoise(0.18,0.18,700); sfxTone(130,'sawtooth',0.1,0.005,0.18,70); },
  hwPeck:          ()=>{ sfxNoise(0.08,0.03,2500); sfxTone(600,'square',0.06,0.001,0.03); },
  hwHonk:          ()=>{ sfxTone(280,'sawtooth',0.14,0.01,0.15,180); sfxTone(350,'sawtooth',0.08,0.02,0.12,220); },
  hwHoot:          ()=>{ sfxTone(700,'sine',0.08,0.005,0.1,500); sfxTone(900,'sine',0.05,0.01,0.08,600); },
  hwCharge:        ()=>{ sfxTone(180,'sawtooth',0.12,0.005,0.2,90); sfxNoise(0.08,0.12,500); },
  hwFeather:       ()=>{ sfxTone(800,'sine',0.1,0.01,0.15,1400); sfxTone(500,'sine',0.06,0.02,0.12,900); },
  hwTalon:         ()=>{ sfxNoise(0.12,0.06,3500); sfxTone(400,'square',0.08,0.001,0.05); },
  hwStampede:      ()=>{ sfxNoise(0.35,0.45,350); sfxTone(60,'sawtooth',0.22,0.005,0.4,30); },
  hwSplash:        ()=>{ sfxNoise(0.15,0.12,4000); sfxTone(1200,'square',0.08,0.001,0.1,300); },
  hwCannonFire:    ()=>{ sfxNoise(0.3,0.35,400); sfxTone(80,'sawtooth',0.2,0.005,0.3,40); },
  hwBarnyardCannon:()=>{ sfxNoise(0.25,0.3,500); sfxTone(120,'square',0.12,0.005,0.25,60); },
  hwCreekCannon:   ()=>{ sfxTone(500,'sine',0.12,0.005,0.15,1000); sfxNoise(0.06,0.1,3000); },
  hwWoodlandCannon:()=>{ sfxTone(350,'sawtooth',0.1,0.01,0.2,150); sfxNoise(0.12,0.15,1500); },
  hwHayIn:         ()=>{ sfxTone(880,'sine',0.08,0.005,0.08); sfxTone(1100,'sine',0.05,0.01,0.06); },
  hwVictory:       ()=>{ [392,494,587,784,988].forEach((f,i)=>setTimeout(()=>sfxTone(f,'sine',0.22,0.02,0.3),i*100)); },
  hwDefeat:        ()=>{ sfxTone(370,'sawtooth',0.18,0.02,0.12); setTimeout(()=>sfxTone(277,'sawtooth',0.18,0.02,0.18),150); setTimeout(()=>sfxTone(185,'sawtooth',0.22,0.02,0.45),320); },
};

// Throttle repeated sounds so they don't stack
const _sfxThrottle={};
function sfx(name, throttleMs=0){
  if(!SFX[name]) return;
  if(throttleMs>0){
    const now=Date.now();
    if(_sfxThrottle[name] && now-_sfxThrottle[name]<throttleMs) return;
    _sfxThrottle[name]=now;
  }
  SFX[name]();
}
