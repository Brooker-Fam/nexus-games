// ── TOWER DEFENSE GAME ──
const canvas = document.getElementById('tdCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const CELL = 40;
const COLS = W/CELL, ROWS = H/CELL;

// Path waypoints (grid coords)
const PATH_WAYPOINTS = [
  {x:0,y:3},{x:4,y:3},{x:4,y:1},{x:8,y:1},
  {x:8,y:6},{x:12,y:6},{x:12,y:3},{x:16,y:3},
  {x:16,y:10},{x:10,y:10},{x:10,y:8},{x:6,y:8},
  {x:6,y:11},{x:17.5,y:11}
];

function wpPx(wp){ return {x: wp.x*CELL, y: wp.y*CELL + CELL/2}; }

const TOWER_TYPES = {
  gun:     { color:'#00f5ff', range:120, damage:15, rate:30,  cost:50,  bullet:'cyan',   aoe:false },
  laser:   { color:'#ff0088', range:100, damage:8,  rate:15,  cost:80,  bullet:'pink',   aoe:false },
  missile: { color:'#ff8800', range:150, damage:45, rate:90,  cost:120, bullet:'orange', aoe:true  },
  slow:    { color:'#8888ff', range:100, damage:2,  rate:25,  cost:70,  bullet:'blue',   aoe:false },
};

let state = {
  gold:200, lives:20, score:0, wave:0,
  towers:[], enemies:[], bullets:[], particles:[],
  waveActive:false, waveEnemyTimer:0, waveEnemiesLeft:0,
  selectedTower:'gun', speed:1, frame:0, gameOver:false,
};

function initState(){
  state = {
    gold: 200, lives: 20, score: 0, wave: 0,
    towers: [], enemies: [], bullets: [], particles: [],
    waveActive: false, waveEnemyTimer: 0, waveEnemiesLeft: 0,
    selectedTower: 'gun', speed: 1, frame: 0, gameOver: false,
  };
  setLog([]);
}

let logs = [];
function addLog(msg, cls=''){
  const box = document.getElementById('logBox');
  const d = document.createElement('div');
  d.className = 'log-entry '+(cls||'');
  d.textContent = msg;
  box.insertBefore(d, box.firstChild);
  if(box.children.length > 40) box.removeChild(box.lastChild);
}
function setLog(arr){ document.getElementById('logBox').innerHTML=''; }

function updateHUD(){
  document.getElementById('waveNum').textContent = state.wave;
  document.getElementById('livesNum').textContent = state.lives;
  document.getElementById('goldNum').textContent = state.gold;
  document.getElementById('scoreNum').textContent = state.score;
}

// Path cells set
const pathCells = new Set();
function buildPath(){
  pathCells.clear();
  for(let i=0;i<PATH_WAYPOINTS.length-1;i++){
    const a=PATH_WAYPOINTS[i], b=PATH_WAYPOINTS[i+1];
    const dx=Math.sign(b.x-a.x), dy=Math.sign(b.y-a.y);
    let cx=Math.round(a.x), cy=Math.round(a.y);
    while(cx!==Math.round(b.x)||cy!==Math.round(b.y)){
      for(let r=0;r<1;r++) pathCells.add(`${cx},${cy}`);
      if(dx!==0) cx+=dx; else cy+=dy;
    }
    pathCells.add(`${Math.round(b.x)},${Math.round(b.y)}`);
  }
}
buildPath();

function isPathCell(gx,gy){
  return pathCells.has(`${Math.floor(gx)},${Math.floor(gy)}`);
}

canvas.addEventListener('click', e=>{
  if(state.gameOver) return;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX-r.left, my = e.clientY-r.top;
  const gx = Math.floor(mx/CELL), gy = Math.floor(my/CELL);
  if(isPathCell(gx,gy)){ addLog('Cannot place on path!','bad'); return; }
  const ttype = state.selectedTower;
  const cost = TOWER_TYPES[ttype].cost;
  if(state.gold < cost){ addLog('Not enough gold!','bad'); return; }
  // no overlap
  if(state.towers.some(t=>Math.floor(t.x/CELL)===gx && Math.floor(t.y/CELL)===gy)){
    addLog('Cell occupied!','bad'); return;
  }
  state.gold -= cost;
  state.towers.push({
    x: gx*CELL+CELL/2, y: gy*CELL+CELL/2,
    type: ttype, cooldown: 0,
    ...TOWER_TYPES[ttype]
  });
  sfx('tdPlace');
  addLog(`Placed ${ttype.toUpperCase()} tower (-${cost}g)`,'info');
  updateHUD();
});

function selectTower(type, btn){
  state.selectedTower = type;
  document.querySelectorAll('.tower-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

function setSpeed(s, btn){
  state.speed = s;
  document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function startWave(){
  if(state.waveActive || state.gameOver) return;
  state.wave++;
  const count = 8 + state.wave * 3;
  state.waveActive = true;
  state.waveEnemiesLeft = count;
  state.waveEnemyTimer = 0;
  document.getElementById('waveBtn').disabled = true;
  sfx('tdWave');
  addLog(`▶ WAVE ${state.wave} INCOMING — ${count} enemies`,'info');
  updateHUD();
}

function spawnEnemy(){
  const hp = 40 + state.wave * 20 + Math.random()*20;
  const spd = 0.6 + state.wave * 0.05 + Math.random()*0.2;
  const isBoss = state.waveEnemiesLeft === 1 && state.wave % 5 === 0;
  state.enemies.push({
    x: PATH_WAYPOINTS[0].x*CELL,
    y: PATH_WAYPOINTS[0].y*CELL + CELL/2,
    wpIdx: 0, progress: 0,
    hp: isBoss ? hp*4 : hp,
    maxHp: isBoss ? hp*4 : hp,
    speed: isBoss ? spd*0.5 : spd,
    slow: 0, boss: isBoss,
    reward: isBoss ? 60 : 10 + state.wave * 2,
  });
}

function moveEnemy(e){
  if(e.wpIdx >= PATH_WAYPOINTS.length-1){ return true; }
  const target = wpPx(PATH_WAYPOINTS[e.wpIdx+1]);
  const spd = e.slow > 0 ? e.speed * 0.4 : e.speed;
  const dx = target.x - e.x, dy = target.y - e.y;
  const dist = Math.hypot(dx,dy);
  if(dist < spd+1){ e.x=target.x; e.y=target.y; e.wpIdx++; return false; }
  e.x += (dx/dist)*spd;
  e.y += (dy/dist)*spd;
  if(e.slow>0) e.slow--;
  return false;
}

function towerShoot(t){
  if(t.cooldown>0){ t.cooldown--; return; }
  let best=null, bd=Infinity;
  for(const e of state.enemies){
    const d=Math.hypot(e.x-t.x,e.y-t.y);
    if(d<t.range && e.wpIdx<PATH_WAYPOINTS.length-1){
      if(e.wpIdx>bd||(e.wpIdx===bd&&d<bd)){ best=e; bd=d; }
      if(!best||(e.wpIdx>best.wpIdx||(e.wpIdx===best.wpIdx&&d<bd))){ best=e; bd=d; }
    }
  }
  if(!best) return;
  t.cooldown = t.rate;
  const bAngle = Math.atan2(best.y - t.y, best.x - t.x);
  // per-type shoot sound (throttled so rapid fire doesn't stack)
  const sndMap={gun:'tdShoot',laser:'tdLaser',missile:'tdMissile',slow:'tdCryo'};
  sfx(sndMap[t.type]||'tdShoot', t.type==='gun'?80: t.type==='laser'?60: t.type==='missile'?200:150);
  state.bullets.push({
    x:t.x, y:t.y, tx:best, spd: t.type==='missile'?4:7,
    dmg:t.damage, color:t.bullet, aoe:t.aoe,
    slow: t.type==='slow',
    towerType: t.type,
    angle: bAngle,
    trailX:[], trailY:[],
    life: 0,
  });
}

function moveBullets(){
  for(let i=state.bullets.length-1;i>=0;i--){
    const b=state.bullets[i];
    b.life++;
    if(!b.tx || b.tx.hp<=0){ state.bullets.splice(i,1); continue; }
    const dx=b.tx.x-b.x, dy=b.tx.y-b.y, d=Math.hypot(dx,dy);
    // update angle to face target
    b.angle = Math.atan2(dy, dx);
    // store trail (max 10 points)
    b.trailX.push(b.x); b.trailY.push(b.y);
    if(b.trailX.length > 12){ b.trailX.shift(); b.trailY.shift(); }
    if(d < b.spd+3){
      // hit
      if(b.aoe){
        for(const e of state.enemies){
          if(Math.hypot(e.x-b.tx.x,e.y-b.tx.y)<55){ e.hp-=b.dmg; }
        }
        sfx('tdExplode',200);
        spawnHitParticles(b.tx.x, b.tx.y, 'explosion');
      } else {
        b.tx.hp -= b.dmg;
        if(b.slow) b.tx.slow = 60;
        spawnHitParticles(b.tx.x, b.tx.y, b.towerType);
      }
      state.bullets.splice(i,1);
    } else {
      b.x += (dx/d)*b.spd;
      b.y += (dy/d)*b.spd;
    }
  }
}

function spawnHitParticles(x, y, type){
  if(type==='gun'){
    // sparks — fast, short-lived, white/cyan
    for(let i=0;i<8;i++){
      const a=Math.random()*Math.PI*2, s=Math.random()*4+2;
      state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:12,maxLife:12,type:'spark',color:'#aaeeff'});
    }
  } else if(type==='laser'){
    // energy burst — pink rings + dots
    for(let i=0;i<6;i++){
      const a=(i/6)*Math.PI*2, s=2+Math.random()*2;
      state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:18,maxLife:18,type:'energy',color:'#ff0088'});
    }
    state.particles.push({x,y,vx:0,vy:0,life:10,maxLife:10,type:'ring',color:'#ff0088',radius:2});
  } else if(type==='explosion'){
    // big fiery explosion for missiles
    for(let i=0;i<16;i++){
      const a=Math.random()*Math.PI*2, s=Math.random()*5+2;
      const cols=['#ff4400','#ff8800','#ffcc00','#ffffff'];
      state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:25,maxLife:25,type:'fire',color:cols[Math.floor(Math.random()*cols.length)]});
    }
    // shockwave ring
    state.particles.push({x,y,vx:0,vy:0,life:15,maxLife:15,type:'shockwave',color:'#ff8800',radius:4});
  } else if(type==='slow'){
    // ice shatter — blue/white fragments
    for(let i=0;i<8;i++){
      const a=Math.random()*Math.PI*2, s=Math.random()*2.5+1;
      state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20,maxLife:20,type:'ice',color:'#aaddff'});
    }
    state.particles.push({x,y,vx:0,vy:0,life:12,maxLife:12,type:'ring',color:'#88ccff',radius:2});
  }
}

// legacy compat
function spawnHitParticle(x,y,color){ spawnHitParticles(x,y,'gun'); }

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

function drawTowerBase(x, y, color, glowColor){
  ctx.save();
  ctx.shadowColor = glowColor; ctx.shadowBlur = 14;
  // concrete pad shadow
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/8, r=17;
    i===0?ctx.moveTo(x+Math.cos(a)*r+1,y+Math.sin(a)*r+1):ctx.lineTo(x+Math.cos(a)*r+1,y+Math.sin(a)*r+1);
  }
  ctx.closePath(); ctx.fill();
  // base plate
  const baseGrad = ctx.createRadialGradient(x-3,y-3,1,x,y,18);
  baseGrad.addColorStop(0,'#243444'); baseGrad.addColorStop(0.6,'#152030'); baseGrad.addColorStop(1,'#080f18');
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/8, r=17;
    i===0?ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fillStyle=baseGrad; ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=1.3; ctx.stroke();
  // bolt holes at corners
  ctx.fillStyle='rgba(0,0,0,0.6)';
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/8, r=13;
    ctx.beginPath(); ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,1.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.5; ctx.stroke();
  }
  // pivot ring
  ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2);
  const ringGrad=ctx.createRadialGradient(x-1,y-1,0,x,y,6);
  ringGrad.addColorStop(0,'#3a5060'); ringGrad.addColorStop(1,'#111d28');
  ctx.fillStyle=ringGrad; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=0.8; ctx.stroke();
  ctx.restore();
}

// ── MACHINE GUN TOWER ──
function drawGunTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#00f5ff','#00f5ff');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#00c8ff'; ctx.shadowBlur=10;

  // === TURRET BODY — boxy armored housing ===
  const hGrad = ctx.createLinearGradient(-11,-9,11,9);
  hGrad.addColorStop(0,'#2e4e68'); hGrad.addColorStop(0.4,'#1d3550'); hGrad.addColorStop(1,'#0d1e30');
  ctx.fillStyle=hGrad;
  ctx.beginPath();
  ctx.moveTo(-11,-9); ctx.lineTo(6,-9); ctx.lineTo(10,-6);
  ctx.lineTo(10,6);   ctx.lineTo(6,9);  ctx.lineTo(-11,9); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle='#00a8cc'; ctx.lineWidth=1.2; ctx.stroke();

  // armor plate highlight (top-left bevel)
  ctx.beginPath(); ctx.moveTo(-11,-9); ctx.lineTo(6,-9); ctx.lineTo(10,-6);
  ctx.strokeStyle='rgba(150,220,255,0.25)'; ctx.lineWidth=1; ctx.stroke();

  // side vent slits
  ctx.strokeStyle='rgba(0,200,220,0.3)'; ctx.lineWidth=0.8;
  for(let vx=-8;vx<2;vx+=2.5){
    ctx.beginPath(); ctx.moveTo(vx,-8); ctx.lineTo(vx,8); ctx.stroke();
  }

  // ammo belt box (left side)
  const aGrad=ctx.createLinearGradient(-11,-5,-4,5);
  aGrad.addColorStop(0,'#1a3040'); aGrad.addColorStop(1,'#0c1820');
  ctx.fillStyle=aGrad;
  ctx.beginPath(); ctx.roundRect(-11,-5,7,10,1); ctx.fill();
  ctx.strokeStyle='#2a5070'; ctx.lineWidth=0.8; ctx.stroke();
  // ammo rounds inside box
  for(let ay=-3.5;ay<=3.5;ay+=1.8){
    ctx.fillStyle='#d4a800'; ctx.globalAlpha=0.8;
    ctx.fillRect(-9.5,ay-0.6,4,1.2);
    ctx.fillStyle='#a07800'; ctx.globalAlpha=1;
    ctx.fillRect(-9.5,ay-0.6,1,1.2);
  }

  // === DUAL MACHINE GUN BARRELS ===
  for(const yo of [-4, 4]){
    // receiver / breach
    ctx.fillStyle='#1a3040';
    ctx.beginPath(); ctx.roundRect(0,yo-2.2,6,4.4,1); ctx.fill();
    ctx.strokeStyle='#00b8d4'; ctx.lineWidth=0.7; ctx.stroke();

    // main barrel (long, tapered)
    const bGrad=ctx.createLinearGradient(6,yo-2,6,yo+2);
    bGrad.addColorStop(0,'#3a5c72'); bGrad.addColorStop(0.5,'#1e3e54'); bGrad.addColorStop(1,'#0e1e2c');
    ctx.fillStyle=bGrad;
    ctx.beginPath();
    ctx.moveTo(6,yo-2); ctx.lineTo(20,yo-1.3); ctx.lineTo(20,yo+1.3); ctx.lineTo(6,yo+2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#00c8dd'; ctx.lineWidth=0.6; ctx.stroke();

    // heat shroud (perforated sleeve over barrel)
    ctx.strokeStyle='rgba(0,200,220,0.4)'; ctx.lineWidth=0.5;
    for(let hx=8;hx<18;hx+=2){
      ctx.beginPath(); ctx.moveTo(hx,yo-1.8); ctx.lineTo(hx,yo+1.8); ctx.stroke();
    }
    // barrel ridge rings
    for(const rx of [9,12,15,18]){
      ctx.strokeStyle='rgba(0,180,210,0.5)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(rx,yo-1.5); ctx.lineTo(rx,yo+1.5); ctx.stroke();
    }

    // muzzle brake (end piece)
    ctx.fillStyle='#0d1e2c';
    ctx.beginPath();
    ctx.moveTo(20,yo-1.3); ctx.lineTo(22,yo-2.2); ctx.lineTo(23,yo); ctx.lineTo(22,yo+2.2); ctx.lineTo(20,yo+1.3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=0.7; ctx.stroke();
    // muzzle slots
    ctx.fillStyle='rgba(0,0,0,0.8)';
    ctx.fillRect(20.5,yo-1.8,1.5,1.2);
    ctx.fillRect(20.5,yo+0.6,1.5,1.2);
  }

  // === GUN BRIDGE / YOKE connecting barrels ===
  ctx.fillStyle='rgba(30,60,80,0.9)';
  ctx.beginPath(); ctx.roundRect(5,-5,4,10,1); ctx.fill();
  ctx.strokeStyle='#004455'; ctx.lineWidth=0.6; ctx.stroke();

  // targeting sensor on top
  ctx.fillStyle='#0d2030';
  ctx.beginPath(); ctx.roundRect(-3,-12,6,4,1); ctx.fill();
  ctx.strokeStyle='#00f5ff'; ctx.lineWidth=0.7; ctx.stroke();
  // sensor lens
  const lens=ctx.createRadialGradient(0,-10,0,0,-10,2);
  lens.addColorStop(0,'#88ffff'); lens.addColorStop(1,'#004466');
  ctx.fillStyle=lens; ctx.beginPath(); ctx.arc(0,-10,2,0,Math.PI*2); ctx.fill();

  ctx.restore(); ctx.restore();
}

// ── LASER TOWER ──
function drawLaserTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#ff0088','#ff0088');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#ff0088'; ctx.shadowBlur=12;

  // === HOUSING — same boxy gun shape but sleeker ===
  const hGrad=ctx.createLinearGradient(-11,-8,11,8);
  hGrad.addColorStop(0,'#3a0f22'); hGrad.addColorStop(0.4,'#250a18'); hGrad.addColorStop(1,'#100408');
  ctx.fillStyle=hGrad;
  ctx.beginPath();
  ctx.moveTo(-11,-8); ctx.lineTo(6,-8); ctx.lineTo(10,-5);
  ctx.lineTo(10,5);   ctx.lineTo(6,8);  ctx.lineTo(-11,8); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle='#cc0066'; ctx.lineWidth=1.2; ctx.stroke();
  // highlight bevel
  ctx.beginPath(); ctx.moveTo(-11,-8); ctx.lineTo(6,-8); ctx.lineTo(10,-5);
  ctx.strokeStyle='rgba(255,120,180,0.2)'; ctx.lineWidth=1; ctx.stroke();

  // power conduits (vertical lines on body)
  ctx.strokeStyle='rgba(255,0,120,0.25)'; ctx.lineWidth=0.7;
  for(let vx=-8;vx<2;vx+=2.5){
    ctx.beginPath(); ctx.moveTo(vx,-7); ctx.lineTo(vx,7); ctx.stroke();
  }

  // energy capacitor bank (left)
  ctx.fillStyle='#1a0510';
  ctx.beginPath(); ctx.roundRect(-11,-6,6,12,1); ctx.fill();
  ctx.strokeStyle='#550033'; ctx.lineWidth=0.8; ctx.stroke();
  // capacitor cells
  for(let cy=-5;cy<=4;cy+=2.2){
    const capGrad=ctx.createLinearGradient(-10,cy,-5,cy);
    capGrad.addColorStop(0,'#ff0066'); capGrad.addColorStop(1,'#330022');
    ctx.fillStyle=capGrad; ctx.globalAlpha=0.8;
    ctx.fillRect(-10,cy,5,1.5);
    ctx.globalAlpha=1;
  }

  // === SINGLE LASER BARREL — same profile as gun barrel but with coils ===
  // receiver
  ctx.fillStyle='#200812';
  ctx.beginPath(); ctx.roundRect(0,-3,7,6,1); ctx.fill();
  ctx.strokeStyle='#cc0066'; ctx.lineWidth=0.8; ctx.stroke();

  // barrel body (same taper as gun)
  const bGrad=ctx.createLinearGradient(7,-3,7,3);
  bGrad.addColorStop(0,'#3a1020'); bGrad.addColorStop(0.5,'#220810'); bGrad.addColorStop(1,'#100408');
  ctx.fillStyle=bGrad;
  ctx.beginPath();
  ctx.moveTo(7,-3); ctx.lineTo(21,-2); ctx.lineTo(21,2); ctx.lineTo(7,3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#ff0077'; ctx.lineWidth=0.7; ctx.stroke();

  // EM acceleration rings (the gun-barrel rings, but glowing pink)
  for(const rx of [9,12,15,18,21]){
    const ringGrad=ctx.createLinearGradient(rx,-3,rx,3);
    ringGrad.addColorStop(0,'rgba(255,0,120,0.6)');
    ringGrad.addColorStop(0.5,'rgba(255,0,120,0.2)');
    ringGrad.addColorStop(1,'rgba(255,0,120,0.6)');
    ctx.strokeStyle=ringGrad; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(rx,-2.5); ctx.lineTo(rx,2.5); ctx.stroke();
    // ring glow dot
    ctx.fillStyle='rgba(255,0,136,0.4)';
    ctx.beginPath(); ctx.arc(rx,-2.5,0.8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx,2.5,0.8,0,Math.PI*2); ctx.fill();
  }

  // emitter lens at tip (instead of muzzle brake)
  const lens=ctx.createRadialGradient(22,0,0,22,0,3.5);
  lens.addColorStop(0,'#ffffff'); lens.addColorStop(0.3,'#ff44aa'); lens.addColorStop(0.7,'#ff0088'); lens.addColorStop(1,'transparent');
  ctx.fillStyle=lens;
  ctx.beginPath(); ctx.arc(22,0,3.5,0,Math.PI*2); ctx.fill();
  // outer lens ring
  ctx.strokeStyle='rgba(255,0,136,0.8)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.arc(22,0,3.5,0,Math.PI*2); ctx.stroke();

  // targeting scope on top (same as gun)
  ctx.fillStyle='#120408';
  ctx.beginPath(); ctx.roundRect(-3,-11,6,4,1); ctx.fill();
  ctx.strokeStyle='#ff0088'; ctx.lineWidth=0.7; ctx.stroke();
  const sLens=ctx.createRadialGradient(0,-9,0,0,-9,2);
  sLens.addColorStop(0,'#ffaacc'); sLens.addColorStop(1,'#440022');
  ctx.fillStyle=sLens; ctx.beginPath(); ctx.arc(0,-9,2,0,Math.PI*2); ctx.fill();

  ctx.restore(); ctx.restore();
}

// ── MISSILE TOWER ──
function drawMissileTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#ff8800','#ff8800');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;

  // === ROTATING LAUNCHER ARM ===
  // central pivot yoke
  const yGrad=ctx.createLinearGradient(-5,-8,5,8);
  yGrad.addColorStop(0,'#2a1a08'); yGrad.addColorStop(1,'#120c04');
  ctx.fillStyle=yGrad;
  ctx.beginPath(); ctx.roundRect(-5,-8,10,16,2); ctx.fill();
  ctx.strokeStyle='#884400'; ctx.lineWidth=1; ctx.stroke();

  // elevation pivot knuckle
  ctx.fillStyle='#3a2a14';
  ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#ff8800'; ctx.lineWidth=0.8; ctx.stroke();
  ctx.fillStyle='#1a1008';
  ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();

  // === TWIN ROCKET POD ARMS ===
  for(const yo of [-5, 5]){
    // arm strut
    ctx.fillStyle='#1a1008';
    ctx.fillRect(0,yo-1,8,2);
    ctx.strokeStyle='#553300'; ctx.lineWidth=0.5; ctx.strokeRect(0,yo-1,8,2);

    // === ROCKET POD (3 tubes side by side) ===
    // pod housing
    const podGrad=ctx.createLinearGradient(7,yo-5,20,yo+5);
    podGrad.addColorStop(0,'#2a1800'); podGrad.addColorStop(1,'#150c00');
    ctx.fillStyle=podGrad;
    ctx.beginPath();
    ctx.moveTo(8,yo-5); ctx.lineTo(18,yo-5); ctx.lineTo(20,yo-3);
    ctx.lineTo(20,yo+3); ctx.lineTo(18,yo+5); ctx.lineTo(8,yo+5); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='#cc5500'; ctx.lineWidth=0.8; ctx.stroke();

    // 3 missile tubes in a row
    for(let ti=0;ti<3;ti++){
      const ty=yo-3+ti*3;
      // tube barrel (circular opening)
      ctx.fillStyle='#0a0500';
      ctx.beginPath(); ctx.ellipse(20,ty,2,1.2,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#884400'; ctx.lineWidth=0.6; ctx.stroke();

      // missile body inside tube
      const rGrad=ctx.createLinearGradient(11,ty-1,19,ty+1);
      rGrad.addColorStop(0,'#cc5500'); rGrad.addColorStop(1,'#884400');
      ctx.fillStyle=rGrad;
      ctx.fillRect(11,ty-1,8,2);

      // warhead cone (pointy tip)
      ctx.fillStyle='#ff2200';
      ctx.beginPath(); ctx.moveTo(19,ty-1); ctx.lineTo(22,ty); ctx.lineTo(19,ty+1); ctx.closePath(); ctx.fill();

      // exhaust bell at back
      ctx.fillStyle='#222';
      ctx.beginPath(); ctx.ellipse(11,ty,1.5,1,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#555'; ctx.lineWidth=0.4; ctx.stroke();
    }

    // pod detail stripe
    ctx.strokeStyle='rgba(255,100,0,0.3)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(8,yo); ctx.lineTo(18,yo); ctx.stroke();
  }

  // IFF antenna on top
  ctx.strokeStyle='#996622'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,-14); ctx.stroke();
  ctx.fillStyle='#ff4400';
  ctx.beginPath(); ctx.arc(0,-14,1.5,0,Math.PI*2); ctx.fill();
  ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(0,-14,1.5,0,Math.PI*2); ctx.fill();

  ctx.restore(); ctx.restore();
}

// ── CRYO TOWER ── (same design, just polished)
function drawCryoTower(x, y, angle){
  ctx.save(); ctx.translate(x,y);
  drawTowerBase(0,0,'#88aaff','#88aaff');
  ctx.rotate(angle);
  ctx.save();
  ctx.shadowColor='#aaccff'; ctx.shadowBlur=16;

  // dome housing
  const cGrad=ctx.createRadialGradient(-2,-2,1,0,0,12);
  cGrad.addColorStop(0,'#c8e8ff'); cGrad.addColorStop(0.35,'#5599cc'); cGrad.addColorStop(0.7,'#1a3060'); cGrad.addColorStop(1,'#060e20');
  ctx.fillStyle=cGrad;
  ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#66aaee'; ctx.lineWidth=1.2; ctx.stroke();

  // dome highlight
  ctx.fillStyle='rgba(220,240,255,0.12)';
  ctx.beginPath(); ctx.ellipse(-3,-4,6,4,Math.PI/5,0,Math.PI*2); ctx.fill();

  // ice crystal lattice (6-fold symmetry)
  ctx.save();
  for(let i=0;i<6;i++){
    ctx.save(); ctx.rotate((i/6)*Math.PI*2);
    // main arm
    ctx.strokeStyle='rgba(180,220,255,0.75)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-10); ctx.stroke();
    // branch pairs
    for(const br of [0.35,0.6,0.8]){
      const by=-10*br;
      ctx.strokeStyle='rgba(160,210,255,0.5)'; ctx.lineWidth=0.6;
      ctx.beginPath(); ctx.moveTo(0,by); ctx.lineTo(-2.5,by-2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,by); ctx.lineTo(2.5,by-2); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // glowing core
  const core=ctx.createRadialGradient(0,0,0,0,0,5);
  core.addColorStop(0,'#ffffff'); core.addColorStop(0.4,'#88ccff'); core.addColorStop(1,'#2244aa');
  ctx.fillStyle=core; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(180,230,255,0.6)'; ctx.lineWidth=0.8; ctx.stroke();

  // === FREEZE NOZZLE (barrel-style, same profile as gun barrel) ===
  // receiver block
  ctx.fillStyle='#0a1830';
  ctx.beginPath(); ctx.roundRect(7,-3.5,5,7,1); ctx.fill();
  ctx.strokeStyle='#4477aa'; ctx.lineWidth=0.7; ctx.stroke();

  // nozzle barrel (tapered like gun)
  const nGrad=ctx.createLinearGradient(12,-3,12,3);
  nGrad.addColorStop(0,'#2a4060'); nGrad.addColorStop(0.5,'#162030'); nGrad.addColorStop(1,'#0a1020');
  ctx.fillStyle=nGrad;
  ctx.beginPath();
  ctx.moveTo(12,-3); ctx.lineTo(22,-2); ctx.lineTo(22,2); ctx.lineTo(12,3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#5599cc'; ctx.lineWidth=0.7; ctx.stroke();

  // cryo rings on nozzle
  for(const rx of [13,16,19,22]){
    ctx.strokeStyle='rgba(100,180,255,0.5)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(rx,-2.5); ctx.lineTo(rx,2.5); ctx.stroke();
  }

  // flared tip emitter
  ctx.fillStyle='rgba(140,210,255,0.35)';
  ctx.beginPath(); ctx.moveTo(22,-2); ctx.lineTo(26,0); ctx.lineTo(22,2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(140,210,255,0.7)'; ctx.lineWidth=0.7; ctx.stroke();

  ctx.restore(); ctx.restore();
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

const TARGET_MS = 1000/60; // 16.667ms per logic tick
let lastTime=0, raf;
let tdAccum=0; // accumulator for tower defense
function gameLoop(ts){
  if(!Array.isArray(state.towers)) { lastTime=ts; raf=requestAnimationFrame(gameLoop); return; }
  const dt = Math.min(ts - lastTime, 100); // cap at 100ms to avoid spiral after tab switch
  lastTime = ts;
  if(!state.gameOver){
    tdAccum += dt * state.speed;
    while(tdAccum >= TARGET_MS){
      tick();
      tdAccum -= TARGET_MS;
    }
  }
  drawBg(); drawPath(); drawTowers(); drawEnemies(); drawBullets(); drawParticles();
  raf = requestAnimationFrame(gameLoop);
}

function tick(){
  if(!Array.isArray(state.towers)||!Array.isArray(state.enemies)||!Array.isArray(state.bullets)) return;
  state.frame++;
  // spawn enemies
  if(state.waveActive && state.waveEnemiesLeft>0){
    state.waveEnemyTimer++;
    if(state.waveEnemyTimer >= 45){
      spawnEnemy(); state.waveEnemiesLeft--;
      state.waveEnemyTimer=0;
    }
  }
  // move enemies
  for(let i=state.enemies.length-1;i>=0;i--){
    const e=state.enemies[i];
    const reached = moveEnemy(e);
    if(reached){
      state.lives--; state.enemies.splice(i,1);
      sfx('tdEnemy',100);
      addLog('Enemy breached! -1 life','bad');
      updateHUD();
      if(state.lives<=0){ endGame(false); return; }
    } else if(e.hp<=0){
      state.score += e.boss?200:20+state.wave*5;
      spawnHitParticle(e.x,e.y,'orange');
      addLog(`+${e.boss?200:20+state.wave*5}pts`,'good');
      state.enemies.splice(i,1);
      updateHUD();
    }
  }
  // towers shoot
  for(const t of state.towers) towerShoot(t);
  moveBullets();
  // wave complete?
  if(state.waveActive && state.waveEnemiesLeft===0 && state.enemies.length===0){
    state.waveActive=false;
    document.getElementById('waveBtn').disabled=false;
    addLog(`✓ Wave ${state.wave} complete! +50g`,'good');
    sfx('tdVictory'); sfx('rtsGoldIn');
    state.gold+=50; updateHUD();
  }
}

function endGame(won){
  state.gameOver=true;
  const ov=document.getElementById('overlay');
  const ot=document.getElementById('overlayTitle');
  const os=document.getElementById('overlaySub');
  ov.classList.add('show');
  if(won){ ot.className='overlay-title win'; ot.textContent='VICTORY'; os.textContent=`WAVE ${state.wave} — SCORE: ${state.score}`; sfx('tdVictory'); }
  else    { ot.className='overlay-title lose'; ot.textContent='GAME OVER'; os.textContent=`REACHED WAVE ${state.wave} — SCORE: ${state.score}`; sfx('tdDead'); }
}

function resetGame(){
  cancelAnimationFrame(raf);
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('waveBtn').disabled=false;
  initState();
  updateHUD();
  setLog([]);
  addLog('Game initialized. Place towers and send waves!','info');
  lastTime=performance.now();
  tdAccum=0;
  raf=requestAnimationFrame(gameLoop);
}
