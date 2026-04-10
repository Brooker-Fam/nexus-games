// ── HOMESTEAD WARS LOCKSTEP MULTIPLAYER ──
// Both clients run identical simulation. Only commands are synced.

const HW_TURN_LENGTH = 6;  // ticks per turn (~100ms at 60fps)
const HW_INPUT_DELAY = 2;  // turns of input delay (~200ms)

let hwLsTurn = 0, hwLsTickInTurn = 0;
const hwLsTurnData = {};
const _hwLsChecksums = {}; // stored checksums keyed by turn number

const HW_TARGET_MS = 1000/60;

function hwLsInit(){
  hwLsTurn = 0; hwLsTickInTurn = 0;
  for(const k in hwLsTurnData) delete hwLsTurnData[k];
  for(const k in _hwLsChecksums) delete _hwLsChecksums[k];
}

function _hwEnsureTurn(t){
  if(!hwLsTurnData[t]) hwLsTurnData[t] = { local:[], remote:[], localReady:false, remoteReady:false };
  return hwLsTurnData[t];
}

function hwLsBufferCommand(cmd){
  _hwEnsureTurn(hwLsTurn + HW_INPUT_DELAY).local.push(cmd);
}

function hwLsSendTurn(turnNum){
  const td = _hwEnsureTurn(turnNum);
  td.localReady = true;
  hwMpSend({ t:'turn', n:turnNum, cmds:td.local });
}

function hwLsReceiveTurn(turnNum, cmds){
  const td = _hwEnsureTurn(turnNum);
  td.remote = cmds;
  td.remoteReady = true;
}

function hwLsCanAdvance(){
  if(!window._hwMpMultiplayer) return true;
  // Only block right before the turn boundary (tick 5 of 6).
  // During ticks 0-4, let the game run freely — no blocking.
  // This prevents the stutter of freezing for an entire turn.
  if(hwLsTickInTurn < HW_TURN_LENGTH - 1) return true;
  // About to hit the boundary — ensure next turn's data is ready
  const nextExecTurn = hwLsTurn + 1;
  const td = hwLsTurnData[nextExecTurn];
  if(!td) return true;
  return td.localReady && td.remoteReady;
}

function hwLsExecuteTurn(){
  const td = hwLsTurnData[hwLsTurn];
  if(!td) return;
  // Both clients must process commands in the same order (player first).
  // Host has local=player, remote=enemy; Guest has local=enemy, remote=player.
  const allCmds = [];
  for(const cmd of td.local){
    cmd.side = hwMpIsHost ? 'player' : 'enemy';
    allCmds.push(cmd);
  }
  for(const cmd of td.remote){
    cmd.side = hwMpIsHost ? 'enemy' : 'player';
    allCmds.push(cmd);
  }
  allCmds.sort((a, b) => (a.side === 'player' ? 0 : 1) - (b.side === 'player' ? 0 : 1));
  for(const cmd of allCmds) hwCommandQueue.push(cmd);
  delete hwLsTurnData[hwLsTurn - 4];
}

// Checksum for desync detection
function hwLsChecksum(){
  let h = 0;
  for(const e of H.entities){
    h = (h*31 + (e.x|0)) | 0;
    h = (h*31 + (e.y|0)) | 0;
    h = (h*31 + (e.hp|0)) | 0;
    h = (h*31 + e.id) | 0;
  }
  h = (h*31 + (H.hay.player|0) + (H.hay.enemy|0)) | 0;
  return h;
}

// Compare a remote checksum against our STORED checksum for the same turn
function hwLsCompareChecksum(turnNum, remoteHash){
  const localHash = _hwLsChecksums[turnNum];
  if(localHash === undefined) return; // haven't reached that turn yet
  if(localHash !== remoteHash){
    console.warn('[HW-DESYNC] Turn', turnNum, 'local=', localHash, 'remote=', remoteHash);
  }
  delete _hwLsChecksums[turnNum]; // clean up
}

function hwLsTick(){
  hwLsTickInTurn++;
  if(hwLsTickInTurn >= HW_TURN_LENGTH){
    hwLsSendTurn(hwLsTurn + HW_INPUT_DELAY);
    hwLsTurn++;
    hwLsTickInTurn = 0;
    hwLsExecuteTurn();
    // Compute and store checksum at this exact simulation point,
    // then send it. The receiver compares against their stored value
    // for the same turn — not a live recomputation.
    if(hwLsTurn % 60 === 0){
      const h = hwLsChecksum();
      _hwLsChecksums[hwLsTurn] = h;
      hwMpSend({ t:'chk', n:hwLsTurn, h:h });
    }
  }
}
