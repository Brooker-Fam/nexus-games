// Insight Wars foundation logic.
// Stack binding for downstream hoglets: Nexus Games is a vanilla JavaScript + HTML/CSS app served by Vercel.
// There is no React, Vite, or framework build step in the current repo.

export const PLAYER = 'player';
export const OPPONENT = 'opponent';

export const CARD_TYPES = Object.freeze({
  MINION: 'minion',
  SPELL: 'spell',
});

export const GAME_STATUS = Object.freeze({
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
});

export const TURN_PHASE = Object.freeze({
  MAIN: 'main',
  COMPLETE: 'complete',
});

const MAX_HERO_HP = 20;
const MAX_EVENTS = 10;
const STARTING_HAND_SIZE = 3;

function enemyOf(playerId){
  return playerId === PLAYER ? OPPONENT : PLAYER;
}

function defaultRng(){
  return Math.random();
}

function deepClone(value){
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function success(state, message = 'ok'){
  return { ok: true, state, message };
}

function failure(state, error){
  return { ok: false, state, error };
}

function findMinion(state, ownerId, minionId){
  const board = state.players[ownerId]?.board || [];
  return board.find((minion) => minion.id === minionId) || null;
}

function removeDeadMinions(state){
  for(const playerId of [PLAYER, OPPONENT]){
    state.players[playerId].board = state.players[playerId].board.filter((minion) => minion.currentHp > 0);
  }
}

function applyDamageToHero(state, playerId, amount){
  const player = state.players[playerId];
  player.hp = Math.max(0, player.hp - Math.max(0, amount));
}

function healHero(state, playerId, amount){
  const player = state.players[playerId];
  player.hp = Math.min(MAX_HERO_HP, player.hp + Math.max(0, amount));
}

function applyDamageToMinion(state, ownerId, minionId, amount){
  const minion = findMinion(state, ownerId, minionId);
  if(!minion) return false;
  minion.currentHp -= Math.max(0, amount);
  removeDeadMinions(state);
  return true;
}

function damageTarget(state, target, amount){
  if(!target) return false;
  if(target.type === 'hero'){
    applyDamageToHero(state, target.owner, amount);
    return true;
  }
  if(target.type === 'minion'){
    return applyDamageToMinion(state, target.owner, target.minionId, amount);
  }
  return false;
}

function checkGameOver(state){
  const playerDead = state.players[PLAYER].hp <= 0;
  const opponentDead = state.players[OPPONENT].hp <= 0;

  if(opponentDead && !playerDead){
    state.status = GAME_STATUS.WON;
  } else if(playerDead){
    state.status = GAME_STATUS.LOST;
  } else {
    state.status = GAME_STATUS.PLAYING;
  }
}

function drawCards(state, playerId, count = 1){
  const player = state.players[playerId];
  for(let i = 0; i < count; i++){
    const card = player.deck.shift();
    if(!card) break;
    player.hand.push(card);
  }
}

function summonMinion(state, ownerId, cardId, name, attack, hp){
  const minion = {
    id: `m-${state.nextMinionId++}`,
    cardId,
    owner: ownerId,
    name,
    baseAttack: attack,
    currentAttack: attack,
    maxHp: hp,
    currentHp: hp,
    summoningSick: true,
    hasAttacked: false,
    disabledUntilTurn: null,
  };
  state.players[ownerId].board.push(minion);
  return minion;
}

function validEnemyMinionTarget(state, sourcePlayer, target){
  if(!target || target.type !== 'minion') return null;
  const enemy = enemyOf(sourcePlayer);
  if(target.owner !== enemy) return null;
  return findMinion(state, enemy, target.minionId);
}

export const CARD_DEFINITIONS = Object.freeze([
  {
    id: 'feature_flag',
    name: 'Feature Flag',
    cost: 1,
    type: CARD_TYPES.SPELL,
    effect: 'Disable one enemy minion during its controller\'s next turn.',
    resolve(state, context){
      const targetMinion = validEnemyMinionTarget(state, context.sourcePlayer, context.target);
      if(targetMinion){
        targetMinion.disabledUntilTurn = state.turn.number + 1;
      }
    },
  },
  {
    id: 'session_replay',
    name: 'Session Replay',
    cost: 2,
    type: CARD_TYPES.SPELL,
    effect: 'Reveal the AI hand for the player\'s current turn only. No-op when the AI plays it.',
    resolve(state, context){
      if(context.sourcePlayer === PLAYER){
        state.visibility.opponentHandRevealed = true;
        state.visibility.opponentHandRevealExpiresOnTurnEnd = state.turn.number;
      }
    },
  },
  {
    id: 'ab_test',
    name: 'A/B Test',
    cost: 3,
    type: CARD_TYPES.SPELL,
    effect: '50/50: deal 5 damage to the enemy hero, or heal your hero for 5.',
    resolve(state, context){
      if(context.rng() < 0.5){
        applyDamageToHero(state, enemyOf(context.sourcePlayer), 5);
      } else {
        healHero(state, context.sourcePlayer, 5);
      }
    },
  },
  {
    id: 'funnel',
    name: 'Funnel',
    cost: 4,
    type: CARD_TYPES.SPELL,
    effect: 'Deal 2 damage to the enemy hero and 1 damage to each enemy minion.',
    resolve(state, context){
      const enemy = enemyOf(context.sourcePlayer);
      applyDamageToHero(state, enemy, 2);
      for(const minion of state.players[enemy].board){
        minion.currentHp -= 1;
      }
      removeDeadMinions(state);
    },
  },
  {
    id: 'cohort',
    name: 'Cohort',
    cost: 3,
    type: CARD_TYPES.MINION,
    attack: 2,
    hp: 3,
    effect: 'Summon a 2/3 Cohort minion.',
    resolve(state, context){
      summonMinion(state, context.sourcePlayer, 'cohort', 'Cohort', 2, 3);
    },
  },
  {
    id: 'insight',
    name: 'Insight',
    cost: 2,
    type: CARD_TYPES.SPELL,
    effect: 'Draw 2 cards. Inferred for the truncated card prompt and documented for follow-up hoglets.',
    resolve(state, context){
      drawCards(state, context.sourcePlayer, 2);
    },
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    cost: 4,
    type: CARD_TYPES.MINION,
    attack: 3,
    hp: 5,
    effect: 'Summon a durable 3/5 Dashboard minion.',
    resolve(state, context){
      summonMinion(state, context.sourcePlayer, 'dashboard', 'Dashboard', 3, 5);
    },
  },
  {
    id: 'survey',
    name: 'Survey',
    cost: 2,
    type: CARD_TYPES.SPELL,
    effect: 'Heal your hero for 3 and draw 1 card.',
    resolve(state, context){
      healHero(state, context.sourcePlayer, 3);
      drawCards(state, context.sourcePlayer, 1);
    },
  },
  {
    id: 'hogql_query',
    name: 'HogQL Query',
    cost: 5,
    type: CARD_TYPES.SPELL,
    effect: 'Deal 4 damage to a chosen enemy target, or the enemy hero if no valid target is supplied.',
    resolve(state, context){
      const enemy = enemyOf(context.sourcePlayer);
      const fallbackHero = { type: 'hero', owner: enemy };
      const target = context.target && context.target.owner === enemy ? context.target : fallbackHero;
      const validTarget = target.type === 'minion'
        ? findMinion(state, enemy, target.minionId)
        : target.type === 'hero';
      damageTarget(state, validTarget ? target : fallbackHero, 4);
    },
  },
]);

export const CARDS_BY_ID = Object.freeze(Object.fromEntries(CARD_DEFINITIONS.map((card) => [card.id, card])));

export const DEFAULT_DECK_LIST = Object.freeze([
  ['feature_flag', 3],
  ['session_replay', 2],
  ['ab_test', 3],
  ['funnel', 2],
  ['cohort', 3],
  ['insight', 3],
  ['dashboard', 2],
  ['survey', 3],
  ['hogql_query', 2],
]);

function makeUnshuffledDeck(state){
  const deck = [];
  for(const [cardId, copies] of DEFAULT_DECK_LIST){
    for(let i = 0; i < copies; i++){
      deck.push({ instanceId: `c-${state.nextCardInstanceId++}`, cardId });
    }
  }
  return deck;
}

function shuffleDeck(deck, rng){
  const shuffled = deck.slice();
  for(let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createPlayerState(){
  return {
    hp: MAX_HERO_HP,
    maxHp: MAX_HERO_HP,
    events: 0,
    maxEvents: 0,
    deck: [],
    hand: [],
    board: [],
  };
}

export function createInitialState(options = {}){
  const rng = options.rng || defaultRng;
  const shouldShuffle = options.shuffle !== false;
  const startingHandSize = options.startingHandSize ?? STARTING_HAND_SIZE;
  const state = {
    version: 1,
    status: GAME_STATUS.PLAYING,
    turn: {
      number: 1,
      phase: TURN_PHASE.MAIN,
      activePlayer: PLAYER,
    },
    players: {
      [PLAYER]: createPlayerState(),
      [OPPONENT]: createPlayerState(),
    },
    visibility: {
      opponentHandRevealed: false,
      opponentHandRevealExpiresOnTurnEnd: null,
    },
    nextCardInstanceId: 1,
    nextMinionId: 1,
    log: [],
  };

  for(const playerId of [PLAYER, OPPONENT]){
    const unshuffled = makeUnshuffledDeck(state);
    state.players[playerId].deck = shouldShuffle ? shuffleDeck(unshuffled, rng) : unshuffled;
    drawCards(state, playerId, startingHandSize);
  }

  state.players[PLAYER].maxEvents = 1;
  state.players[PLAYER].events = 1;

  return state;
}

export function cloneState(state){
  return deepClone(state);
}

export function getCardDefinition(cardInstance){
  return CARDS_BY_ID[cardInstance.cardId];
}

export function getActivePlayerId(state){
  return state.turn.activePlayer;
}

export function getEnemyPlayerId(state, playerId = state.turn.activePlayer){
  return enemyOf(playerId);
}

export function getVisibleOpponentHand(state){
  return state.visibility.opponentHandRevealed
    ? state.players[OPPONENT].hand.map((card) => ({ ...card, definition: CARDS_BY_ID[card.cardId] }))
    : [];
}

function refreshActivePlayerForTurn(state){
  const active = state.turn.activePlayer;
  const activePlayer = state.players[active];
  activePlayer.maxEvents = Math.min(MAX_EVENTS, state.turn.number);
  activePlayer.events = activePlayer.maxEvents;

  for(const minion of activePlayer.board){
    minion.summoningSick = false;
    minion.hasAttacked = false;
  }
}

function clearTurnLimitedEffects(state){
  if(state.visibility.opponentHandRevealExpiresOnTurnEnd === state.turn.number){
    state.visibility.opponentHandRevealed = false;
    state.visibility.opponentHandRevealExpiresOnTurnEnd = null;
  }
}

export function endTurn(state){
  if(state.status !== GAME_STATUS.PLAYING){
    return failure(state, 'Cannot end turn after the game is over.');
  }

  const next = cloneState(state);
  clearTurnLimitedEffects(next);
  next.turn.phase = TURN_PHASE.COMPLETE;
  next.turn.number += 1;
  next.turn.activePlayer = enemyOf(next.turn.activePlayer);
  next.turn.phase = TURN_PHASE.MAIN;
  refreshActivePlayerForTurn(next);
  next.log.push({ type: 'turn_started', turn: next.turn.number, activePlayer: next.turn.activePlayer });
  return success(next, 'Turn ended.');
}

export function playCard(state, cardInstanceId, target = null, options = {}){
  if(state.status !== GAME_STATUS.PLAYING){
    return failure(state, 'Cannot play cards after the game is over.');
  }

  const active = state.turn.activePlayer;
  const activePlayer = state.players[active];
  const handIndex = activePlayer.hand.findIndex((card) => card.instanceId === cardInstanceId);
  if(handIndex === -1){
    return failure(state, `Card ${cardInstanceId} is not in the active player's hand.`);
  }

  const cardInstance = activePlayer.hand[handIndex];
  const card = CARDS_BY_ID[cardInstance.cardId];
  if(!card){
    return failure(state, `Unknown card id: ${cardInstance.cardId}`);
  }

  if(activePlayer.events < card.cost){
    return failure(state, `Insufficient events to play ${card.name}.`);
  }

  const next = cloneState(state);
  const nextActivePlayer = next.players[active];
  const [nextCardInstance] = nextActivePlayer.hand.splice(handIndex, 1);
  nextActivePlayer.events -= card.cost;

  const context = {
    sourcePlayer: active,
    target,
    rng: options.rng || defaultRng,
    cardInstance: nextCardInstance,
  };
  card.resolve(next, context);
  removeDeadMinions(next);
  checkGameOver(next);
  next.log.push({ type: 'card_played', turn: next.turn.number, player: active, cardId: card.id, cardName: card.name });
  return success(next, `${card.name} played.`);
}

function canMinionAttack(state, playerId, minion){
  if(!minion) return { ok: false, error: 'Minion not found.' };
  if(state.turn.activePlayer !== playerId) return { ok: false, error: 'It is not this minion controller\'s turn.' };
  if(minion.summoningSick) return { ok: false, error: 'Minion has summoning sickness.' };
  if(minion.hasAttacked) return { ok: false, error: 'Minion has already attacked this turn.' };
  if(minion.disabledUntilTurn === state.turn.number) return { ok: false, error: 'Minion is disabled this turn.' };
  if(minion.currentHp <= 0) return { ok: false, error: 'Minion is not alive.' };
  return { ok: true };
}

export function attackWithMinion(state, minionId, target){
  if(state.status !== GAME_STATUS.PLAYING){
    return failure(state, 'Cannot attack after the game is over.');
  }

  const active = state.turn.activePlayer;
  const attacker = findMinion(state, active, minionId);
  const attackCheck = canMinionAttack(state, active, attacker);
  if(!attackCheck.ok){
    return failure(state, attackCheck.error);
  }

  const enemy = enemyOf(active);
  if(!target || target.owner !== enemy){
    return failure(state, 'Target must belong to the enemy player.');
  }

  if(target.type === 'minion' && !findMinion(state, enemy, target.minionId)){
    return failure(state, 'Target minion not found.');
  }

  const next = cloneState(state);
  const nextAttacker = findMinion(next, active, minionId);
  nextAttacker.hasAttacked = true;

  if(target.type === 'hero'){
    applyDamageToHero(next, enemy, nextAttacker.currentAttack);
  } else if(target.type === 'minion'){
    const defender = findMinion(next, enemy, target.minionId);
    defender.currentHp -= nextAttacker.currentAttack;
    nextAttacker.currentHp -= defender.currentAttack;
    removeDeadMinions(next);
  } else {
    return failure(state, 'Unknown attack target type.');
  }

  checkGameOver(next);
  next.log.push({ type: 'minion_attacked', turn: next.turn.number, player: active, minionId, target });
  return success(next, 'Attack resolved.');
}

export function createGame(options = {}){
  let state = createInitialState(options);
  const rng = options.rng || defaultRng;

  return {
    getState(){
      return state;
    },
    playCard(cardInstanceId, target){
      const result = playCard(state, cardInstanceId, target, { rng });
      if(result.ok) state = result.state;
      return result;
    },
    attackWithMinion(minionId, target){
      const result = attackWithMinion(state, minionId, target);
      if(result.ok) state = result.state;
      return result;
    },
    endTurn(){
      const result = endTurn(state);
      if(result.ok) state = result.state;
      return result;
    },
  };
}

export const InsightWarsGameState = Object.freeze({
  createInitialState,
  cloneState,
  createGame,
  playCard,
  attackWithMinion,
  endTurn,
  getCardDefinition,
  getActivePlayerId,
  getEnemyPlayerId,
  getVisibleOpponentHand,
  CARD_DEFINITIONS,
  CARDS_BY_ID,
  DEFAULT_DECK_LIST,
  CARD_TYPES,
  GAME_STATUS,
  TURN_PHASE,
});
