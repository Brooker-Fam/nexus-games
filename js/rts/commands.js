// ── RTS COMMAND SYSTEM ──
// All player actions go through commands. Each command carries cmd.side.
// Host executes locally. Guest sends to host. One unified executor.

const rtsCommandQueue = [];

function issueCommand(cmd){
  cmd.tick = S.frame;
  if(window._mpMultiplayer && mpConnected){
    // Lockstep: buffer command for future turn (both clients)
    lsBufferCommand(cmd);
  } else {
    // Singleplayer: execute immediately
    cmd.side = 'player';
    rtsCommandQueue.push(cmd);
  }
}

function processCommands(){
  while(rtsCommandQueue.length > 0){
    executeCommand(rtsCommandQueue.shift());
  }
}

function executeCommand(cmd){
  const side = cmd.side || 'player';
  const faction = side==='player' ? S.playerFaction : S.enemyFaction;
  const cfg = FACTION_CFG[faction];
  const elite2FnMap = { makeWizard, makeNecromancer, makeTank };
  const getBuildTypeFromEntity = (ent)=>{
    if(!ent) return 'structure';
    if(ent.type==='base') return 'base';
    if(ent.type==='cannon') return 'cannon';
    if(ent.isBarracks) return 'barracks';
    if(ent.isAerialHangar) return 'aerial';
    if(ent.isOilRig) return 'oilrig';
    return 'structure';
  };

  switch(cmd.type){

    case 'train_unit': {
      const building = S.entities.find(e=>e.id===cmd.buildingId);
      if(!building || building.underConstruction) break;
      if(building.side !== side) break; // can't train from enemy building
      const aerialFnMap = { makeStarFighter, makeSkyAttacker };
      const costMap = { worker:cfg.workerCost, warrior:cfg.warriorCost, elite:cfg.eliteCost, elite2:cfg.elite2Cost, aerial:cfg.aerialUnitCost };
      const cost = costMap[cmd.unitType] || 0;
      if(S.gold[side] < cost) break;
      // Roboto: tanks and sky attackers also cost oil
      const oilCost = cmd.unitType==='elite2' ? (cfg.tankOilCost||0)
                    : cmd.unitType==='aerial'  ? (cfg.aerialOilCost||0) : 0;
      if(oilCost > 0 && (S.oil[side]||0) < oilCost) break;

      const timeMap = { worker:BUILD_TIMES.worker, warrior:BUILD_TIMES.warrior, elite:BUILD_TIMES.elite, elite2:BUILD_TIMES.elite2, aerial:BUILD_TIMES[cfg.aerialFn==='makeSkyAttacker'?'skyattacker':'starfighter'] };
      const time = timeMap[cmd.unitType] || BUILD_TIMES.worker;

      const fnMap = {
        worker:  ()=>makeWorker(side, faction, building.x, building.y),
        warrior: ()=>makeWarrior(side, faction, building.x, building.y),
        elite:   ()=>makeElite(side, faction, building.x, building.y),
        elite2:  ()=>elite2FnMap[cfg.elite2Fn](side, faction, building.x, building.y),
        aerial:  ()=>aerialFnMap[cfg.aerialFn](side, faction, building.x, building.y),
      };

      const fn = fnMap[cmd.unitType];
      if(!fn) break;
      const label = cmd.unitType==='worker' ? cfg.workerLabel
        : cmd.unitType==='warrior' ? cfg.warriorLabel
        : cmd.unitType==='elite' ? cfg.eliteLabel
        : cmd.unitType==='aerial' ? cfg.aerialUnitLabel
        : cfg.elite2Label;

      if(!queueUnit(building, label, time, fn)) break;
      S.gold[side] -= cost;
      if(oilCost>0) S.oil[side]=Math.max(0,(S.oil[side]||0)-oilCost);
      updateRtsHUD();
      rtsSetLog(`${label} queued (${building.queue.length}/${QUEUE_MAX})`);
      break;
    }

    case 'build_structure': {
      if(cmd.cost) S.gold[side] -= cmd.cost;
      const worker = S.entities.find(e=>e.id===cmd.workerId);
      if(!worker) break;
      worker.buildTarget = { x:cmd.x, y:cmd.y, buildType:cmd.buildType, ghost:null };
      worker.state = 'building';
      break;
    }

    case 'move_units': {
      for(const id of cmd.unitIds){
        const unit = S.entities.find(e=>e.id===id);
        if(!unit || unit.side!==side) continue;
        const idx = cmd.unitIds.indexOf(id);
        const spread = idx * 20 - (cmd.unitIds.length * 10);
        unit.moveTarget = { x:cmd.x + spread, y:cmd.y };
        unit.attackMoveTarget = null;
        unit.forcedTarget = null;
        if(unit.type==='worker'){
          unit.assignedTask = null;
          unit.assignedTargetId = null;
        }
        unit.state = unit.type==='warrior' ? 'march' : 'moving';
      }
      break;
    }

    case 'assign_worker_task': {
      const target = S.entities.find(e=>e.id===cmd.targetId);
      if(!target || target.side!==side) break;
      for(const workerId of cmd.workerIds||[]){
        const worker = S.entities.find(e=>e.id===workerId);
        if(!worker || worker.side!==side || worker.type!=='worker') continue;
        worker.moveTarget = null;
        if(cmd.task==='build'){
          if(!target.underConstruction) continue;
          worker.assignedTask = null;
          worker.assignedTargetId = null;
          worker.target = null;
          worker.buildTarget = {
            x:target.x,
            y:target.y,
            buildType:getBuildTypeFromEntity(target),
            ghost:target,
          };
          worker.state = 'building';
        } else if(cmd.task==='gather_oil'){
          if(!target.isOilRig || target.underConstruction) continue;
          worker.buildTarget = null;
          worker.target = target;
          worker.assignedTask = 'gather_oil';
          worker.assignedTargetId = target.id;
          worker.state = 'moving';
          worker.mineTimer = 0;
        }
      }
      break;
    }

    case 'attack_target': {
      for(const id of cmd.unitIds){
        const unit = S.entities.find(e=>e.id===id);
        if(!unit || unit.side!==side || unit.type!=='warrior') continue;
        const target = S.entities.find(e=>e.id===cmd.targetId);
        if(!target) continue;
        unit.forcedTarget = target;
        unit.moveTarget = null;
        unit.attackMoveTarget = null;
        unit.state = 'march';
      }
      break;
    }


    case 'attack_move': {
      for(const id of cmd.unitIds){
        const unit = S.entities.find(e=>e.id===id);
        if(!unit || unit.side!==side || unit.type!=='warrior') continue;
        const idx = cmd.unitIds.indexOf(id);
        const spread = idx * 20 - (cmd.unitIds.length * 10);
        unit.attackMoveTarget = { x:cmd.x + spread, y:cmd.y };
        unit.moveTarget = null;
        unit.forcedTarget = null;
        unit.target = null;
        unit.state = 'march';
      }
      break;
    }

    case 'start_duel': {
      const s1=S.entities.find(e=>e.id===cmd.swordsmanId);
      if(!s1||s1.side!==side||s1.subtype||s1.state==='duel'||s1.type!=='warrior') break;
      let nearest=null, nearestDist=Infinity;
      for(const e of S.entities){
        if(e===s1||e.side!==side||e.type!=='warrior'||e.faction!==s1.faction||e.subtype||e.state==='duel') continue;
        const d=_dist(e.x-s1.x,e.y-s1.y);
        if(d<nearestDist){ nearestDist=d; nearest=e; }
      }
      const pairLabels={shadow:'Swordsmen',roboto:'GunBots',prism:'Witches'};
      const needLabel={shadow:'Swordsman',roboto:'GunBot',prism:'Witch'};
      const label=pairLabels[s1.faction]||'Warriors';
      if(!nearest){ if(side==='player') rtsSetLog(`Need another ${needLabel[s1.faction]||'warrior'} to start a duel!`); break; }
      const s1Wins = Math.random() < 0.5;
      s1.state='duel'; s1.duelOpponentId=nearest.id; s1.duelAttacker=s1Wins;
      nearest.state='duel'; nearest.duelOpponentId=s1.id; nearest.duelAttacker=!s1Wins;
      if(side==='player') rtsSetLog(`Two ${label} enter the duel ring...`);
      break;
    }

    case 'toggle_weapon': {
      const bh=S.entities.find(e=>e.id===cmd.unitId);
      if(!bh||bh.side!==side||bh.subtype!=='bloodhound') break;
      bh.bowMode=!bh.bowMode;
      if(bh.bowMode){ bh.ranged=true; bh.range=260; bh.speed=0.9; bh.fireRate=38; bh.damage=28; }
      else           { bh.ranged=false; bh.range=50;  bh.speed=3.2; bh.fireRate=22; bh.damage=35; }
      if(side==='player') rtsSetLog(`Bloodhound switched to ${bh.bowMode?'bow':'sword'} mode!`);
      break;
    }

    case 'attack_all': {
      let count = 0;
      for(const e of S.entities){
        if(e.type==='warrior' && e.side===side && e.state==='idle'){
          e.state = 'march';
          count++;
        }
      }
      rtsSetLog(count > 0 ? `${count} warriors advancing!` : 'No idle warriors to command.');
      break;
    }
  }
}

//# sourceMappingURL=commands.js.map
