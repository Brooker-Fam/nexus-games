// ── AI CONFIG ──
// Base values — overwritten by applyDifficultyToAI() at game start.
// _AI_DEFAULTS stores the original values so multiplayer can reset them.
const AI_CONFIG = {
  buildInterval: 180,        // ticks between build decisions
  trainInterval: 120,        // ticks between train decisions
  attackInterval: 400,       // ticks between attack waves
  maxWorkers: 14,
  attackMinWarriors: 5,      // min idle warriors to launch attack
  attackMatchMin: 3,         // min warriors for "outnumber player" attack
  resourceBonus: 1.0,        // gold multiplier for AI workers
  // build order quality
  barracksWorkerReq: 2,      // workers needed before 1st barracks
  barracks2WorkerReq: 6,     // workers needed before 2nd barracks
  eliteWorkerReq: 4,         // workers needed before elite structure
  maxCannons: 3,             // defensive cannon cap
  // tactical micro
  focusFireChance: 0,        // chance to target lowest-HP enemy (0 in MP)
  kiteChance: 0,             // chance for ranged AI to retreat from melee (0 in MP)
  strategicTargetChance: 0,  // chance for an attack wave to prioritize production/economy
  counterAttackRatio: 1.15,  // required army-strength advantage before an early attack
  // mistakes & coordination
  mistakeChance: 0,          // chance to skip a decision cycle
  attackPartialChance: 0,    // chance to only send some warriors
  // costs
  barracksCost: STRUCT_COSTS.barracks.gold,
  cannonCost: STRUCT_COSTS.cannon.gold,
  structureCost: STRUCT_COSTS.structure.gold,
  structureOilCost: STRUCT_COSTS.structure.oil,
  aerialCost: STRUCT_COSTS.aerial.gold,
  aerialOilCost: STRUCT_COSTS.aerial.oil,
  oilRigCost: STRUCT_COSTS.oilrig.gold,
  lingNestCost: STRUCT_COSTS.lingnest?.gold||0,
  lingNestOilCost: STRUCT_COSTS.lingnest?.oil||0,
  researchLabCost: STRUCT_COSTS.researchlab?.gold||0,
  researchLabOilCost: STRUCT_COSTS.researchlab?.oil||0,
  eliteCost: 30,
  warriorCost: 10,
  warrior2Cost: 16,
  workerCost: 5,
};
const _AI_DEFAULTS = Object.assign({}, AI_CONFIG);
function resetAIConfig(){ Object.assign(AI_CONFIG, _AI_DEFAULTS); }

// Deterministic distance — _dist is "implementation-approximated" per spec,
// so Safari/JSC and Chrome/V8 can return different last-bit results.
// Math.sqrt is IEEE 754 correctly-rounded, so dx*dx+dy*dy → sqrt is portable.
function _dist(dx,dy){ return Math.sqrt(dx*dx+dy*dy); }

// ── COLLISION DETECTION ──
// Ground warriors occupy physical space: they push each other apart when
// they overlap and can't walk through buildings. Aerial units fly above
// the battlefield and are exempt from ground collision, and so are
// workers — they dart in and out of build/mine targets constantly, and
// solid collision against warriors and buildings made them get stuck.
// Radii are kept well under standard melee attack range (50) so a unit
// can always close to attack a building without being shoved back out.
function unitCollisionRadius(e){
  if(e.aerial) return 0;
  if(e.type==='worker') return 0;
  if(e.type==='warrior'){
    if(e.subtype==='tank') return 18;
    if(e.subtype==='warbot'||e.subtype==='assaultbot'||e.subtype==='bloodhound') return 13;
    if(e.subtype==='ling') return 8;
    return 11;
  }
  return 0;
}

function buildingCollisionRadius(e){
  if(e.type==='base') return 28;
  if(e.type==='cannon') return 20;
  if(e.type==='structure') return e.isAerialHangar ? 24 : 22;
  return 0;
}

function resolveUnitCollisions(){
  const units=[];
  for(const e of S.entities){
    if(e.hp<=0) continue;
    if(unitCollisionRadius(e)>0) units.push(e);
  }

  // push overlapping ground units apart
  for(let i=0;i<units.length;i++){
    const a=units[i], ar=unitCollisionRadius(a);
    for(let j=i+1;j<units.length;j++){
      const b=units[j], br=unitCollisionRadius(b);
      const minDist=ar+br;
      const dx=b.x-a.x, dy=b.y-a.y, d=_dist(dx,dy);
      if(d>=minDist) continue;
      let nx, ny;
      if(d<0.0001){
        // Exact overlap (e.g. a stack spawned on the same point): fan pairs
        // out at a deterministic angle derived from their ids, rather than
        // always the same axis, so a dense stack separates in 2D instead of
        // collapsing onto a line.
        const seed=((a.id*2654435761)^(b.id*40503))>>>0;
        const angle=(seed%3600)/3600*Math.PI*2;
        nx=Math.cos(angle); ny=Math.sin(angle);
      } else {
        nx=dx/d; ny=dy/d;
      }
      const overlap=(minDist-d)/2;
      a.x-=nx*overlap; a.y-=ny*overlap;
      b.x+=nx*overlap; b.y+=ny*overlap;
    }
  }

  // keep ground units out of buildings (buildings never move)
  for(const e of S.entities){
    if(e.hp<=0) continue;
    const br=buildingCollisionRadius(e);
    if(br<=0) continue;
    for(const u of units){
      const ur=unitCollisionRadius(u);
      const minDist=br+ur;
      const dx=u.x-e.x, dy=u.y-e.y, d=_dist(dx,dy);
      if(d>=minDist || d<0.0001) continue;
      const overlap=minDist-d;
      const nx=dx/d, ny=dy/d;
      u.x+=nx*overlap; u.y+=ny*overlap;
    }
  }

  // keep everyone inside the map
  for(const e of S.entities){
    if(e.hp<=0 || e.type!=='worker' && e.type!=='warrior') continue;
    const r=unitCollisionRadius(e)||10;
    if(e.x<r) e.x=r; else if(e.x>RW-r) e.x=RW-r;
    if(e.y<r) e.y=r; else if(e.y>RH-r) e.y=RH-r;
  }
}

function aiCount(type, subFilter){
  return S.entities.filter(e=>{
    if(e.side!=='enemy') return false;
    if(e.type!==type) return false;
    return subFilter ? subFilter(e) : true;
  }).length;
}

function aiQueueAt(building, label, time, fn, cost, unitType){
  if(!building || building.underConstruction) return false;
  if(building.queue && building.queue.length>=QUEUE_MAX) return false;
  if(S.gold.enemy<cost) return false;
  S.gold.enemy-=cost;
  queueUnit(building, label, time, fn, unitType);
  return true;
}

function aiBuild(type, nearX, nearY, cost, oilCost=0){
  if(S.gold.enemy<cost) return false;
  if(oilCost>0 && (S.oil.enemy||0)<oilCost) return false;
  // Find an idle AI worker to assign
  const worker = S.entities.find(e=>e.side==='enemy'&&e.type==='worker'&&e.state!=='building');
  if(!worker) return false;
  S.gold.enemy-=cost;
  if(oilCost>0) S.oil.enemy=Math.max(0,(S.oil.enemy||0)-oilCost);
  const x=nearX+(rtsRand()-0.5)*160;
  const y=nearY+(rtsRand()-0.5)*200;
  // Assign worker to build (same flow as player)
  worker.buildTarget = { x, y, buildType:type, ghost:null };
  worker.state = 'building';
  return true;
}

function aiCombatPower(unit){
  if(!unit || unit.type!=='warrior') return 0;
  const healthRatio=Math.max(0,unit.hp)/Math.max(1,unit.maxHp||unit.hp||1);
  const damagePerSecond=unit.beam ? (unit.damage||1) : (unit.damage||1)*60/Math.max(1,unit.ranged?(unit.fireRate||50):MELEE_ATTACK_TICKS);
  const rangeBonus=unit.ranged ? 1+Math.min(unit.range||0,300)/600 : 1;
  return damagePerSecond*rangeBonus*(0.35+healthRatio*0.65);
}

function aiArmyPower(side, onlyIdle=false){
  return S.entities.reduce((total,e)=>{
    if(e.side!==side||e.type!=='warrior'||(onlyIdle&&e.state!=='idle')) return total;
    return total+aiCombatPower(e);
  },0);
}

function aiNearestTarget(unit, candidates){
  let best=null, bestDist=Infinity;
  for(const candidate of candidates){
    if(candidate.aerial&&!canTargetAerial(unit)) continue;
    const distance=_dist(candidate.x-unit.x,candidate.y-unit.y);
    if(distance<bestDist){ best=candidate; bestDist=distance; }
  }
  return best;
}

function aiDefendBase(threats){
  const defenders=S.entities
    .filter(e=>e.side==='enemy'&&e.type==='warrior'&&e.state==='idle')
    .sort((a,b)=>_dist(a.x-S.enemyBase.x,a.y-S.enemyBase.y)-_dist(b.x-S.enemyBase.x,b.y-S.enemyBase.y));
  const requiredPower=threats.reduce((sum,e)=>sum+aiCombatPower(e),0)*1.2;
  let committedPower=0;
  for(const defender of defenders){
    const target=aiNearestTarget(defender,threats);
    if(!target) continue;
    defender.forcedTarget=target;
    defender.moveTarget=null;
    defender.attackMoveTarget=null;
    defender.state='march';
    committedPower+=aiCombatPower(defender);
    if(committedPower>=requiredPower) break;
  }
}

function aiChooseAttackTarget(){
  const candidates=S.entities.filter(e=>e.side==='player'&&e!==S.playerBase&&(
    e.type==='structure'||e.type==='cannon'||e.type==='worker'
  ));
  if(!candidates.length) return S.playerBase;
  // Production first, then static defence, tech/economy, and exposed workers.
  const priority=e=>e.isBarracks?0:e.type==='cannon'?1:e.isAerialHangar?2:e.type==='structure'?3:4;
  candidates.sort((a,b)=>priority(a)-priority(b)||a.hp-b.hp||a.id-b.id);
  return candidates[0];
}

function aiLaunchAttack(warriors){
  const strategic=!window._mpMultiplayer&&Math.random()<AI_CONFIG.strategicTargetChance;
  const objective=strategic?aiChooseAttackTarget():S.playerBase;
  for(const warrior of warriors){
    warrior.moveTarget=null;
    warrior.attackMoveTarget=null;
    warrior.forcedTarget=objective;
    warrior.state='march';
  }
}

function aiTick(){
  S.aiTimer++;
  const eb=S.enemyBase;
  if(!eb) return;

  // Gather intel
  const workers   = aiCount('worker');
  const warriors  = aiCount('warrior');
  const barracks  = aiCount('structure', e=>e.isBarracks);
  const eliteStructs = aiCount('structure', e=>!e.isBarracks&&!e.isAerialHangar&&!e.isLingNest&&!e.isResearchLab);
  const aerialHangars = aiCount('structure', e=>e.isAerialHangar);
  const cannons   = aiCount('cannon');
  const idleWarriors = S.entities.filter(e=>e.side==='enemy'&&e.type==='warrior'&&e.state==='idle').length;

  // Detect threats near base
  const baseThreats = S.entities.filter(e=>
    e.side==='player'&&e.type==='warrior'&&_dist(e.x-eb.x,e.y-eb.y)<400
  );

  // In multiplayer, skip economy/building AI (guest player handles that manually)
  if(!window._mpMultiplayer){

  // === BUILD DECISIONS (cadence set by difficulty) ===
  if(S.aiTimer%AI_CONFIG.buildInterval===0){

    // Mistake: easy AI sometimes skips build decisions entirely
    if(Math.random() >= AI_CONFIG.mistakeChance){

    // Always keep training workers (up to cap)
    if(workers<AI_CONFIG.maxWorkers){
      aiQueueAt(eb,'Worker',BUILD_TIMES.worker,()=>makeWorker('enemy',S.enemyFaction),AI_CONFIG.workerCost);
    }

    // Build first barracks (worker threshold set by difficulty)
    if(barracks===0 && workers>=AI_CONFIG.barracksWorkerReq){
      aiBuild('barracks', eb.x-150, eb.y, AI_CONFIG.barracksCost);
    }
    // Build second barracks for faster production
    else if(barracks===1 && workers>=AI_CONFIG.barracks2WorkerReq && S.gold.enemy>=AI_CONFIG.barracksCost){
      aiBuild('barracks', eb.x-200, eb.y+120, AI_CONFIG.barracksCost);
    }

    // Build cannons (cap set by difficulty)
    if(cannons<AI_CONFIG.maxCannons && workers>=3 && S.gold.enemy>=AI_CONFIG.cannonCost){
      aiBuild('cannon', eb.x-100, eb.y, AI_CONFIG.cannonCost);
    }

    // Build elite structure (worker threshold set by difficulty)
    if(eliteStructs===0 && workers>=AI_CONFIG.eliteWorkerReq && barracks>=1){
      aiBuild('structure', eb.x-200, eb.y, AI_CONFIG.structureCost, AI_CONFIG.structureOilCost);
    }

    // Build aerial hangar once elite structure exists
    if(aerialHangars===0 && eliteStructs>=1 && workers>=AI_CONFIG.eliteWorkerReq){
      aiBuild('aerial', eb.x-160, eb.y-150, AI_CONFIG.aerialCost, AI_CONFIG.aerialOilCost);
    }

    // Build oil-rig-equivalent resource structure once barracks + 3 workers exist
    const eCfg2=FACTION_CFG[S.enemyFaction];
    if(eCfg2.oilRigLabel){
      const oilRigs=aiCount('structure',e=>e.isOilRig);
      if(oilRigs===0 && barracks>=1 && workers>=3){
        aiBuild('oilrig', eb.x-180, eb.y+200, AI_CONFIG.oilRigCost);
      }
    }

    // Build a Ling Nest once a barracks exists — it then passively trickles
    // free Lings with no further AI upkeep.
    if(eCfg2.lingNestLabel){
      const lingNests=aiCount('structure',e=>e.isLingNest);
      if(lingNests===0 && barracks>=1 && workers>=3){
        aiBuild('lingnest', eb.x-160, eb.y-200, AI_CONFIG.lingNestCost, AI_CONFIG.lingNestOilCost);
      }
    }

    // Build a Research Lab once a barracks exists, then pay to research
    // military tech there — required before the AI can train Warbots,
    // Tanks, and Warships.
    if(eCfg2.researchLabLabel){
      const researchLabs=S.entities.filter(e=>e.side==='enemy'&&e.isResearchLab);
      if(researchLabs.length===0 && barracks>=1 && workers>=3){
        aiBuild('researchlab', eb.x-160, eb.y+150, AI_CONFIG.researchLabCost, AI_CONFIG.researchLabOilCost);
      } else if(!S.research.enemy){
        const completedLab=researchLabs.find(e=>!e.underConstruction);
        const alreadyResearching=researchLabs.some(e=>e.queue?.some(q=>q.unitType==='research'));
        if(completedLab && !alreadyResearching){
          aiQueueAt(completedLab, eCfg2.researchLabel||'RESEARCH', BUILD_TIMES.research,
            ()=>{ S.research.enemy=true; return []; }, eCfg2.researchCost||0, 'research');
        }
      }
    }

    } // end mistake check
  }

  // === TRAIN UNITS (cadence set by difficulty) ===
  if(S.aiTimer%AI_CONFIG.trainInterval===0){

    // Mistake: easy AI sometimes skips training
    if(Math.random() >= AI_CONFIG.mistakeChance){

    // Train warriors from ALL barracks (mix in 2nd-tier Warbot/Legionnaires when available)
    const allBarracks=S.entities.filter(e=>e.side==='enemy'&&e.type==='structure'&&e.isBarracks&&!e.underConstruction);
    const eCfgW=FACTION_CFG[S.enemyFaction];
    const warrior2FnMap2={makeWarbot,makeLegionnaireSquad};
    const warrior2OilNeeded=eCfgW.warrior2OilCost||0;
    const researchDone = !eCfgW.researchLabLabel || S.research.enemy;
    for(const bar of allBarracks){
      const wantWarrior2 = eCfgW.warrior2Fn && researchDone && Math.random()<0.35
        && S.gold.enemy>=AI_CONFIG.warrior2Cost && (S.oil.enemy||0)>=warrior2OilNeeded;
      if(wantWarrior2){
        const w2fn=warrior2FnMap2[eCfgW.warrior2Fn];
        const w2time=eCfgW.warrior2Fn==='makeLegionnaireSquad'?BUILD_TIMES.legionnairesquad:BUILD_TIMES.warbot;
        if(w2fn && aiQueueAt(bar,eCfgW.warrior2Label,w2time,()=>w2fn('enemy',S.enemyFaction,bar.x,bar.y),AI_CONFIG.warrior2Cost)){
          if(warrior2OilNeeded>0) S.oil.enemy=Math.max(0,(S.oil.enemy||0)-warrior2OilNeeded);
          continue;
        }
      }
      aiQueueAt(bar,'Warrior',BUILD_TIMES.warrior,()=>makeWarrior('enemy',S.enemyFaction,bar.x,bar.y),AI_CONFIG.warriorCost);
    }

    // Train elites (and elite2/tanks for Roboto)
    const eliteStruct=S.entities.find(e=>e.side==='enemy'&&e.type==='structure'&&!e.isBarracks&&!e.isAerialHangar&&!e.isOilRig&&!e.isLingNest&&!e.isResearchLab&&!e.underConstruction);
    const eCfg3=FACTION_CFG[S.enemyFaction];
    if(S.enemyFaction==='prism'){
      const princessExists=S.entities.some(e=>e.side==='enemy' && e.faction==='prism' && e.subtype==='princess');
      const princessQueued=S.entities.some(e=>e.side==='enemy' && e.queue?.some(q=>q.unitType==='princess' || q.label===eCfg3.princessLabel));
      const princessOil=eCfg3.princessOilCost||0;
      if(!princessExists && !princessQueued && S.gold.enemy>=eCfg3.princessCost && (S.oil.enemy||0)>=princessOil){
        if(aiQueueAt(eb,eCfg3.princessLabel,BUILD_TIMES.elite,()=>makePrincess('enemy','prism',eb.x,eb.y),eCfg3.princessCost,'princess')){
          S.oil.enemy=Math.max(0,(S.oil.enemy||0)-princessOil);
        }
      }
    }
    if(eliteStruct){
      const tankOilNeeded=eCfg3.tankOilCost||0;
      const canAffordTank=eCfg3.elite2Fn==='makeTank' && (!eCfg3.researchLabLabel||S.research.enemy)
        && S.gold.enemy>=eCfg3.elite2Cost && (S.oil.enemy||0)>=tankOilNeeded;
      if(canAffordTank){
        const elite2FnMap2={makeTank};
        const tfn=elite2FnMap2[eCfg3.elite2Fn];
        if(tfn && aiQueueAt(eliteStruct,eCfg3.elite2Label,BUILD_TIMES.elite2,()=>tfn('enemy',S.enemyFaction,eliteStruct.x,eliteStruct.y),eCfg3.elite2Cost)){
          if(tankOilNeeded>0) S.oil.enemy=Math.max(0,(S.oil.enemy||0)-tankOilNeeded);
        }
      } else {
        const eliteOilNeeded=eCfg3.eliteOilCost||0;
        const eliteGoldNeeded=eCfg3.eliteCost||AI_CONFIG.eliteCost;
        if(S.gold.enemy>=eliteGoldNeeded && (S.oil.enemy||0)>=eliteOilNeeded){
          if(aiQueueAt(eliteStruct,eCfg3.eliteLabel||'Elite',BUILD_TIMES.elite,()=>makeElite('enemy',S.enemyFaction,eliteStruct.x,eliteStruct.y),eliteGoldNeeded)){
            if(eliteOilNeeded>0) S.oil.enemy=Math.max(0,(S.oil.enemy||0)-eliteOilNeeded);
          }
        }
      }
    }

    // Train aerial units from hangar (2nd tier preferred when affordable, like elite/elite2)
    const eCfg=FACTION_CFG[S.enemyFaction];
    const aerialHangar=S.entities.find(e=>e.side==='enemy'&&e.type==='structure'&&e.isAerialHangar&&!e.underConstruction);
    const aerialFnMap2={makeStarFighter,makeSkyAttacker};
    const aerial2FnMap2={makeWarship,makeLightFighter,makeDestroyer};
    const aerial2BuildTimeMap={makeWarship:BUILD_TIMES.warship,makeLightFighter:BUILD_TIMES.lightfighter,makeDestroyer:BUILD_TIMES.destroyer};
    const aerialOilNeeded=eCfg.aerialOilCost||0;
    const aerial2OilNeeded=eCfg.aerial2OilCost||0;
    if(aerialHangar && eCfg.aerial2Fn && (!eCfg.researchLabLabel||S.research.enemy)
      && S.gold.enemy>=eCfg.aerial2Cost && (S.oil.enemy||0)>=aerial2OilNeeded){
      const a2fn=aerial2FnMap2[eCfg.aerial2Fn];
      if(a2fn && aiQueueAt(aerialHangar,eCfg.aerial2Label,
        aerial2BuildTimeMap[eCfg.aerial2Fn],
        ()=>a2fn('enemy',S.enemyFaction,aerialHangar.x,aerialHangar.y),
        eCfg.aerial2Cost)){
        if(aerial2OilNeeded>0) S.oil.enemy=Math.max(0,(S.oil.enemy||0)-aerial2OilNeeded);
      }
    } else if(aerialHangar && eCfg.aerialFn && S.gold.enemy>=eCfg.aerialUnitCost && (S.oil.enemy||0)>=aerialOilNeeded){
      const afn=aerialFnMap2[eCfg.aerialFn];
      if(afn && aiQueueAt(aerialHangar,eCfg.aerialUnitLabel,
        BUILD_TIMES[eCfg.aerialFn==='makeSkyAttacker'?'skyattacker':'starfighter'],
        ()=>afn('enemy',S.enemyFaction,aerialHangar.x,aerialHangar.y),
        eCfg.aerialUnitCost)){
        if(aerialOilNeeded>0) S.oil.enemy=Math.max(0,(S.oil.enemy||0)-aerialOilNeeded);
      }
    }

    } // end mistake check
  }

  } // end !_mpMultiplayer (build/train)

  // === ATTACK DECISIONS ===
  // The 'enemy' side is a human guest in multiplayer, not the AI — never
  // hijack their idle warriors into auto-attacking or auto-defending.
  if(!window._mpMultiplayer){

  // Defend base when threatened
  if(baseThreats.length>0 && S.aiTimer%60===0){
    aiDefendBase(baseThreats);
  }

  // Attack when we have a decent army (thresholds set by difficulty)
  if(S.aiTimer%AI_CONFIG.attackInterval===0){
    const idleArmy=S.entities.filter(e=>e.side==='enemy'&&e.type==='warrior'&&e.state==='idle');
    const powerAdvantage=aiArmyPower('enemy',true)>=aiArmyPower('player')*AI_CONFIG.counterAttackRatio;
    const shouldAttack = idleWarriors>=AI_CONFIG.attackMinWarriors || (idleWarriors>=AI_CONFIG.attackMatchMin && powerAdvantage);
    if(shouldAttack){
      // Partial attack: easy AI sometimes only sends a portion
      const sendAll = Math.random() >= AI_CONFIG.attackPartialChance;
      const wave=sendAll?idleArmy:idleArmy.slice(0,Math.ceil(idleArmy.length*0.5));
      aiLaunchAttack(wave);
    }
  }

  } // end !_mpMultiplayer
}

// ── TICK ──
function rtsTick(){
  if(S.gameOver) return;
  S.frame++;
  processCommands();
  tickCamera();
  aiTick();

  const playerBase = S.playerBase;
  const enemyBase  = S.enemyBase;
  if(!playerBase||!enemyBase) return;

  for(const e of S.entities){
    e.frame=(e.frame||0)+1;
    if(e.type==='worker') workerTick(e, playerBase, enemyBase);
    if(e.type==='warrior') warriorTick(e, playerBase, enemyBase);
    if(e.type==='cannon') cannonTick(e);
    if(e.type==='structure' && e.queue) buildingTick(e);
    if(e.type==='base' && e.queue) buildingTick(e);
    // oil rig slow refill (1 oil per 2s)
    if(e.isOilRig && !e.underConstruction && (e.oil||0)<e.maxOil && S.frame%120===0) e.oil++;
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
        S.entities.push(revived);
        spawnMagicBurst(pos.x, pos.y, '#9922ff');
        if(e.side==='player') rtsSetLog('Necromancer raised a Swordsman from the dead!');
      }
    }
  }

  resolveUnitCollisions();

  // remove dead units — record fallen swordsmen for necromancer
  for(let i=S.entities.length-1;i>=0;i--){
    const e=S.entities[i];
    // Skip primary bases (handled by game-over check below)
    if(e===playerBase || e===enemyBase) continue;
    if(e.hp<=0){
      if(e.type==='warrior' && e.faction==='shadow' && !e.subtype && e.state!=='duel'){
        deadSwordsmenPool.push({x:e.x, y:e.y, side:e.side});
        if(deadSwordsmenPool.length>12) deadSwordsmenPool.shift();
      }
      // Track kills and deaths for performance rating
      if(e.type==='warrior'||e.type==='worker'){
        if(e.side==='enemy') S.stats.kills++;
        else S.stats.deaths++;
      }
      spawnDeathParticles(e.x,e.y,FACTION_CFG[e.faction]?.color||'#886633');
      sfx('rtsUnitDie',120);
      S.entities.splice(i,1);
    }
  }

  updateProjectiles();
  tickPendingChains();

  // check base HP
  if(playerBase.hp<=0){
    S.baseHP=0;
    console.log('[GAME OVER] player base destroyed. frame=',S.frame,'hp=',playerBase.hp);
    endRTS(mySide()==='player' ? false : true);
    return;
  }
  if(enemyBase.hp<=0){
    S.enemyBaseHP=0;
    console.log('[GAME OVER] enemy base destroyed. frame=',S.frame,'hp=',enemyBase.hp);
    endRTS(mySide()==='player' ? true : false); return;
  }
  S.baseHP=Math.floor(playerBase.hp);
  S.enemyBaseHP=Math.floor(enemyBase.hp);

  // particles
  for(let i=S.particles.length-1;i>=0;i--){
    const p=S.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=0.9; p.vy*=0.9; p.life--;
    if(p.isRing) p.radius+=3;
    if(p.life<=0) S.particles.splice(i,1);
  }

  updateRtsHUD();
}

// ── WORKER STATE HANDLERS ──
const MINE_TICKS = 90;
const MINE_DROPOFF_DIST = 55;
const BUILD_ARRIVE_DIST = 20;
const MOVE_ARRIVE_DIST = 10;
const MINE_ARRIVE_DIST = 8;
const GOLD_NODE_PENALTIES = { neutral:200, player:0, enemy:400 };
const WORKER_ATTACK_TICKS = 40;
const WORKER_RETALIATE_WINDOW = 240; // ~4s at 60fps — how long a worker keeps fighting after being hit

// Applies damage to a unit/structure. Workers that take damage start
// retaliating against whatever enemy is close enough to hit back; warriors
// remember their attacker so they can retaliate even outside normal aggro
// range (see RETALIATE_WINDOW in warriorTick).
function dealDamage(target, amount, attacker){
  target.hp -= amount;
  if(target.type==='worker') target.retaliateTimer = WORKER_RETALIATE_WINDOW;
  if(target.type==='warrior' && attacker){ target.lastAttacker=attacker; target.lastAttackedFrame=S.frame; }
}

function moveToward(unit, tx, ty, arrivedDist){
  const dx=tx-unit.x, dy=ty-unit.y, d=_dist(dx,dy);
  if(d<arrivedDist) return true;
  unit.x+=dx/d*unit.speed; unit.y+=dy/d*unit.speed;
  return false;
}

// Workers can't seek out fights, but once hit they'll swing back at
// whatever enemy is in melee range for very low damage until it backs
// off or the retaliation window runs out. Returns true while fighting,
// so workerTick can skip the worker's normal gather/build/move logic.
function workerCombatTick(w){
  if((w.retaliateTimer||0)>0){
    w.retaliateTimer--;
    let nearest=null, nearestDist=Infinity;
    for(const e of S.entities){
      if(e.side===w.side) continue;
      if(e===S.playerBase||e===S.enemyBase) continue;
      const d=_dist(e.x-w.x,e.y-w.y);
      if(d<=w.range && d<nearestDist){ nearest=e; nearestDist=d; }
    }
    if(nearest){
      if(w.state!=='defending'){ w.preCombatState=w.state; w.state='defending'; }
      w.attackTimer=(w.attackTimer||0)+1;
      if(w.attackTimer>=WORKER_ATTACK_TICKS){
        w.attackTimer=0;
        dealDamage(nearest, w.damage, w);
        spawnHitFlash(nearest.x,nearest.y,FACTION_CFG[w.faction].color);
      }
      return true;
    }
  }
  if(w.state==='defending'){ w.state=w.preCombatState||'idle'; w.preCombatState=null; }
  return false;
}

function workerBuild(w){
  if(moveToward(w, w.buildTarget.x, w.buildTarget.y, BUILD_ARRIVE_DIST)) {
    const bt=w.buildTarget.buildType||'structure';
    if(!w.buildTarget.ghost){
      const makers={cannon:makeCannon, barracks:makeBarracks, base:makeBase, aerial:makeAerialBuilding, oilrig:makeOilRig, lingnest:makeLingNest, researchlab:makeResearchLab};
      const ghost=(makers[bt]||makeStructure)(w.side, w.faction, w.buildTarget.x, w.buildTarget.y);
      S.entities.push(ghost);
      w.buildTarget.ghost=ghost;
    }
    const ghost=w.buildTarget.ghost;
    if(!ghost || ghost.hp<=0){ w.state='idle'; w.buildTarget=null; return; }
    ghost.buildProgress=(ghost.buildProgress||0)+1;
    w.buildTimer=(w.buildTimer||0)+1;
    w.hammerSwing=Math.sin(w.buildTimer*0.4);
    if(w.hammerSwing<-0.95 && w.buildTimer>2) sfx('rtsHammer',200);
    if(ghost.buildProgress>=ghost.buildTime){
      ghost.underConstruction=false;
      ghost.hp=ghost.maxHp;
      sfx('rtsBuildDone');
      if(w.side==='player'){
        const lbl=bt==='cannon'?'CANNON':bt==='barracks'?FACTION_CFG[w.faction].barracksLabel:bt==='base'?FACTION_CFG[w.faction].buildingName:bt==='aerial'?FACTION_CFG[w.faction].aerialLabel:bt==='oilrig'?(FACTION_CFG[w.faction].oilRigLabel||'OIL RIG'):bt==='lingnest'?(FACTION_CFG[w.faction].lingNestLabel||'LING NEST'):bt==='researchlab'?(FACTION_CFG[w.faction].researchLabLabel||'RESEARCH LAB'):FACTION_CFG[w.faction].structLabel;
        rtsSetLog(`${lbl} complete!`);
      }
      w.state='idle'; w.buildTarget=null; w.hammerSwing=0; w.buildTimer=0;
    }
  }
}

function workerFindGold(w){
  let best=null, bestScore=Infinity;
  for(const node of S.goldNodes){
    if(node.gold<=0) continue;
    const d=_dist(node.x-w.x, node.y-w.y);
    const penalty=GOLD_NODE_PENALTIES[node.owner]||(node.owner===w.side?0:400);
    const score=d+penalty;
    if(score<bestScore){ bestScore=score; best=node; }
  }
  // Roboto workers also collect oil from oil rigs on their side
  const cfg=FACTION_CFG[w.faction||S.playerFaction];
  if(cfg.oilRigLabel){
    for(const ent of S.entities){
      if(!ent.isOilRig||ent.side!==w.side||ent.underConstruction) continue;
      if((ent.oil||0)<=0) continue;
      const d=_dist(ent.x-w.x, ent.y-w.y);
      const score=d+250; // prefer gold, use oil rig when closer or no gold
      if(score<bestScore){ bestScore=score; best=ent; }
    }
  }
  if(!best){ w.state='idle'; return; }
  w.target=best; w.state='moving';
  if(moveToward(w, best.x, best.y, MINE_ARRIVE_DIST)){
    w.state='mining'; w.mineTimer=0;
  }
}

function workerMine(w){
  w.mineTimer++;
  if(w.mineTimer>MINE_TICKS){
    if(w.target && w.target.isOilRig){
      // Mining an oil rig
      if(w.target.oil>0){
        w.target.oil--; w.oilCarry=(w.oilCarry||0)+1;
        if(w.oilCarry>=w.goldCap) w.state='returning';
      } else { w.state='idle'; }
    } else if(w.target && w.target.gold>0){
      w.target.gold--; w.goldCarry++;
      if(w.goldCarry>=w.goldCap) w.state='returning';
    } else { w.state='idle'; }
    w.mineTimer=0;
  }
}

function workerReturn(w, myBase){
  let nearestBase=null, nearestDist=Infinity;
  for(const ent of S.entities){
    if(ent.type!=='base'||ent.side!==w.side) continue;
    const d=_dist(ent.x-w.x,ent.y-w.y);
    if(d<nearestDist){ nearestDist=d; nearestBase=ent; }
  }
  const dropoff=nearestBase||myBase;
  if(moveToward(w, dropoff.x, dropoff.y, MINE_DROPOFF_DIST)){
    if((w.oilCarry||0)>0){
      let oil=w.oilCarry;
      if(w.side==='enemy' && !window._mpMultiplayer) oil=Math.round(oil*AI_CONFIG.resourceBonus);
      S.oil[w.side]=(S.oil[w.side]||0)+oil;
      if(w.side==='player') S.stats.oilEarned+=oil;
      w.oilCarry=0;
    }
    if(w.goldCarry>0){
      let gold = w.goldCarry;
      if(w.side==='enemy' && !window._mpMultiplayer) gold = Math.round(gold * AI_CONFIG.resourceBonus);
      S.gold[w.side]+=gold;
      if(w.side==='player') S.stats.goldEarned+=gold;
      w.goldCarry=0;
    }
    w.state='idle';
  }
}

function workerTick(w, playerBase, enemyBase){
  const myBase=w.side==='player'?playerBase:enemyBase;
  if(workerCombatTick(w)) return;
  if(w.state==='building' && w.buildTarget){ workerBuild(w); return; }
  if(w.moveTarget){
    if(moveToward(w, w.moveTarget.x, w.moveTarget.y, MOVE_ARRIVE_DIST)){
      w.moveTarget=null; w.state='idle';
    }
    return;
  }
  if(w.assignedTask==='gather_oil'){
    const rig=S.entities.find(e=>e.id===w.assignedTargetId && e.isOilRig && e.side===w.side && !e.underConstruction);
    if(!rig || (rig.oil||0)<=0){
      w.assignedTask=null;
      w.assignedTargetId=null;
      w.target=null;
      if(w.state!=='returning') w.state='idle';
    } else {
      w.target=rig;
      if(w.state==='returning'){
        workerReturn(w, myBase);
      } else if(moveToward(w, rig.x, rig.y, MINE_ARRIVE_DIST)){
        w.state='mining';
        workerMine(w);
      } else {
        w.state='moving';
      }
      return;
    }
  }
  if(w.state==='idle'||w.state==='moving') workerFindGold(w);
  else if(w.state==='mining') workerMine(w);
  else if(w.state==='returning') workerReturn(w, myBase);
}

// ── CANNON TICK ──
function cannonTick(c){
  if(c.underConstruction) return; // can't fire while being built
  c.cooldown=Math.max(0,(c.cooldown||0)-1);
  if(c.cooldown>0) return;
  // Find the nearest enemy within range, including aerial units.
  let target=null, bestDist=c.range;
  const enemySide=c.side==='player'?'enemy':'player';
  for(const e of S.entities){
    if(e.side!==enemySide) continue;
    const d=_dist(e.x-c.x,e.y-c.y);
    if(d<bestDist){ bestDist=d; target=e; }
  }
  if(!target) return;
  c.aimAngle=Math.atan2(target.y-c.y,target.x-c.x);
  c.cooldown=c.rate;
  const cCfg=FACTION_CFG[c.faction];
  sfx(cCfg.cannonSound||'rtsCannonFire',300);
  S.projectiles.push({
    x:c.x, y:c.y, tx:target, by:c,
    speed:8, damage:c.damage,
    faction:c.faction, color:cCfg.cannonColor||'#ffaa00',
    type:'cannonball', trail:[], side:c.side,
  });
}

// ── BUILDING TICK — processes train queues ──
function buildingTick(b){
  if(b.underConstruction) return; // can't train while being built
  if(b.infested) ensureInfestedProduction(b);
  if(b.isLingNest) ensureLingNestProduction(b);
  if(!b.queue || b.queue.length===0) return;
  b.trainTimer=(b.trainTimer||0)+1;
  const item=b.queue[0];
  if(b.trainTimer>=item.time){
    b.trainTimer=0;
    b.queue.shift();
    // spawn the unit(s) — some units (e.g. Legionnaires) train in squads
    const result=item.fn();
    const spawned=Array.isArray(result) ? result : [result];
    for(const u of spawned) S.entities.push(u);
    if(b.side==='player'){
      S.stats.unitsBuilt+=spawned.length;
      rtsSetLog(spawned.length>1 ? `${item.label} squad ready! (×${spawned.length})` : `${item.label} ready!`);
    }
    if(b.infested) ensureInfestedProduction(b);
    if(b.isLingNest) ensureLingNestProduction(b);
  }
}

function ensureInfestedProduction(factory){
  if(!factory?.infested || factory.underConstruction) return false;
  if(!factory.queue) factory.queue=[];
  if(factory.queue.length>0) return false;
  return queueUnit(factory, 'INFESTED GUNBOT', BUILD_TIMES.infestedGunbot,
    ()=>makeInfestedGunbot(factory.side, factory.x, factory.y), 'infestedGunbot');
}

function ensureLingNestProduction(nest){
  if(!nest?.isLingNest || nest.underConstruction) return false;
  if(!nest.queue) nest.queue=[];
  if(nest.queue.length>0) return false;
  return queueUnit(nest, 'LING', BUILD_TIMES.ling,
    ()=>makeLing(nest.side, nest.x, nest.y), 'ling');
}

function queueUnit(building, label, time, fn, unitType){
  if(!building.queue) building.queue=[];
  if(building.queue.length>=QUEUE_MAX){ rtsSetLog('Queue full!'); return false; }
  building.queue.push({label,time,fn,unitType});
  return true;
}

// ── WARRIOR STATE HANDLERS ──
const MELEE_ATTACK_TICKS = 45;

// Returns true if this attacker can hit aerial units.
// Allowed: gunbot (roboto warrior), warbot, shockbot, dark warrior (shadow elite),
//          witch (prism warrior), princess (prism elite), wizard, starfighter, skyattacker,
//          bow-mode legionnaire, bow-mode bloodhound.
// Blocked: workers, swordsman (shadow melee warrior), sword-mode legionnaire, necromancer, tank, ling.
function canTargetAerial(w){
  if(w.type==='cannon') return true;
  if(w.type!=='warrior') return false;
  if(w.faction==='shadow' && !w.subtype) return false; // swordsman (melee only)
  if(w.subtype==='legionnaire') return w.bowMode===true; // bow mode can hit aerial
  if(w.subtype==='bloodhound') return w.bowMode===true; // bow mode can hit aerial
  if(w.subtype==='necromancer') return false;
  if(w.subtype==='tank') return false;
  if(w.subtype==='ling') return false; // ground-only melee creature
  return true;
}


function warriorFindAttackMoveTarget(w){
  const scanRange = Math.max(w.range||50, 180);
  let nearest=null, nearestDist=Infinity;
  for(const e of S.entities){
    if(e.side===w.side) continue;
    if(e===S.playerBase||e===S.enemyBase) continue;
    if(e.aerial && !canTargetAerial(w)) continue;
    const d=_dist(e.x-w.x,e.y-w.y);
    if(d<=scanRange && d<nearestDist){ nearest=e; nearestDist=d; }
  }
  return nearest ? { target:nearest, dist:nearestDist } : { target:null, dist:Infinity };
}

function warriorAttackMove(w){
  const found = warriorFindAttackMoveTarget(w);
  if(found.target){
    if(w.ranged) warriorRangedAttack(w, found.target, found.dist);
    else warriorMeleeAttack(w, found.target, found.dist);
    return;
  }
  if(moveToward(w, w.attackMoveTarget.x, w.attackMoveTarget.y, 8)){
    w.attackMoveTarget=null;
    w.state='idle';
  } else {
    w.state='march';
  }
}

function warriorFindTarget(w, enemyBase2){
  // Forced target (right-click)
  if(w.forcedTarget){
    if(w.forcedTarget.hp<=0||!S.entities.includes(w.forcedTarget)){
      w.forcedTarget=null;
    } else {
      // respect aerial restriction even for forced targets
      if(!w.forcedTarget.aerial || canTargetAerial(w)){
        return { target:w.forcedTarget, dist:_dist(w.forcedTarget.x-w.x, w.forcedTarget.y-w.y) };
      }
      w.forcedTarget=null;
    }
  }

  // AI focus-fire: target lowest-HP enemy in engagement range (singleplayer only)
  if(!window._mpMultiplayer && w.side==='enemy' && AI_CONFIG.focusFireChance>0 && Math.random()<AI_CONFIG.focusFireChance){
    let weakest=null, weakestHP=Infinity;
    const scanRange = (w.range||50) * 2;
    for(const e of S.entities){
      if(e.side===w.side) continue;
      // skip primary bases (handled as fallback)
      if(e===S.playerBase||e===S.enemyBase) continue;
      if(e.aerial && !canTargetAerial(w)) continue;
      const d=_dist(e.x-w.x,e.y-w.y);
      if(d<scanRange && e.hp<weakestHP){ weakestHP=e.hp; weakest=e; }
    }
    if(weakest){
      return { target:weakest, dist:_dist(weakest.x-w.x, weakest.y-w.y) };
    }
  }

  // Auto-target nearest enemy (including non-primary bases)
  let nearest=null, nearestDist=Infinity;
  for(const e of S.entities){
    if(e.side===w.side) continue;
    // skip primary bases (handled as fallback)
    if(e===S.playerBase||e===S.enemyBase) continue;
    if(e.aerial && !canTargetAerial(w)) continue;
    const d=_dist(e.x-w.x,e.y-w.y);
    if(d<nearestDist){ nearestDist=d; nearest=e; }
  }
  const target=nearest||enemyBase2;
  const dist=nearest?nearestDist:_dist(enemyBase2.x-w.x,enemyBase2.y-w.y);
  return { target, dist };
}

function warriorMarchToward(w, target, spreadMod, spreadScale){
  w.state='march';
  const dx=target.x-w.x, dy=target.y-w.y, d=_dist(dx,dy)||1;
  const spread=(w.id%spreadMod)*spreadScale-(spreadMod*spreadScale/2);
  w.x+=dx/d*w.speed; w.y+=(dy+spread*0.05)/d*w.speed;
}

function advanceRangedAttack(w, target){
  if(w.beam){ beamAttackTick(w, target); return; }
  const fireRate=w.fireRate||50;
  w.attackTimer++;
  while(w.attackTimer>=fireRate){
    w.attackTimer-=fireRate;
    if(w.summonsLegionnaires) summonLegionnaire(w, target);
    else fireWarriorProjectiles(w, target);
  }
}

// Continuous beam weapon (Light Fighter) — deals damage every tick instead of
// firing discrete shots; w.damage is interpreted as damage-per-second.
function beamAttackTick(w, target){
  const wasBeaming=w._lastBeamFrame===S.frame-1;
  w._lastBeamFrame=S.frame;
  w.beamTarget=target;
  target.hp-=w.damage/60;
  w.beamPulse=wasBeaming?(w.beamPulse||0)+1:0;
  if(!wasBeaming) sfx('rtsBeam', 40);
  if(w.beamPulse%12===0) spawnHitFlash(target.x,target.y,'#ffffff');
}

function summonLegionnaire(princess, target){
  const spawnOffset=princess.side==='player'?24:-24;
  // makeLegionnaire normally offsets a unit from a production building; adjust
  // its origin so the summoned soldier appears directly in front of Princess.
  const productionOffset=princess.side==='player'?80:-80;
  for(let i=0;i<10;i++){
    const legionnaire=makeLegionnaire(
      princess.side,
      princess.faction,
      princess.x+spawnOffset-productionOffset,
      princess.y,
      i%2===1
    );
    legionnaire.y=princess.y+(rtsRand()-0.5)*36;
    legionnaire.forcedTarget=target;
    legionnaire.state='march';
    S.entities.push(legionnaire);
    spawnMagicBurst(legionnaire.x,legionnaire.y,FACTION_CFG.prism.color);
  }
  sfx('rtsMagicFire',80);
}

function warriorRangedAttack(w, target, targetDist){
  // AI kiting: ranged units retreat from nearby melee threats (singleplayer only)
  if(!window._mpMultiplayer && w.side==='enemy' && AI_CONFIG.kiteChance>0 && targetDist<=w.range){
    for(const e of S.entities){
      if(e.side===w.side||e.type==='base'||e.ranged) continue;
      const d=_dist(e.x-w.x,e.y-w.y);
      if(d<100 && Math.random()<AI_CONFIG.kiteChance*0.08){
        // Retreat away from melee threat while still shooting
        const dx=w.x-e.x, dy=w.y-e.y, dist=_dist(dx,dy)||1;
        w.x+=dx/dist*w.speed; w.y+=dy/dist*w.speed;
        // Still fire if ready
        if(w.aerial) w.aimAngle=Math.atan2(target.y-w.y, target.x-w.x);
        advanceRangedAttack(w, target);
        return;
      }
    }
  }

  if(targetDist<=w.range){
    w.state='attack';
    advanceRangedAttack(w, target);
    // track aim angle for aerial units so they visually face their target
    if(w.aerial) w.aimAngle=Math.atan2(target.y-w.y, target.x-w.x);
  } else {
    if(w.aerial) w.aimAngle=Math.atan2(target.y-w.y, target.x-w.x);
    warriorMarchToward(w, target, 13, 4);
  }
}

function warriorMeleeAttack(w, target, targetDist){
  if(targetDist<=w.range){
    w.state='attack';
    w.attackTimer++;
    if(w.attackTimer>=MELEE_ATTACK_TICKS){
      w.attackTimer=0;
      dealDamage(target, w.damage, w);
      if(target.type==='base') spawnHitFlash(target.x+(w.side==='player'?-30:30),target.y+(Math.random()-0.5)*60,'#ff4444');
      else spawnHitFlash(target.x,target.y,FACTION_CFG[w.faction].color);
    }
  } else {
    warriorMarchToward(w, target, 11, 5);
  }
}

function warriorTick(w, playerBase, enemyBase){
  if(w.beam) w.beamTarget=null;
  const enemyBase2=w.side==='player'?enemyBase:playerBase;

  // DUEL STATE — two warriors fighting to become an elite
  if(w.state==='duel'){
    const opp=S.entities.find(e=>e.id===w.duelOpponentId);
    if(!opp||opp.hp<=0||!S.entities.includes(opp)){
      // Opponent is gone — this warrior won
      if(w.hp>0){
        if(w.faction==='shadow'){
          w.subtype='bloodhound'; w.maxHp=180; w.hp=180; w.damage=35; w.speed=3.2;
          w.range=50; w.ranged=false; w.fireRate=22; w.bowMode=false;
          if(w.side==='player') rtsSetLog('A Bloodhound has emerged from the duel!');
          spawnMagicBurst(w.x, w.y, '#ffaa00');
        } else if(w.faction==='roboto'){
          w.subtype='assaultbot'; w.maxHp=180; w.hp=180; w.damage=8; w.speed=1.5;
          w.range=140; w.ranged=true; w.fireRate=12;
          if(w.side==='player') rtsSetLog('An Assault Bot has emerged from the brawl!');
          spawnMagicBurst(w.x, w.y, '#ff6600');
        } else if(w.faction==='prism'){
          w.subtype='psionic'; w.maxHp=110; w.hp=110; w.damage=28; w.speed=0.85;
          w.range=270; w.ranged=true; w.fireRate=65;
          if(w.side==='player') rtsSetLog('A Psionic Warrior has emerged from the duel!');
          spawnMagicBurst(w.x, w.y, '#cc44ff');
        }
        w.state='idle'; w.duelOpponentId=null;
      }
      return;
    }
    // Rush toward opponent
    const dx=opp.x-w.x, dy=opp.y-w.y, d=_dist(dx,dy)||1;
    if(d>22){ w.x+=dx/d*3.5; w.y+=dy/d*3.5; }
    else if(w.duelAttacker){
      w.attackTimer=(w.attackTimer||0)+1;
      if(w.attackTimer>=15){
        w.attackTimer=0;
        opp.hp-=12;
        spawnHitFlash(opp.x,opp.y,'#ffdd00');
        sfx('rtsUnitHit',50);
      }
    }
    return;
  }

  // Auto-aggro: idle warriors engage nearby enemies
  // Bloodhounds in sword mode have a much wider charge range
  if(w.state==='idle'){
    const AGGRO_RANGE = (w.subtype==='bloodhound'&&!w.bowMode)||w.subtype==='assaultbot' ? 350 : Math.max(w.range||50,150);
    for(const e of S.entities){
      if(e.side===w.side) continue;
      if(e===S.playerBase||e===S.enemyBase) continue;
      if(_dist(e.x-w.x, e.y-w.y) <= AGGRO_RANGE){
        w.state='march';
        break;
      }
    }
    // Retaliate against whoever last hit us, even if they're outside our
    // normal aggro range (e.g. long-range siege fire or splash damage).
    if(w.state==='idle' && w.lastAttacker && w.lastAttacker.hp>0
       && S.entities.includes(w.lastAttacker) && (S.frame-(w.lastAttackedFrame||0))<RETALIATE_WINDOW){
      w.forcedTarget=w.lastAttacker;
      w.state='march';
    }
    if(w.state==='idle') return;
  }

  if(w.attackMoveTarget){
    warriorAttackMove(w);
    return;
  }

  if(w.moveTarget){
    if(moveToward(w, w.moveTarget.x, w.moveTarget.y, 8)){
      w.moveTarget=null; w.state='idle';
    }
    return;
  }

  const {target, dist}=warriorFindTarget(w, enemyBase2);
  if(!target) return;

  if(w.ranged) warriorRangedAttack(w, target, dist);
  else warriorMeleeAttack(w, target, dist);
}

// How long (in ticks) an idle unit remembers who last hit it, so it can
// retaliate even against an attacker outside its normal aggro range.
const RETALIATE_WINDOW = 180;

// ── COMBAT CONSTANTS ──
const COMBAT = {
  tankAoeRadius: 80,
  tankAoeDamageFactor: 0.5,
  chainLightningRange: 200,
  chainLightningDamageFactor: 0.6,
  chainLightningBounces: 2,
  darkOrbAoeRadius: 90,
  darkOrbDamageFactor: 0.55,
};

// ── PROJECTILES ──
const PROJECTILE_TYPES = {
  // subtype overrides (checked first)
  tank:        { type:'shell',      color:'#ff6600', speed:9,  sound:'rtsCannonFire' },
  wizard:      { type:'lightning',  color:'#88ffff', speed:6,  sound:'rtsLightning' },
  necromancer: { type:'darkmagic',  color:'#440088', speed:4,  sound:'rtsDarkMagic' },
  // 2nd-tier aerial units
  warship:      { type:'bullet',  color:'#ffcc44', speed:12, sound:'rtsBullet' },
  destroyer:    { type:'darkorb', color:'#5500aa', speed:2.5, sound:'rtsDarkOrb',
                  aoeRadius:COMBAT.darkOrbAoeRadius, aoeFactor:COMBAT.darkOrbDamageFactor },
  // elite per-faction
  'elite.roboto': { type:'lightning',  color:'#44ffff', speed:11, sound:'rtsLightning' },
  'elite.shadow': { type:'darkmagic',  color:'#220044', speed:4,  sound:'rtsDarkMagic' },
  'elite.prism':  { type:'prismblast', color:'#ffffff', speed:4,  sound:'rtsMagicFire' },
  // base warriors per-faction
  'warrior.roboto': { type:'bullet', speed:11, sound:'rtsBullet' },
  'warrior.shadow': { type:'magic',  speed:4,  sound:'rtsMagicFire' },
  'warrior.prism':  { type:'magic',  speed:4,  sound:'rtsMagicFire' },
};

function spawnProjectile(shooter, target, burstOffset){
  const cfg=FACTION_CFG[shooter.faction];
  const sub = shooter.subtype;
  // Lookup: subtype first, then elite.faction, then warrior.faction
  const pCfg = PROJECTILE_TYPES[sub]
    || (sub==='elite' && PROJECTILE_TYPES['elite.'+shooter.faction])
    || PROJECTILE_TYPES['warrior.'+shooter.faction]
    || { type:'magic', speed:4, sound:'rtsMagicFire' };

  // Multi-shot volleys (e.g. Warship) spawn from slightly offset points that
  // still home in on the same target, so the bullets fan out visually.
  let sx=shooter.x, sy=shooter.y;
  if(burstOffset){
    const dx=target.x-shooter.x, dy=target.y-shooter.y, d=_dist(dx,dy)||1;
    sx += (-dy/d)*burstOffset*7;
    sy += (dx/d)*burstOffset*7;
  }

  S.projectiles.push({
    x:sx, y:sy,
    tx:target,
    by:shooter,
    speed: pCfg.speed,
    damage:shooter.damage,
    faction:shooter.faction,
    color: pCfg.color || cfg.color,
    type: pCfg.type,
    trail:[],
    isElite: sub==='elite',
    isWizard: sub==='wizard',
    isNecro: sub==='necromancer',
    isTank: sub==='tank',
    aoeRadius: pCfg.aoeRadius,
    aoeFactor: pCfg.aoeFactor,
    side:shooter.side,
  });
  sfx(pCfg.sound||'rtsBullet', 80);
}

// Warships in multiple mode engage every enemy in range simultaneously;
// every other ranged attack sends one projectile at its selected target.
function fireWarriorProjectiles(w, target){
  if(w.subtype==='warship' && w.attackMode==='multiple'){
    const targets=S.entities.filter(e=>
      e.side!==w.side && e.hp>0 && _dist(e.x-w.x,e.y-w.y)<=w.range
    );
    // The target selected by warriorFindTarget can be a base that is stored
    // separately from S.entities, so retain it when it is the only valid aim.
    if(!targets.includes(target) && target?.hp>0 && _dist(target.x-w.x,target.y-w.y)<=w.range){
      targets.push(target);
    }
    for(const enemy of targets) spawnProjectile(w, enemy);
    return;
  }
  spawnProjectile(w, target);
}

function updateProjectiles(){
  for(let i=S.projectiles.length-1;i>=0;i--){
    const p=S.projectiles[i];
    p.trail.push({x:p.x,y:p.y});
    if(p.trail.length>8) p.trail.shift();
    if(!p.tx||p.tx.hp<=0){ S.projectiles.splice(i,1); continue; }
    const dx=p.tx.x-p.x, dy=p.tx.y-p.y, d=_dist(dx,dy);
    if(d<p.speed+4){
      dealDamage(p.tx, p.damage, p.by);
      if(p.type==='bullet') spawnHitFlash(p.tx.x,p.tx.y,'#ffcc44');
      else if(p.type==='cannonball'){
        spawnHitParticles2(p.tx.x,p.tx.y);
      }
      else if(p.type==='shell'){
        // tank shell — AOE explosion
        for(const ent of S.entities){
          if(ent.side===p.side||ent.type==='base') continue;
          if(_dist(ent.x-p.tx.x,ent.y-p.tx.y)<COMBAT.tankAoeRadius) dealDamage(ent, p.damage*COMBAT.tankAoeDamageFactor, p.by);
        }
        spawnHitParticles2(p.tx.x, p.tx.y);
      }
      else if(p.type==='lightning'||p.type==='darkmagic'){
        spawnLightningHit(p.tx.x,p.tx.y,p.color);
        chainLightning(p.tx, p.damage*COMBAT.chainLightningDamageFactor, p.color, p.side, COMBAT.chainLightningBounces);
      }
      else if(p.type==='darkorb'){
        // destroyer's dark orb — slow-moving area damage
        const radius = p.aoeRadius || COMBAT.darkOrbAoeRadius;
        const factor = p.aoeFactor || COMBAT.darkOrbDamageFactor;
        for(const ent of S.entities){
          if(ent.side===p.side||ent.type==='base') continue;
          if(_dist(ent.x-p.tx.x,ent.y-p.tx.y)<radius) dealDamage(ent, p.damage*factor, p.by);
        }
        spawnDarkOrbBurst(p.tx.x, p.tx.y);
      }
      else {
        spawnMagicBurst(p.tx.x,p.tx.y,p.color);
      }
      S.projectiles.splice(i,1);
    } else {
      p.x+=dx/d*p.speed; p.y+=dy/d*p.speed;
    }
  }
}

// Pending chain lightning bounces — processed in rtsTick instead of setTimeout
const _pendingChains=[];
const CHAIN_BOUNCE_DELAY=4; // ticks between bounces (~67ms at 60fps)

function chainLightning(origin, damage, color, shooterSide, bounces){
  if(bounces<=0) return;
  // find nearest enemy unit within range, not the origin
  let best=null, bestD=COMBAT.chainLightningRange;
  for(const e of S.entities){
    if(e.side===shooterSide||e===origin||e.type==='base') continue;
    const d=_dist(e.x-origin.x,e.y-origin.y);
    if(d<bestD){ bestD=d; best=e; }
  }
  if(!best) return;
  dealDamage(best, damage);
  // draw arc between origin and best as a particle trail
  const steps=8;
  for(let s=0;s<=steps;s++){
    const t2=s/steps;
    const jx=(Math.random()-0.5)*20*(1-t2);
    const jy=(Math.random()-0.5)*20*(1-t2);
    S.particles.push({
      x:origin.x+(best.x-origin.x)*t2+jx,
      y:origin.y+(best.y-origin.y)*t2+jy,
      vx:0,vy:0,life:12,maxLife:12,color,size:3,
    });
  }
  spawnLightningHit(best.x,best.y,color);
  // queue next bounce instead of setTimeout
  if(bounces-1>0){
    _pendingChains.push({ origin:best, damage:damage*0.6, color, shooterSide, bounces:bounces-1, delay:CHAIN_BOUNCE_DELAY });
  }
}

function tickPendingChains(){
  for(let i=_pendingChains.length-1;i>=0;i--){
    const c=_pendingChains[i];
    if(--c.delay<=0){
      _pendingChains.splice(i,1);
      chainLightning(c.origin, c.damage, c.color, c.shooterSide, c.bounces);
    }
  }
}

function spawnLightningHit(x,y,color){
  for(let i=0;i<6;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*4+2;
    S.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:16,maxLife:16,color,size:2+Math.random()*2});
  }
  S.particles.push({x,y,vx:0,vy:0,life:10,maxLife:10,color,size:0,isRing:true,radius:3});
}

function spawnMagicBurst(x,y,color){
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2;
    S.particles.push({x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:22,maxLife:22,color,size:3});
  }
  S.particles.push({x,y,vx:0,vy:0,life:12,maxLife:12,color,size:0,isRing:true,radius:2});
}

function spawnHitParticles2(x,y){
  // big fiery explosion for tank shells
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*6+3;
    const cols=['#ff4400','#ff8800','#ffcc00','#ffffff','#ff2200'];
    S.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,maxLife:30,color:cols[Math.floor(Math.random()*cols.length)],size:4+Math.random()*4});
  }
  S.particles.push({x,y,vx:0,vy:0,life:18,maxLife:18,color:'#ff8800',size:0,isRing:true,radius:4});
  S.particles.push({x,y,vx:0,vy:0,life:12,maxLife:12,color:'#ffcc44',size:0,isRing:true,radius:6});
}

function spawnDarkOrbBurst(x,y){
  // Large void implosion for the Destroyer's dark orb
  for(let i=0;i<28;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*6+4;
    S.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:32,maxLife:32,color:'#7700cc',size:5+Math.random()*5});
  }
  S.particles.push({x,y,vx:0,vy:0,life:28,maxLife:28,color:'#aa44ff',size:0,isRing:true,radius:8});
  S.particles.push({x,y,vx:0,vy:0,life:22,maxLife:22,color:'#5500aa',size:0,isRing:true,radius:14});
  S.particles.push({x,y,vx:0,vy:0,life:16,maxLife:16,color:'#000000',size:0,isRing:true,radius:20});
}

function spawnHitFlash(x,y,color){
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*2+1;
    S.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:18,maxLife:18,color,size:2+Math.random()*2});
  }
}
function spawnDeathParticles(x,y,color){
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2, s=Math.random()*3+1;
    S.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30,maxLife:30,color,size:3+Math.random()*3});
  }
}

function endRTS(playerWon){
  S.gameOver=true;
  const ov=document.getElementById('rts-gameover-overlay');
  const title=document.getElementById('rts-over-title');
  const sub=document.getElementById('rts-over-sub');
  ov.style.display='flex';
  if(playerWon){ title.textContent='VICTORY'; title.className='rts-over-title win'; sub.textContent='The enemy base has been destroyed.'; }
  else { title.textContent='DEFEAT'; title.className='rts-over-title lose'; sub.textContent='Your base has fallen.'; }

  // Record result and show rating change
  const result = recordGameResult(playerWon, S.frame, S.stats);
  showRatingChange(result);
  if(window.posthog) posthog.capture('dso_game_ended', {
    outcome: playerWon ? 'victory' : 'defeat',
    faction: S.playerFaction,
    enemy_faction: S.enemyFaction,
    mode: window._mpMultiplayer ? 'multiplayer' : 'singleplayer',
    rating_before: result.before,
    rating_after: result.after,
    rating_delta: result.after - result.before,
    streak: result.streak,
    games_played: result.gamesPlayed,
    game_frames: S.frame,
  });
}

// ══════════════════
//  RTS DRAW ENGINE
// ══════════════════
let rtsLastTime=0, rtsAccum=0;
function rtsLoop(ts){
  const dt = Math.min(ts - rtsLastTime, 100);
  rtsLastTime = ts;

  if(window._mpMultiplayer){
    // Lockstep: both clients run simulation, advance only when commands ready
    rtsAccum += dt * S.speed;
    while(rtsAccum >= TARGET_MS){
      if(!lsCanAdvance()) break;
      lsTick();
      rtsTick();
      rtsAccum -= TARGET_MS;
    }
  } else {
    // Singleplayer
    rtsAccum += dt * S.speed;
    while(rtsAccum >= TARGET_MS){
      rtsTick();
      rtsAccum -= TARGET_MS;
    }
  }

  rtsDraw();
  S.raf=requestAnimationFrame(rtsLoop);
}

// ── MULTIPLAYER BACKGROUND KEEPALIVE ──
// Chrome/Safari throttle requestAnimationFrame in background tabs.
// This interval keeps the simulation alive so the lockstep doesn't stall.
let _mpKeepAlive = null;

function mpStartKeepAlive(){
  if(_mpKeepAlive) return;
  _mpKeepAlive = setInterval(()=>{
    if(!window._mpMultiplayer || S.gameOver) { mpStopKeepAlive(); return; }
    const now = performance.now();
    // Only kick in when rAF has stopped firing (tab is backgrounded)
    if(now - rtsLastTime > 200){
      const dt = Math.min(now - rtsLastTime, 100);
      rtsLastTime = now;
      rtsAccum += dt * S.speed;
      while(rtsAccum >= TARGET_MS){
        if(!lsCanAdvance()) break;
        lsTick();
        rtsTick();
        rtsAccum -= TARGET_MS;
      }
    }
  }, 100);
}

function mpStopKeepAlive(){
  if(_mpKeepAlive){ clearInterval(_mpKeepAlive); _mpKeepAlive=null; }
}


//# sourceMappingURL=game.js.map
