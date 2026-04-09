// ══════════════════════════════════════════════
//  CITY BACKGROUND + HUB NAVIGATION
// ══════════════════════════════════════════════

const _CC = document.getElementById('city-canvas');
const _CX = _CC.getContext('2d');

const _THEMES = [
  { name:'PRISM ARMADA',  pri:[0,210,255],  sec:[0,35,75],  acc:[160,240,255], win:[210,245,255], skyA:[2,5,18],  skyB:[0,14,34],  grd:[0,70,130]  },
  { name:'SHADOW ARMADA', pri:[160,40,255], sec:[28,5,58],  acc:[210,130,255], win:[225,170,255], skyA:[5,0,14],  skyB:[12,0,30],  grd:[65,0,130]  },
  { name:'ROBOTO ARMADA', pri:[255,145,0],  sec:[55,22,4],  acc:[255,210,80],  win:[255,225,130], skyA:[20,7,0],  skyB:[30,11,2],  grd:[125,52,0]  },
];

let _tIdx=0, _nIdx=1, _tT=0;
let _cBuildings=[], _cSkyline=[], _cShips=[], _cStars=[];
let _cityRaf=null;

function _lerpC(a,b,t){ return [a[0]+(b[0]-a[0])*t|0, a[1]+(b[1]-a[1])*t|0, a[2]+(b[2]-a[2])*t|0]; }
function _cRgb(c){ return `rgb(${c[0]},${c[1]},${c[2]})`; }
function _cRgba(c,a){ return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

function _initCityScene(){
  const W=_CC.width=window.innerWidth, H=_CC.height=window.innerHeight;
  const groundY=H*0.70;

  _cStars=[];
  for(let i=0;i<130;i++)
    _cStars.push({x:Math.random()*W, y:Math.random()*groundY*0.85, r:Math.random()*1.3, a:0.2+Math.random()*0.6, phase:Math.random()*Math.PI*2});

  // distant low-detail skyline
  _cSkyline=[]; let x=-20;
  while(x<W+60){
    const w=18+Math.random()*35, h=30+Math.random()*(H*0.28);
    _cSkyline.push({x,w,h}); x+=w+1+Math.random()*6;
  }

  // near buildings
  _cBuildings=[]; x=-30;
  while(x<W+100){
    const w=44+Math.random()*90, h=110+Math.random()*(H*0.52);
    const cols=Math.max(1,Math.floor(w/13)), rows=Math.max(1,Math.floor(h/13));
    const wins=[];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++)
      wins.push({on:Math.random()>0.38, flicker:Math.random()>0.93, rate:0.006+Math.random()*0.012});
    const spire=h>H*0.38 && Math.random()>0.55;
    _cBuildings.push({x,w,h,cols,rows,wins,spire});
    x+=w+4+Math.random()*14;
  }

  // flying ships / drones
  _cShips=[];
  for(let i=0;i<7;i++) _cShips.push({
    x:Math.random()*W, y:H*0.08+Math.random()*H*0.38,
    spd:0.25+Math.random()*0.65, w:18+Math.random()*28, h:4+Math.random()*5,
    phase:Math.random()*Math.PI*2, dir:Math.random()>0.5?1:-1,
  });
}

function _drawCityFrame(){
  const W=_CC.width, H=_CC.height, groundY=H*0.70;
  // hold 65% of cycle, blend in last 35% with smoothstep
  const eff=Math.max(0,(_tT-0.65)/0.35);
  const te=eff*eff*(3-2*eff);
  const cur=_THEMES[_tIdx], nxt=_THEMES[_nIdx];
  const pri=_lerpC(cur.pri,nxt.pri,te), sec=_lerpC(cur.sec,nxt.sec,te);
  const acc=_lerpC(cur.acc,nxt.acc,te), win=_lerpC(cur.win,nxt.win,te);
  const skyA=_lerpC(cur.skyA,nxt.skyA,te), skyB=_lerpC(cur.skyB,nxt.skyB,te);
  const grd=_lerpC(cur.grd,nxt.grd,te);

  // sky gradient
  const sky=_CX.createLinearGradient(0,0,0,groundY+40);
  sky.addColorStop(0,_cRgb(skyA)); sky.addColorStop(1,_cRgb(skyB));
  _CX.fillStyle=sky; _CX.fillRect(0,0,W,H);

  // stars
  for(const s of _cStars){
    const twink=0.5+0.5*Math.sin(Date.now()*0.001*s.r+s.phase);
    _CX.globalAlpha=s.a*twink;
    _CX.fillStyle=_cRgba(acc,1);
    _CX.beginPath(); _CX.arc(s.x,s.y,s.r,0,Math.PI*2); _CX.fill();
  }
  _CX.globalAlpha=1;

  // horizon glow
  const hg=_CX.createRadialGradient(W/2,groundY,0,W/2,groundY,W*0.65);
  hg.addColorStop(0,_cRgba(pri,0.2)); hg.addColorStop(1,'transparent');
  _CX.fillStyle=hg; _CX.fillRect(0,groundY-120,W,240);

  // far skyline
  _CX.fillStyle=_cRgba(sec,0.28);
  for(const b of _cSkyline) _CX.fillRect(b.x,groundY-b.h,b.w,b.h);

  // near buildings
  for(const b of _cBuildings){
    const by=groundY-b.h;
    const bg=_CX.createLinearGradient(b.x,by,b.x+b.w,groundY);
    bg.addColorStop(0,_cRgba(sec,0.88)); bg.addColorStop(1,_cRgba(sec,0.60));
    _CX.fillStyle=bg; _CX.fillRect(b.x,by,b.w,b.h);
    _CX.strokeStyle=_cRgba(pri,0.22); _CX.lineWidth=1; _CX.strokeRect(b.x,by,b.w,b.h);

    // optional spire
    if(b.spire){
      _CX.fillStyle=_cRgba(sec,0.75);
      _CX.beginPath(); _CX.moveTo(b.x+b.w/2-4,by); _CX.lineTo(b.x+b.w/2,by-28); _CX.lineTo(b.x+b.w/2+4,by); _CX.closePath(); _CX.fill();
      _CX.strokeStyle=_cRgba(pri,0.45); _CX.stroke();
      // beacon light
      _CX.fillStyle=_cRgba(acc,0.8+0.2*Math.sin(Date.now()*0.003));
      _CX.shadowColor=_cRgb(acc); _CX.shadowBlur=8;
      _CX.beginPath(); _CX.arc(b.x+b.w/2,by-28,2,0,Math.PI*2); _CX.fill();
      _CX.shadowBlur=0;
    }

    // windows
    const ww=(b.w-4)/b.cols;
    for(let r=0;r<b.rows;r++) for(let c=0;c<b.cols;c++){
      const wObj=b.wins[r*b.cols+c]; if(!wObj) continue;
      if(wObj.flicker && Math.random()<wObj.rate) wObj.on=!wObj.on;
      if(!wObj.on) continue;
      _CX.fillStyle=_cRgba(win,0.5+Math.random()*0.25);
      _CX.fillRect(b.x+2+c*ww, by+4+r*13, ww-2, 8);
    }

    // rooftop light
    _CX.fillStyle=_cRgba(pri,0.9); _CX.shadowColor=_cRgb(pri); _CX.shadowBlur=6;
    _CX.beginPath(); _CX.arc(b.x+b.w/2,by,1.5,0,Math.PI*2); _CX.fill();
    _CX.shadowBlur=0;
  }

  // ground
  const grG=_CX.createLinearGradient(0,groundY,0,H);
  grG.addColorStop(0,_cRgba(grd,0.35)); grG.addColorStop(0.5,_cRgba(grd,0.15)); grG.addColorStop(1,'rgba(0,0,0,0.92)');
  _CX.fillStyle=grG; _CX.fillRect(0,groundY,W,H-groundY);

  // neon street lines
  for(let i=0;i<5;i++){
    const ly=groundY+6+i*7;
    const lg=_CX.createLinearGradient(0,0,W,0);
    lg.addColorStop(0,'transparent');
    lg.addColorStop(0.3,_cRgba(pri,0.28-i*0.05));
    lg.addColorStop(0.7,_cRgba(pri,0.28-i*0.05));
    lg.addColorStop(1,'transparent');
    _CX.strokeStyle=lg; _CX.lineWidth=1;
    _CX.beginPath(); _CX.moveTo(0,ly); _CX.lineTo(W,ly); _CX.stroke();
  }

  // flying ships
  for(const s of _cShips){
    s.x+=s.spd*s.dir;
    if(s.x>W+120) s.x=-120;
    if(s.x<-120) s.x=W+120;
    const bob=Math.sin(Date.now()*0.0008+s.phase)*4;
    const sx=s.x, sy=s.y+bob;
    _CX.fillStyle=_cRgba(sec,0.92);
    _CX.beginPath();
    if(s.dir>0){
      _CX.moveTo(sx,sy); _CX.lineTo(sx+s.w*0.65,sy-s.h/2);
      _CX.lineTo(sx+s.w,sy-s.h*0.15); _CX.lineTo(sx+s.w,sy+s.h*0.15);
      _CX.lineTo(sx+s.w*0.65,sy+s.h/2);
    } else {
      _CX.moveTo(sx+s.w,sy); _CX.lineTo(sx+s.w*0.35,sy-s.h/2);
      _CX.lineTo(sx,sy-s.h*0.15); _CX.lineTo(sx,sy+s.h*0.15);
      _CX.lineTo(sx+s.w*0.35,sy+s.h/2);
    }
    _CX.closePath(); _CX.fill();
    _CX.strokeStyle=_cRgba(pri,0.65); _CX.lineWidth=0.7; _CX.stroke();
    // engine glow
    const trailX=s.dir>0?sx:sx+s.w;
    const eg=_CX.createRadialGradient(trailX,sy,0,trailX,sy,s.h*2.2);
    eg.addColorStop(0,_cRgba(acc,0.75)); eg.addColorStop(1,'transparent');
    _CX.fillStyle=eg; _CX.beginPath(); _CX.arc(trailX,sy,s.h*2.2,0,Math.PI*2); _CX.fill();
  }

  // vignette
  const vig=_CX.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.9);
  vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.55)');
  _CX.fillStyle=vig; _CX.fillRect(0,0,W,H);
}

function _updateHubUI(){
  const eff=Math.max(0,(_tT-0.65)/0.35);
  const te=eff*eff*(3-2*eff);
  const colors=['#00d2ff','#a028ff','#ff9100'];
  const label=document.getElementById('hub-faction-label');
  if(label){
    label.textContent=te>0.5?_THEMES[_nIdx].name:_THEMES[_tIdx].name;
    label.style.color=te>0.5?colors[_nIdx]:colors[_tIdx];
  }
}

function _cityLoop(){
  if(!_cityRaf) return;
  _cityRaf=requestAnimationFrame(_cityLoop);
  _tT+=1/540; // ~9 second full cycle at 60fps
  if(_tT>=1){ _tT=0; _tIdx=_nIdx; _nIdx=(_nIdx+1)%_THEMES.length; }
  _drawCityFrame();
  _updateHubUI();
}

function startCityAnimation(){
  if(_cityRaf) return;
  _initCityScene();
  _cityRaf=requestAnimationFrame(_cityLoop);
}

function stopCityAnimation(){
  _cityRaf=null;
}

// ── Hub navigation ──
function launchGame(id){
  document.getElementById('hub-back-btn').style.display='';
  switchTab(id, null);
}

function goToHub(){
  switchTab('hub', null);
}
