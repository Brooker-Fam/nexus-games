// ── RTS MULTIPLAYER (PeerJS WebRTC) ──
// Version hash — both clients must match or desync is guaranteed.
// Bump this whenever game logic, costs, stats, or balance changes.
const MP_VERSION = 'v10-random-maps';

let mpPeer=null, mpConn=null, mpIsHost=false, mpConnected=false;
let mpLocalFaction=null, mpRemoteFaction=null;
let mpOnConnect=null;

// Side helpers — used everywhere for multiplayer-aware logic
function mySide(){ return (window._mpMultiplayer && !mpIsHost) ? 'enemy' : 'player'; }
function myFaction(){ return mySide()==='player' ? S.playerFaction : S.enemyFaction; }
function myGold(){ return S.gold[mySide()]; }
function myOil(){ return S.oil[mySide()]||0; }

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
    if(msg.t==='faction') {
      mpRemoteFaction=msg.f;
      if(msg.ver && msg.ver !== MP_VERSION){
        const status=document.getElementById('mp-status');
        if(status){
          status.className='mp-status error';
          status.textContent='VERSION MISMATCH — both players must refresh (Ctrl+Shift+R)';
        }
        rtsSetLog('Version mismatch! Both players need to hard-refresh.');
        console.error('[MP] Version mismatch: local='+MP_VERSION+' remote='+msg.ver);
        return; // block game start
      }
      mpCheckStart();
    }
    else if(msg.t==='turn') lsReceiveTurn(msg.n, msg.cmds);
    else if(msg.t==='chk'){
      lsCompareChecksum(msg.n, msg.h);
    }
    else if(msg.t==='go') mpStartGame(msg);
  });
  c.on('close',()=>{ mpConnected=false; rtsSetLog('Opponent disconnected.'); });
  c.on('error',err=>{ console.log('[MP] Error:', err); });
}

function mpSend(msg){ if(mpConn&&mpConn.open) mpConn.send(msg); }
function mpSendCommand(cmd){ mpSend({t:'cmd',c:cmd}); }

function mpPickFaction(f){
  mpLocalFaction=f;
  mpSend({t:'faction',f,ver:MP_VERSION});
  mpCheckStart();
}

function mpCheckStart(){
  if(!mpLocalFaction||!mpRemoteFaction) return;
  if(mpIsHost){
    const msg={t:'go',hf:mpLocalFaction,gf:mpRemoteFaction,seed:(Date.now()^(Math.random()*0x7fffffff))|0,ver:MP_VERSION};
    mpSend(msg); mpStartGame(msg);
  }
}

function mpStartGame(msg){
  // Version check on 'go' message (guest side)
  if(msg.ver && msg.ver !== MP_VERSION){
    rtsSetLog('Version mismatch! Both players need to hard-refresh (Ctrl+Shift+R).');
    console.error('[MP] Version mismatch on go: local='+MP_VERSION+' remote='+msg.ver);
    return;
  }
  window._mpMultiplayer=true;
  document.getElementById('dso-select').style.display='none';
  document.getElementById('dso-reveal').style.display='none';
  document.getElementById('dso-game').style.display='flex';
  document.getElementById('rts-gameover-overlay').style.display='none';
  // Both clients init identically
  S.playerFaction=msg.hf;
  S.enemyFaction=msg.gf;
  startRTS(msg.hf,msg.gf,msg.seed);
  lsInit();
  mpStartKeepAlive();
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

function mpDisconnect(){
  mpStopKeepAlive();
  if(mpConn){ mpConn.close(); mpConn=null; }
  if(mpPeer){ mpPeer.destroy(); mpPeer=null; }
  mpConnected=false; mpIsHost=false; mpLocalFaction=null; mpRemoteFaction=null;
  window._mpMultiplayer=false;
}

//# sourceMappingURL=multiplayer.js.map
