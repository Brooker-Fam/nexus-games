import { createDeck, drawCards, getCardDefinition } from './deck.js';
import {
  canMinionAttack,
  checkWinCondition,
  createHero,
  damageHero as applyHeroDamage,
  healHero as applyHeroHeal,
  isGameOver,
  otherPlayer,
  playerLabel,
  readyBoardForTurn,
} from './rules.js';
import { MAX_MANA } from './types.js';

const OPENING_HAND_SIZE = 3;

export function createSeededRng(seed = 1){
  let value = Number.isFinite(seed) ? seed >>> 0 : 1;
  if(value === 0) value = 1;

  return function seededRng(){
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createPlayerState(deck){
  return {
    hero: createHero(),
    maxMana: 0,
    mana: 0,
    deck,
    hand: [],
    board: [],
    discard: [],
  };
}

export function createInitialState(options = {}){
  const rng = options.rng || createSeededRng(options.seed ?? Date.now());
  const player = drawCards(createPlayerState(createDeck(rng)), OPENING_HAND_SIZE);
  const ai = drawCards(createPlayerState(createDeck(rng)), OPENING_HAND_SIZE);

  return {
    turnNumber: 1,
    activePlayer: 'player',
    nextId: 1,
    status: 'playing',
    winner: null,
    rng,
    players: {
      player: { ...player, maxMana: 1, mana: 1 },
      ai,
    },
    log: ['New game started. Player turn 1 begins with 1 event.'],
  };
}

export function startTurn(state, player){
  if(isGameOver(state)) return state;
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
        board: readyBoardForTurn(afterDraw.board, state.turnNumber),
      },
    },
    log: [...state.log, `${playerLabel(player)} starts turn ${state.turnNumber}.`],
  };
}

export function endTurn(state){
  if(isGameOver(state)) return state;
  const nextPlayer = otherPlayer(state.activePlayer);
  const nextState = {
    ...state,
    turnNumber: state.turnNumber + 1,
    activePlayer: nextPlayer,
    log: [...state.log, `${playerLabel(state.activePlayer)} ended the turn.`],
  };
  return startTurn(nextState, nextPlayer);
}

export function healHero(state, player, amount){
  return applyHeroHeal(state, player, amount);
}

export function damageHero(state, player, amount){
  return applyHeroDamage(state, player, amount);
}

export function playCard(state, player, cardId, target){
  if(isGameOver(state)) return state;
  const playerState = state.players[player];
  const handIndex = playerState.hand.findIndex((card) => card.id === cardId);
  if(handIndex < 0) return state;

  const card = playerState.hand[handIndex];
  if(playerState.mana < card.cost) return state;

  const definition = getCardDefinition(card.definitionKey);
  if(!definition) return state;

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

  return checkWinCondition({
    ...workingState,
    players: {
      ...workingState.players,
      [player]: {
        ...workingState.players[player],
        discard: [...workingState.players[player].discard, card],
      },
    },
    log: [...workingState.log, `${playerLabel(player)} played ${card.name}.`],
  });
}

export function attackHero(state, attackerPlayer, minionId, defenderPlayer = otherPlayer(attackerPlayer)){
  if(isGameOver(state)) return state;
  const attackerState = state.players[attackerPlayer];
  const minion = attackerState.board.find((candidate) => candidate.id === minionId);
  if(!minion || !canMinionAttack(state, attackerPlayer, minion)) return state;

  const board = attackerState.board.map((candidate) => (
    candidate.id === minionId
      ? { ...candidate, attackedThisTurn: true }
      : candidate
  ));

  let nextState = {
    ...state,
    players: {
      ...state.players,
      [attackerPlayer]: {
        ...attackerState,
        board,
      },
    },
    log: [
      ...state.log,
      `${playerLabel(attackerPlayer)} ${minion.name} attacked ${playerLabel(defenderPlayer)} hero for ${minion.attack}.`,
    ],
  };

  nextState = applyHeroDamage(nextState, defenderPlayer, minion.attack);
  return checkWinCondition(nextState);
}

export { canMinionAttack, isGameOver, otherPlayer };
