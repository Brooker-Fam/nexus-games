import { HERO_MAX_HP } from './types.js';

export function otherPlayer(player){
  return player === 'player' ? 'ai' : 'player';
}

export function playerLabel(player){
  if(player === 'player') return 'Player';
  if(player === 'ai') return 'AI';
  return 'No one';
}

export function isGameOver(state){
  return state.status === 'ended' || Boolean(state.winner);
}

export function checkWinCondition(state){
  if(isGameOver(state)) return state;

  const playerHp = state.players.player.hero.hp;
  const aiHp = state.players.ai.hero.hp;
  let winner = null;

  // Player-favorable tie-break preserves the win-screen branch behavior while
  // still using the canonical "ai" winner value for AI victories.
  if(aiHp <= 0) winner = 'player';
  else if(playerHp <= 0) winner = 'ai';

  if(!winner) return state;

  return {
    ...state,
    status: 'ended',
    winner,
    log: [...state.log, `${playerLabel(winner)} wins Insight Wars!`],
  };
}

export function healHero(state, player, amount){
  if(isGameOver(state)) return state;
  const safeAmount = Math.max(0, amount);
  const hero = state.players[player].hero;

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hero: {
          ...hero,
          hp: Math.min(hero.maxHp, hero.hp + safeAmount),
        },
      },
    },
  };
}

export function damageHero(state, player, amount){
  if(isGameOver(state)) return state;
  const safeAmount = Math.max(0, amount);
  const hero = state.players[player].hero;
  const nextState = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hero: {
          ...hero,
          hp: Math.max(0, hero.hp - safeAmount),
        },
      },
    },
  };

  return checkWinCondition(nextState);
}

export function damageMinion(state, owner, minionId, amount){
  if(isGameOver(state)) return state;
  const safeAmount = Math.max(0, amount);
  const ownerState = state.players[owner];
  let defeatedMinion = null;
  const board = ownerState.board
    .map((minion) => {
      if(minion.id !== minionId) return minion;
      const damaged = { ...minion, hp: Math.max(0, minion.hp - safeAmount) };
      if(damaged.hp <= 0) defeatedMinion = damaged;
      return damaged;
    })
    .filter((minion) => minion.hp > 0);

  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...ownerState,
        board,
      },
    },
    log: defeatedMinion
      ? [...state.log, `${playerLabel(owner)} ${defeatedMinion.name} was defeated.`]
      : state.log,
  };
}

export function damageAllMinions(state, owner, amount){
  let nextState = state;
  const targets = state.players[owner].board.map((minion) => minion.id);
  for(const minionId of targets){
    nextState = damageMinion(nextState, owner, minionId, amount);
    if(isGameOver(nextState)) break;
  }
  return nextState;
}

export function disableMinionUntilTurn(state, owner, minionId, turnNumber){
  if(isGameOver(state)) return state;
  const ownerState = state.players[owner];
  const board = ownerState.board.map((minion) => (
    minion.id === minionId
      ? { ...minion, disabled: true, disabledUntilTurn: turnNumber }
      : minion
  ));

  return {
    ...state,
    players: {
      ...state.players,
      [owner]: {
        ...ownerState,
        board,
      },
    },
  };
}

export function canMinionAttack(state, player, minion){
  return (
    !isGameOver(state)
    && state.activePlayer === player
    && minion.owner === player
    && minion.hp > 0
    && !minion.summoningSick
    && !minion.hasAttacked
    && !minion.attackedThisTurn
    && !minion.disabled
    && !(minion.disabledUntilTurn && minion.disabledUntilTurn >= state.turnNumber)
  );
}

export function readyBoardForTurn(board, turnNumber){
  return board.map((minion) => {
    const nextMinion = {
      ...minion,
      summoningSick: false,
      hasAttacked: false,
      attackedThisTurn: false,
    };

    if(nextMinion.disabledUntilTurn && nextMinion.disabledUntilTurn < turnNumber){
      nextMinion.disabled = false;
      delete nextMinion.disabledUntilTurn;
    }

    return nextMinion;
  });
}

export function createHero(){
  return { hp: HERO_MAX_HP, maxHp: HERO_MAX_HP };
}
