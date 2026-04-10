// ── HOMESTEAD WARS — UI ──
const HW_CLICK_RADII = { base:70, structure:50, cannon:36, warrior:20, worker:14 };

let _hwBuildModeCost = 0;

function hwOpenBuildPopup(screenX, screenY, context){
  H.buildingSource = H.selected[0] || null;
  const cfg = HW_FACTIONS[hwMyFaction()];
  const popup = document.getElementById('hw-build-popup');
  const title = document.getElementById('hwbp-title');
  const opts  = document.getElementById('hwbp-options');
  opts.innerHTML='';

  function addOpt(icon, name, desc, cost, onclick, disabled){
    const btn=document.createElement('button');
    btn.className='hwbp-option';
    btn.disabled=disabled!==undefined ? disabled : hwMyHay()<cost;
    btn.innerHTML=`<span class="hwbp-opt-icon">${icon}</span>
      <span class="hwbp-opt-info"><span class="hwbp-opt-name">${name}</span>
      <span class="hwbp-opt-desc">${desc}</span></span>
      <span class="hwbp-opt-cost">${cost}h</span>`;
    btn.onclick=onclick;
    opts.appendChild(btn);
  }

  const elite2FnMap = { hwMakeRam, hwMakePelican, hwMakeBear };

  function trainCmd(buildingId, unitType, popupContext){
    hwIssueCommand({ type:'train_unit', buildingId, unitType });
    hwSetLog(`${unitType} queued!`);
    sfx('hwQueueUnit');
    const b=H.entities.find(e=>e.id===buildingId);
    if(b) setTimeout(()=>hwOpenBuildPopup(b.x-H.camX,b.y-H.camY,popupContext), window._hwMpMultiplayer && !hwMpIsHost ? 200 : 0);
  }

  if(context==='base'){
    title.textContent = cfg.buildingName;
    const sel=H.selected[0];
    addOpt(cfg.workerIcon, cfg.workerLabel, 'Gathers hay from bales', cfg.workerCost,
      ()=>trainCmd(sel?sel.id:H.buildingSource?.id, 'worker', 'base'));

  } else if(context==='barracks'){
    const sel=H.selected[0]; if(!sel) return;
    title.textContent = cfg.barracksLabel;
    addOpt(cfg.warriorIcon, cfg.warriorLabel, cfg.warriorDesc, cfg.warriorCost,
      ()=>trainCmd(sel.id, 'warrior', 'barracks'));

  } else if(context==='worker'){
    title.textContent = 'WORKER ACTIONS';
    addOpt(cfg.barracksIcon, `Build ${cfg.barracksLabel}`, `Click to place — trains ${cfg.warriorLabel}s (20h)`, 20, ()=>{
      H.buildStructureMode='barracks'; _hwBuildModeCost=20;
      hwSetLog(`Click to place your ${cfg.barracksLabel}!`); hwCloseBuildPopup();
    });
    addOpt(cfg.structIcon, `Build ${cfg.structLabel}`, `Click to place — trains elite units (30h)`, 30, ()=>{
      H.buildStructureMode=true; _hwBuildModeCost=30;
      hwSetLog(`Click to place your ${cfg.structLabel}!`); hwCloseBuildPopup();
    });
    addOpt('💣', 'Build CANNON', 'Auto-attacks nearby enemies (15h)', 15, ()=>{
      H.buildStructureMode='cannon'; _hwBuildModeCost=15;
      hwSetLog('Click to place your CANNON!'); hwCloseBuildPopup();
    });
    addOpt(cfg.baseIcon, `Build ${cfg.buildingName}`, `Click to place — trains more workers (35h)`, 35, ()=>{
      H.buildStructureMode='base'; _hwBuildModeCost=35;
      hwSetLog(`Click to place your new ${cfg.buildingName}!`); hwCloseBuildPopup();
    });

  } else if(context==='structure'){
    const sel=H.selected[0];
    if(!sel) return;
    title.textContent = cfg.structLabel;

    const eliteTypes = [
      { icon:cfg.eliteIcon, label:cfg.eliteLabel, desc:cfg.eliteDesc, cost:cfg.eliteCost, unitType:'elite' },
      { icon:cfg.elite2Icon, label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, unitType:'elite2' },
    ];

    for(const u of eliteTypes){
      addOpt(u.icon, u.label, u.desc, u.cost,
        ()=>trainCmd(sel.id, u.unitType, 'structure'),
        hwMyHay()<u.cost||sel.underConstruction);
    }
  }

  // show queue / construction status
  const src = H.selected[0];
  if(src && src.queue!==undefined){
    if(src.underConstruction){
      const pct=Math.floor((src.buildProgress/src.buildTime)*100);
      const info=document.createElement('div');
      info.style.cssText='margin-top:8px;padding:6px 8px;background:rgba(218,165,32,0.1);border:1px solid rgba(218,165,32,0.3);font-size:10px;letter-spacing:1px;color:#DAA520;text-align:center;';
      info.textContent=`⚙ UNDER CONSTRUCTION ${pct}%`;
      opts.appendChild(info);
    } else if(src.queue && src.queue.length>0){
      const qDiv=document.createElement('div');
      qDiv.style.cssText='margin-top:8px;padding:6px 8px;background:rgba(30,20,10,0.8);border:1px solid rgba(139,90,43,0.15);';
      const qTitle=document.createElement('div');
      qTitle.style.cssText='font-family:Orbitron,sans-serif;font-size:8px;letter-spacing:2px;color:rgba(218,165,32,0.5);margin-bottom:4px;';
      qTitle.textContent=`QUEUE (${src.queue.length}/${HW_QUEUE_MAX})`;
      qDiv.appendChild(qTitle);
      src.queue.forEach((item,i)=>{
        const row=document.createElement('div');
        row.style.cssText='font-size:10px;color:rgba(255,248,220,0.5);display:flex;align-items:center;gap:6px;margin-bottom:2px;';
        if(i===0){
          const pct=item.time>0 ? Math.floor(((src.trainTimer||0)/item.time)*100) : 0;
          row.innerHTML=`<span style="color:#DAA520">▶</span><span>${item.label}</span>
            <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:#DAA520;transition:width 0.3s;"></div>
            </div><span style="font-size:9px;color:#DAA520">${pct}%</span>`;
        } else {
          row.innerHTML=`<span style="color:rgba(255,255,255,0.2)">${i+1}</span><span>${item.label}</span>`;
        }
        qDiv.appendChild(row);
      });
      opts.appendChild(qDiv);
    }
  }

  const wrap=document.getElementById('hw-viewport-wrap');
  const ww=wrap.offsetWidth, wh=wrap.offsetHeight;
  const pw=240, ph=220;
  let px=Math.min(screenX+20,ww-pw-10);
  let py=Math.max(10,Math.min(screenY-ph/2,wh-ph-10));
  popup.style.left=px+'px'; popup.style.top=py+'px';
  popup.style.display='block';
  H.buildPopupOpen=true;
  popup.onclick=function(ev){ ev.stopPropagation(); };
}

function hwCloseBuildPopup(){
  const el=document.getElementById('hw-build-popup');
  if(el) el.style.display='none';
  H.buildPopupOpen = false;
  H.buildingSource = null;
}

function hwOrderAttack(){
  hwIssueCommand({ type:'attack_all' });
}

function hwScreenToWorld(sx, sy){ return { x: sx+H.camX, y: sy+H.camY }; }
function hwCanvasPos(e){
  const c=document.getElementById('hw-canvas');
  const rect=c.getBoundingClientRect();
  const scaleX=c.width/rect.width, scaleY=c.height/rect.height;
  return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
}

function hwHandleClick(e){
  if(H.gameOver) return;
  const sp=hwCanvasPos(e);
  const wp=hwScreenToWorld(sp.x, sp.y);
  if(e.target.closest && e.target.closest('#hw-build-popup')) return;
  if(H.buildPopupOpen){ hwCloseBuildPopup(); }

  if(H.buildStructureMode){
    const side=hwMySide();
    const worker=H.selected.find(s=>s.type==='worker'&&s.side===side);
    const workerId = worker ? worker.id
      : (H.entities.filter(en=>en.type==='worker'&&en.side===side&&en.state!=='building')
          .sort((a,b)=>{const d=Math.hypot(a.x-wp.x,a.y-wp.y)-Math.hypot(b.x-wp.x,b.y-wp.y);return d!==0?d:a.id-b.id;})[0]||{}).id;

    if(!workerId){
      hwSetLog('No available worker to build!');
      H.buildStructureMode=false;
      return;
    }
    if(H.buildStructureMode==='base'){
      hwIssueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_hwBuildModeCost, buildType:'base' });
    } else {
      hwIssueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_hwBuildModeCost, buildType:
        H.buildStructureMode==='cannon'?'cannon':H.buildStructureMode==='barracks'?'barracks':'structure' });
    }
    H.buildStructureMode=false;
    H.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#DAA520',size:0,isRing:true,radius:4});
    return;
  }

  for(const ent of H.entities) ent.selected=false;
  H.selected=[];

  let hit=null, hitDist=Infinity;
  for(const ent of H.entities){
    if(ent.side!==hwMySide()) continue;
    const r=HW_CLICK_RADII[ent.type]||14;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<hitDist){ hit=ent; hitDist=d; }
  }

  if(hit){
    hit.selected=true; H.selected=[hit];
    const cfg=HW_FACTIONS[H.playerFaction];
    const sx=hit.x-H.camX, sy=hit.y-H.camY;
    if(hit.type==='base'){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        hwSetLog(`${cfg.buildingName} — under construction ${pct}%`);
      } else {
        hwOpenBuildPopup(sx,sy,'base');
        hwSetLog(`${cfg.buildingName} — train workers here.`);
      }
    } else if(hit.type==='structure' && hit.isBarracks){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        hwSetLog(`${cfg.barracksLabel} — under construction ${pct}%`);
      } else {
        hwOpenBuildPopup(sx,sy,'barracks');
        hwSetLog(`${cfg.barracksLabel} — train ${cfg.warriorLabel}s here.`);
      }
    } else if(hit.type==='structure'){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        hwSetLog(`${cfg.structLabel} — under construction ${pct}%`);
      } else {
        hwOpenBuildPopup(sx,sy,'structure');
        hwSetLog(`${cfg.structLabel} — train elite units.`);
      }
    } else if(hit.type==='cannon'){
      const pct=hit.underConstruction?` (building ${Math.floor((hit.buildProgress/hit.buildTime)*100)}%)`:'';
      hwSetLog(`CANNON${pct} — HP: ${Math.floor(hit.hp)}/${hit.maxHp}  Range: ${hit.range}`);
    } else if(hit.type==='worker'){
      hwOpenBuildPopup(sx,sy,'worker');
      hwSetLog(`${cfg.workerLabel} selected — build or click to move.`);
    } else if(hit.type==='warrior'){
      const UNIT_LABELS={elite:'eliteLabel',wizard:'elite2Label',necromancer:'elite2Label',tank:'elite2Label'};
      const lbl=cfg[UNIT_LABELS[hit.subtype]]||cfg.warriorLabel;
      hwSetLog(`${lbl} selected — click to move or attack.`);
    }
  }
}

function hwHandleRightClick(e){
  e.preventDefault();
  if(H.gameOver) return;
  const sp=hwCanvasPos(e);
  const wp=hwScreenToWorld(sp.x,sp.y);

  if(H.selected.length===0) return;

  let enemyHit=null, enemyDist=Infinity;
  for(const ent of H.entities){
    if(ent.side===hwMySide()) continue;
    const r=HW_CLICK_RADII[ent.type]||20;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<enemyDist){ enemyHit=ent; enemyDist=d; }
  }

  const selectedIds=H.selected.filter(s=>s.side===hwMySide()).map(s=>s.id);
  if(enemyHit){
    hwIssueCommand({ type:'attack_target', unitIds:selectedIds, targetId:enemyHit.id });
    hwSetLog(`Attack order issued!`);
  } else {
    hwIssueCommand({ type:'move_units', unitIds:selectedIds, x:wp.x, y:wp.y });
    hwSetLog(`Move order issued!`);
  }
  H.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,
    color:enemyHit?'#dd3322':'#44cc44',size:0,isRing:true,radius:4});
}

function hwSetLog(msg){ const el=document.getElementById('hw-log'); if(el) el.textContent=msg; }
function hwUpdateHwHUD(){
  const hayEl=document.getElementById('hw-hay');
  if(hayEl) hayEl.textContent=Math.floor(hwMyHay());
  const units=H.entities.filter(e=>e.side===hwMySide()&&e.type!=='base').length;
  const unitsEl=document.getElementById('hw-units');
  if(unitsEl) unitsEl.textContent=units;
  const hpEl=document.getElementById('hw-base-hp');
  if(hpEl) hpEl.textContent=H.baseHP;
  if(H.buildPopupOpen){
    const opts=document.getElementById('hwbp-options');
    if(opts) opts.querySelectorAll('.hwbp-option').forEach(btn=>{
      const costEl=btn.querySelector('.hwbp-opt-cost');
      if(costEl){
        const cost=parseInt(costEl.textContent);
        btn.disabled = hwMyHay() < cost;
      }
    });
  }
}
