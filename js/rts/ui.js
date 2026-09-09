// ── CLICK RADII ──
const CLICK_RADII = { base:70, structure:50, cannon:36, warrior:20, worker:14 };

// ── BUILD POPUP ──
let _buildModeCost = 0;
let _buildModeOilCost = 0;

function trainingProgress(timer, totalTime){
  if(!Number.isFinite(totalTime) || totalTime<=0) return {pct:0, seconds:0};
  const elapsed=Math.max(0,Math.min(timer||0,totalTime));
  return {
    pct:Math.floor((elapsed/totalTime)*100),
    seconds:Math.ceil((totalTime-elapsed)/60),
  };
}

function updateTrainingProgress(){
  if(!S.buildPopupOpen) return;
  const popup=document.getElementById('rts-build-popup');
  const status=document.querySelector('#rbp-options .rbp-queue-status');
  if(!status) return;
  const src=S.entities.find(e=>String(e.id)===status.dataset.buildingId);
  const item=src?.queue?.[0];
  const queueSignature=(src?.queue||[]).map(entry=>`${entry.label}:${entry.time}`).join('|');
  if(!item || queueSignature!==status.dataset.queueSignature){
    openBuildPopup(0,0,popup.dataset.context);
    return;
  }
  const progress=trainingProgress(src.trainTimer,item.time);
  const fill=status.querySelector('.rbp-training-fill');
  const remaining=status.querySelector('.rbp-training-remaining');
  if(fill) fill.style.width=`${progress.pct}%`;
  if(remaining) remaining.textContent=`${progress.seconds}s`;
}

function baseTrainingTypes(cfg, faction){
  const types = [
    { icon:cfg.workerIcon, label:cfg.workerLabel, desc:'Gathers gold from mines', cost:cfg.workerCost, oilCost:0, unitType:'worker' },
  ];
  // The Princess is the Prism Armada's unique royal Temple unit.
  if(faction==='prism'){
    types.push({ icon:cfg.princessIcon, label:cfg.princessLabel, desc:cfg.princessDesc, cost:cfg.princessCost, oilCost:cfg.princessOilCost||0, unitType:'princess' });
    types.push({ icon:cfg.arkshipIcon, label:cfg.arkshipLabel, desc:cfg.arkshipDesc, cost:cfg.arkshipCost, oilCost:cfg.arkshipOilCost||0, unitType:'arkship' });
  }
  // Gongui is the Roboto Armada's unique royal Factory unit.
  if(faction==='roboto'){
    types.push({ icon:cfg.gonguiIcon, label:cfg.gonguiLabel, desc:cfg.gonguiDesc, cost:cfg.gonguiCost, oilCost:cfg.gonguiOilCost||0, unitType:'gongui' });
  }
  return types;
}

// True when unitType is one of the Research Lab-gated 2nd-tier units
// (Warbot/Tank/Warship) and this side hasn't completed research yet.
function unitNeedsResearch(cfg, unitType){
  return !!cfg.researchLabLabel
    && (unitType==='warrior2'||unitType==='elite2'||unitType==='aerial2')
    && !S.research[mySide()];
}

function structureEliteTypes(cfg, faction){
  const types=[];
  types.push({ icon:cfg.eliteIcon, label:cfg.eliteLabel, desc:cfg.eliteDesc, cost:cfg.eliteCost, oilCost:cfg.eliteOilCost||0, unitType:'elite' });
  types.push({ icon:cfg.elite2Icon, label:cfg.elite2Label, desc:cfg.elite2Desc, cost:cfg.elite2Cost, oilCost:cfg.tankOilCost||cfg.elite2OilCost||0, unitType:'elite2' });
  return types;
}

// Structure build costs — advanced-unit and air-unit buildings cost the most
// gold and require oil; the main base (TEMPLE/FACTORY) costs the most of all.
const STRUCT_COSTS = {
  cannon:    { gold:35,  oil:0  },
  barracks:  { gold:55,  oil:0  },
  oilrig:    { gold:45,  oil:0  },
  lingnest:  { gold:90,  oil:30 },
  researchlab: { gold:65, oil:20 },
  councillight: { gold:65, oil:20 },
  councildark: { gold:65, oil:20 },
  structure: { gold:100, oil:35 },
  aerial:    { gold:110, oil:40 },
  base:      { gold:160, oil:0  },
};

function openBuildPopup(screenX, screenY, context){
  // remember which entity spawned this popup so units spawn there
  S.buildingSource = S.selected[0] || null;
  const cfg = FACTION_CFG[myFaction()];
  const popup = document.getElementById('rts-build-popup');
  popup.dataset.context=context;
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
    const sel=S.selected[0];
    title.textContent = cfg.buildingName;
    const hasPrincess=S.entities.some(e=>e.side===mySide() && e.faction==='prism' && e.subtype==='princess');
    for(const u of baseTrainingTypes(cfg,myFaction())){
      const princessUnavailable=u.unitType==='princess' && S.entities.some(e=>
        e.side===mySide() && (e.subtype==='princess' || e.queue?.some(q=>q.unitType==='princess' || q.label===cfg.princessLabel))
      );
      const gonguiUnavailable=u.unitType==='gongui' && S.entities.some(e=>
        e.side===mySide() && (e.subtype==='gongui' || e.queue?.some(q=>q.unitType==='gongui' || q.label===cfg.gonguiLabel)
          || (e.subtype==='capitalship' && e.passenger))
      );
      const arkshipUnavailable=u.unitType==='arkship' && (!hasPrincess || S.entities.some(e=>
        e.side===mySide() && (e.subtype==='arkship' || e.queue?.some(q=>q.unitType==='arkship' || q.label===cfg.arkshipLabel))
      ));
      const desc = (u.unitType==='arkship' && !hasPrincess) ? 'Requires an existing Princess to build' : u.desc;
      addOpt(u.icon, u.label, desc, u.cost,
        ()=>trainCmd(sel?sel.id:S.buildingSource?.id, u.unitType, 'base'),
        princessUnavailable||gonguiUnavailable||arkshipUnavailable||myGold()<u.cost||myOil()<u.oilCost||sel?.underConstruction,
        u.oilCost);
    }
    if(myFaction()==='shadow'){
      const cooldown=Math.max(0,(sel?.lingCallCooldown||0)-S.frame);
      const goldCost=cfg.lingCallGoldCost||0;
      const essenceCost=cfg.lingCallOilCost||0;
      const lingCount=cfg.lingCallCount||12;
      addOpt('☄', 'CALL DOWN ALLIED INFESTED', cooldown>0
        ? `Temple is recovering — ${Math.ceil(cooldown/60)}s`
        : `Choose a location to call down ${lingCount} allied Lings`, goldCost, ()=>{
        S.callDownLingMode={templeId:sel?sel.id:S.buildingSource?.id};
        rtsSetLog('Choose a location to call down allied infested Lings.');
        closeBuildPopup();
        rtsUpdateViewportCursor();
      }, !!sel?.underConstruction||cooldown>0||myGold()<goldCost||myOil()<essenceCost, essenceCost);
    }

  } else if(context==='barracks'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent = cfg.barracksLabel;

    const barracksTypes = [
      { icon:cfg.warriorIcon, label:cfg.warriorLabel, desc:cfg.warriorDesc, cost:cfg.warriorCost, oilCost:cfg.warriorOilCost||0, unitType:'warrior' },
    ];
    if(cfg.warrior2Label){
      const needsResearch=unitNeedsResearch(cfg,'warrior2');
      const needsCouncilLight=!!cfg.councilOfLightLabel && !S.entities.some(e=>e.side===mySide()&&e.isCouncilOfLight&&!e.underConstruction);
      const locked=needsResearch||needsCouncilLight;
      const desc = needsResearch ? `Requires completed research at the ${cfg.researchLabLabel}`
        : needsCouncilLight ? `Requires a completed ${cfg.councilOfLightLabel}`
        : cfg.warrior2Desc;
      barracksTypes.push({ icon:cfg.warrior2Icon, label:cfg.warrior2Label,
        desc, cost:cfg.warrior2Cost, oilCost:cfg.warrior2OilCost||0, unitType:'warrior2', locked });
    }

    for(const u of barracksTypes){
      addOpt(u.icon, u.label, u.desc, u.cost,
        ()=>trainCmd(sel.id, u.unitType, 'barracks'),
        u.locked||myGold()<u.cost||myOil()<u.oilCost||sel.underConstruction,
        u.oilCost);
    }

  } else if(context==='worker'){
    title.textContent = 'WORKER ACTIONS';
    const resCfg=FACTION_CFG[S.playerFaction||'prism'];
    const oilName=resCfg.oilResourceName||'oil';
    const bc=STRUCT_COSTS.barracks, sc=STRUCT_COSTS.structure, cc=STRUCT_COSTS.cannon,
          ac=STRUCT_COSTS.aerial, oc=STRUCT_COSTS.oilrig, baseC=STRUCT_COSTS.base;
    // Tech-tree gating: the elite structure (shrine/armory/dark shrine) needs a
    // completed barracks (portal/barracks/training field) first, and the aerial
    // hangar needs a completed elite structure first.
    const hasBarracks = S.entities.some(e=>e.side===mySide() && e.type==='structure' && e.isBarracks && !e.underConstruction);
    const hasEliteStruct = S.entities.some(e=>e.side===mySide() && e.type==='structure' && !e.isBarracks && !e.isAerialHangar && !e.isOilRig && !e.isLingNest && !e.isResearchLab && !e.isCouncilOfLight && !e.isCouncilOfDarkness && !e.underConstruction);
    addOpt(cfg.barracksIcon, `Build ${cfg.barracksLabel}`, `Click to place — trains ${cfg.warriorLabel}s (${bc.gold}g)`, bc.gold, ()=>{
      S.buildStructureMode='barracks'; _buildModeCost=bc.gold; _buildModeOilCost=bc.oil;
      rtsSetLog(`Click to place your ${cfg.barracksLabel}!`); closeBuildPopup();
    }, myGold()<bc.gold||myOil()<bc.oil, bc.oil);
    addOpt(cfg.structIcon, `Build ${cfg.structLabel}`,
      hasBarracks ? `Click to place — trains elite units (${sc.gold}g +${sc.oil}${oilName})` : `Requires a completed ${cfg.barracksLabel} first`,
      sc.gold, ()=>{
      if(!hasBarracks) return;
      S.buildStructureMode=true; _buildModeCost=sc.gold; _buildModeOilCost=sc.oil;
      rtsSetLog(`Click to place your ${cfg.structLabel}!`); closeBuildPopup();
    }, myGold()<sc.gold||myOil()<sc.oil||!hasBarracks, sc.oil);
    addOpt('💣', 'Build CANNON', `Auto-attacks nearby enemies (${cc.gold}g)`, cc.gold, ()=>{
      S.buildStructureMode='cannon'; _buildModeCost=cc.gold; _buildModeOilCost=cc.oil;
      rtsSetLog('Click to place your CANNON!'); closeBuildPopup();
    }, myGold()<cc.gold||myOil()<cc.oil, cc.oil);
    addOpt(cfg.aerialIcon, `Build ${cfg.aerialLabel}`,
      hasEliteStruct ? `Click to place — aerial units (${ac.gold}g +${ac.oil}${oilName})` : `Requires a completed ${cfg.structLabel} first`,
      ac.gold, ()=>{
      if(!hasEliteStruct) return;
      S.buildStructureMode='aerial'; _buildModeCost=ac.gold; _buildModeOilCost=ac.oil;
      rtsSetLog(`Click to place your ${cfg.aerialLabel}!`); closeBuildPopup();
    }, myGold()<ac.gold||myOil()<ac.oil||!hasEliteStruct, ac.oil);
    if(cfg.oilRigLabel){
      addOpt(cfg.oilRigIcon, `Build ${cfg.oilRigLabel}`, `Click to place — workers harvest ${oilName} needed for advanced units (${oc.gold}g)`, oc.gold, ()=>{
        S.buildStructureMode='oilrig'; _buildModeCost=oc.gold; _buildModeOilCost=oc.oil;
        rtsSetLog(`Click to place your ${cfg.oilRigLabel}!`); closeBuildPopup();
      }, myGold()<oc.gold||myOil()<oc.oil, oc.oil);
    }
    if(cfg.lingNestLabel){
      const lc=STRUCT_COSTS.lingnest;
      addOpt(cfg.lingNestIcon, `Build ${cfg.lingNestLabel}`, `Click to place — ${(cfg.lingNestDesc||'passively spawns free Lings').toLowerCase()} (${lc.gold}g +${lc.oil}${oilName})`, lc.gold, ()=>{
        S.buildStructureMode='lingnest'; _buildModeCost=lc.gold; _buildModeOilCost=lc.oil;
        rtsSetLog(`Click to place your ${cfg.lingNestLabel}!`); closeBuildPopup();
      }, myGold()<lc.gold||myOil()<lc.oil, lc.oil);
    }
    if(cfg.researchLabLabel){
      const rl=STRUCT_COSTS.researchlab;
      addOpt(cfg.researchLabIcon, `Build ${cfg.researchLabLabel}`, `Click to place — ${(cfg.researchLabDesc||'unlocks advanced units').toLowerCase()} (${rl.gold}g +${rl.oil}${oilName})`, rl.gold, ()=>{
        S.buildStructureMode='researchlab'; _buildModeCost=rl.gold; _buildModeOilCost=rl.oil;
        rtsSetLog(`Click to place your ${cfg.researchLabLabel}!`); closeBuildPopup();
      }, myGold()<rl.gold||myOil()<rl.oil, rl.oil);
    }
    if(cfg.councilOfLightLabel){
      const cl=STRUCT_COSTS.councillight;
      addOpt(cfg.councilOfLightIcon, `Build ${cfg.councilOfLightLabel}`, `Click to place — ${(cfg.councilOfLightDesc||'unlocks advanced units').toLowerCase()} (${cl.gold}g +${cl.oil}${oilName})`, cl.gold, ()=>{
        S.buildStructureMode='councillight'; _buildModeCost=cl.gold; _buildModeOilCost=cl.oil;
        rtsSetLog(`Click to place your ${cfg.councilOfLightLabel}!`); closeBuildPopup();
      }, myGold()<cl.gold||myOil()<cl.oil, cl.oil);
    }
    if(cfg.councilOfDarknessLabel){
      const cd=STRUCT_COSTS.councildark;
      addOpt(cfg.councilOfDarknessIcon, `Build ${cfg.councilOfDarknessLabel}`, `Click to place — ${(cfg.councilOfDarknessDesc||'unlocks advanced units').toLowerCase()} (${cd.gold}g +${cd.oil}${oilName})`, cd.gold, ()=>{
        S.buildStructureMode='councildark'; _buildModeCost=cd.gold; _buildModeOilCost=cd.oil;
        rtsSetLog(`Click to place your ${cfg.councilOfDarknessLabel}!`); closeBuildPopup();
      }, myGold()<cd.gold||myOil()<cd.oil, cd.oil);
    }
    addOpt(cfg.baseIcon, `Build ${cfg.buildingName}`, `Click to place — trains more workers (${baseC.gold}g)`, baseC.gold, ()=>{
      S.buildStructureMode='base'; _buildModeCost=baseC.gold; _buildModeOilCost=baseC.oil;
      rtsSetLog(`Click to place your new ${cfg.buildingName}!`); closeBuildPopup();
    }, myGold()<baseC.gold||myOil()<baseC.oil, baseC.oil);

  } else if(context==='aerial'){
    const sel=S.selected[0];
    if(!sel) return;
    title.textContent = cfg.aerialLabel;

    const needsCouncilDarkAerial=!!cfg.councilOfDarknessLabel && !S.entities.some(e=>e.side===mySide()&&e.isCouncilOfDarkness&&!e.underConstruction);
    const aerialTypes = [
      { icon:cfg.aerialUnitIcon, label:cfg.aerialUnitLabel, desc:cfg.aerialUnitDesc, cost:cfg.aerialUnitCost, oilCost:cfg.aerialOilCost||0, unitType:'aerial' },
      { icon:cfg.aerial2Icon, label:cfg.aerial2Label,
        desc: needsCouncilDarkAerial ? `Requires a completed ${cfg.councilOfDarknessLabel}` : cfg.aerial2Desc,
        cost:cfg.aerial2Cost, oilCost:cfg.aerial2OilCost||0, unitType:'aerial2', locked:needsCouncilDarkAerial },
    ];
    // The Capital Ship is the Roboto Armada's unique flagship, trained here
    // at the Shipyard alongside the standard aerial units.
    if(myFaction()==='roboto' && cfg.capitalShipLabel){
      aerialTypes.push({ icon:cfg.capitalShipIcon, label:cfg.capitalShipLabel, desc:cfg.capitalShipDesc, cost:cfg.capitalShipCost, oilCost:cfg.capitalShipOilCost||0, unitType:'capitalship' });
    }

    for(const u of aerialTypes){
      const needsResearch=unitNeedsResearch(cfg,u.unitType);
      const shipUnavailable=u.unitType==='capitalship' && S.entities.some(e=>
        e.side===mySide() && (e.subtype==='capitalship' || e.queue?.some(q=>q.unitType==='capitalship' || q.label===cfg.capitalShipLabel))
      );
      const desc = needsResearch ? `Requires completed research at the ${cfg.researchLabLabel}` : u.desc;
      addOpt(u.icon, u.label, desc, u.cost,
        ()=>trainCmd(sel.id, u.unitType, 'aerial'),
        u.locked||needsResearch||shipUnavailable||myGold()<u.cost||myOil()<u.oilCost||sel.underConstruction,
        u.oilCost);
    }

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

  } else if(context==='legionnaire'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='LEGIONNAIRE';
    const isBow=sel.bowMode;
    addOpt(isBow?'🗡':'🏹', isBow?'Switch to SWORD':'Switch to BOW',
      isBow?'Close ranks for stronger melee attacks':'Fire at range and target aerial units',
      0, ()=>{ issueCommand({type:'toggle_weapon',unitId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='warship'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='WARSHIP';
    const isSingle=sel.attackMode==='single';
    addOpt(isSingle?'✦':'🎯', isSingle?'Switch to MULTIPLE':'Switch to SINGLE',
      isSingle?'Fire one bullet at every enemy in range at a slower rate':'Focus one target with one bullet at 112 BPM',
      0, ()=>{ issueCommand({type:'toggle_warship_attack_mode',unitId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='gongui'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='GONGUI, THE ROBOTO KING';
    addOpt(cfg.gonguiIcon||'👑', 'THE ROBOTO KING', `HP: ${Math.floor(sel?.hp||0)}/${sel?.maxHp||260} · Board a Capital Ship to carry him into battle`, 0, ()=>closeBuildPopup(), true);

  } else if(context==='capitalship'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='CAPITAL SHIP';
    addOpt(sel.landed?'🚀':'🛬', sel.landed?'TAKE OFF':'LAND',
      sel.landed?'Return to the air and resume multi-target fire':'Touch down — grounded and vulnerable, but able to board or deploy Gongui',
      0, ()=>{ issueCommand({type:'toggle_capitalship_landed',unitId:sel.id}); closeBuildPopup(); }, false);
    if(sel.passenger){
      addOpt('👑', 'DEPLOY GONGUI', sel.landed?'Unload Gongui to fight on the ground':'Land the ship first to deploy Gongui',
        0, ()=>{ issueCommand({type:'deploy_gongui',unitId:sel.id}); closeBuildPopup(); }, !sel.landed);
    } else {
      addOpt('👑', 'BOARD GONGUI', 'Load a nearby Gongui aboard for safe transport',
        0, ()=>{ issueCommand({type:'board_gongui',unitId:sel.id}); closeBuildPopup(); }, false);
    }

  } else if(context==='arkship'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent='ARKSHIP';
    const isPhasing=sel.arkMode==='phasing';
    addOpt(isPhasing?'⚔':'🌀', isPhasing?'Switch to ATTACKING':'Switch to PHASING',
      isPhasing?'Reform and fire twin beams at nearby enemies'
        : (sel.deployedCrew?'Phase out — the Princess and her Witches have already been deployed':'Phase out and deploy the Princess with 5 Witches'),
      0, ()=>{ issueCommand({type:'toggle_arkship_mode',unitId:sel.id}); closeBuildPopup(); }, false);

  } else if(context==='structure'){
    const sel=S.selected[0];
    if(!sel) return;
    title.textContent = cfg.structLabel;

    const eliteTypes = structureEliteTypes(cfg,myFaction());
    const needsCouncilDarkElite=!!cfg.councilOfDarknessLabel && !S.entities.some(e=>e.side===mySide()&&e.isCouncilOfDarkness&&!e.underConstruction);

    for(const u of eliteTypes){
      const needsCouncilDark = u.unitType==='elite2' && needsCouncilDarkElite;
      const needsResearch=unitNeedsResearch(cfg,u.unitType);
      const locked = needsCouncilDark||needsResearch;
      const desc = needsCouncilDark ? `Requires a completed ${cfg.councilOfDarknessLabel}`
        : needsResearch ? `Requires completed research at the ${cfg.researchLabLabel}`
        : u.desc;
      addOpt(u.icon, u.label, desc, u.cost,
        ()=>trainCmd(sel.id, u.unitType, 'structure'),
        locked||myGold()<u.cost||myOil()<u.oilCost||sel.underConstruction,
        u.oilCost);
    }

  } else if(context==='researchlab'){
    const sel=S.selected[0]; if(!sel) return;
    title.textContent = cfg.researchLabLabel||'RESEARCH LAB';
    const side=mySide();
    const cost=cfg.researchCost||0;
    if(S.research[side]){
      addOpt(cfg.researchLabIcon||'🔬', 'RESEARCH COMPLETE',
        cfg.researchDesc||'Advanced units unlocked', 0, ()=>{}, true);
    } else {
      const researching = sel.queue?.some(q=>q.unitType==='research');
      addOpt(cfg.researchLabIcon||'🔬', cfg.researchLabel||'RESEARCH',
        researching ? 'Research in progress...' : `${cfg.researchDesc||'Unlocks advanced units'} (${cost}g)`,
        cost,
        ()=>{
          issueCommand({ type:'start_research', buildingId:sel.id });
          rtsSetLog(`${cfg.researchLabel||'Research'} started!`);
          sfx('rtsQueueUnit');
          setTimeout(()=>openBuildPopup((sel.x-S.camX)*S.camZoom,(sel.y-S.camY)*S.camZoom,'researchlab'), window._mpMultiplayer && !mpIsHost ? 200 : 0);
        },
        researching||sel.underConstruction||myGold()<cost);
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
      qDiv.className='rbp-queue-status';
      qDiv.dataset.buildingId=String(src.id);
      qDiv.dataset.queueSignature=src.queue.map(item=>`${item.label}:${item.time}`).join('|');
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
          const progress=trainingProgress(src.trainTimer,item.time);
          row.innerHTML=`<span style="color:var(--neon-cyan)">▶</span><span>${item.label}</span>
            <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div class="rbp-training-fill" style="width:${progress.pct}%;height:100%;background:var(--neon-cyan);"></div>
            </div><span class="rbp-training-remaining" style="font-size:9px;color:var(--neon-cyan);min-width:24px;text-align:right">${progress.seconds}s</span>`;
        } else {
          row.innerHTML=`<span style="color:rgba(255,255,255,0.2)">${i+1}</span><span>${item.label}</span>`;
        }
        qDiv.appendChild(row);
      });
      opts.appendChild(qDiv);
    }
  }

  S.buildPopupOpen=true;

  // Prevent panel clicks from bubbling to the canvas click handler
  popup.onclick=function(ev){ ev.stopPropagation(); };
}

// Resets the action panel to its idle state (shown whenever nothing is selected)
// rather than hiding it — the panel is a permanent part of the bottom HUD.
function closeBuildPopup(){
  const popup=document.getElementById('rts-build-popup');
  popup.dataset.context='';
  popup.onclick=null;
  document.getElementById('rbp-title').textContent='NO SELECTION';
  document.getElementById('rbp-options').innerHTML=
    '<div class="rbp-idle-hint">Click your <span id="hud-building-name">'+
    (FACTION_CFG[myFaction()].buildingName||'TEMPLE')+
    '</span> or a worker to build</div>';
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
  if(S.callDownLingMode){
    issueCommand({type:'call_down_lings',buildingId:S.callDownLingMode.templeId,x:wp.x,y:wp.y});
    S.callDownLingMode=false;
    rtsSetLog('Allied infested Lings are incoming!');
    rtsUpdateViewportCursor();
    return;
  }
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
      issueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_buildModeCost, oilCost:_buildModeOilCost, buildType:'base' });
    } else {
      issueCommand({ type:'build_structure', workerId, x:wp.x, y:wp.y, cost:_buildModeCost, oilCost:_buildModeOilCost, buildType:
        S.buildStructureMode==='cannon'?'cannon':S.buildStructureMode==='barracks'?'barracks':S.buildStructureMode==='aerial'?'aerial':S.buildStructureMode==='oilrig'?'oilrig':S.buildStructureMode==='lingnest'?'lingnest':S.buildStructureMode==='researchlab'?'researchlab':S.buildStructureMode==='councillight'?'councillight':S.buildStructureMode==='councildark'?'councildark':'structure' });
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
    } else if(hit.type==='structure' && hit.isLingNest){
      const nestLabel=cfg.lingNestLabel||'LING NEST';
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${nestLabel} — under construction ${pct}%`);
      } else {
        const item=hit.queue?.[0];
        const nextLing=item ? `  Next Ling: ${trainingProgress(hit.trainTimer,item.time).seconds}s` : '';
        rtsSetLog(`${nestLabel} — HP: ${Math.floor(hit.hp)}/${hit.maxHp}${nextLing}`);
      }
    } else if(hit.type==='structure' && hit.isResearchLab){
      const labLabel=cfg.researchLabLabel||'RESEARCH LAB';
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${labLabel} — under construction ${pct}%`);
      } else {
        openBuildPopup(sx,sy,'researchlab');
        rtsSetLog(S.research[mySide()]
          ? `${labLabel} — research complete, advanced units unlocked!`
          : `${labLabel} — research required to unlock advanced units.`);
      }
    } else if(hit.type==='structure' && hit.isCouncilOfLight){
      const clLabel=cfg.councilOfLightLabel||'COUNCIL OF LIGHT';
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${clLabel} — under construction ${pct}%`);
      } else {
        rtsSetLog(`${clLabel} — HP: ${Math.floor(hit.hp)}/${hit.maxHp}  ${cfg.warrior2Label||'advanced units'} unlocked!`);
      }
    } else if(hit.type==='structure' && hit.isCouncilOfDarkness){
      const cdLabel=cfg.councilOfDarknessLabel||'COUNCIL OF DARKNESS';
      if(hit.underConstruction){
        const pct=Math.floor((hit.buildProgress/hit.buildTime)*100);
        rtsSetLog(`${cdLabel} — under construction ${pct}%`);
      } else {
        rtsSetLog(`${cdLabel} — HP: ${Math.floor(hit.hp)}/${hit.maxHp}  ${cfg.elite2Label||'advanced'} and ${cfg.aerial2Label||'advanced aerial'} units unlocked!`);
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
    } else if(hit.type==='warrior' && hit.subtype==='legionnaire'){
      openBuildPopup(sx,sy,'legionnaire');
      rtsSetLog(`LEGIONNAIRE — ${hit.bowMode?'bow':'sword'} mode  HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='warship'){
      openBuildPopup(sx,sy,'warship');
      rtsSetLog(`WARSHIP — ${hit.attackMode} attack mode  HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='gongui'){
      openBuildPopup(sx,sy,'gongui');
      rtsSetLog(`GONGUI, THE ROBOTO KING — HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='capitalship'){
      openBuildPopup(sx,sy,'capitalship');
      rtsSetLog(`CAPITAL SHIP — ${hit.landed?'landed':'airborne'}${hit.passenger?', Gongui aboard':''}  HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='arkship'){
      openBuildPopup(sx,sy,'arkship');
      rtsSetLog(`ARKSHIP — ${hit.arkMode} mode  HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='assaultbot'){
      openBuildPopup(sx,sy,'assaultbot');
      rtsSetLog(`ASSAULT BOT — HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior' && hit.subtype==='psionic'){
      openBuildPopup(sx,sy,'psionic');
      rtsSetLog(`PSIONIC WARRIOR — HP: ${Math.floor(hit.hp)}/${hit.maxHp}`);
    } else if(hit.type==='warrior'){
      const UNIT_LABELS={princess:'princessLabel',arkship:'arkshipLabel',elite:'eliteLabel',wizard:'elite2Label',necromancer:'elite2Label',tank:'elite2Label',starfighter:'aerialUnitLabel',skyattacker:'aerialUnitLabel',warship:'aerial2Label',lightfighter:'aerial2Label',destroyer:'aerial2Label',warbot:'warrior2Label'};
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
    updateTrainingProgress();
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
