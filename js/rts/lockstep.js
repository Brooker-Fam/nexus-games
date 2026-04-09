// ── LOCKSTEP MULTIPLAYER ──
// Both clients run identical simulation. Only commands are synced.

const TURN_LENGTH = 6;  // ticks per turn (~100ms at 60fps)
const INPUT_DELAY = 2;  // turns of input delay (~200ms)
const DESYNC_TOLERANCE = 2; // consecutive mismatches before warning

let lsTurn = 0, lsTickInTurn = 0;
let lsDesyncCount = 0;
const lsTurnData = {};

function lsInit(){
  lsTurn = 0; lsTickInTurn = 0; lsDesyncCount = 0;
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

// ── CHECKSUM ──
// Hashes all state-affecting fields for desync detection.
// Must match identically on both clients every check.

const _STATE_CODES = { idle:1, march:2, attack:3, mining:4, returning:5, building:6, moving:7 };

function lsChecksum(){
  let h = 0;
  for(const e of S.entities){
    // Position, health, identity
    h = (h*31 + (e.x|0)) | 0;
    h = (h*31 + (e.y|0)) | 0;
    h = (h*31 + (e.hp|0)) | 0;
    h = (h*31 + e.id) | 0;
    // Unit state
    h = (h*31 + (_STATE_CODES[e.state]||0)) | 0;
    // Timers that affect game logic
    h = (h*31 + (e.attackTimer||0)) | 0;
    h = (h*31 + (e.cooldown||0)) | 0;
    h = (h*31 + (e.buildProgress||0)) | 0;
    h = (h*31 + (e.trainTimer||0)) | 0;
    h = (h*31 + (e.mineTimer||0)) | 0;
    h = (h*31 + (e.reviveTimer||0)) | 0;
    // Construction flag
    h = (h*31 + (e.underConstruction?1:0)) | 0;
    // Queue length (full queue content is overkill)
    h = (h*31 + (e.queue?e.queue.length:0)) | 0;
  }
  // Gold
  h = (h*31 + (S.gold.player|0)) | 0;
  h = (h*31 + (S.gold.enemy|0)) | 0;
  // Gold nodes (depletion state)
  for(const n of S.goldNodes){
    h = (h*31 + (n.gold|0)) | 0;
  }
  // Necromancer corpse pool
  h = (h*31 + deadSwordsmenPool.length) | 0;
  for(const p of deadSwordsmenPool){
    h = (h*31 + (p.x|0)) | 0;
    h = (h*31 + (p.y|0)) | 0;
  }
  // Frame counter (catches any timing drift)
  h = (h*31 + S.frame) | 0;
  return h;
}

// ── DESYNC HANDLING ──

function lsHandleDesync(remoteTurn, localHash, remoteHash){
  lsDesyncCount++;
  console.warn(`[DESYNC] Turn ${remoteTurn} — local=${localHash} remote=${remoteHash} (count: ${lsDesyncCount})`);

  if(lsDesyncCount >= DESYNC_TOLERANCE){
    // Show visible warning to player
    rtsSetLog('⚠ Desync detected — game state may differ from opponent');
    // Host sends authoritative state snapshot for guest to correct
    if(mpIsHost){
      mpSend({ t:'sync', state: lsSerializeState() });
    }
  }
}

function lsSerializeState(){
  // Minimal authoritative snapshot from host
  return {
    frame: S.frame,
    goldP: S.gold.player,
    goldE: S.gold.enemy,
    entities: S.entities.map(e => ({
      id:e.id, x:+e.x.toFixed(2), y:+e.y.toFixed(2), hp:e.hp,
      state:e.state, attackTimer:e.attackTimer||0,
      cooldown:e.cooldown||0, buildProgress:e.buildProgress||0,
      trainTimer:e.trainTimer||0, mineTimer:e.mineTimer||0,
      reviveTimer:e.reviveTimer||0,
      underConstruction:!!e.underConstruction,
      queueLen:e.queue?e.queue.length:0,
    })),
    goldNodes: S.goldNodes.map(n => n.gold),
    corpsePool: deadSwordsmenPool.map(p => ({x:p.x|0, y:p.y|0})),
  };
}

function lsApplyStateCorrection(state){
  if(!state || mpIsHost) return; // only guest applies corrections
  console.log('[SYNC] Applying host state correction at frame', state.frame);

  S.frame = state.frame;
  S.gold.player = state.goldP;
  S.gold.enemy = state.goldE;

  // Correct entity fields that may have diverged
  for(const se of state.entities){
    const local = S.entities.find(e => e.id === se.id);
    if(!local) continue;
    local.x = se.x; local.y = se.y; local.hp = se.hp;
    local.state = se.state;
    local.attackTimer = se.attackTimer;
    local.cooldown = se.cooldown;
    local.buildProgress = se.buildProgress;
    local.trainTimer = se.trainTimer;
    local.mineTimer = se.mineTimer;
    local.reviveTimer = se.reviveTimer;
    local.underConstruction = se.underConstruction;
  }

  // Correct gold nodes
  if(state.goldNodes){
    for(let i = 0; i < state.goldNodes.length && i < S.goldNodes.length; i++){
      S.goldNodes[i].gold = state.goldNodes[i];
    }
  }

  // Correct corpse pool
  if(state.corpsePool){
    deadSwordsmenPool.length = 0;
    for(const p of state.corpsePool) deadSwordsmenPool.push({x:p.x, y:p.y});
  }

  lsDesyncCount = 0;
  rtsSetLog('State corrected by host');
}

function lsTick(){
  lsTickInTurn++;
  if(lsTickInTurn >= TURN_LENGTH){
    lsSendTurn(lsTurn + INPUT_DELAY);
    lsTurn++;
    lsTickInTurn = 0;
    lsExecuteTurn();
    // Checksum every 30 turns (~3s) for faster desync detection
    if(lsTurn % 30 === 0) mpSend({ t:'chk', n:lsTurn, h:lsChecksum() });
  }
}
