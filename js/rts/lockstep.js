// ── LOCKSTEP MULTIPLAYER ──
// Both clients run identical simulation. Only commands are synced.

const TURN_LENGTH = 6;  // ticks per turn (~100ms at 60fps)
const INPUT_DELAY = 2;  // turns of input delay (~200ms)

let lsTurn = 0, lsTickInTurn = 0;
const lsTurnData = {};
const _lsChecksums = {}; // stored checksums keyed by turn number

function lsInit(){
  lsTurn = 0; lsTickInTurn = 0;
  for(const k in lsTurnData) delete lsTurnData[k];
  for(const k in _lsChecksums) delete _lsChecksums[k];
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
  // Only block right before the turn boundary (tick 5 of 6).
  // During ticks 0-4, let the game run freely — no blocking.
  // This prevents the stutter of freezing for an entire turn.
  if(lsTickInTurn < TURN_LENGTH - 1) return true;
  // About to hit the boundary — ensure next turn's data is ready
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

// Checksum for desync detection
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

// Compare a remote checksum against our STORED checksum for the same turn
function lsCompareChecksum(turnNum, remoteHash){
  const localHash = _lsChecksums[turnNum];
  if(localHash === undefined) return; // haven't reached that turn yet
  if(localHash !== remoteHash){
    console.warn('[DESYNC] Turn', turnNum, 'local=', localHash, 'remote=', remoteHash);
  }
  delete _lsChecksums[turnNum]; // clean up
}

function lsTick(){
  lsTickInTurn++;
  if(lsTickInTurn >= TURN_LENGTH){
    lsSendTurn(lsTurn + INPUT_DELAY);
    lsTurn++;
    lsTickInTurn = 0;
    lsExecuteTurn();
    // Compute and store checksum at this exact simulation point,
    // then send it. The receiver compares against their stored value
    // for the same turn — not a live recomputation.
    if(lsTurn % 60 === 0){
      const h = lsChecksum();
      _lsChecksums[lsTurn] = h;
      mpSend({ t:'chk', n:lsTurn, h:h });
    }
  }
}

//# sourceMappingURL=lockstep.js.map
