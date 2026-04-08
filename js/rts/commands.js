// ── RTS COMMAND SYSTEM ──
// All player actions that mutate game state go through commands.
// This decouples input from simulation — required for multiplayer.

const rtsCommandQueue = [];

function issueCommand(cmd){
  cmd.tick = rtsFrame;
  if(window._mpMultiplayer && mpConnected){
    // Multiplayer: send to host. Host executes, guest gets state back.
    mpSendCommand(cmd);
    // Host also executes locally
    if(mpIsHost) rtsCommandQueue.push(cmd);
  } else {
    // Singleplayer: execute locally
    rtsCommandQueue.push(cmd);
  }
}

function processCommands(){
  while(rtsCommandQueue.length > 0){
    const cmd = rtsCommandQueue.shift();
    executeCommand(cmd);
  }
}

function executeCommand(cmd){
  const side = mySide();
  const faction = side==='player' ? rtsPlayerFaction : rtsEnemyFaction;
  const cfg = FACTION_CFG[faction];

  switch(cmd.type){

    case 'train_unit': {
      const building = rtsEntities.find(e=>e.id===cmd.buildingId);
      if(!building || building.underConstruction) break;
      const costMap = { worker:5, warrior:cfg.warriorCost, elite:cfg.eliteCost, elite2:cfg.elite2Cost };
      const cost = costMap[cmd.unitType] || 0;
      if(myGold() < cost) break;

      const timeMap = { worker:BUILD_TIMES.worker, warrior:BUILD_TIMES.warrior, elite:BUILD_TIMES.elite, elite2:BUILD_TIMES.elite };
      const time = timeMap[cmd.unitType] || BUILD_TIMES.worker;

      const elite2FnMap = { makeWizard, makeNecromancer, makeTank };
      const fnMap = {
        worker:  ()=>makeWorker(side, faction, building.x, building.y),
        warrior: ()=>makeWarrior(side, faction, building.x, building.y),
        elite:   ()=>makeElite(side, faction, building.x, building.y),
        elite2:  ()=>elite2FnMap[cfg.elite2Fn](side, faction, building.x, building.y),
      };

      const fn = fnMap[cmd.unitType];
      if(!fn) break;
      const label = cmd.unitType==='worker' ? cfg.workerLabel
        : cmd.unitType==='warrior' ? cfg.warriorLabel
        : cmd.unitType==='elite' ? cfg.eliteLabel
        : cfg.elite2Label;

      if(!queueUnit(building, label, time, fn)) break;
      spendGold(cost);
      console.log('[CMD] train_unit side=',side,'cost=',cost,'rtsGold=',rtsGold,'aiGold=',aiGold);
      updateRtsHUD();
      rtsSetLog(`${label} queued (${building.queue.length}/${QUEUE_MAX})`);
      break;
    }

    case 'build_structure': {
      if(cmd.cost) spendGold(cmd.cost);
      if(cmd.buildType==='base'){
        const nb={id:nextId(),type:'base',side,x:cmd.x,y:cmd.y,hp:100,maxHp:100,w:60,h:80,selected:false,queue:[],trainTimer:0};
        rtsEntities.push(nb);
      } else {
        const worker = rtsEntities.find(e=>e.id===cmd.workerId);
        if(!worker) break;
        worker.buildTarget = { x:cmd.x, y:cmd.y, buildType:cmd.buildType, ghost:null };
        worker.state = 'building';
      }
      break;
    }

    case 'move_units': {
      for(const id of cmd.unitIds){
        const unit = rtsEntities.find(e=>e.id===id);
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
        const unit = rtsEntities.find(e=>e.id===id);
        if(!unit || unit.side!==side || unit.type!=='warrior') continue;
        const target = rtsEntities.find(e=>e.id===cmd.targetId);
        if(!target) continue;
        unit.forcedTarget = target;
        unit.moveTarget = null;
        unit.state = 'march';
      }
      break;
    }

    case 'attack_all': {
      let count = 0;
      for(const e of rtsEntities){
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
