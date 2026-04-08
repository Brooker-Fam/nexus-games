// ── CLICK RADII ──
const CLICK_RADII = { base:70, structure:50, cannon:36, warrior:20, worker:14 };

// ── BUILD POPUP ──
let rtsBuildPopupOpen = false;
let buildStructureMode = false;
let _buildModeCost = 0;
let rtsBuildingSource = null; // the building entity that opened the popup

function openBuildPopup(screenX, screenY, context){
  // remember which entity spawned this popup so units spawn there
  rtsBuildingSource = rtsSelected[0] || null;
  const cfg = FACTION_CFG[myFaction()];
  const popup = document.getElementById('rts-build-popup');
  const title = document.getElementById('rbp-title');
  const opts  = document.getElementById('rbp-options');
  opts.innerHTML='';

  // Helper to create a popup button
  function addOpt(icon, name, desc, cost, onclick, disabled){
    const btn=document.createElement('button');
    btn.className='rbp-option';
    btn.disabled=disabled!==undefined ? disabled : myGold()<cost;
    btn.innerHTML=`<span class="rbp-opt-icon">${icon}</span>
      <span class="rbp-opt-info"><span class="rbp-opt-name">${name}</span>
      <span class="rbp-opt-desc">${desc}</span></span>
      <span class="rbp-opt-cost">${cost}g</span>`;
    btn.onclick=onclick;
    opts.appendChild(btn);
  }

  const elite2FnMap = { makeWizard, makeNecromancer, makeTank };

  // Helper: issue train command and refresh popup
  function trainCmd(buildingId, unitType, popupContext){
    issueCommand({ type:'train_unit', buildingId, unitType });
    rtsSetLog(`${unitType} queued!`);
    sfx('rtsQueueUnit');
    // Refresh popup after short delay to let state sync update
    const b=rtsEntities.find(e=>e.id===buildingId);
    if(b) setTimeout(()=>openBuildPopup(b.x-camX,b.y-camY,popupContext), window._mpMultiplayer && !mpIsHost ? 200 : 0);
  }

  if(context==='base'){
    title.textContent = cfg.buildingName;
    const sel=rtsSelected[0];
    addOpt(cfg.workerIcon, cfg.workerLabel, 'Gathers gold from mines', 5,
      ()=>trainCmd(sel?sel.id:rtsBuildingSource?.id, 'worker', 'base'));

  } else if(context==='barracks'){
    const sel=rtsSelected[0]; if(!sel) return;
    title.textContent = cfg.barracksLabel;
    addOpt(cfg.warriorIcon, cfg.warriorLabel, cfg.warriorDesc, cfg.warriorCost,
      ()=>trainCmd(sel.id, 'warrior', 'barracks'));

  } else if(context==='worker'){
    title.textContent = 'WORKER ACTIONS';
    addOpt(cfg.barracksIcon, `Build ${cfg.barracksLabel}`, `Right-click to place — trains ${cfg.warriorLabel}s (20g)`, 20, ()=>{
      buildStructureMode='barracks'; _buildModeCost=20; spendGold(20); updateRtsHUD();
      rtsSetLog(`Right-click to place your ${cfg.barracksLabel}!`); closeBuildPopup();
    });
    addOpt(cfg.structIcon, `Build ${cfg.structLabel}`, `Right-click to place — trains elite units (20g)`, 20, ()=>{
      buildStructureMode=true; _buildModeCost=20; spendGold(20); updateRtsHUD();
      rtsSetLog(`Right-click to place your ${cfg.structLabel}!`); closeBuildPopup();
    });
    addOpt('💣', 'Build CANNON', 'Auto-attacks nearby enemies (15g)', 15, ()=>{
      buildStructureMode='cannon'; _buildModeCost=15; spendGold(15); updateRtsHUD();
      rtsSetLog('Right-click to place your CANNON!'); closeBuildPopup();
    });
    addOpt(cfg.baseIcon, `Build ${cfg.buildingName}`, `Right-click to place — trains more workers (25g)`, 25, ()=>{
      buildStructureMode='base'; _buildModeCost=25; spendGold(25); updateRtsHUD();
      rtsSetLog(`Right-click to place your new ${cfg.buildingName}!`); closeBuildPopup();
    });

  } else if(context==='structure'){
    const sel=rtsSelected[0];
    if(!sel) return;
    title.textContent = cfg.structLabel;

    const eliteTypes = [
      { icon:cfg.eliteIcon, label:cfg.eliteLabel, desc:cfg.eliteDesc, cost:cfg.eliteCost, unitType:'elite' },
      { icon:cfg.elite2Icon, label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, unitType:'elite2' },
    ];

    for(const u of eliteTypes){
      addOpt(u.icon, u.label, u.desc, u.cost,
        ()=>trainCmd(sel.id, u.unitType, 'structure'),
        myGold()<u.cost||sel.underConstruction);
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
          const pct=item.time>0 ? Math.floor(((src.trainTimer||0)/item.time)*100) : 0;
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

function rtsOrderAttack(){
  issueCommand({ type:'attack_all' });
}

// Convert screen coords → world coords
function screenToWorld(sx, sy){ return { x: sx+camX, y: sy+camY }; }
// Get canvas-relative mouse position
function canvasPos(e){
  const c=document.getElementById('rts-canvas');
  const rect=c.getBoundingClientRect();
  // Scale from display size to canvas resolution
  const scaleX=c.width/rect.width, scaleY=c.height/rect.height;
  return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
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
    if(ent.side!==mySide()) continue;
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
    const side=mySide();
    const worker=rtsSelected.find(s=>s.type==='worker'&&s.side===side);
    const workerId = worker ? worker.id
      : (rtsEntities.filter(en=>en.type==='worker'&&en.side===side&&en.state!=='building')
          .sort((a,b)=>Math.hypot(a.x-wp.x,a.y-wp.y)-Math.hypot(b.x-wp.x,b.y-wp.y))[0]||{}).id;

    if(!workerId){
      rtsSetLog('No available worker to build!');
      buildStructureMode=false;
      return;
    }
    if(buildStructureMode==='base'){
      issueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_buildModeCost, buildType:'base' });
    } else {
      issueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_buildModeCost, buildType:
        buildStructureMode==='cannon'?'cannon':buildStructureMode==='barracks'?'barracks':'structure' });
    }
    buildStructureMode=false;
    rtsParticles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#ffdd00',size:0,isRing:true,radius:4});
    return;
  }

  if(rtsSelected.length===0) return;

  // check enemy hit
  let enemyHit=null, enemyDist=Infinity;
  for(const ent of rtsEntities){
    if(ent.side===mySide()) continue;
    const r=CLICK_RADII[ent.type]||20;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<enemyDist){ enemyHit=ent; enemyDist=d; }
  }

  const selectedIds=rtsSelected.filter(s=>s.side===mySide()).map(s=>s.id);
  if(enemyHit){
    issueCommand({ type:'attack_target', unitIds:selectedIds, targetId:enemyHit.id });
    rtsSetLog(`Attack order issued!`);
  } else {
    issueCommand({ type:'move_units', unitIds:selectedIds, x:wp.x, y:wp.y });
    rtsSetLog(`Move order issued!`);
  }
  rtsParticles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,
    color:enemyHit?'#ff4444':'#00ff88',size:0,isRing:true,radius:4});
}

function rtsSetLog(msg){ document.getElementById('rts-log').textContent=msg; }
function updateRtsHUD(){
  document.getElementById('rts-gold').textContent=Math.floor(myGold());
  const units=rtsEntities.filter(e=>e.side===mySide()&&e.type!=='base').length;
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

