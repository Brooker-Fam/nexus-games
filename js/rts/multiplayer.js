// ── RTS MULTIPLAYER (PeerJS WebRTC) ──
// Host creates game → gets room code
// Guest joins with code → replaces AI opponent

let mpPeer = null;
let mpConn = null;
let mpIsHost = false;
let mpConnected = false;
let mpRemoteFaction = null;

function mpInit(){
  if(mpPeer) mpPeer.destroy();
  mpPeer = new Peer();
  return new Promise((resolve, reject)=>{
    mpPeer.on('open', id=>resolve(id));
    mpPeer.on('error', err=>reject(err));
  });
}

// HOST: create game and wait for guest
async function mpHost(){
  const id = await mpInit();
  mpIsHost = true;
  // Generate a short room code from the peer ID
  const code = id.slice(-6).toUpperCase();
  mpPeer.on('connection', conn=>{
    mpConn = conn;
    setupConnection(conn);
  });
  return code;
}

// GUEST: join game with room code
function mpJoin(hostId){
  return mpInit().then(()=>{
    return new Promise((resolve, reject)=>{
      mpConn = mpPeer.connect(hostId, { reliable:true });
      mpConn.on('open', ()=>{
        mpIsHost = false;
        setupConnection(mpConn);
        resolve();
      });
      mpConn.on('error', reject);
      setTimeout(()=>reject(new Error('Connection timeout')), 10000);
    });
  });
}

function setupConnection(conn){
  mpConnected = true;
  conn.on('data', msg=>{
    if(msg.type==='faction_pick'){
      mpRemoteFaction = msg.faction;
      checkBothReady();
    } else if(msg.type==='command'){
      // Remote player's command — execute as enemy
      executeRemoteCommand(msg.cmd);
    } else if(msg.type==='start_game'){
      mpStartGame(msg);
    }
  });
  conn.on('close', ()=>{
    mpConnected = false;
    rtsSetLog('Opponent disconnected.');
  });
}

function mpSend(msg){
  if(mpConn && mpConn.open) mpConn.send(msg);
}

// Send a command to the remote player
function mpSendCommand(cmd){
  mpSend({ type:'command', cmd });
}

// Execute a remote player's command (they control the enemy side)
function executeRemoteCommand(cmd){
  const cfg = FACTION_CFG[rtsEnemyFaction];
  switch(cmd.type){
    case 'train_unit': {
      const building = rtsEntities.find(e=>e.id===cmd.buildingId);
      if(!building || building.underConstruction) break;
      const costMap = { worker:5, warrior:cfg.warriorCost, elite:cfg.eliteCost, elite2:cfg.elite2Cost };
      const cost = costMap[cmd.unitType] || 0;
      if(aiGold < cost) break;
      const timeMap = { worker:BUILD_TIMES.worker, warrior:BUILD_TIMES.warrior, elite:BUILD_TIMES.elite, elite2:BUILD_TIMES.elite };
      const elite2FnMap = { makeWizard, makeNecromancer, makeTank };
      const fnMap = {
        worker:  ()=>makeWorker('enemy', rtsEnemyFaction, building.x, building.y),
        warrior: ()=>makeWarrior('enemy', rtsEnemyFaction, building.x, building.y),
        elite:   ()=>makeElite('enemy', rtsEnemyFaction, building.x, building.y),
        elite2:  ()=>elite2FnMap[cfg.elite2Fn]('enemy', rtsEnemyFaction, building.x, building.y),
      };
      const fn = fnMap[cmd.unitType]; if(!fn) break;
      const labelMap = { worker:cfg.workerLabel, warrior:cfg.warriorLabel, elite:cfg.eliteLabel, elite2:cfg.elite2Label };
      if(!queueUnit(building, labelMap[cmd.unitType], timeMap[cmd.unitType], fn)) break;
      aiGold -= cost;
      break;
    }
    case 'build_structure': {
      const worker = rtsEntities.find(e=>e.id===cmd.workerId);
      if(!worker) break;
      worker.buildTarget = { x:cmd.x, y:cmd.y, buildType:cmd.buildType, ghost:null };
      worker.state = 'building';
      break;
    }
    case 'move_units': {
      for(const id of cmd.unitIds){
        const unit = rtsEntities.find(e=>e.id===id);
        if(!unit || unit.side!=='enemy') continue;
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
        if(!unit || unit.side!=='enemy' || unit.type!=='warrior') continue;
        const target = rtsEntities.find(e=>e.id===cmd.targetId);
        if(!target) continue;
        unit.forcedTarget = target;
        unit.moveTarget = null;
        unit.state = 'march';
      }
      break;
    }
    case 'attack_all': {
      for(const e of rtsEntities){
        if(e.type==='warrior' && e.side==='enemy' && e.state==='idle') e.state = 'march';
      }
      break;
    }
  }
}

let mpLocalFaction = null;
function mpPickFaction(faction){
  mpLocalFaction = faction;
  mpSend({ type:'faction_pick', faction });
  checkBothReady();
}

function checkBothReady(){
  if(!mpLocalFaction || !mpRemoteFaction) return;
  if(mpIsHost){
    // Host starts the game for both
    mpSend({ type:'start_game', hostFaction:mpLocalFaction, guestFaction:mpRemoteFaction });
    mpStartGame({ hostFaction:mpLocalFaction, guestFaction:mpRemoteFaction });
  }
}

function mpStartGame(msg){
  const myFaction = mpIsHost ? msg.hostFaction : msg.guestFaction;
  const theirFaction = mpIsHost ? msg.guestFaction : msg.hostFaction;
  rtsPlayerFaction = myFaction;
  rtsEnemyFaction = theirFaction;
  // Disable AI in multiplayer
  window._mpMultiplayer = true;
  document.getElementById('dso-select').style.display='none';
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-game').style.display='block';
  document.getElementById('rts-gameover-overlay').style.display='none';
  startRTS(myFaction);
}

function mpDisconnect(){
  if(mpConn){ mpConn.close(); mpConn=null; }
  if(mpPeer){ mpPeer.destroy(); mpPeer=null; }
  mpConnected = false;
  mpIsHost = false;
  mpLocalFaction = null;
  mpRemoteFaction = null;
  window._mpMultiplayer = false;
}
