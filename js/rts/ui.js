// ── CLICK RADII ──
const CLICK_RADII = { base:70, structure:50, cannon:36, warrior:20, worker:14 };

// ── BUILD POPUP ──
let _buildModeCost = 0;

function openBuildPopup(screenX, screenY, context){
  // remember which entity spawned this popup so units spawn there
  S.buildingSource = S.selected[0] || null;
  const cfg = FACTION_CFG[myFaction()];
  const popup = document.getElementById('rts-build-popup');
  const title = document.getElementById('rbp-title');
  const opts  = document.getElementById('rbp-options');
  opts.innerHTML='';

  // Helper to create a popup button
  function addOpt(icon, name, desc, cost, onclick, disabled, oilCost=0){
    const btn=document.createElement('button');
    btn.className='rbp-option';
    btn.dataset.goldCost=String(cost||0);
    btn.dataset.oilCost=String(oilCost||0);
    const forceDisabled = disabled!==undefined ? !!disabled : false;
    btn.dataset.forceDisabled = forceDisabled ? '1' : '0';
    btn.disabled=forceDisabled || myGold()<cost || myOil()<oilCost;
    const resCfg=FACTION_CFG[S.playerFaction||'prism'];
    const oilAbbrev=(resCfg.oilResourceName||'oil').slice(0,3).toLowerCase();
    const oilCostLabel = oilCost>0 ? ` +${oilCost}${oilAbbrev}` : '';
    btn.innerHTML=`<span class="rbp-opt-icon">${icon}</span>
      <span class="rbp-opt-info"><span class="rbp-opt-name">${name}</span>
      <span class="rbp-opt-desc">${desc}</span></span>
      <span class="rbp-opt-cost">${cost}g${oilCostLabel}</span>`;
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
    const b=S.entities.find(e=>e.id===buildingId);
    if(b) setTimeout(()=>openBuildPopup((b.x-S.camX)*S.camZoom,(b.y-S.camY)*S.camZoom,popupContext), window._mpMultiplayer && !mpIsHost ? 200 : 0);
  }

  if(context==='base'){
    title.textContent = cfg.buildingName;
    const sel=S.selected[0];
    addOpt(cfg.workerIcon, cfg.workerLabel, 'Gathers gold from mines', cfg.workerCost,
      ()=>trainCmd(sel?sel.id:S.buildingSource?.id, 'worker', 'base'));

  } else if(context==='barracks'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent = cfg.barracksLabel;
    addOpt(cfg.warriorIcon, cfg.warriorLabel, cfg.warriorDesc, cfg.warriorCost,
      ()=>trainCmd(sel.id, 'warrior', 'barracks'));

  } else if(context==='worker'){
    title.textContent = 'WORKER ACTIONS';
    addOpt(cfg.barracksIcon, `Build ${cfg.barracksLabel}`, `Click to place — trains ${cfg.warriorLabel}s (20g)`, 20, ()=>{
      S.buildStructureMode='barracks'; _buildModeCost=20;
      rtsSetLog(`Click to place your ${cfg.barracksLabel}!`); closeBuildPopup();
    });
    addOpt(cfg.structIcon, `Build ${cfg.structLabel}`, `Click to place — trains elite units (30g)`, 30, ()=>{
      S.buildStructureMode=true; _buildModeCost=30;
      rtsSetLog(`Click to place your ${cfg.structLabel}!`); closeBuildPopup();
    });
    addOpt('💣', 'Build CANNON', 'Auto-attacks nearby enemies (15g)', 15, ()=>{
      S.buildStructureMode='cannon'; _buildModeCost=15;
      rtsSetLog('Click to place your CANNON!'); closeBuildPopup();
    });
    addOpt(cfg.aerialIcon, `Build ${cfg.aerialLabel}`, `Click to place — aerial units (25g)`, 25, ()=>{
      S.buildStructureMode='aerial'; _buildModeCost=25;
      rtsSetLog(`Click to place your ${cfg.aerialLabel}!`); closeBuildPopup();
    });
    if(cfg.oilRigLabel){
      addOpt(cfg.oilRigIcon, `Build ${cfg.oilRigLabel}`, `Click to place — workers harvest ${cfg.oilResourceName||'oil'} needed for advanced units (20g)`, 20, ()=>{
        S.buildStructureMode='oilrig'; _buildModeCost=20;
        rtsSetLog(`Click to place your ${cfg.oilRigLabel}!`); closeBuildPopup();
      });
    }
    addOpt(cfg.baseIcon, `Build ${cfg.buildingName}`, `Click to place — trains more workers (35g)`, 35, ()=>{
      S.buildStructureMode='base'; _buildModeCost=35;
      rtsSetLog(`Click to place your new ${cfg.buildingName}!`); closeBuildPopup();
    });

  } else if(context==='aerial'){
    const sel=S.selected[0];
    if(!sel) return;
    title.textContent = cfg.aerialLabel;
    const aerialOilCost = cfg.aerialOilCost||0;
    addOpt(cfg.aerialUnitIcon, cfg.aerialUnitLabel, cfg.aerialUnitDesc, cfg.aerialUnitCost,
      ()=>trainCmd(sel.id, 'aerial', 'aerial'),
      myGold()<cfg.aerialUnitCost||myOil()<aerialOilCost||sel.underConstruction,
      aerialOilCost);

  } else if(context==='swordsman'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='SWORDSMAN';
    addOpt('⚔', 'FIGHT', 'Duel a nearby Swordsman — the victor becomes a Bloodhound', 0,
      ()=>{ issueCommand({type:'start_duel',swordsmanId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='gunbot'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='GUNBOT';
    addOpt('🤜', 'BRAWL', 'Fight a nearby GunBot — the winner becomes an Assault Bot', 0,
      ()=>{ issueCommand({type:'start_duel',swordsmanId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='witch'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='WITCH';
    addOpt('✨', 'DUEL', 'Duel a nearby Witch — the victor becomes a Psionic Warrior', 0,
      ()=>{ issueCommand({type:'start_duel',swordsmanId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='assaultbot'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='ASSAULT BOT';
    addOpt('🤖', 'ASSAULT BOT', `HP: ${Math.floor(sel?.hp||0)}/${sel?.maxHp||180} · Rapid heavy fire`, 0, ()=>closeBuildPopup(), true);

  } else if(context==='psionic'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='PSIONIC WARRIOR';
    addOpt('🔮', 'PSIONIC WARRIOR', `HP: ${Math.floor(sel?.hp||0)}/${sel?.maxHp||110} · Long-range mind blast`, 0, ()=>closeBuildPopup(), true);

  } else if(context==='bloodhound'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='BLOODHOUND';
    const isBow=sel.bowMode;
    addOpt(isBow?'🗡':'🏹', isBow?'Switch to SWORD':'Switch to BOW',
      isBow?'Charge into melee — high damage, wide aggro':'Stand and shoot — ranged, no charge',
      0, ()=>{ issueCommand({type:'toggle_weapon',unitId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='structure'){
    const sel=S.selected[0];
    if(!sel) return;
    title.textContent = cfg.structLabel;

    const eliteTypes = [
      { icon:cfg.eliteIcon, label:cfg.eliteLabel, desc:cfg.eliteDesc, cost:cfg.eliteCost, oilCost:cfg.eliteOilCost||0, unitType:'elite' },
      { icon:cfg.elite2Icon, label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, oilCost:cfg.tankOilCost||cfg.elite2OilCost||0, unitType:'elite2' },
    ];

    for(const u of eliteTypes){
      addOpt(u.icon, u.label, u.desc, u.cost,
        ()=>trainCmd(sel.id, u.unitType, 'structure'),
        myGold()<u.cost||myOil()<u.oilCost||sel.underConstruction,
        u.oilCost);
    }
  }

  // show queue / construction status if building
  const src = S.selected[0];
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
  S.buildPopupOpen=true;

  // Prevent popup clicks from bubbling to the canvas click handler
  popup.onclick=function(ev){ ev.stopPropagation(); };
}

function closeBuildPopup(){
  document.getElementById('rts-build-popup').style.display='none';
  S.buildPopupOpen = false;
  S.buildingSource = null;
}

function rtsSelectArmy(){
  const side=mySide();
  for(const ent of S.entities) ent.selected=false;
  S.selected=[];

  for(const ent of S.entities){
    if(ent.side!==side || ent.type!=='warrior') continue;
    ent.selected=true;
    S.selected.push(ent);
  }

  if(S.buildPopupOpen) closeBuildPopup();
  const count=S.selected.length;
  rtsSetLog(count>0 ? `${count} army unit${count===1?'':'s'} selected — right-click to move or attack.` : 'No army units to select.');
}

// Convert screen coords → world coords
function screenToWorld(sx, sy){ return { x: sx/S.camZoom+S.camX, y: sy/S.camZoom+S.camY }; }
// Get canvas-relative mouse position
function canvasPos(e){
  const c=document.getElementById('rts-canvas');
  const rect=c.getBoundingClientRect();
  // Scale from display size to canvas resolution
  const scaleX=c.width/rect.width, scaleY=c.height/rect.height;
  return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
}

function rtsHandleClick(e){
  if(S.gameOver) return;
  const sp=canvasPos(e);
  const wp=screenToWorld(sp.x, sp.y);
  if(e.target.closest && e.target.closest('#rts-build-popup')) return;
  if(S.attackMoveMode){
    const selectedWarriorIds=S.selected.filter(s=>s.side===mySide()&&s.type==='warrior').map(s=>s.id);
    if(selectedWarriorIds.length>0){
      issueCommand({ type:'attack_move', unitIds:selectedWarriorIds, x:wp.x, y:wp.y });
      rtsSetLog(`Attack-move order issued!`);
      S.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#ffaa00',size:0,isRing:true,radius:4});
      S.attackMoveMode=false;
      rtsUpdateViewportCursor();
      return;
    }
    S.attackMoveMode=false;
    rtsUpdateViewportCursor();
  }
  if(S.buildPopupOpen){ closeBuildPopup(); }

  // structure/base placement mode (left-click to place)
  if(S.buildStructureMode){
    const side=mySide();
    const worker=S.selected.find(s=>s.type==='worker'&&s.side===side);
    const workerId = worker ? worker.id
      : (S.entities.filter(en=>en.type==='worker'&&en.side===side&&en.state!=='building')
          .sort((a,b)=>{const d=Math.hypot(a.x-wp.x,a.y-wp.y)-Math.hypot(b.x-wp.x,b.y-wp.y);return d!==0?d:a.id-b.id;})[0]||{}).id;

    if(!workerId){
      rtsSetLog('No available worker to build!');
      S.buildStructureMode=false;
      return;
    }
    if(S.buildStructureMode==='base'){
      issueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_buildModeCost, buildType:'base' });
    } else {
      issueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_buildModeCost, buildType:
        S.buildStructureMode==='cannon'?'cannon':S.buildStructureMode==='barracks'?'barracks':S.buildStructureMode==='aerial'?'aerial':S.buildStructureMode==='oilrig'?'oilrig':'structure' });
    }
    S.buildStructureMode=false;
    S.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#ffdd00',size:0,isRing:true,radius:4});
    return;
  }

  for(const ent of S.entities) ent.selected=false;
  S.selected=[];

  let hit=null, hitDist=Infinity;
  for(const ent of S.entities){
    if(ent.side!==mySide()) continue;
    const r=CLICK_RADII[ent.type]||14;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<hitDist){ hit=ent; hitDist=d; }
  }

  if(hit){
    hit.selected=true; S.selected=[hit];
    const cfg=FACTION_CFG[S.playerFaction];
    const sx=(hit.x-S.camX)*S.camZoom, sy=(hit.y-S.camY)*S.camZoom;
    if(hit.type==='base'){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.buildingName} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'base');
        rtsSetLog(`${cfg.buildingName} — train workers here.`);
      }
    } else if(hit.type==='structure' && hit.isBarracks){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.barracksLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'barracks');
        rtsSetLog(`${cfg.barracksLabel} — train ${cfg.warriorLabel}s here.`);
      }
    } else if(hit.type==='structure' && hit.isAerialHangar){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cfg.aerialLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'aerial');
        rtsSetLog(`${cfg.aerialLabel} — train aerial units.`);
      }
    } else if(hit.type==='structure' && hit.isOilRig){
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        const rigCfg=FACTION_CFG[S.playerFaction||'prism'];
        rtsSetLog(`${rigCfg.oilRigLabel||'OIL RIG'} — under construction ${pct}%`);
      } else {
        const rigCfg2=FACTION_CFG[S.playerFaction||'prism'];
        const resName=(rigCfg2.oilResourceName||'oil').toLowerCase();
        rtsSetLog(`${rigCfg2.oilRigLabel||'OIL RIG'} — ${resName}: ${hit.oil||0}/${hit.maxOil||200}  HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
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
      rtsSetLog(`${cfg.workerLabel} selected — build or click to move.`);
    } else if(hit.type==='warrior' && !hit.subtype){
      const duelCtx={shadow:'swordsman',roboto:'gunbot',prism:'witch'};
      const ctx=duelCtx[hit.faction];
      if(ctx) openBuildPopup(sx,sy,ctx);
      rtsSetLog(`${cfg.warriorLabel} selected — right-click to move or attack.`);
    } else if(hit.type==='warrior' && hit.subtype==='bloodhound'){
      openBuildPopup(sx,sy,'bloodhound');
      rtsSetLog(`BLOODHOUND — ${hit.bowMode?'bow':'sword'} mode  HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='assaultbot'){
      openBuildPopup(sx,sy,'assaultbot');
      rtsSetLog(`ASSAULT BOT — HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='psionic'){
      openBuildPopup(sx,sy,'psionic');
      rtsSetLog(`PSIONIC WARRIOR — HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior'){
      const UNIT_LABELS={elite:'eliteLabel',wizard:'elite2Label',necromancer:'elite2Label',tank:'elite2Label',starfighter:'aerialUnitLabel',skyattacker:'aerialUnitLabel'};
      const lbl=cfg[UNIT_LABELS[hit.subtype]]||cfg.warriorLabel;
      rtsSetLog(`${lbl} selected — click to move or attack.`);
    }
  }
}

function rtsHandleRightClick(e){
  e.preventDefault();
  if(S.gameOver) return;
  const sp=canvasPos(e);
  const wp=screenToWorld(sp.x,sp.y);

  if(S.selected.length===0) return;

  const OIL_RIG_RIGHT_CLICK_RADIUS = 110;

  // check friendly hit
  let friendlyHit=null, friendlyDist=Infinity;
  for(const ent of S.entities){
    if(ent.side!==mySide()) continue;
    const r=ent.isOilRig ? OIL_RIG_RIGHT_CLICK_RADIUS : (CLICK_RADII[ent.type]||20);
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<friendlyDist){ friendlyHit=ent; friendlyDist=d; }
  }

  // check enemy hit
  let enemyHit=null, enemyDist=Infinity;
  for(const ent of S.entities){
    if(ent.side===mySide()) continue;
    const r=CLICK_RADII[ent.type]||20;
    const d=Math.hypot(wp.x-ent.x,wp.y-ent.y);
    if(d<r && d<enemyDist){ enemyHit=ent; enemyDist=d; }
  }

  const selectedIds=S.selected.filter(s=>s.side===mySide()).map(s=>s.id);
  const selectedWorkerIds=S.selected.filter(s=>s.side===mySide()&&s.type==='worker').map(s=>s.id);
  if(friendlyHit && selectedWorkerIds.length>0){
    const buildable=friendlyHit.type==='base'||friendlyHit.type==='structure'||friendlyHit.type==='cannon';
    if(buildable && friendlyHit.underConstruction){
      issueCommand({ type:'assign_worker_task', workerIds:selectedWorkerIds, task:'build', targetId:friendlyHit.id });
      rtsSetLog(`Build order issued!`);
      S.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#ffdd00',size:0,isRing:true,radius:4});
      return;
    }
    if(friendlyHit.isOilRig && !friendlyHit.underConstruction){
      issueCommand({ type:'assign_worker_task', workerIds:selectedWorkerIds, task:'gather_oil', targetId:friendlyHit.id });
      rtsSetLog(`Oil gathering order issued!`);
      S.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,color:'#00d27f',size:0,isRing:true,radius:4});
      return;
    }
  }

  const selectedWarriorIds=S.selected.filter(s=>s.side===mySide()&&s.type==='warrior').map(s=>s.id);
  const isAttackMove = S.attackMoveMode && selectedWarriorIds.length>0 && !enemyHit;
  if(enemyHit){
    issueCommand({ type:'attack_target', unitIds:selectedIds, targetId:enemyHit.id });
    rtsSetLog(`Attack order issued!`);
  } else if(isAttackMove){
    issueCommand({ type:'attack_move', unitIds:selectedWarriorIds, x:wp.x, y:wp.y });
    rtsSetLog(`Attack-move order issued!`);
  } else {
    issueCommand({ type:'move_units', unitIds:selectedIds, x:wp.x, y:wp.y });
    rtsSetLog(`Move order issued!`);
  }
  S.attackMoveMode = false;
  rtsUpdateViewportCursor();
  S.particles.push({x:wp.x,y:wp.y,vx:0,vy:0,life:25,maxLife:25,
    color:enemyHit?'#ff4444':isAttackMove?'#ffaa00':'#00ff88',size:0,isRing:true,radius:4});
}

function rtsSetLog(msg){ document.getElementById('rts-log').textContent=msg; }
function updateRtsHUD(){
  document.getElementById('rts-gold').textContent=Math.floor(myGold());
  const units=S.entities.filter(e=>e.side===mySide()&&e.type!=='base').length;
  document.getElementById('rts-units').textContent=units;
  document.getElementById('rts-base-hp').textContent=S.baseHP;
  // second resource HUD (oil / essence / light) — show for factions with an oil rig
  const cfg=FACTION_CFG[S.playerFaction||'prism'];
  const oilRow=document.getElementById('rts-oil-row');
  if(oilRow){
    if(cfg.oilRigLabel){
      oilRow.style.display='';
      const icon=cfg.oilResourceIcon||'🛢';
      const name=cfg.oilResourceName||'OIL';
      oilRow.innerHTML=`<span class="rts-res-icon">${icon}</span> ${name}: <span id="rts-oil">${Math.floor(myOil())}</span>`;
    } else {
      oilRow.style.display='none';
    }
  }
  // refresh popup options if open so gold costs update
  if(S.buildPopupOpen){
    const opts=document.getElementById('rbp-options');
    if(opts) opts.querySelectorAll('.rbp-option').forEach(btn=>{
      const forceDisabled = btn.dataset.forceDisabled === '1';
      if(forceDisabled){
        btn.disabled = true;
        return;
      }
      const goldCost=parseInt(btn.dataset.goldCost||'0',10);
      const oilCost=parseInt(btn.dataset.oilCost||'0',10);
      btn.disabled = myGold() < goldCost || myOil() < oilCost;
    });
  }
}


//# sourceMappingURL=ui.js.map
