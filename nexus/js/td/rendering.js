// ── DRAW ──
// The static battlefield (deck plating, path channel, rubble) is painted once
// into an offscreen layer and blitted each frame; it is rebuilt only when the
// map or the breached shortcut changes. Positions/variation come from a hash of
// the cell coordinates so the board looks the same every time it is drawn.
let tdBoardLayer = null, tdBoardKey = '';
let tdFxTime = 0; // free-running animation clock (runs even between waves)

function tdHash(x, y, salt){
  let h = Math.imul(x|0, 374761393) ^ Math.imul(y|0, 668265263) ^ Math.imul((salt|0)+1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tdChannelCells(){
  const cells = new Set(pathCells);
  if(state.shortcutOpen) for(const c of tunnelCellsSet) cells.add(c);
  return cells;
}

function buildBoardLayer(){
  const dpr = typeof TD_DPR === 'number' ? TD_DPR : 1;
  if(!tdBoardLayer) tdBoardLayer = document.createElement('canvas');
  tdBoardLayer.width = W*dpr; tdBoardLayer.height = H*dpr;
  const g = tdBoardLayer.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);

  // Deep-space backdrop: nebula washes and a seeded starfield.
  const base = g.createLinearGradient(0,0,W,H);
  base.addColorStop(0,'#0a1420'); base.addColorStop(0.5,'#050b13'); base.addColorStop(1,'#0b0f1c');
  g.fillStyle = base; g.fillRect(0,0,W,H);
  for(const [nx,ny,nr,col] of [[0.82,0.18,0.55,'rgba(130,50,210,0.16)'],[0.12,0.86,0.5,'rgba(0,170,220,0.13)'],[0.5,0.5,0.35,'rgba(40,90,160,0.08)']]){
    const n = g.createRadialGradient(W*nx,H*ny,0,W*nx,H*ny,W*nr);
    n.addColorStop(0,col); n.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle = n; g.fillRect(0,0,W,H);
  }
  for(let i=0;i<140;i++){
    const sx = tdHash(i,7,1)*W, sy = tdHash(i,13,2)*H, sr = tdHash(i,3,3);
    g.fillStyle = `rgba(210,235,255,${0.12+sr*0.45})`;
    g.fillRect(sx, sy, sr>0.9?1.6:1, sr>0.9?1.6:1);
  }

  const channel = tdChannelCells();
  const blocked = c => channel.has(c) || (!state.shortcutOpen && wallCellsSet.has(c));

  // Build deck: individual smoked-metal plates, slightly translucent so the
  // nebula reads through, with bevels, rivets and the odd vent or status light.
  for(let gy=0;gy<ROWS;gy++){
    for(let gx=0;gx<COLS;gx++){
      if(blocked(`${gx},${gy}`)) continue;
      const x = gx*CELL, y = gy*CELL, n = tdHash(gx,gy,4);
      const plate = g.createLinearGradient(x,y,x+CELL,y+CELL);
      plate.addColorStop(0,`rgba(${26+n*12},${40+n*14},${54+n*16},0.72)`);
      plate.addColorStop(1,`rgba(${9+n*5},${15+n*7},${24+n*9},0.85)`);
      g.fillStyle = plate;
      g.beginPath(); g.roundRect(x+1.5,y+1.5,CELL-3,CELL-3,3); g.fill();
      // bevel: lit top-left, shadowed bottom-right
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(170,220,240,0.10)';
      g.beginPath(); g.moveTo(x+2,y+CELL-3); g.lineTo(x+2,y+2); g.lineTo(x+CELL-3,y+2); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.moveTo(x+CELL-2,y+3); g.lineTo(x+CELL-2,y+CELL-2); g.lineTo(x+3,y+CELL-2); g.stroke();
      if(tdHash(gx,gy,5) < 0.35){
        g.fillStyle = 'rgba(0,0,0,0.5)';
        for(const [rx,ry] of [[5,5],[CELL-5,5],[5,CELL-5],[CELL-5,CELL-5]]){
          g.beginPath(); g.arc(x+rx,y+ry,1.1,0,Math.PI*2); g.fill();
        }
        g.fillStyle = 'rgba(190,230,250,0.10)';
        for(const [rx,ry] of [[5,5],[CELL-5,5],[5,CELL-5],[CELL-5,CELL-5]]){
          g.beginPath(); g.arc(x+rx-0.4,y+ry-0.4,0.6,0,Math.PI*2); g.fill();
        }
      }
      const d = tdHash(gx,gy,6);
      if(d < 0.12){
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
        for(let k=0;k<3;k++){ g.beginPath(); g.moveTo(x+12,y+14+k*6); g.lineTo(x+CELL-12,y+14+k*6); g.stroke(); }
        g.strokeStyle = 'rgba(150,200,225,0.07)'; g.lineWidth = 1;
        for(let k=0;k<3;k++){ g.beginPath(); g.moveTo(x+12,y+15.5+k*6); g.lineTo(x+CELL-12,y+15.5+k*6); g.stroke(); }
      } else if(d < 0.18){
        const col = tdHash(gx,gy,7) < 0.5 ? '0,230,255' : '255,170,40';
        const lx = x+CELL-9, ly = y+9;
        const lg = g.createRadialGradient(lx,ly,0,lx,ly,6);
        lg.addColorStop(0,`rgba(${col},0.55)`); lg.addColorStop(1,`rgba(${col},0)`);
        g.fillStyle = lg; g.beginPath(); g.arc(lx,ly,6,0,Math.PI*2); g.fill();
        g.fillStyle = `rgba(${col},0.9)`; g.beginPath(); g.arc(lx,ly,1.2,0,Math.PI*2); g.fill();
      }
    }
  }

  // Path channel: a recessed trench whose footprint matches exactly the cells
  // that can't hold towers. Edges glow cyan; a breached tunnel glows amber.
  for(const cell of channel){
    const [gx,gy] = cell.split(',').map(Number);
    const x = gx*CELL, y = gy*CELL;
    const floor = g.createLinearGradient(x,y,x,y+CELL);
    floor.addColorStop(0,'#040910'); floor.addColorStop(0.5,'#08131d'); floor.addColorStop(1,'#040910');
    g.fillStyle = floor; g.fillRect(x,y,CELL,CELL);
    // floor grating
    g.strokeStyle = 'rgba(90,170,210,0.07)'; g.lineWidth = 1;
    for(let k=6;k<CELL;k+=8){
      g.beginPath(); g.moveTo(x+k+.5,y); g.lineTo(x+k+.5,y+CELL); g.stroke();
      g.beginPath(); g.moveTo(x,y+k+.5); g.lineTo(x+CELL,y+k+.5); g.stroke();
    }
  }
  for(const cell of channel){
    const [gx,gy] = cell.split(',').map(Number);
    const x = gx*CELL, y = gy*CELL;
    const rim = (state.shortcutOpen && tunnelCellsSet.has(cell) && !pathCells.has(cell)) ? '255,170,60' : '0,210,255';
    const sides = [
      [!channel.has(`${gx},${gy-1}`), x,y, x+CELL,y, 0,1],
      [!channel.has(`${gx},${gy+1}`), x,y+CELL, x+CELL,y+CELL, 0,-1],
      [!channel.has(`${gx-1},${gy}`), x,y, x,y+CELL, 1,0],
      [!channel.has(`${gx+1},${gy}`), x+CELL,y, x+CELL,y+CELL, -1,0],
    ];
    for(const [open,x1,y1,x2,y2,nx,ny] of sides){
      if(!open) continue;
      // inner wall shadow falling into the trench
      const sh = g.createLinearGradient(x1,y1,x1+nx*9,y1+ny*9);
      sh.addColorStop(0,'rgba(0,0,0,0.7)'); sh.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.fillRect(Math.min(x1,x1+nx*9), Math.min(y1,y1+ny*9), Math.abs(x2-x1)||9, Math.abs(y2-y1)||9);
      // glowing rim
      g.save();
      g.shadowColor = `rgba(${rim},0.9)`; g.shadowBlur = 8;
      g.strokeStyle = `rgba(${rim},0.55)`; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x1+nx*1.5,y1+ny*1.5); g.lineTo(x2+nx*1.5,y2+ny*1.5); g.stroke();
      g.restore();
    }
  }

  // Destructible rubble: a heap of lit boulders sealing off the shortcut.
  if(!state.shortcutOpen){
    for(const cell of wallCellsSet){
      const [gx,gy] = cell.split(',').map(Number);
      const x = gx*CELL, y = gy*CELL;
      g.fillStyle = '#0d0905'; g.fillRect(x+1,y+1,CELL-2,CELL-2);
      g.save();
      g.strokeStyle = 'rgba(255,150,50,0.35)'; g.setLineDash([5,4]); g.lineWidth = 1;
      g.strokeRect(x+1.5,y+1.5,CELL-3,CELL-3);
      g.restore();
      for(let r=0;r<6;r++){
        const cx = x+8+tdHash(gx*7+r,gy,8)*(CELL-16), cy = y+8+tdHash(gx,gy*7+r,9)*(CELL-16);
        const rad = 5 + tdHash(gx+r,gy+r,10)*6;
        const rock = g.createRadialGradient(cx-rad*0.4,cy-rad*0.4,0.5,cx,cy,rad);
        rock.addColorStop(0,'#b08a5a'); rock.addColorStop(0.55,'#5a4128'); rock.addColorStop(1,'#1c130a');
        g.fillStyle = rock;
        g.beginPath();
        for(let k=0;k<7;k++){
          const a = k/7*Math.PI*2, rr = rad*(0.75+tdHash(r,k,gx+gy)*0.35);
          k===0 ? g.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr) : g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);
        }
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.8; g.stroke();
      }
    }
  }

  const vignette = g.createRadialGradient(W*.5,H*.48,H*.25,W*.5,H*.48,W*.72);
  vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(1,'rgba(0,0,0,0.6)');
  g.fillStyle = vignette; g.fillRect(0,0,W,H);
}

function drawBg(){
  tdFxTime++;
  const key = `${PATH_WAYPOINTS.map(p=>p.x+','+p.y).join(';')}|${state.shortcutOpen?1:0}`;
  if(key !== tdBoardKey || !tdBoardLayer){ buildBoardLayer(); tdBoardKey = key; }
  ctx.drawImage(tdBoardLayer, 0, 0, W, H);
}

function tracePolyline(points){
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
}

// Animated portal: swirling arcs and a pulsing core where enemies enter or exit.
function drawPortal(x, y, rgb, dir){
  const t = tdFxTime*0.04*dir, pulse = 0.75 + Math.sin(tdFxTime*0.08)*0.25;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x,y,0,x,y,26);
  halo.addColorStop(0,`rgba(${rgb},${0.55*pulse})`); halo.addColorStop(0.45,`rgba(${rgb},0.18)`); halo.addColorStop(1,`rgba(${rgb},0)`);
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x,y,26,0,Math.PI*2); ctx.fill();
  ctx.lineCap = 'round';
  for(let i=0;i<3;i++){
    const a = t + i*Math.PI*2/3;
    ctx.strokeStyle = `rgba(${rgb},0.8)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x,y,13,a,a+1.1); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},0.45)`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x,y,8,-a*1.6,-a*1.6+1.4); ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,255,255,${0.6*pulse})`;
  ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawPath(){
  const pts = PATH_WAYPOINTS.map(wpPx);
  const routes = [pts];
  if(state.shortcutOpen && activeMap.shortcut){
    const sc = activeMap.shortcut;
    routes.push([PATH_WAYPOINTS[sc.breachIndex], ...sc.tunnelWaypoints, PATH_WAYPOINTS[sc.rejoinIndex]].map(wpPx));
  }

  // Energy flowing along the route shows travel direction at a glance.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for(const route of routes){
    ctx.strokeStyle = 'rgba(0,150,255,0.10)'; ctx.lineWidth = 10;
    tracePolyline(route); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,190,255,0.22)'; ctx.lineWidth = 1.5;
    tracePolyline(route); ctx.stroke();
    ctx.setLineDash([2, 38]);
    ctx.lineDashOffset = -tdFxTime*0.9;
    ctx.strokeStyle = 'rgba(140,230,255,0.85)'; ctx.lineWidth = 4;
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 10;
    tracePolyline(route); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
  }
  ctx.restore();

  drawPortal(pts[0].x, pts[0].y, '0,255,136', 1);
  drawPortal(pts[pts.length-1].x, pts[pts.length-1].y, '255,0,136', -1);
}

function tdHexAlpha(hex,a){
  const r=parseInt(hex.slice(1,3),16)||0, g=parseInt(hex.slice(3,5),16)||0, b=parseInt(hex.slice(5,7),16)||0;
  return `rgba(${r},${g},${b},${a})`;
}

function drawTowerRange(t){
  ctx.save();
  const fill = ctx.createRadialGradient(t.x, t.y, t.range*0.2, t.x, t.y, t.range);
  fill.addColorStop(0, tdHexAlpha(t.color, 0.02)); fill.addColorStop(1, tdHexAlpha(t.color, 0.09));
  ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, Math.PI*2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = tdHexAlpha(t.color, 0.35);
  ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTowers(){
  if(!Array.isArray(state.towers)) return;
  for(const t of state.towers) drawTowerRange(t);
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

    // Selected-for-relocation ring, drawn under the turret.
    if(state.movingTower===t){
      ctx.save();
      ctx.strokeStyle='rgba(0,255,136,0.8)'; ctx.lineWidth=2;
      ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.arc(t.x,t.y,20,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle='rgba(0,255,136,0.25)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(t.x,t.y,t.range,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    // Colored light spill from the turret onto the deck.
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const spill=ctx.createRadialGradient(t.x,t.y,4,t.x,t.y,30);
    spill.addColorStop(0,tdHexAlpha(t.color,0.22)); spill.addColorStop(1,tdHexAlpha(t.color,0));
    ctx.fillStyle=spill; ctx.beginPath(); ctx.arc(t.x,t.y,30,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Cooling down after a relocation: can't fire yet.
    if(t.moveCooldown>0) ctx.globalAlpha=0.55;

    if(t.type==='gun')    drawGunTower(t.x, t.y, angle);
    else if(t.type==='laser')   drawLaserTower(t.x, t.y, angle);
    else if(t.type==='missile') drawMissileTower(t.x, t.y, angle);
    else if(t.type==='slow')    drawCryoTower(t.x, t.y, angle);
    ctx.globalAlpha=1;

    drawTowerEvolutionBadge(t);
  }
}

// Evolution feedback: a tinted ring once a tower branches at level 3, plus
// small level pips so the player can tell levels apart at a glance.
function drawTowerEvolutionBadge(t){
  if(t.level>1){
    ctx.save();
    ctx.strokeStyle = t.evoTint || 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = t.evoTint || '#ffffff';
    for(let i=0;i<t.level-1;i++){
      ctx.beginPath(); ctx.arc(t.x-6+i*6, t.y+17, 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawEnemies(){
  if(!Array.isArray(state.enemies)) return;
  for(const e of state.enemies){
    if(e.shielded) drawShieldAura(e);
    if(e.boss) drawBossEnemy(e); else drawGruntEnemy(e);
    if(e.digging) drawDigProgress(e);
    drawEnemyHpBar(e);
  }
}

// Adaptive enemies: a ring tinted to the tower type they resist, so spam gets visible pushback.
function drawShieldAura(e){
  const color = TOWER_TYPES[e.resistType]?.color || '#ffffff';
  const r = (e.boss ? 16 : 10) * (e.splitDepth ? 0.7 : 1) + 5;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.65;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

// Digger channeling: a filling ring above the enemy shows breach progress.
function drawDigProgress(e){
  const frac = 1 - Math.max(0, e.digTimer)/TD_CONFIG.digDuration;
  const r = 8;
  ctx.save();
  ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(e.x, e.y-24, r, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle='#cc9944'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(e.x, e.y-24, r, -Math.PI/2, -Math.PI/2 + frac*Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawEnemyHpBar(e){
  const r = e.boss ? (e.splitDepth?11:16) : 10;
  const bw=28, bh=4;
  const bx=e.x-bw/2, by=e.y-r-8;
  ctx.fillStyle='rgba(0,0,0,0.7)';
  ctx.fillRect(bx-1, by-1, bw+2, bh+2);
  const hp = Math.max(0,e.hp/e.maxHp);
  ctx.fillStyle = hp>0.5?'#00ff88':hp>0.25?'#ffaa00':'#ff2244';
  ctx.fillRect(bx, by, bw*hp, bh);
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.fillRect(bx, by, bw*hp, 1);
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

// ── STANDARD ENEMY LOOKS ──
// Each grunt kind (ENEMY_KINDS in logic.js) has its own shape and color; diggers and
// boss minions get fixed looks so they stay recognizable.
// sides: polygon side count (0 = circle); star: alternate inner/outer points;
// size: radius multiplier so thin shapes read as large as the others.
const ENEMY_LOOKS = {
  hexagon:  { sides:6, star:false, hi:'#ff6688', mid:'#cc1133', dark:'#4a0812', edge:'#ff6688', leg:'rgba(255,80,100,0.85)',  glow:'#ff0044', eye:'rgba(255,60,60,0.9)' },   // red hexagon
  triangle: { sides:3, star:false, size:1.35, hi:'#88ff99', mid:'#1fae4a', dark:'#063a16', edge:'#66ff88', leg:'rgba(80,220,120,0.85)',  glow:'#00ff66', eye:'rgba(160,255,120,0.9)' }, // green triangle
  diamond:  { sides:4, star:false, hi:'#ffcc66', mid:'#e07a10', dark:'#4a2204', edge:'#ffb347', leg:'rgba(255,160,60,0.85)',  glow:'#ff8800', eye:'rgba(255,200,60,0.9)' },  // orange diamond
  square:   { sides:4, star:false, rot:Math.PI/4, hi:'#d9a3ff', mid:'#8a2be2', dark:'#2a0a4a', edge:'#c58cff', leg:'rgba(180,110,255,0.85)', glow:'#aa44ff', eye:'rgba(230,160,255,0.9)' }, // purple square
  star:     { sides:5, star:true,  size:1.15, hi:'#fff59a', mid:'#e6c200', dark:'#4a3d00', edge:'#ffe14d', leg:'rgba(240,210,60,0.85)',  glow:'#ffdd00', eye:'rgba(255,255,160,0.9)' }, // yellow star
  pentagon: { sides:5, star:false, hi:'#ff99ee', mid:'#d01fa8', dark:'#440636', edge:'#ff77dd', leg:'rgba(255,90,210,0.85)',  glow:'#ff22cc', eye:'rgba(255,150,240,0.9)' }, // magenta pentagon
};
const DIGGER_LOOK = { sides:8, star:false, hi:'#e8c48a', mid:'#9a6a2e', dark:'#3a240a', edge:'#cc9944', leg:'rgba(200,150,80,0.85)', glow:'#cc9944', eye:'rgba(255,210,140,0.9)' }; // bronze octagon
const MINION_LOOK = { sides:0, star:false, hi:'#ffb0a0', mid:'#e0503a', dark:'#4a120a', edge:'#ff8866', leg:'rgba(255,120,90,0.85)', glow:'#ff5533', eye:'rgba(255,180,140,0.9)' };  // coral orb

function enemyLook(e){
  if(e.digger) return DIGGER_LOOK;
  if(e.minion) return MINION_LOOK;
  return ENEMY_LOOKS[e.kind] || ENEMY_LOOKS.hexagon;
}

function traceEnemyBody(look, r){
  r *= look.size || 1;
  ctx.beginPath();
  if(look.sides===0){ ctx.arc(0,0,r*0.85,0,Math.PI*2); return; }
  const pts = look.star ? look.sides*2 : look.sides;
  const rot = look.rot || 0;
  for(let i=0;i<pts;i++){
    const a = rot + (i/pts)*Math.PI*2;
    const rr = look.star ? (i%2===0 ? r*1.15 : r*0.5) : r;
    i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.closePath();
}

// ── STANDARD ENEMY: small hexapod crawler bot ──
function drawGruntEnemy(e){
  const look = enemyLook(e);
  // tougher kinds render bigger so they read as threats at a glance
  const kind = typeof ENEMY_KINDS!=='undefined' && ENEMY_KINDS.find(k=>k.id===e.kind);
  const r = e.minion ? 8 : 10 * (kind ? 0.8 + 0.2*kind.hpMult : 1);
  const frozen = e.slow>0;
  const phase = (e.walkDist||0)*0.15;

  ctx.save();
  // ground shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y+r*0.7, r*1.1, r*0.5, 0, 0, Math.PI*2); ctx.fill();

  ctx.save();
  ctx.translate(e.x, e.y); ctx.rotate(e.angle||0);
  ctx.shadowColor = frozen?'#8888ff':look.glow;
  ctx.shadowBlur = 10;

  // 6 legs, alternating tripod gait
  const legAngles=[-2.35,-1.57,-0.78,0.78,1.57,2.35];
  const legColor = frozen?'rgba(150,200,255,0.85)':look.leg;
  legAngles.forEach((ba,i)=>{
    drawMechLeg(ba, r, phase, (i%2===0?0:Math.PI), r*1.6, legColor, 1.4);
  });

  // carapace body in this enemy's shape
  const bGrad=ctx.createRadialGradient(-2,-2,1,0,0,r);
  if(frozen){ bGrad.addColorStop(0,'#cfe8ff'); bGrad.addColorStop(0.5,'#6688cc'); bGrad.addColorStop(1,'#223a66'); }
  else { bGrad.addColorStop(0,look.hi); bGrad.addColorStop(0.5,look.mid); bGrad.addColorStop(1,look.dark); }
  ctx.fillStyle=bGrad;
  traceEnemyBody(look, r);
  ctx.fill();
  ctx.strokeStyle= frozen?'#aaccff':look.edge; ctx.lineWidth=1.3; ctx.stroke();

  // armor seam lines
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=0.6;
  for(let i=0;i<3;i++){
    const a=(i/3)*Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.2,Math.sin(a)*r*0.2); ctx.lineTo(Math.cos(a)*r*0.6,Math.sin(a)*r*0.6); ctx.stroke();
  }

  // single pulsing sensor eye facing direction of travel
  const eyePulse=0.6+Math.sin((state.frame||0)*0.15)*0.4;
  const eGrad=ctx.createRadialGradient(r*0.5,0,0,r*0.5,0,3);
  eGrad.addColorStop(0,`rgba(255,255,255,${eyePulse})`);
  eGrad.addColorStop(0.5, frozen?'rgba(180,220,255,0.9)':look.eye);
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
  const r = e.splitDepth ? 11 : 16; // split-off bosses render smaller
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
        ctx.globalCompositeOperation='lighter';
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
    ctx.globalCompositeOperation='lighter';

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
