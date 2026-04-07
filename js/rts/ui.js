// ── CLICK RADII ──
const CLICK_RADII = { base:70, structure:50, cannon:36, warrior:20, worker:14 };

// ── BUILD POPUP ──
let rtsBuildPopupOpen = false;
let buildStructureMode = false;
let rtsBuildingSource = null; // the building entity that opened the popup

function openBuildPopup(screenX, screenY, context){
  // remember which entity spawned this popup so units spawn there
  rtsBuildingSource = rtsSelected[0] || null;
  const cfg = FACTION_CFG[rtsPlayerFaction];
  const popup = document.getElementById('rts-build-popup');
  const title = document.getElementById('rbp-title');
  const opts  = document.getElementById('rbp-options');
  opts.innerHTML='';

  if(context==='base'){
    // Base/Factory/Temple: workers only
    title.textContent = cfg.buildingName;
    const workerBtn=document.createElement('button');
    workerBtn.className='rbp-option'; workerBtn.disabled=rtsGold<5;
    const wIcon=rtsPlayerFaction==='roboto'?'🤖':rtsPlayerFaction==='shadow'?'🥷':'🧙';
    workerBtn.innerHTML=`<span class="rbp-opt-icon">${wIcon}</span>
      <span class="rbp-opt-info"><span class="rbp-opt-name">${cfg.workerLabel}</span>
      <span class="rbp-opt-desc">Gathers gold from mines</span></span>
      <span class="rbp-opt-cost">5g</span>`;
    workerBtn.onclick=()=>trainUnit('worker');
    opts.appendChild(workerBtn);

  } else if(context==='barracks'){
    // Barracks/Portal/Training Field: warriors only
    const sel=rtsSelected[0]; if(!sel) return;
    title.textContent = cfg.barracksLabel;
    const warIcon=rtsPlayerFaction==='roboto'?'🦾':rtsPlayerFaction==='shadow'?'⚔':'✨';
    const warDesc=rtsPlayerFaction==='roboto'?'Ranged — rapid fire gun':
                  rtsPlayerFaction==='prism'?'Ranged — magic projectiles':'Melee — fast sword charge';
    const wBtn=document.createElement('button');
    wBtn.className='rbp-option'; wBtn.disabled=rtsGold<cfg.warriorCost;
    wBtn.innerHTML=`<span class="rbp-opt-icon">${warIcon}</span>
      <span class="rbp-opt-info"><span class="rbp-opt-name">${cfg.warriorLabel}</span>
      <span class="rbp-opt-desc">${warDesc}</span></span>
      <span class="rbp-opt-cost">${cfg.warriorCost}g</span>`;
    wBtn.onclick=()=>{
      if(rtsGold<cfg.warriorCost){ rtsSetLog('Not enough gold!'); return; }
      if(sel.underConstruction){ rtsSetLog('Still under construction!'); return; }
      const fn=()=>makeWarrior('player',rtsPlayerFaction,sel.x,sel.y);
      if(!queueUnit(sel,cfg.warriorLabel,BUILD_TIMES.warrior,fn)) return;
      rtsGold-=cfg.warriorCost; updateRtsHUD();
      rtsSetLog(`${cfg.warriorLabel} queued (${sel.queue.length}/${QUEUE_MAX})`);
      openBuildPopup(sel.x-camX,sel.y-camY,'barracks');
    };
    opts.appendChild(wBtn);

  } else if(context==='worker'){
    title.textContent = 'WORKER ACTIONS';
    const addOpt=(icon,name,desc,cost,onclick)=>{
      const btn=document.createElement('button');
      btn.className='rbp-option'; btn.disabled=rtsGold<cost;
      btn.innerHTML=`<span class="rbp-opt-icon">${icon}</span>
        <span class="rbp-opt-info"><span class="rbp-opt-name">${name}</span>
        <span class="rbp-opt-desc">${desc}</span></span>
        <span class="rbp-opt-cost">${cost}g</span>`;
      btn.onclick=onclick; opts.appendChild(btn);
    };

    // Build Barracks/Portal/Training Field
    const barIcon=rtsPlayerFaction==='roboto'?'🪖':rtsPlayerFaction==='prism'?'🌀':'⚔';
    addOpt(barIcon,`Build ${cfg.barracksLabel}`,`Right-click to place — trains ${cfg.warriorLabel}s (20g)`,20,()=>{
      buildStructureMode='barracks'; rtsGold-=20; updateRtsHUD();
      rtsSetLog(`Right-click to place your ${cfg.barracksLabel}!`); closeBuildPopup();
    });

    // Build secondary structure (Shrine/Dark Shrine/Armory)
    const strIcon=rtsPlayerFaction==='roboto'?'🏭':rtsPlayerFaction==='prism'?'🏛':'⚡';
    addOpt(strIcon,`Build ${cfg.structLabel}`,`Right-click to place — trains elite units (20g)`,20,()=>{
      buildStructureMode=true; rtsGold-=20; updateRtsHUD();
      rtsSetLog(`Right-click to place your ${cfg.structLabel}!`); closeBuildPopup();
    });

    // Build Cannon
    addOpt('💣','Build CANNON','Auto-attacks nearby enemies (15g)',15,()=>{
      buildStructureMode='cannon'; rtsGold-=15; updateRtsHUD();
      rtsSetLog('Right-click to place your CANNON!'); closeBuildPopup();
    });

    // Build another base
    const baseIcon=rtsPlayerFaction==='roboto'?'🏗':'🏰';
    addOpt(baseIcon,`Build ${cfg.buildingName}`,`Right-click to place — trains more workers (25g)`,25,()=>{
      buildStructureMode='base'; rtsGold-=25; updateRtsHUD();
      rtsSetLog(`Right-click to place your new ${cfg.buildingName}!`); closeBuildPopup();
    });

  } else if(context==='structure'){
    const sel=rtsSelected[0];
    if(!sel) return;
    title.textContent = cfg.structLabel;

    // Build list of units for this faction's structure
    const structUnits=[];
    if(rtsPlayerFaction==='prism'){
      structUnits.push({icon:'🔮',label:cfg.eliteLabel,  desc:cfg.eliteDesc,  cost:cfg.eliteCost,  fn:()=>makeElite('player',rtsPlayerFaction,sel.x,sel.y)});
      structUnits.push({icon:'⚡',label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, fn:()=>makeWizard('player',rtsPlayerFaction,sel.x,sel.y)});
    } else if(rtsPlayerFaction==='shadow'){
      structUnits.push({icon:'🌑',label:cfg.eliteLabel,  desc:cfg.eliteDesc,  cost:cfg.eliteCost,  fn:()=>makeElite('player',rtsPlayerFaction,sel.x,sel.y)});
      structUnits.push({icon:'💀',label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, fn:()=>makeNecromancer('player',rtsPlayerFaction,sel.x,sel.y)});
    } else {
      structUnits.push({icon:'⚡',label:cfg.eliteLabel,  desc:cfg.eliteDesc,  cost:cfg.eliteCost,  fn:()=>makeElite('player',rtsPlayerFaction,sel.x,sel.y)});
      structUnits.push({icon:'🚗',label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, fn:()=>makeTank('player',rtsPlayerFaction,sel.x,sel.y)});
    }

    for(const u of structUnits){
      const btn=document.createElement('button');
      btn.className='rbp-option'; btn.disabled=rtsGold<u.cost||(sel.underConstruction);
      btn.innerHTML=`<span class="rbp-opt-icon">${u.icon}</span>
        <span class="rbp-opt-info"><span class="rbp-opt-name">${u.label}</span>
        <span class="rbp-opt-desc">${u.desc}</span></span>
        <span class="rbp-opt-cost">${u.cost}g</span>`;
      btn.onclick=(()=>{
        const _u=u;
        return ()=>{
          if(rtsGold<_u.cost){ rtsSetLog('Not enough gold!'); return; }
          if(sel.underConstruction){ rtsSetLog('Still under construction!'); return; }
          if(!queueUnit(sel,_u.label,BUILD_TIMES.elite,_u.fn)) return;
          rtsGold-=_u.cost; updateRtsHUD();
          rtsSetLog(`${_u.label} queued (${sel.queue.length}/${QUEUE_MAX})`);
          openBuildPopup(sel.x-camX,sel.y-camY,'structure');
        };
      })();
      opts.appendChild(btn);
    }
  }

  // show queue / construction status if building
  const src = rtsSelected[0];
  if(src && src.queue!==undefined){
    if(src.underConstruction){
      const pct=Math.floor((src.buildProgress/src.buildTime)*100);
      const info=document.createElement('div');
      info.style.cssText='margin-top:8px;padding:6px 8px;background:rgba(255,180,0,0.1);border:1px solid rgba(255,180,0,0.3);font-size:10px;letter-spacing:1px;color:#ffcc44;text-align:center;';
      info.textContent=`⚙ UNDER CONSTRUCTION ${pct}%`;
      opts.appendChild(info);
    } else if(src.queue && src.queue.length>0){
      const qDiv=document.createElement('div');
      qDiv.style.cssText='margin-top:8px;padding:6px 8px;background:rgba(0,20,40,0.8);border:1px solid rgba(0,245,255,0.15);';
      const qTitle=document.createElement('div');
      qTitle.style.cssText='font-family:Orbitron,sans-serif;font-size:8px;letter-spacing:2px;color:rgba(0,245,255,0.5);margin-bottom:4px;';
      qTitle.textContent=`QUEUE (${src.queue.length}/${QUEUE_MAX})`;
      qDiv.appendChild(qTitle);
      src.queue.forEach((item,i)=>{
        const row=document.createElement('div');
        row.style.cssText='font-size:10px;color:var(--text-dim);display:flex;align-items:center;gap:6px;margin-bottom:2px;';
        if(i===0){
          // show progress bar for item being trained
          const pct=Math.floor(((src.trainTimer||0)/item.time)*100);
          row.innerHTML=`<span style="color:var(--neon-cyan)">▶</span><span>${item.label}</span>
            <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--neon-cyan);transition:width 0.3s;"></div>
            </div><span style="font-size:9px;color:var(--neon-cyan)">${pct}%</span>`;
        } else {
          row.innerHTML=`<span style="color:rgba(255,255,255,0.2)">${i+1}</span><span>${item.label}</span>`;
        }
        qDiv.appendChild(row);
      });
      opts.appendChild(qDiv);
    }
  }

  // position popup
  const wrap=document.getElementById('rts-viewport-wrap');
  const ww=wrap.offsetWidth, wh=wrap.offsetHeight;
  const pw=240, ph=220;
  let px=Math.min(screenX+20,ww-pw-10);
  let py=Math.max(10,Math.min(screenY-ph/2,wh-ph-10));
  popup.style.left=px+'px'; popup.style.top=py+'px';
  popup.style.display='block';
  rtsBuildPopupOpen=true;

  // Prevent popup clicks from bubbling to the canvas click handler
  popup.onclick=function(ev){ ev.stopPropagation(); };
}

function closeBuildPopup(){
  document.getElementById('rts-build-popup').style.display='none';
  rtsBuildPopupOpen = false;
  rtsBuildingSource = null;
}

function trainUnit(unitType){
  const cost = unitType==='worker'?5:10;
  if(rtsGold<cost){ rtsSetLog('Not enough gold!'); return; }
  const building = rtsBuildingSource;
  if(!building){ rtsSetLog('No building selected!'); return; }
  if(building.underConstruction){ rtsSetLog('Building still under construction!'); return; }
  const cfg = FACTION_CFG[rtsPlayerFaction];
  const spawnX=building.x, spawnY=building.y;
  const label = unitType==='worker'?cfg.workerLabel:cfg.warriorLabel;
  const time  = unitType==='worker'?BUILD_TIMES.worker:BUILD_TIMES.warrior;
  const fn    = unitType==='worker'
    ? ()=>makeWorker('player',rtsPlayerFaction,spawnX,spawnY)
    : ()=>makeWarrior('player',rtsPlayerFaction,spawnX,spawnY);
  if(!queueUnit(building, label, time, fn)) return;
  rtsGold-=cost;
  rtsSetLog(`${label} queued (${building.queue.length}/${QUEUE_MAX})`);
  updateRtsHUD();
  // keep popup open so player can queue more
  openBuildPopup(building.x-camX, building.y-camY, building.isBarracks?'barracks':'base');
}

function rtsOrderAttack(){
  let count=0;
  for(const e of rtsEntities){
    if(e.type==='warrior'&&e.side==='player'&&e.state==='idle'){ e.state='march'; count++; }
  }
  rtsSetLog(count>0?`${count} warriors advancing!`:'No idle warriors selected.');
}

// Convert screen coords → world coords
function screenToWorld(sx, sy){ return { x: sx+camX, y: sy+camY }; }
// Get canvas-relative mouse position
function canvasPos(e){
  const rect=document.getElementById('rts-canvas').getBoundingClientRect();
  return { x:e.clientX-rect.left, y:e.clientY-rect.top };
}

function rtsHandleClick(e){
  if(rtsGameOver) return;
  const sp=canvasPos(e);
  const wp=screenToWorld(sp.x, sp.y);
  if(e.target.closest && e.target.closest('#rts-build-popup')) return;
  if(rtsBuildPopupOpen){ closeBuildPopup(); }

  for(const ent of rtsEntities) ent.selected=false;
  rtsSelected=[];

  let hit=null, hitDist=Infinity;
  for(const ent of rtsEntities){
    if(ent.side!=='player') continue;
    const r=CLICK_RADII[ent.type]||14;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<hitDist){ hit=ent; hitDist=d; }
  }

  if(hit){
    hit.selected=true; rtsSelected=[hit];
    const cfg=FACTION_CFG[rtsPlayerFaction];
    const sx=hit.x-camX, sy=hit.y-camY;
    if(hit.type==='base'){
      openBuildPopup(sx,sy,'base');
      rtsSetLog(`${cfg.buildingName} — train workers here.`);
    } else if(hit.type==='structure' && hit.isBarracks){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.barracksLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'barracks');
        rtsSetLog(`${cfg.barracksLabel} — train ${cfg.warriorLabel}s here.`);
      }
    } else if(hit.type==='structure'){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.structLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'structure');
        rtsSetLog(`${cfg.structLabel} — train elite units.`);
      }
    } else if(hit.type==='cannon'){
      const pct=hit.underConstruction?` (building ${Math.floor((hit.buildProgress/hit.buildTime)*100)}%)`:'';
      rtsSetLog(`CANNON${pct} — HP: ${Math.floor(hit.hp)}/${hit.maxHp}  Range: ${hit.range}`);
    } else if(hit.type==='worker'){
      openBuildPopup(sx,sy,'worker');
      rtsSetLog(`${cfg.workerLabel} selected — build or right-click to move.`);
    } else if(hit.type==='warrior'){
      const UNIT_LABELS={elite:'eliteLabel',wizard:'elite2Label',necromancer:'elite2Label',tank:'elite2Label'};
      const lbl=cfg[UNIT_LABELS[hit.subtype]]||cfg.warriorLabel;
      rtsSetLog(`${lbl} selected — right-click to move or attack.`);
    }
  }
}

function rtsHandleRightClick(e){
  e.preventDefault();
  if(rtsGameOver) return;
  const sp=canvasPos(e);
  const wp=screenToWorld(sp.x,sp.y);

  // structure/base placement mode
  if(buildStructureMode){
    const worker=rtsSelected.find(s=>s.type==='worker'&&s.side==='player');
    const dispatchWorker=(buildTarget)=>{
      if(worker){ worker.buildTarget=buildTarget; worker.state='building'; }
      else {
        const nearest=rtsEntities.filter(en=>en.type==='worker'&&en.side==='player'&&en.state!=='building')
          .sort((a,b)=>Math.hypot(a.x-wp.x,a.y-wp.y)-Math.hypot(b.x-wp.x,b.y-wp.y))[0];
        if(nearest){ nearest.buildTarget=buildTarget; nearest.state='building'; }
      }
    };
    if(buildStructureMode==='base'){
      const nb={id:Math.random(),type:'base',side:'player',x:wp.x,y:wp.y,hp:100,maxHp:100,w:60,h:80,selected:false};
      rtsEntities.push(nb);
      rtsSetLog(`New ${FACTION_CFG[rtsPlayerFaction].buildingName} placed!`);
    } else if(buildStructureMode==='cannon'){
      // store what to build in the worker's buildTarget
      dispatchWorker({x:wp.x,y:wp.y,buildType:'cannon'});
    } else if(buildStructureMode==='barracks'){
      dispatchWorker({x:wp.x,y:wp.y,buildType:'barracks'});
    } else {
      // standard structure
      dispatchWorker({x:wp.x,y:wp.y,buildType:'structure'});
    }
    buildStructureMode=false;
    rtsParticles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#ffdd00',size:0,isRing:true,radius:4});
    return;
  }

  if(rtsSelected.length===0) return;

  // check enemy hit
  let enemyHit=null, enemyDist=Infinity;
  for(const ent of rtsEntities){
    if(ent.side==='player') continue;
    const r=CLICK_RADII[ent.type]||20;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<enemyDist){ enemyHit=ent; enemyDist=d; }
  }

  let moved=0, attacked=0;
  for(const sel of rtsSelected){
    if(sel.side!=='player') continue;
    if(enemyHit&&(sel.type==='warrior')){
      sel.forcedTarget=enemyHit; sel.moveTarget=null; sel.state='march'; attacked++;
    } else {
      const spread=rtsSelected.indexOf(sel);
      sel.moveTarget={x:wp.x+(spread%3-1)*35, y:wp.y+Math.floor(spread/3)*35};
      sel.forcedTarget=null;
      sel.state=sel.type==='warrior'?'march':'moving';
      moved++;
    }
  }
  if(attacked>0) rtsSetLog(`Attack order issued to ${attacked} unit${attacked>1?'s':''}!`);
  else if(moved>0) rtsSetLog(`Move order issued to ${moved} unit${moved>1?'s':''}!`);
  rtsParticles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,
    color:enemyHit?'#ff4444':'#00ff88',size:0,isRing:true,radius:4});
}

function rtsSetLog(msg){ document.getElementById('rts-log').textContent=msg; }
function updateRtsHUD(){
  document.getElementById('rts-gold').textContent=Math.floor(rtsGold);
  const units=rtsEntities.filter(e=>e.side==='player'&&e.type!=='base').length;
  document.getElementById('rts-units').textContent=units;
  document.getElementById('rts-base-hp').textContent=rtsBaseHP;
  // refresh popup options if open so gold costs update
  if(rtsBuildPopupOpen){
    const opts=document.getElementById('rbp-options');
    if(opts) opts.querySelectorAll('.rbp-option').forEach(btn=>{
      const cost=parseInt(btn.querySelector('.rbp-opt-cost').textContent);
      btn.disabled = rtsGold < cost;
    });
  }
}

