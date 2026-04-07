// ── AI LOGIC ──
let aiGold=0, aiTimer=0;
function aiTick(){
  aiTimer++;
  if(aiTimer%240===0){
    const workers=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='worker').length;
    const warriors=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='warrior'&&e.subtype!=='elite').length;
    const structs=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='structure').length;
    const barracks=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='structure'&&e.isBarracks).length;
    const cannons=rtsEntities.filter(e=>e.side==='enemy'&&e.type==='cannon').length;
    const eb=rtsEntities.find(e=>e.type==='base'&&e.side==='enemy');
    if(!eb) return;

    // build barracks first (to get warriors)
    if(aiGold>=20 && barracks===0 && workers>=3){
      aiGold-=20;
      rtsEntities.push(makeBarracks('enemy',rtsEnemyFaction,eb.x-150+(Math.random()-0.5)*80,eb.y+(Math.random()-0.5)*200));
    }
    // build a cannon for defense
    else if(aiGold>=15 && cannons===0 && workers>=4){
      aiGold-=15;
      rtsEntities.push(makeCannon('enemy',rtsEnemyFaction,eb.x-120+(Math.random()-0.5)*60,eb.y+(Math.random()-0.5)*160));
    }
    // build elite structure
    else if(aiGold>=20 && structs-barracks===0 && workers>=5){
      aiGold-=20;
      rtsEntities.push(makeStructure('enemy',rtsEnemyFaction,eb.x-200,eb.y+(Math.random()-0.5)*200));
    }
    // train elites
    else if(aiGold>=18 && structs-barracks>0){
      const str=rtsEntities.find(e=>e.side==='enemy'&&e.type==='structure'&&!e.isBarracks&&!e.underConstruction);
      if(str && (!str.queue||str.queue.length<QUEUE_MAX)){
        aiGold-=18;
        queueUnit(str,'Elite',BUILD_TIMES.elite,()=>makeElite('enemy',rtsEnemyFaction,str.x,str.y));
      }
    }
    // train warriors from barracks
    else if(aiGold>=10 && barracks>0 && warriors<workers*0.8){
      const bar=rtsEntities.find(e=>e.side==='enemy'&&e.type==='structure'&&e.isBarracks&&!e.underConstruction);
      if(bar && (!bar.queue||bar.queue.length<QUEUE_MAX)){
        aiGold-=10;
        queueUnit(bar,'Warrior',BUILD_TIMES.warrior,()=>makeWarrior('enemy',rtsEnemyFaction,bar.x,bar.y));
      }
    }
    // train workers
    else if(aiGold>=5 && workers<14){
      const base=rtsEntities.find(e=>e.type==='base'&&e.side==='enemy');
      if(base && (!base.queue||base.queue.length<QUEUE_MAX)){
        aiGold-=5;
        queueUnit(base,'Worker',BUILD_TIMES.worker,()=>makeWorker('enemy',rtsEnemyFaction));
      }
    }
  }
  // AI sends warriors every ~400 frames
  if(aiTimer%400===0){
    for(const e of rtsEntities){
      if((e.type==='warrior')&&e.side==='enemy'&&e.state==='idle') e.state='march';
    }
  }
}

// ── TICK ──
function rtsTick(){
  if(rtsGameOver) return;
  rtsFrame++;
  tickCamera();
  aiTick();

  // gold passive trickle per worker mining
  const playerBase = rtsEntities.find(e=>e.type==='base'&&e.side==='player');
  const enemyBase  = rtsEntities.find(e=>e.type==='base'&&e.side==='enemy');
  if(!playerBase||!enemyBase) return;

  for(const e of rtsEntities){
    e.frame=(e.frame||0)+1;
    if(e.type==='worker') workerTick(e, playerBase, enemyBase);
    if(e.type==='warrior') warriorTick(e, playerBase, enemyBase);
    if(e.type==='cannon') cannonTick(e);
    if(e.type==='structure' && e.queue) buildingTick(e);
    if(e.type==='base' && e.queue) buildingTick(e);
    // necromancer revival tick
    if(e.type==='warrior' && e.subtype==='necromancer' && e.state!=='idle'){
      e.reviveTimer=(e.reviveTimer||0)+1;
      if(e.reviveTimer>=e.reviveCooldown && deadSwordsmenPool.length>0){
        e.reviveTimer=0;
        const pos=deadSwordsmenPool.pop();
        // raise at where they fell, on necromancer's side
        const revived=makeWarrior(e.side, e.faction, pos.x-80, pos.y);
        revived.state='march';
        revived.x=pos.x; revived.y=pos.y;
        rtsEntities.push(revived);
        spawnMagicBurst(pos.x, pos.y, '#9922ff');
        if(e.side==='player') rtsSetLog('Necromancer raised a Swordsman from the dead!');
      }
    }
  }

  // remove dead units — record fallen swordsmen for necromancer
  for(let i=rtsEntities.length-1;i>=0;i--){
    const e=rtsEntities[i];
    if(e.type!=='base' && e.hp<=0){
      if(e.type==='warrior' && e.faction==='shadow' && !e.subtype){
        deadSwordsmenPool.push({x:e.x, y:e.y, side:e.side});
        if(deadSwordsmenPool.length>12) deadSwordsmenPool.shift();
      }
      spawnDeathParticles(e.x,e.y,FACTION_CFG[e.faction]?.color||'#886633');
      sfx('rtsUnitDie',120);
      rtsEntities.splice(i,1);
    }
  }

  updateProjectiles();

  // check base HP
  if(playerBase.hp<=0){ rtsBaseHP=0; endRTS(false); return; }
  if(enemyBase.hp<=0){ rtsEnemyBaseHP=0; endRTS(true); return; }
  rtsBaseHP=Math.floor(playerBase.hp);
  rtsEnemyBaseHP=Math.floor(enemyBase.hp);

  // particles
  for(let i=rtsParticles.length-1;i>=0;i--){
    const p=rtsParticles[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=0.9; p.vy*=0.9; p.life--;
    if(p.life<=0) rtsParticles.splice(i,1);
  }

  updateRtsHUD();
}

function workerTick(w, playerBase, enemyBase){
  const myBase = w.side==='player'?playerBase:enemyBase;

  // building a structure: walk to build location then place it
  if(w.state==='building' && w.buildTarget){
    const dx=w.buildTarget.x-w.x, dy=w.buildTarget.y-w.y, d=Math.hypot(dx,dy);
    if(d>20){ w.x+=dx/d*w.speed; w.y+=dy/d*w.speed; return; }
    // arrived — start or continue constructing
    const bt=w.buildTarget.buildType||'structure';
    // place a ghost building on first arrival
    if(!w.buildTarget.ghost){
      let ghost=null;
      if(bt==='cannon') ghost=makeCannon(w.side,w.faction,w.buildTarget.x,w.buildTarget.y);
      else if(bt==='barracks') ghost=makeBarracks(w.side,w.faction,w.buildTarget.x,w.buildTarget.y);
      else ghost=makeStructure(w.side,w.faction,w.buildTarget.x,w.buildTarget.y);
      rtsEntities.push(ghost);
      w.buildTarget.ghost=ghost;
    }
    // advance construction
    const ghost=w.buildTarget.ghost;
    if(!ghost || ghost.hp<=0){ w.state='idle'; w.buildTarget=null; return; }
    ghost.buildProgress=(ghost.buildProgress||0)+1;
    w.buildTimer=(w.buildTimer||0)+1;
    w.hammerSwing=Math.sin(w.buildTimer*0.4);
    // hammer sound on the downswing
    if(w.hammerSwing<-0.95 && w.buildTimer>2) sfx('rtsHammer',200);
    if(ghost.buildProgress>=ghost.buildTime){
      ghost.underConstruction=false;
      ghost.hp=ghost.maxHp;
      sfx('rtsBuildDone');
      if(w.side==='player'){
        const lbl=bt==='cannon'?'CANNON':bt==='barracks'?FACTION_CFG[w.faction].barracksLabel:FACTION_CFG[w.faction].structLabel;
        rtsSetLog(`${lbl} complete!`);
      }
      w.state='idle'; w.buildTarget=null; w.hammerSwing=0; w.buildTimer=0;
    }
    return;
  }

  // manual move order overrides normal AI
  if(w.moveTarget){
    const dx=w.moveTarget.x-w.x, dy=w.moveTarget.y-w.y, d=Math.hypot(dx,dy);
    if(d<10){ w.moveTarget=null; w.state='idle'; return; }
    w.x+=dx/d*w.speed; w.y+=dy/d*w.speed;
    return;
  }
  if(w.state==='idle'||w.state==='moving'){
    // find nearest node with gold (prefer own-side nodes)
    let best=null, bestScore=Infinity;
    for(const node of rtsGoldNodes){
      if(node.gold<=0) continue;
      const d=Math.hypot(node.x-w.x, node.y-w.y);
      // prefer nodes on own side; neutral is fine too; enemy nodes are far anyway
      const penalty = node.owner==='neutral'?200: node.owner===w.side?0:400;
      const score=d+penalty;
      if(score<bestScore){ bestScore=score; best=node; }
    }
    if(!best){ w.state='idle'; return; }
    w.target=best; w.state='moving';
    const dx=best.x-w.x, dy=best.y-w.y, d=Math.hypot(dx,dy);
    if(d<8){ w.state='mining'; w.mineTimer=0; return; }
    w.x+=dx/d*w.speed; w.y+=dy/d*w.speed;
  } else if(w.state==='mining'){
    w.mineTimer++;
    if(w.mineTimer>60){
      if(w.target && w.target.gold>0){
        w.target.gold--; w.goldCarry++;
        if(w.goldCarry>=w.goldCap) w.state='returning';
      } else { w.state='idle'; }
      w.mineTimer=0;
    }
  } else if(w.state==='returning'){
    // return to nearest friendly base (not always the original)
    let nearestBase=null, nearestBaseDist=Infinity;
    for(const ent of rtsEntities){
      if(ent.type!=='base'||ent.side!==w.side) continue;
      const d=Math.hypot(ent.x-w.x,ent.y-w.y);
      if(d<nearestBaseDist){ nearestBaseDist=d; nearestBase=ent; }
    }
    const dropoff = nearestBase || myBase;
    const dx=dropoff.x-w.x, dy=dropoff.y-w.y, d=Math.hypot(dx,dy);
    if(d<55){
      if(w.side==='player') rtsGold+=w.goldCarry;
      else aiGold+=w.goldCarry;
      w.goldCarry=0; w.state='idle';
    } else { w.x+=dx/d*w.speed; w.y+=dy/d*w.speed; }
  }
}

// ── CANNON TICK ──
function cannonTick(c){
  if(c.underConstruction) return; // can't fire while being built
  c.cooldown=Math.max(0,(c.cooldown||0)-1);
  if(c.cooldown>0) return;
  // find nearest enemy within range
  let target=null, bestDist=c.range;
  const enemySide=c.side==='player'?'enemy':'player';
  for(const e of rtsEntities){
    if(e.side!==enemySide) continue;
    const d=Math.hypot(e.x-c.x,e.y-c.y);
    if(d<bestDist){ bestDist=d; target=e; }
  }
  if(!target) return;
  c.aimAngle=Math.atan2(target.y-c.y,target.x-c.x);
  c.cooldown=c.rate;
  const _cSnd={prism:'rtsPrismCannon',shadow:'rtsShadowCannon',roboto:'rtsCannonFire'};
  sfx(_cSnd[c.faction]||'rtsCannonFire',300);
  const _cCol={prism:'#00f5ff',shadow:'#cc44ff',roboto:'#ffaa00'};
  // fire a cannon projectile
  rtsProjectiles.push({
    x:c.x, y:c.y, tx:target,
    speed:8, damage:c.damage,
    faction:c.faction, color:_cCol[c.faction]||'#ffaa00',
    type:'cannonball', trail:[], side:c.side,
  });
}

// ── BUILDING TICK — processes train queues ──
function buildingTick(b){
  if(b.underConstruction) return; // can't train while being built
  if(!b.queue || b.queue.length===0) return;
  b.trainTimer=(b.trainTimer||0)+1;
  const item=b.queue[0];
  if(b.trainTimer>=item.time){
    b.trainTimer=0;
    b.queue.shift();
    // spawn the unit
    const u=item.fn();
    rtsEntities.push(u);
    if(b.side==='player') rtsSetLog(`${item.label} ready!`);
  }
}

function queueUnit(building, label, time, fn){
  if(!building.queue) building.queue=[];
  if(building.queue.length>=QUEUE_MAX){ rtsSetLog('Queue full!'); return false; }
  building.queue.push({label,time,fn});
  return true;
}

// player attack order
function warriorTick(w, playerBase, enemyBase){
  if(w.state==='idle') return;

  const enemyBase2 = w.side==='player'?enemyBase:playerBase;

  // --- MOVE ORDER: walk to position first ---
  if(w.moveTarget){
    const dx=w.moveTarget.x-w.x, dy=w.moveTarget.y-w.y, d=Math.hypot(dx,dy);
    if(d<8){ w.moveTarget=null; w.state='idle'; return; }
    w.x+=dx/d*w.speed; w.y+=dy/d*w.speed;
    return;
  }

  // --- FORCED ATTACK TARGET (right-click on enemy) ---
  let target=null, targetDist=Infinity;
  if(w.forcedTarget){
    if(w.forcedTarget.hp<=0||!rtsEntities.includes(w.forcedTarget)){
      w.forcedTarget=null; // target dead, resume normal
    } else {
      target=w.forcedTarget;
      targetDist=Math.hypot(target.x-w.x, target.y-w.y);
    }
  }

  // --- AUTO-TARGETING (march mode, no forced target) ---
  if(!target){
    let nearestEnemy=null, nearestDist=Infinity;
    for(const e of rtsEntities){
      if(e.side===w.side||e.type==='base') continue;
      const d=Math.hypot(e.x-w.x,e.y-w.y);
      if(d<nearestDist){ nearestDist=d; nearestEnemy=e; }
    }
    target = nearestEnemy || enemyBase2;
    targetDist = nearestEnemy ? nearestDist : Math.hypot(enemyBase2.x-w.x,enemyBase2.y-w.y);
  }

  if(!target) return;

  if(w.ranged){
    if(targetDist<=w.range){
      w.state='attack';
      w.attackTimer++;
      if(w.attackTimer>=(w.fireRate||50)){ w.attackTimer=0; spawnProjectile(w, target); }
    } else {
      w.state='march';
      const dx=target.x-w.x, dy=target.y-w.y, d=Math.hypot(dx,dy)||1;
      const spread=(w.id%13)*4-24;
      w.x+=dx/d*w.speed; w.y+=(dy+spread*0.05)/d*w.speed;
    }
  } else {
    if(targetDist<=w.range){
      w.state='attack';
      w.attackTimer++;
      if(w.attackTimer>=45){
        w.attackTimer=0;
        target.hp-=w.damage;
        if(target.type==='base') spawnHitFlash(target.x+(w.side==='player'?-30:30),target.y+(Math.random()-0.5)*60,'#ff4444');
        else spawnHitFlash(target.x,target.y,FACTION_CFG[w.faction].color);
      }
    } else {
      w.state='march';
      const dx=target.x-w.x, dy=target.y-w.y, d=Math.hypot(dx,dy)||1;
      const spread=(w.id%11)*5-25;
      w.x+=dx/d*w.speed; w.y+=(dy+spread*0.04)/d*w.speed;
    }
  }
}

// ── PROJECTILES ──
let rtsProjectiles=[];
function spawnProjectile(shooter, target){
  const cfg=FACTION_CFG[shooter.faction];
  const isElite = shooter.subtype==='elite';
  const isWizard = shooter.subtype==='wizard';
  const isNecro  = shooter.subtype==='necromancer';
  const isTank   = shooter.subtype==='tank';

  let ptype='magic';
  if(isTank) ptype='shell';
  else if(isWizard) ptype='lightning';
  else if(isNecro) ptype='darkmagic';
  else if(shooter.faction==='roboto') ptype=isElite?'lightning':'bullet';
  else if(shooter.faction==='shadow') ptype=isElite?'darkmagic':'magic';
  else ptype=isElite?'prismblast':'magic';

  const color = isTank?'#ff6600' : isWizard?'#88ffff' : isNecro?'#440088' :
    isElite?(shooter.faction==='roboto'?'#44ffff':shooter.faction==='shadow'?'#220044':'#ffffff')
    : cfg.color;

  rtsProjectiles.push({
    x:shooter.x, y:shooter.y,
    tx:target,
    speed: isTank?9 : (shooter.faction==='roboto'&&!isWizard) ? 11 : isWizard?6 : 4,
    damage:shooter.damage,
    faction:shooter.faction,
    color, type:ptype,
    trail:[],
    isElite, isWizard, isNecro, isTank,
    side:shooter.side,
  });
  // fire sound per type
  const fireSnd={bullet:'rtsBullet',lightning:'rtsLightning',darkmagic:'rtsDarkMagic',magic:'rtsMagicFire',shell:'rtsCannonFire',cannonball:'rtsCannonFire',prismblast:'rtsMagicFire'};
  sfx(fireSnd[ptype]||'rtsBullet', 80);
}

function updateProjectiles(){
  for(let i=rtsProjectiles.length-1;i>=0;i--){
    const p=rtsProjectiles[i];
    p.trail.push({x:p.x,y:p.y});
    if(p.trail.length>8) p.trail.shift();
    if(!p.tx||p.tx.hp<=0){ rtsProjectiles.splice(i,1); continue; }
    const dx=p.tx.x-p.x, dy=p.tx.y-p.y, d=Math.hypot(dx,dy);
    if(d<p.speed+4){
      p.tx.hp-=p.damage;
      if(p.type==='bullet') spawnHitFlash(p.tx.x,p.tx.y,'#ffcc44');
      else if(p.type==='cannonball'){
        spawnHitParticles2(p.tx.x,p.tx.y);
      }
      else if(p.type==='shell'){
        // tank shell — AOE explosion
        for(const ent of rtsEntities){
          if(ent.side===p.side||ent.type==='base') continue;
          if(Math.hypot(ent.x-p.tx.x,ent.y-p.tx.y)<80) ent.hp-=p.damage*0.5;
        }
        spawnHitParticles2(p.tx.x, p.tx.y);
      }
      else if(p.type==='lightning'||p.type==='darkmagic'){
        spawnLightningHit(p.tx.x,p.tx.y,p.color);
        chainLightning(p.tx, p.damage*0.6, p.color, p.side, 2);
      } else {
        spawnMagicBurst(p.tx.x,p.tx.y,p.color);
      }
      rtsProjectiles.splice(i,1);
    } else {
      p.x+=dx/d*p.speed; p.y+=dy/d*p.speed;
    }
  }
}

function chainLightning(origin, damage, color, shooterSide, bounces){
  if(bounces<=0) return;
  // find nearest enemy unit within 200px not the origin
  let best=null, bestD=200;
  for(const e of rtsEntities){
    if(e.side===shooterSide||e===origin||e.type==='base') continue;
    const d=Math.hypot(e.x-origin.x,e.y-origin.y);
    if(d<bestD){ bestD=d; best=e; }
  }
  if(!best) return;
  best.hp-=damage;
  // draw arc between origin and best as a particle trail
  const steps=8;
  for(let s=0;s<=steps;s++){
    const t2=s/steps;
    const jx=(Math.random()-0.5)*20*(1-t2);
    const jy=(Math.random()-0.5)*20*(1-t2);
    rtsParticles.push({
      x:origin.x+(best.x-origin.x)*t2+jx,
      y:origin.y+(best.y-origin.y)*t2+jy,
      vx:0,vy:0,life:12,maxLife:12,color,size:3,
    });
  }
  spawnLightningHit(best.x,best.y,color);
  setTimeout(()=>chainLightning(best,damage*0.6,color,shooterSide,bounces-1),60);
}

function spawnLightningHit(x,y,color){
  for(let i=0;i<6;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*4+2;
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:16,maxLife:16,color,size:2+Math.random()*2});
  }
  rtsParticles.push({x,y,vx:0,vy:0,life:10,maxLife:10,color,size:0,isRing:true,radius:3});
}

function spawnMagicBurst(x,y,color){
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2;
    rtsParticles.push({x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:22,maxLife:22,color,size:3});
  }
  rtsParticles.push({x,y,vx:0,vy:0,life:12,maxLife:12,color,size:0,isRing:true,radius:2});
}

function spawnHitParticles2(x,y){
  // big fiery explosion for tank shells
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*6+3;
    const cols=['#ff4400','#ff8800','#ffcc00','#ffffff','#ff2200'];
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,maxLife:30,color:cols[Math.floor(Math.random()*cols.length)],size:4+Math.random()*4});
  }
  rtsParticles.push({x,y,vx:0,vy:0,life:18,maxLife:18,color:'#ff8800',size:0,isRing:true,radius:4});
  rtsParticles.push({x,y,vx:0,vy:0,life:12,maxLife:12,color:'#ffcc44',size:0,isRing:true,radius:6});
}

function spawnHitFlash(x,y,color){
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*2+1;
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:18,maxLife:18,color,size:2+Math.random()*2});
  }
}
function spawnDeathParticles(x,y,color){
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*3+1;
    rtsParticles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,maxLife:30,color,size:3+Math.random()*3});
  }
}

function endRTS(playerWon){
  rtsGameOver=true;
  const ov=document.getElementById('rts-gameover-overlay');
  const title=document.getElementById('rts-over-title');
  const sub=document.getElementById('rts-over-sub');
  ov.style.display='flex';
  if(playerWon){ title.textContent='VICTORY'; title.className='rts-over-title win'; sub.textContent='The enemy base has been destroyed.'; }
  else { title.textContent='DEFEAT'; title.className='rts-over-title lose'; sub.textContent='Your base has fallen.'; }
}

// ══════════════════
//  RTS DRAW ENGINE
// ══════════════════
let rtsLastTime=0, rtsAccum=0;
function rtsLoop(ts){
  const dt = Math.min(ts - rtsLastTime, 100);
  rtsLastTime = ts;
  rtsAccum += dt;
  while(rtsAccum >= TARGET_MS){
    rtsTick();
    rtsAccum -= TARGET_MS;
  }
  rtsDraw();
  rtsRAF=requestAnimationFrame(rtsLoop);
}

const rc2=()=>document.getElementById('rts-canvas').getContext('2d');

