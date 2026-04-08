// ── RTS MULTIPLAYER (PeerJS WebRTC) ──
let mpPeer=null, mpConn=null, mpIsHost=false, mpConnected=false;
let mpLocalFaction=null, mpRemoteFaction=null;
let mpOnConnect=null;

// Side helpers — used everywhere for multiplayer-aware logic
function mySide(){ return (window._mpMultiplayer && !mpIsHost) ? 'enemy' : 'player'; }
function myFaction(){ return mySide()==='player' ? S.playerFaction : S.enemyFaction; }
function myGold(){ return S.gold[mySide()]; }

// Unambiguous room codes
const MP_PREFIX='nexus-dso-';
const _MP_CHARS='3479ACDEFGHJKMNPQRTUVWXY';
function mpCode(){ let c=''; for(let i=0;i<4;i++) c+=_MP_CHARS[Math.floor(Math.random()*_MP_CHARS.length)]; return c; }

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
  c.on('data',msg=>{
    if(msg.t==='faction') { mpRemoteFaction=msg.f; mpCheckStart(); }
    else if(msg.t==='cmd' && mpIsHost){
      // Host receives guest command — stamp side and queue for execution
      msg.c.side = 'enemy';
      rtsCommandQueue.push(msg.c);
    }
    else if(msg.t==='s') mpApplyState(msg);
    else if(msg.t==='go') mpStartGame(msg);
  });
  c.on('close',()=>{ mpConnected=false; rtsSetLog('Opponent disconnected.'); });
  c.on('error',err=>{ console.log('[MP] Error:', err); });
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
  window._mpMultiplayer=true;
  document.getElementById('dso-select').style.display='none';
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-game').style.display='block';
  document.getElementById('rts-gameover-overlay').style.display='none';
  // Both clients init identically
  S.playerFaction=msg.hf;
  S.enemyFaction=msg.gf;
  startRTS(msg.hf);
  _rebuildEntMap();
  // Guest: fix HUD for their faction, start camera at their base
  if(!mpIsHost){
    const myCfg=FACTION_CFG[msg.gf];
    document.getElementById('rts-faction-badge').textContent=msg.gf.toUpperCase()+' ARMADA';
    document.getElementById('rts-faction-badge').style.color=myCfg.color;
    document.getElementById('hud-building-name').textContent=myCfg.buildingName;
    document.getElementById('rts-enemy-faction').textContent=msg.hf.toUpperCase();
    document.getElementById('rts-enemy-faction').style.color=FACTION_CFG[msg.hf].color;
    rtsSetLog('Click your '+myCfg.buildingName+' to train units!');
    S.camX=ENEMY_BASE_X-VW/2; clampCam();
  }
}

// ── HOST STATE SYNC (delta compression) ──
const _E_FIELDS=['id','type','side','faction','x','y','hp','maxHp','state','subtype',
  'ranged','aimAngle','frame','underConstruction','buildProgress','buildTime',
  'goldCarry','attackTimer','hammerSwing','isBarracks'];
const _E_DELTA=['x','y','hp','state','frame','underConstruction','buildProgress',
  'goldCarry','attackTimer','hammerSwing','aimAngle'];

let _lastSnap={}, _lastIds=new Set(), _fullSyncCounter=0;

function _encodeEntity(e){
  const a=_E_FIELDS.map(f=> f==='x'||f==='y'||f==='hp' ? Math.round(e[f]||0) : e[f]);
  if(e.queue&&e.queue.length) a.push(e.queue.map(q=>[q.label,q.time||0]), e.trainTimer||0);
  return a;
}

function mpSendState(){
  _fullSyncCounter++;
  const doFull=(_fullSyncCounter%30===0);
  const curIds=new Set(S.entities.map(e=>e.id));
  const removed=[];
  for(const id of _lastIds){ if(!curIds.has(id)) removed.push(id); }

  let ents;
  if(doFull){
    ents=S.entities.map(e=>_encodeEntity(e));
    _lastSnap={};
    for(const e of S.entities) _lastSnap[e.id]=_encodeEntity(e);
  } else {
    ents=[];
    for(const e of S.entities){
      const enc=_encodeEntity(e);
      const prev=_lastSnap[e.id];
      if(!prev){ ents.push(enc); }
      else {
        let changed=false;
        for(const f of _E_DELTA){
          const i=_E_FIELDS.indexOf(f);
          if(i>=0 && enc[i]!==prev[i]){ changed=true; break; }
        }
        if(enc.length!==prev.length) changed=true;
        if(changed) ents.push(enc);
      }
      _lastSnap[e.id]=enc;
    }
  }
  _lastIds=curIds;
  for(const id of removed) delete _lastSnap[id];

  const projs=S.projectiles.map(p=>[Math.round(p.x),Math.round(p.y),p.color,p.type,p.side]);
  mpSend({t:'s', e:ents, p:projs, r:removed.length?removed:undefined,
    g:{p:Math.round(S.gold.player),e:Math.round(S.gold.enemy)},
    bh:S.baseHP, eh:S.enemyBaseHP, f:S.frame, go:S.gameOver?1:0,
    full:doFull?1:undefined});
}

// ── GUEST STATE RECEIVER ──
let _entMap=new Map();
function _rebuildEntMap(){ _entMap.clear(); for(const e of S.entities) _entMap.set(e.id,e); }

function _applyEntityArray(a){
  const id=a[0];
  let local=_entMap.get(id);
  if(!local){ local={id}; S.entities.push(local); _entMap.set(id,local); }
  for(let i=0;i<_E_FIELDS.length;i++) local[_E_FIELDS[i]]=a[i];
  if(a.length>_E_FIELDS.length){
    local.queue=(a[_E_FIELDS.length]||[]).map(q=>Array.isArray(q)?{label:q[0],time:q[1]}:{label:q,time:0});
    local.trainTimer=a[_E_FIELDS.length+1]||0;
  } else if(!local.queue){ local.queue=[]; }
}

function mpApplyState(msg){
  S.gold.player=msg.g.p; S.gold.enemy=msg.g.e;
  S.baseHP=msg.bh; S.enemyBaseHP=msg.eh;
  S.frame=msg.f; S.gameOver=!!msg.go;

  if(msg.full){
    const hostIds=new Set();
    for(const a of msg.e){ _applyEntityArray(a); hostIds.add(a[0]); }
    for(let i=S.entities.length-1;i>=0;i--){
      if(!hostIds.has(S.entities[i].id)){ _entMap.delete(S.entities[i].id); S.entities.splice(i,1); }
    }
  } else {
    for(const a of msg.e) _applyEntityArray(a);
    if(msg.r) for(const id of msg.r){
      const i=S.entities.findIndex(e=>e.id===id);
      if(i>=0){ _entMap.delete(id); S.entities.splice(i,1); }
    }
  }

  S.projectiles=msg.p.map(a=>({x:a[0],y:a[1],color:a[2],type:a[3],side:a[4],trail:[]}));
  updateRtsHUD();
  if(S.gameOver){
    const myBaseHP=mySide()==='player'?S.baseHP:S.enemyBaseHP;
    endRTS(myBaseHP>0);
  }
}

function mpDisconnect(){
  if(mpConn){ mpConn.close(); mpConn=null; }
  if(mpPeer){ mpPeer.destroy(); mpPeer=null; }
  mpConnected=false; mpIsHost=false; mpLocalFaction=null; mpRemoteFaction=null;
  window._mpMultiplayer=false;
}
