# Multiplayer Redesign

## Problem
Multiplayer was bolted onto a player-vs-AI architecture. Two gold variables,
hardcoded 'player' side checks, and the guest running partial game logic
create endless edge cases (double deductions, wrong faction, can't build, desync).

## Architecture: Host-Authoritative

- **Host** runs the simulation. One truth, one game loop, one authority.
- **Guest** is a remote controller + display. Sends commands, renders state.
- **PeerJS** WebRTC for peer-to-peer connection.

## Key Changes

### 1. Gold model: object, not two variables
```
Before: let rtsGold=0; let aiGold=0;
After:  const rtsGold = { player: 0, enemy: 0 };
```
All gold reads: `rtsGold[side]`
All gold writes: `rtsGold[side] -= cost`
Worker return: `rtsGold[w.side] += w.goldCarry`
AI checks: `rtsGold.enemy < cost`

Files: camera.js (declaration), game.js (AI, workers), commands.js (checks),
multiplayer.js (sync), entities.js (startRTS reset), ui.js (HUD, popups)

### 2. Commands carry their side — one unified executor
Every command gets stamped: `cmd.side = mySide()`
Delete `executeRemoteCommand()` entirely.
`executeCommand()` reads `cmd.side` to determine faction + gold source.

When host receives guest command:
```
msg.c.side = 'enemy';
rtsCommandQueue.push(msg.c);  // goes through normal executeCommand
```

Files: commands.js, multiplayer.js

### 3. Guest sends commands, never executes locally
```
function issueCommand(cmd) {
  cmd.side = mySide();
  if (multiplayer && !isHost) {
    mpSendCommand(cmd);      // send to host only
  } else {
    rtsCommandQueue.push(cmd);  // host/singleplayer: execute locally
  }
}
```

Files: commands.js

### 4. No gold deductions in UI
Clicking "Build Barracks" only sets placement mode. No spendGold() call.
Gold deducted when command executes on host. No double-deduction possible.

Files: ui.js

### 5. Guest UI uses myFaction() / myGold() everywhere
- openBuildPopup: `FACTION_CFG[myFaction()]`
- button disabled: `myGold() < cost`
- HUD display: `myGold()`
- Click handlers: `ent.side === mySide()`

Files: ui.js

### 6. State sync sends gold as object
```
Send: g: { p: rtsGold.player, e: rtsGold.enemy }
Recv: rtsGold.player = msg.g.p; rtsGold.enemy = msg.g.e;
```

Files: multiplayer.js

## Data Flow

### Single-player
```
Click "Train Warrior"
  → issueCommand({ type:'train_unit', side:'player', buildingId:42 })
  → pushed to rtsCommandQueue
  → processCommands() in rtsTick()
  → executeCommand() checks rtsGold['player'], deducts, queues unit
```

### Multiplayer: Host action
```
Host clicks "Train Warrior"
  → issueCommand({ type:'train_unit', side:'player', buildingId:42 })
  → pushed to rtsCommandQueue (NOT sent over network)
  → processCommands() → executeCommand() checks rtsGold['player']
  → next mpSendState() sends updated gold + queue to guest
```

### Multiplayer: Guest action
```
Guest clicks "Train Warrior"
  → issueCommand({ type:'train_unit', side:'enemy', buildingId:42 })
  → sent to host via mpSendCommand() (NOT executed locally)
  → guest shows "Queued!" feedback immediately

Host receives:
  → stamps cmd.side = 'enemy'
  → pushed to rtsCommandQueue
  → executeCommand() checks rtsGold['enemy'], deducts, queues unit
  → next mpSendState() sends updated gold + queue to guest
```

## Implementation Steps (each leaves game working)

- [ ] Step 1: Gold refactor — rtsGold → {player, enemy}, kill aiGold. Test SP.
- [ ] Step 2: Side-aware commands — stamp cmd.side, unify executors. Delete executeRemoteCommand.
- [ ] Step 3: Guest routing — guest only sends, never executes locally.
- [ ] Step 4: UI fixes — myFaction(), myGold() everywhere. No UI gold deductions.
- [ ] Step 5: State sync format — gold as {p, e} object.
- [ ] Step 6: Test both single-player and multiplayer end-to-end.

## What stays the same
- PeerJS connection (mpHost, mpJoin, short codes)
- Delta compression for state sync
- Guest skips rtsTick(), only renders
- Camera/input handling (local on both clients)
- All rendering code unchanged
- All entity/faction config unchanged
