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
  // Check the NEXT turn that will be executed at the upcoming boundary.
  // lsTurn was already executed; lsTurn+1 is what we need data for.
  const nextExecTurn = lsTurn + 1;
  const td = lsTurnData[nextExecTurn];
  if(!td) return true;
  return td.localReady && td.remoteReady;
}

function lsExecuteTurn(){
  const td = lsTurnData[lsTurn];
  if(!td) return;
  // Both clients must process commands in the same order (player first).
  // Host has local=player, remote=enemy; Guest has local=enemy, remote=player.
  const allCmds = [];
  for(const cmd of td.local){
    cmd.side = mpIsHost ? 'player' : 'enemy';
    allCmds.push(cmd);
  }
  for(const cmd of td.remote){
    cmd.side = mpIsHost ? 'enemy' : 'player';
    allCmds.push(cmd);
  }
  allCmds.sort((a, b) => (a.side === 'player' ? 0 : 1) - (b.side === 'player' ? 0 : 1));
  for(const cmd of allCmds) rtsCommandQueue.push(cmd);
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
    if(lsTurn % 60 === 0) mpSend({ t:'chk', n:lsTurn, h:lsChecksum() });
  }
}
