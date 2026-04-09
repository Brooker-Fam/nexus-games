// ── LOCKSTEP MULTIPLAYER ──
// Both clients run identical simulation. Only commands are synced.

const TURN_LENGTH = 6;  // ticks per turn (~100ms at 60fps)
const INPUT_DELAY = 2;  // turns of input delay (~200ms)

let lsTurn = 0, lsTickInTurn = 0;
const lsTurnData = {};

function lsInit(){
  lsTurn = 0; lsTickInTurn = 0;
  for(const k in lsTurnData) delete lsTurnData[k];
}

function _ensureTurn(t){
  if(!lsTurnData[t]) lsTurnData[t] = { local:[], remote:[], localReady:false, remoteReady:false };
  return lsTurnData[t];
}

function lsBufferCommand(cmd){
  _ensureTurn(lsTurn + INPUT_DELAY).local.push(cmd);
}

function lsSendTurn(turnNum){
  const td = _ensureTurn(turnNum);
  td.localReady = true;
  mpSend({ t:'turn', n:turnNum, cmds:td.local });
}

function lsReceiveTurn(turnNum, cmds){
  const td = _ensureTurn(turnNum);
  td.remote = cmds;
  td.remoteReady = true;
}

function lsCanAdvance(){
  if(!window._mpMultiplayer) return true;
  const td = lsTurnData[lsTurn];
  if(!td) return true;
  return td.localReady && td.remoteReady;
}

function lsExecuteTurn(){
  const td = lsTurnData[lsTurn];
  if(!td) return;
  for(const cmd of td.local){
    cmd.side = mpIsHost ? 'player' : 'enemy';
    rtsCommandQueue.push(cmd);
  }
  for(const cmd of td.remote){
    cmd.side = mpIsHost ? 'enemy' : 'player';
    rtsCommandQueue.push(cmd);
  }
  delete lsTurnData[lsTurn - 4];
}

// Checksum for desync detection (log-only)
function lsChecksum(){
  let h = 0;
  for(const e of S.entities){
    h = (h*31 + (e.x|0)) | 0;
    h = (h*31 + (e.y|0)) | 0;
    h = (h*31 + (e.hp|0)) | 0;
    h = (h*31 + e.id) | 0;
  }
  h = (h*31 + (S.gold.player|0) + (S.gold.enemy|0)) | 0;
  return h;
}

function lsTick(){
  lsTickInTurn++;
  if(lsTickInTurn >= TURN_LENGTH){
    lsSendTurn(lsTurn + INPUT_DELAY);
    lsTurn++;
    lsTickInTurn = 0;
    lsExecuteTurn();
    // Early diagnostic: check at turns 2, 5, 10 to find when desync starts
    if(lsTurn <= 10 && (lsTurn===2||lsTurn===5||lsTurn===10)){
      const diag = {
        frame: S.frame,
        entities: S.entities.length,
        goldP: S.gold.player|0,
        goldE: S.gold.enemy|0,
        hash: lsChecksum(),
        positions: S.entities.slice(0,8).map(e=>({id:e.id,x:e.x.toFixed(4),y:e.y.toFixed(4),hp:e.hp,st:e.state})),
      };
      mpSend({ t:'diag', n:lsTurn, d:diag });
      console.log('[DIAG] Turn',lsTurn, JSON.stringify(diag));
    }
    if(lsTurn % 60 === 0) mpSend({ t:'chk', n:lsTurn, h:lsChecksum() });
  }
}
