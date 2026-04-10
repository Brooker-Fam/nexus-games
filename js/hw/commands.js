// ── HOMESTEAD WARS COMMAND SYSTEM ──
// All player actions go through commands. Each command carries cmd.side.
// Host executes locally. Guest sends to host. One unified executor.

const hwCommandQueue = [];

function hwIssueCommand(cmd){
  cmd.tick = H.frame;
  if(window._hwMpMultiplayer && hwMpConnected){
    // Lockstep: buffer command for future turn (both clients)
    hwLsBufferCommand(cmd);
  } else {
    // Singleplayer: execute immediately
    cmd.side = 'player';
    hwCommandQueue.push(cmd);
  }
}

function hwProcessCommands(){
  while(hwCommandQueue.length > 0){
    hwExecuteCommand(hwCommandQueue.shift());
  }
}

function hwExecuteCommand(cmd){
  const side = cmd.side || 'player';
  const faction = side==='player' ? H.playerFaction : H.enemyFaction;
  const cfg = HW_FACTIONS[faction];
  const elite2FnMap = { hwMakeRam, hwMakePelican, hwMakeBear };

  switch(cmd.type){

    case 'train_unit': {
      const building = H.entities.find(e=>e.id===cmd.buildingId);
      if(!building || building.underConstruction) break;
      if(building.side !== side) break; // can't train from enemy building
      const costMap = { worker:cfg.workerCost, warrior:cfg.warriorCost, elite:cfg.eliteCost, elite2:cfg.elite2Cost };
      const cost = costMap[cmd.unitType] || 0;
      if(H.hay[side] < cost) break;

      const timeMap = { worker:HW_BUILD_TIMES.worker, warrior:HW_BUILD_TIMES.warrior, elite:HW_BUILD_TIMES.elite, elite2:HW_BUILD_TIMES.elite2 };
      const time = timeMap[cmd.unitType] || HW_BUILD_TIMES.worker;

      const fnMap = {
        worker:  ()=>hwMakeWorker(side, faction, building.x, building.y),
        warrior: ()=>hwMakeWarrior(side, faction, building.x, building.y),
        elite:   ()=>hwMakeElite(side, faction, building.x, building.y),
        elite2:  ()=>elite2FnMap[cfg.elite2Fn](side, faction, building.x, building.y),
      };

      const fn = fnMap[cmd.unitType];
      if(!fn) break;
      const label = cmd.unitType==='worker' ? cfg.workerLabel
        : cmd.unitType==='warrior' ? cfg.warriorLabel
        : cmd.unitType==='elite' ? cfg.eliteLabel
        : cfg.elite2Label;

      if(!hwQueueUnit(building, label, time, fn)) break;
      H.hay[side] -= cost;
      hwUpdateHUD();
      hwSetLog(`${label} queued (${building.queue.length}/${HW_QUEUE_MAX})`);
      break;
    }

    case 'build_structure': {
      if(cmd.cost) H.hay[side] -= cmd.cost;
      const worker = H.entities.find(e=>e.id===cmd.workerId);
      if(!worker) break;
      worker.buildTarget = { x:cmd.x, y:cmd.y, buildType:cmd.buildType, ghost:null };
      worker.state = 'building';
      break;
    }

    case 'move_units': {
      for(const id of cmd.unitIds){
        const unit = H.entities.find(e=>e.id===id);
        if(!unit || unit.side!==side) continue;
        const idx = cmd.unitIds.indexOf(id);
        const spread = idx * 20 - (cmd.unitIds.length * 10);
        unit.moveTarget = { x:cmd.x + spread, y:cmd.y };
        unit.forcedTarget = null;
        unit.state = unit.type==='warrior' ? 'march' : 'moving';
      }
      break;
    }

    case 'attack_target': {
      for(const id of cmd.unitIds){
        const unit = H.entities.find(e=>e.id===id);
        if(!unit || unit.side!==side || unit.type!=='warrior') continue;
        const target = H.entities.find(e=>e.id===cmd.targetId);
        if(!target) continue;
        unit.forcedTarget = target;
        unit.moveTarget = null;
        unit.state = 'march';
      }
      break;
    }

    case 'attack_all': {
      let count = 0;
      for(const e of H.entities){
        if(e.type==='warrior' && e.side===side && e.state==='idle'){
          e.state = 'march';
          count++;
        }
      }
      hwSetLog(count > 0 ? `${count} warriors advancing!` : 'No idle warriors to command.');
      break;
    }
  }
}
