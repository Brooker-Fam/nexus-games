// ── HOMESTEAD WARS MULTIPLAYER (PeerJS WebRTC) ──
// Version hash — both clients must match or desync is guaranteed.
// Bump this whenever game logic, costs, stats, or balance changes.
const HW_MP_VERSION = 'v1-hw';

let hwMpPeer=null, hwMpConn=null, hwMpIsHost=false, hwMpConnected=false;
let hwMpLocalFaction=null, hwMpRemoteFaction=null;
let hwMpOnConnect=null;

// Side helpers — used everywhere for multiplayer-aware logic
function hwMySide(){ return (window._hwMpMultiplayer && !hwMpIsHost) ? 'enemy' : 'player'; }
function hwMyFaction(){ return hwMySide()==='player' ? H.playerFaction : H.enemyFaction; }
function hwMyHay(){ return H.hay[hwMySide()]; }

// Unambiguous room codes
const HW_MP_PREFIX='nexus-hw-';
const _HW_MP_CHARS='3479ACDEFGHJKMNPQRTUVWXY';
function hwMpCode(){ let c=''; for(let i=0;i<4;i++) c+=_HW_MP_CHARS[Math.floor(Math.random()*_HW_MP_CHARS.length)]; return c; }

function hwMpCreatePeer(id){
  if(hwMpPeer) hwMpPeer.destroy();
  hwMpPeer=new Peer(HW_MP_PREFIX+id);
  return new Promise((res,rej)=>{
    hwMpPeer.on('open',res);
    hwMpPeer.on('error',rej);
  });
}

async function hwMpHost(){
  const code=hwMpCode();
  await hwMpCreatePeer(code);
  hwMpIsHost=true;
  hwMpPeer.on('connection',c=>{ hwMpConn=c; hwMpWire(c); if(hwMpOnConnect) hwMpOnConnect(); });
  return code;
}

async function hwMpJoin(code){
  await hwMpCreatePeer(code+'-g');
  hwMpConn=hwMpPeer.connect(HW_MP_PREFIX+code,{reliable:true});
  return new Promise((res,rej)=>{
    hwMpConn.on('open',()=>{ hwMpIsHost=false; hwMpWire(hwMpConn); res(); });
    hwMpConn.on('error',rej);
    setTimeout(()=>rej(new Error('Timeout')),8000);
  });
}

function hwMpWire(c){
  hwMpConnected=true;
  c.on('data',msg=>{
    if(msg.t==='faction') {
      hwMpRemoteFaction=msg.f;
      if(msg.ver && msg.ver !== HW_MP_VERSION){
        const status=document.getElementById('hw-mp-status');
        if(status){
          status.className='mp-status error';
          status.textContent='VERSION MISMATCH — both players must refresh (Ctrl+Shift+R)';
        }
        hwSetLog('Version mismatch! Both players need to hard-refresh.');
        console.error('[HW-MP] Version mismatch: local='+HW_MP_VERSION+' remote='+msg.ver);
        return; // block game start
      }
      hwMpCheckStart();
    }
    else if(msg.t==='turn') hwLsReceiveTurn(msg.n, msg.cmds);
    else if(msg.t==='chk'){
      hwLsCompareChecksum(msg.n, msg.h);
    }
    else if(msg.t==='go') hwMpStartGame(msg);
  });
  c.on('close',()=>{ hwMpConnected=false; hwSetLog('Opponent disconnected.'); });
  c.on('error',err=>{ console.log('[HW-MP] Error:', err); });
}

function hwMpSend(msg){ if(hwMpConn&&hwMpConn.open) hwMpConn.send(msg); }
function hwMpSendCommand(cmd){ hwMpSend({t:'cmd',c:cmd}); }

function hwMpPickFaction(f){
  hwMpLocalFaction=f;
  hwMpSend({t:'faction',f,ver:HW_MP_VERSION});
  hwMpCheckStart();
}

function hwMpCheckStart(){
  if(!hwMpLocalFaction||!hwMpRemoteFaction) return;
  if(hwMpIsHost){
    const msg={t:'go',hf:hwMpLocalFaction,gf:hwMpRemoteFaction,ver:HW_MP_VERSION};
    hwMpSend(msg); hwMpStartGame(msg);
  }
}

function hwMpStartGame(msg){
  // Version check on 'go' message (guest side)
  if(msg.ver && msg.ver !== HW_MP_VERSION){
    hwSetLog('Version mismatch! Both players need to hard-refresh (Ctrl+Shift+R).');
    console.error('[HW-MP] Version mismatch on go: local='+HW_MP_VERSION+' remote='+msg.ver);
    return;
  }
  window._hwMpMultiplayer=true;
  document.getElementById('hw-select').style.display='none';
  document.getElementById('hw-reveal').style.display='none';
  document.getElementById('hw-game').style.display='block';
  document.getElementById('hw-gameover-overlay').style.display='none';
  // Both clients init identically
  H.playerFaction=msg.hf;
  H.enemyFaction=msg.gf;
  startHW(msg.hf);
  hwLsInit();
  hwMpStartKeepAlive();
  // Guest: fix HUD for their faction, start camera at their base
  if(!hwMpIsHost){
    const myCfg=HW_FACTIONS[msg.gf];
    document.getElementById('hw-faction-badge').textContent=msg.gf.toUpperCase()+' HERD';
    document.getElementById('hw-faction-badge').style.color=myCfg.color;
    document.getElementById('hw-building-name').textContent=myCfg.buildingName;
    document.getElementById('hw-enemy-faction').textContent=msg.hf.toUpperCase();
    document.getElementById('hw-enemy-faction').style.color=HW_FACTIONS[msg.hf].color;
    hwSetLog('Click your '+myCfg.buildingName+' to train units!');
    H.camX=HW_ENEMY_BASE_X-HW_VW/2; hwClampCam();
  }
}

function hwMpDisconnect(){
  hwMpStopKeepAlive();
  if(hwMpConn){ hwMpConn.close(); hwMpConn=null; }
  if(hwMpPeer){ hwMpPeer.destroy(); hwMpPeer=null; }
  hwMpConnected=false; hwMpIsHost=false; hwMpLocalFaction=null; hwMpRemoteFaction=null;
  window._hwMpMultiplayer=false;
}
