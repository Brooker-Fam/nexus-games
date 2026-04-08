// ── RTS MULTIPLAYER (PeerJS WebRTC) ──
let mpPeer=null, mpConn=null, mpIsHost=false, mpConnected=false;
let mpLocalFaction=null, mpRemoteFaction=null;
let mpOnConnect=null; // callback when guest connects to host

// Returns which side this client controls ('player' for host/singleplayer, 'enemy' for guest)
function mySide(){ return (window._mpMultiplayer && !mpIsHost) ? 'enemy' : 'player'; }
function myFaction(){ return mySide()==='player' ? rtsPlayerFaction : rtsEnemyFaction; }
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
    else if(msg.t==='cmd') { if(mpIsHost) executeRemoteCommand(msg.c); }
    else if(msg.t==='s') mpApplyState(msg);
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
  // Guest: fix HUD to show their own faction, start camera at their base
  if(!mpIsHost){
    const myCfg=FACTION_CFG[msg.gf];
    const enemyCfg=FACTION_CFG[msg.hf];
    document.getElementById('rts-faction-badge').textContent=msg.gf.toUpperCase()+' ARMADA';
    document.getElementById('rts-faction-badge').style.color=myCfg.color;
    document.getElementById('hud-building-name').textContent=myCfg.buildingName;
    document.getElementById('rts-enemy-faction').textContent=msg.hf.toUpperCase();
    document.getElementById('rts-enemy-faction').style.color=enemyCfg.color;
    rtsSetLog('Click your '+myCfg.buildingName+' to train units!');
    camX=ENEMY_BASE_X-VW/2; clampCam();
  }
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
    if(cmd.cost) aiGold-=cmd.cost;
    if(cmd.buildType==='base'){
      const nb={id:nextId(),type:'base',side:'enemy',x:cmd.x,y:cmd.y,hp:100,maxHp:100,w:60,h:80,selected:false,queue:[],trainTimer:0};
      rtsEntities.push(nb);
    } else if(w){
      w.buildTarget={x:cmd.x,y:cmd.y,buildType:cmd.buildType,ghost:null}; w.state='building';
    }
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

// ── HOST STATE SYNC (delta compression) ──
// Only send entities that changed since last sync, plus removed IDs
const _E_FIELDS=['id','type','side','faction','x','y','hp','maxHp','state','subtype',
  'ranged','aimAngle','frame','underConstruction','buildProgress','buildTime',
  'goldCarry','attackTimer','hammerSwing','isBarracks'];
// Fields that change frequently — only these are checked for deltas
const _E_DELTA=['x','y','hp','state','frame','underConstruction','buildProgress',
  'goldCarry','attackTimer','hammerSwing','aimAngle'];

let _lastSnap={}; // id -> last sent array
let _lastIds=new Set();
let _fullSyncCounter=0;

function _encodeEntity(e){
  const a=_E_FIELDS.map(f=> f==='x'||f==='y'||f==='hp' ? Math.round(e[f]||0) : e[f]);
  if(e.queue&&e.queue.length) a.push(e.queue.map(q=>[q.label,q.time||0]), e.trainTimer||0);
  return a;
}

function mpSendState(){
  _fullSyncCounter++;
  const doFull=(_fullSyncCounter%30===0); // full sync every 30 sends (~3s)

  const curIds=new Set(rtsEntities.map(e=>e.id));
  // Find removed entities
  const removed=[];
  for(const id of _lastIds){ if(!curIds.has(id)) removed.push(id); }

  let ents;
  if(doFull){
    // Full sync — send everything
    ents=rtsEntities.map(e=>_encodeEntity(e));
    _lastSnap={};
    for(const e of rtsEntities) _lastSnap[e.id]=_encodeEntity(e);
  } else {
    // Delta — only changed entities
    ents=[];
    for(const e of rtsEntities){
      const enc=_encodeEntity(e);
      const prev=_lastSnap[e.id];
      if(!prev){
        ents.push(enc); // new entity
      } else {
        let changed=false;
        for(const f of _E_DELTA){
          const i=_E_FIELDS.indexOf(f);
          if(i>=0 && enc[i]!==prev[i]){ changed=true; break; }
        }
        // Also check queue length change
        if(enc.length!==prev.length) changed=true;
        if(changed) ents.push(enc);
      }
      _lastSnap[e.id]=enc;
    }
  }
  _lastIds=curIds;
  // Clean up removed from snap
  for(const id of removed) delete _lastSnap[id];

  const projs=rtsProjectiles.map(p=>[Math.round(p.x),Math.round(p.y),p.color,p.type,p.side]);
  mpSend({t:'s', e:ents, p:projs, r:removed.length?removed:undefined,
    g:Math.round(rtsGold), a:Math.round(aiGold),
    bh:rtsBaseHP, eh:rtsEnemyBaseHP, f:rtsFrame, go:rtsGameOver?1:0,
    full:doFull?1:undefined});
}

function _applyEntityArray(a){
  const id=a[0];
  let local=rtsEntities.find(e=>e.id===id);
  if(!local){ local={id}; rtsEntities.push(local); }
  for(let i=0;i<_E_FIELDS.length;i++) local[_E_FIELDS[i]]=a[i];
  if(a.length>_E_FIELDS.length){
    local.queue=(a[_E_FIELDS.length]||[]).map(q=>Array.isArray(q)?{label:q[0],time:q[1]}:{label:q,time:0});
    local.trainTimer=a[_E_FIELDS.length+1]||0;
  } else if(!local.queue){ local.queue=[]; }
}

function mpApplyState(msg){
  rtsGold=msg.g; aiGold=msg.a;
  rtsBaseHP=msg.bh; rtsEnemyBaseHP=msg.eh;
  rtsFrame=msg.f; rtsGameOver=!!msg.go;

  if(msg.full){
    // Full sync — replace all entities
    const hostIds=new Set();
    for(const a of msg.e){ _applyEntityArray(a); hostIds.add(a[0]); }
    for(let i=rtsEntities.length-1;i>=0;i--){
      if(!hostIds.has(rtsEntities[i].id)) rtsEntities.splice(i,1);
    }
  } else {
    // Delta — update only changed entities
    for(const a of msg.e) _applyEntityArray(a);
    // Remove explicitly deleted
    if(msg.r) for(const id of msg.r){
      const i=rtsEntities.findIndex(e=>e.id===id);
      if(i>=0) rtsEntities.splice(i,1);
    }
  }

  rtsProjectiles=msg.p.map(a=>({x:a[0],y:a[1],color:a[2],type:a[3],side:a[4],trail:[]}));
  updateRtsHUD();
  if(rtsGameOver){
    const myBaseHP=mySide()==='player'?rtsBaseHP:rtsEnemyBaseHP;
    endRTS(myBaseHP>0);
  }
}

function mpDisconnect(){
  if(mpConn){ mpConn.close(); mpConn=null; }
  if(mpPeer){ mpPeer.destroy(); mpPeer=null; }
  mpConnected=false; mpIsHost=false; mpLocalFaction=null; mpRemoteFaction=null;
  window._mpMultiplayer=false;
}
