// ── RTS MULTIPLAYER (PeerJS WebRTC) ──
let mpPeer=null, mpConn=null, mpIsHost=false, mpConnected=false;
let mpLocalFaction=null, mpRemoteFaction=null;
let mpOnConnect=null; // callback when guest connects to host

// Returns which side this client controls ('player' for host/singleplayer, 'enemy' for guest)
function mySide(){ return (mpConnected && !mpIsHost) ? 'enemy' : 'player'; }
function enemySide(){ return mySide()==='player' ? 'enemy' : 'player'; }
function myGold(){ return mySide()==='player' ? rtsGold : aiGold; }
function spendGold(amount){ if(mySide()==='player') rtsGold-=amount; else aiGold-=amount; }
const MP_PREFIX='nexus-dso-';

function mpCode(){ return Math.random().toString(36).slice(2,6).toUpperCase(); }

function mpCreatePeer(id){
  if(mpPeer) mpPeer.destroy();
  mpPeer=new Peer(MP_PREFIX+id);
  return new Promise((res,rej)=>{
    mpPeer.on('open',res);
    mpPeer.on('error',rej);
  });
}

async function mpHost(){
  const code=mpCode();
  await mpCreatePeer(code);
  mpIsHost=true;
  mpPeer.on('connection',c=>{ mpConn=c; mpWire(c); if(mpOnConnect) mpOnConnect(); });
  return code;
}

async function mpJoin(code){
  await mpCreatePeer(code+'-g');
  mpConn=mpPeer.connect(MP_PREFIX+code,{reliable:true});
  return new Promise((res,rej)=>{
    mpConn.on('open',()=>{ mpIsHost=false; mpWire(mpConn); res(); });
    mpConn.on('error',rej);
    setTimeout(()=>rej(new Error('Timeout')),8000);
  });
}

function mpWire(c){
  mpConnected=true;
  console.log('[MP] Connected! isHost=', mpIsHost);
  c.on('data',msg=>{
    console.log('[MP] Received:', msg.t, msg);
    if(msg.t==='faction') { mpRemoteFaction=msg.f; mpCheckStart(); }
    else if(msg.t==='cmd') executeRemoteCommand(msg.c);
    else if(msg.t==='go')  mpStartGame(msg);
  });
  c.on('close',()=>{ console.log('[MP] Connection CLOSED'); mpConnected=false; rtsSetLog('Opponent disconnected.'); });
  c.on('error',err=>{ console.log('[MP] Connection ERROR:', err); });
}

function mpSend(msg){ if(mpConn&&mpConn.open) mpConn.send(msg); }
function mpSendCommand(cmd){ mpSend({t:'cmd',c:cmd}); }

function mpPickFaction(f){
  mpLocalFaction=f;
  mpSend({t:'faction',f});
  mpCheckStart();
}

function mpCheckStart(){
  if(!mpLocalFaction||!mpRemoteFaction) return;
  if(mpIsHost){
    const msg={t:'go',hf:mpLocalFaction,gf:mpRemoteFaction};
    mpSend(msg); mpStartGame(msg);
  }
}

function mpStartGame(msg){
  console.log('[MP] Starting game! isHost=', mpIsHost, 'hostFaction=', msg.hf, 'guestFaction=', msg.gf);
  window._mpMultiplayer=true;
  document.getElementById('dso-select').style.display='none';
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-game').style.display='block';
  document.getElementById('rts-gameover-overlay').style.display='none';
  // BOTH clients init identically: host faction = 'player' side, guest faction = 'enemy' side
  rtsPlayerFaction=msg.hf;
  rtsEnemyFaction=msg.gf;
  startRTS(msg.hf);
  // Guest starts camera at enemy base
  if(!mpIsHost){ camX=ENEMY_BASE_X-VW/2; clampCam(); }
}

function executeRemoteCommand(cmd){
  const cfg=FACTION_CFG[rtsEnemyFaction];
  const elite2FnMap={makeWizard,makeNecromancer,makeTank};
  if(cmd.type==='train_unit'){
    const b=rtsEntities.find(e=>e.id===cmd.buildingId);
    if(!b||b.underConstruction) return;
    const costs={worker:5,warrior:cfg.warriorCost,elite:cfg.eliteCost,elite2:cfg.elite2Cost};
    if(aiGold<(costs[cmd.unitType]||0)) return;
    const fns={
      worker:()=>makeWorker('enemy',rtsEnemyFaction,b.x,b.y),
      warrior:()=>makeWarrior('enemy',rtsEnemyFaction,b.x,b.y),
      elite:()=>makeElite('enemy',rtsEnemyFaction,b.x,b.y),
      elite2:()=>elite2FnMap[cfg.elite2Fn]('enemy',rtsEnemyFaction,b.x,b.y),
    };
    const times={worker:BUILD_TIMES.worker,warrior:BUILD_TIMES.warrior,elite:BUILD_TIMES.elite,elite2:BUILD_TIMES.elite};
    const labels={worker:cfg.workerLabel,warrior:cfg.warriorLabel,elite:cfg.eliteLabel,elite2:cfg.elite2Label};
    if(!fns[cmd.unitType]||!queueUnit(b,labels[cmd.unitType],times[cmd.unitType],fns[cmd.unitType])) return;
    aiGold-=costs[cmd.unitType];
  } else if(cmd.type==='build_structure'){
    const w=rtsEntities.find(e=>e.id===cmd.workerId);
    if(w){ w.buildTarget={x:cmd.x,y:cmd.y,buildType:cmd.buildType,ghost:null}; w.state='building'; }
  } else if(cmd.type==='move_units'){
    cmd.unitIds.forEach((id,i)=>{
      const u=rtsEntities.find(e=>e.id===id&&e.side==='enemy');
      if(!u) return;
      u.moveTarget={x:cmd.x+i*20-(cmd.unitIds.length*10),y:cmd.y};
      u.forcedTarget=null; u.state=u.type==='warrior'?'march':'moving';
    });
  } else if(cmd.type==='attack_target'){
    const tgt=rtsEntities.find(e=>e.id===cmd.targetId);
    cmd.unitIds.forEach(id=>{
      const u=rtsEntities.find(e=>e.id===id&&e.side==='enemy'&&e.type==='warrior');
      if(u&&tgt){ u.forcedTarget=tgt; u.moveTarget=null; u.state='march'; }
    });
  } else if(cmd.type==='attack_all'){
    rtsEntities.forEach(e=>{ if(e.type==='warrior'&&e.side==='enemy'&&e.state==='idle') e.state='march'; });
  }
}

function mpDisconnect(){
  if(mpConn){ mpConn.close(); mpConn=null; }
  if(mpPeer){ mpPeer.destroy(); mpPeer=null; }
  mpConnected=false; mpIsHost=false; mpLocalFaction=null; mpRemoteFaction=null;
  window._mpMultiplayer=false;
}
