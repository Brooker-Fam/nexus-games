import { HERO_MAX_HP, MAX_MANA } from './types.js';
import {
  cardRequiresTarget,
  createDeck,
  drawCards,
  getCardDefinition,
  isValidCardTarget,
} from './deck.js';
import {
  checkWinCondition,
  damageHeroState,
  findMinion,
  healHeroState,
  isHeroTarget,
  isMinionTarget,
  removeDeadMinions,
} from './effects.js';

const OPENING_HAND_SIZE = 3;

function otherPlayer(player){
  return player === 'player' ? 'ai' : 'player';
}

function createPlayerState(deck){
  return {
    hero: { hp: HERO_MAX_HP, maxHp: HERO_MAX_HP },
    maxMana: 0,
    mana: 0,
    deck,
    hand: [],
    board: [],
    discard: [],
  };
}

function clearEndOfTurnFlags(state, player){
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        board: state.players[player].board.map((minion) => ({
          ...minion,
          disabled: false,
        })),
      },
    },
  };
}

function markAttackerUsed(state, player, attackerId){
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        board: state.players[player].board.map((minion) => (
          minion.id === attackerId ? { ...minion, hasAttacked: true } : minion
        )),
      },
    },
  };
}

export function createInitialState(options = {}){
  const rng = options.rng || Math.random;
  const player = drawCards(createPlayerState(createDeck(rng)), OPENING_HAND_SIZE);
  const ai = drawCards(createPlayerState(createDeck(rng)), OPENING_HAND_SIZE);

  return {
    turnNumber: 1,
    activePlayer: 'player',
    nextId: 1,
    players: {
      player: { ...player, maxMana: 1, mana: 1 },
      ai,
    },
    revealedHands: {
      ai: false,
      player: false,
    },
    winner: null,
    log: ['New game started. Player turn 1 begins with 1 event.'],
  };
}

export function startTurn(state, player){
  if(state.winner) return state;

  const maxMana = Math.min(state.turnNumber, MAX_MANA);
  const currentPlayer = state.players[player];
  const afterDraw = drawCards(currentPlayer, 1);

  return {
    ...state,
    activePlayer: player,
    players: {
      ...state.players,
      [player]: {
        ...afterDraw,
        maxMana,
        mana: maxMana,
        board: afterDraw.board.map((minion) => ({
          ...minion,
          summoningSick: false,
          hasAttacked: false,
        })),
      },
    },
    log: [...state.log, `${player === 'player' ? 'Player' : 'AI'} starts turn ${state.turnNumber}.`],
  };
}

export function endTurn(state){
  if(state.winner) return state;

  const endingPlayer = state.activePlayer;
  const nextPlayer = otherPlayer(endingPlayer);
  const clearedState = clearEndOfTurnFlags(state, endingPlayer);
  const nextState = {
    ...clearedState,
    turnNumber: clearedState.turnNumber + 1,
    activePlayer: nextPlayer,
    revealedHands: endingPlayer === 'player'
      ? { ...(clearedState.revealedHands || {}), ai: false }
      : (clearedState.revealedHands || { ai: false, player: false }),
    log: [...clearedState.log, `${endingPlayer === 'player' ? 'Player' : 'AI'} ended the turn.`],
  };
  return startTurn(nextState, nextPlayer);
}

export function healHero(state, player, amount){
  return healHeroState(state, player, amount);
}

export function damageHero(state, player, amount){
  return damageHeroState(state, player, amount);
}

export function playCard(state, player, cardId, target){
  if(state.winner) return state;

  const playerState = state.players[player];
  const handIndex = playerState.hand.findIndex((card) => card.id === cardId);
  if(handIndex < 0) return state;

  const card = playerState.hand[handIndex];
  if(playerState.mana < card.cost) return state;

  const definition = getCardDefinition(card.definitionKey);
  if(!definition) return state;

  if(cardRequiresTarget(card) && !isValidCardTarget(state, player, card, target)) return state;

  const nextHand = [
    ...playerState.hand.slice(0, handIndex),
    ...playerState.hand.slice(handIndex + 1),
  ];

  const minionId = card.type === 'minion' ? `${player}-minion-${state.nextId}` : undefined;
  let workingState = {
    ...state,
    nextId: minionId ? state.nextId + 1 : state.nextId,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        mana: playerState.mana - card.cost,
        hand: nextHand,
      },
    },
  };

  workingState = definition.resolve(workingState, { player, card, target, minionId });

  return {
    ...workingState,
    players: {
      ...workingState.players,
      [player]: {
        ...workingState.players[player],
        discard: [...workingState.players[player].discard, card],
      },
    },
    log: [...workingState.log, `${player === 'player' ? 'Player' : 'AI'} played ${card.name}.`],
  };
}

export function attackWithMinion(state, player, attackerId, target){
  if(state.winner) return state;
  if(state.activePlayer !== player) return state;

  const attacker = findMinion(state, player, attackerId);
  if(!attacker || attacker.summoningSick || attacker.disabled || attacker.hasAttacked) return state;

  const enemy = otherPlayer(player);
  if(isHeroTarget(target)){
    if(target.player !== enemy) return state;

    const damaged = damageHeroState(state, enemy, attacker.attack);
    const marked = markAttackerUsed(damaged, player, attackerId);
    return {
      ...marked,
      log: [...marked.log, `${attacker.name} attacked the ${enemy === 'ai' ? 'AI' : 'Player'} hero for ${attacker.attack}.`],
    };
  }

  if(isMinionTarget(target)){
    if(target.player !== enemy) return state;
    const defender = findMinion(state, enemy, target.minionId);
    if(!defender) return state;

    const battled = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...state.players[player],
          board: state.players[player].board.map((minion) => (
            minion.id === attackerId
              ? { ...minion, hp: minion.hp - defender.attack, hasAttacked: true }
              : minion
          )),
        },
        [enemy]: {
          ...state.players[enemy],
          board: state.players[enemy].board.map((minion) => (
            minion.id === defender.id
              ? { ...minion, hp: minion.hp - attacker.attack }
              : minion
          )),
        },
      },
    };

    const cleaned = removeDeadMinions(battled);
    return {
      ...cleaned,
      log: [...cleaned.log, `${attacker.name} attacked ${defender.name}.`],
    };
  }

  return state;
}

export { checkWinCondition, otherPlayer };
