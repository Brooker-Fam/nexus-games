export function clampDamage(amount){
  return Math.max(0, amount);
}

export function healHeroState(state, player, amount){
  const hero = state.players[player].hero;
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hero: {
          ...hero,
          hp: Math.min(hero.maxHp, hero.hp + clampDamage(amount)),
        },
      },
    },
  };
}

export function checkWinCondition(state){
  if(state.winner) return state;

  const playerDefeated = state.players.player.hero.hp <= 0;
  const aiDefeated = state.players.ai.hero.hp <= 0;

  if(!playerDefeated && !aiDefeated) return state;

  // Player-favorable tie-break: if both heroes hit 0 HP at the same time,
  // award the game to the player so simultaneous lethal resolves as "You Win!".
  return {
    ...state,
    winner: aiDefeated ? 'player' : 'opponent',
  };
}

export function damageHeroState(state, player, amount){
  const hero = state.players[player].hero;
  const damaged = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hero: {
          ...hero,
          hp: Math.max(0, hero.hp - clampDamage(amount)),
        },
      },
    },
  };

  return checkWinCondition(damaged);
}

export function mapMinion(state, player, minionId, mapper){
  const playerState = state.players[player];
  const board = playerState.board.map((minion) => (
    minion.id === minionId ? mapper(minion) : minion
  ));

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        board,
      },
    },
  };
}

export function removeDeadMinions(state){
  return {
    ...state,
    players: {
      ...state.players,
      player: {
        ...state.players.player,
        board: state.players.player.board.filter((minion) => minion.hp > 0),
      },
      ai: {
        ...state.players.ai,
        board: state.players.ai.board.filter((minion) => minion.hp > 0),
      },
    },
  };
}

export function damageMinionState(state, player, minionId, amount){
  const damaged = mapMinion(state, player, minionId, (minion) => ({
    ...minion,
    hp: minion.hp - clampDamage(amount),
  }));
  return removeDeadMinions(damaged);
}

export function findMinion(state, player, minionId){
  return state.players[player].board.find((minion) => minion.id === minionId) || null;
}

export function isHeroTarget(target){
  return target?.type === 'hero' && (target.player === 'player' || target.player === 'ai');
}

export function isMinionTarget(target){
  return target?.type === 'minion'
    && (target.player === 'player' || target.player === 'ai')
    && typeof target.minionId === 'string';
}
