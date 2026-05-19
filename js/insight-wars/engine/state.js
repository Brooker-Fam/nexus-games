import {
  cardRequiresTarget,
  createDeck,
  drawCards,
  getCardDefinition,
  isValidCardTarget,
} from './deck.js';
import { findMinion, isHeroTarget, isMinionTarget, removeDeadMinions } from './effects.js';
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

function clearEndOfTurnFlags(state, player){
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        board: state.players[player].board.map((minion) => {
          const nextMinion = { ...minion, disabled: false };
          delete nextMinion.disabledUntilTurn;
          return nextMinion;
        }),
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
          minion.id === attackerId
            ? { ...minion, hasAttacked: true, attackedThisTurn: true }
            : minion
        )),
      },
    },
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
    revealedHands: {
      ai: false,
      player: false,
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
    log: [...clearedState.log, `${playerLabel(endingPlayer)} ended the turn.`],
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

export function attackWithMinion(state, player, attackerId, target){
  if(isGameOver(state)) return state;
  if(state.activePlayer !== player) return state;

  const attacker = findMinion(state, player, attackerId);
  if(!attacker || !canMinionAttack(state, player, attacker)) return state;

  const enemy = otherPlayer(player);
  if(isHeroTarget(target)){
    if(target.player !== enemy) return state;

    const marked = markAttackerUsed(state, player, attackerId);
    const damaged = applyHeroDamage(marked, enemy, attacker.attack);
    return {
      ...damaged,
      log: [...damaged.log, `${attacker.name} attacked the ${playerLabel(enemy)} hero for ${attacker.attack}.`],
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
              ? { ...minion, hp: minion.hp - defender.attack, hasAttacked: true, attackedThisTurn: true }
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
    return checkWinCondition({
      ...cleaned,
      log: [...cleaned.log, `${attacker.name} attacked ${defender.name}.`],
    });
  }

  return state;
}

export function attackHero(state, attackerPlayer, minionId, defenderPlayer = otherPlayer(attackerPlayer)){
  return attackWithMinion(state, attackerPlayer, minionId, { type: 'hero', player: defenderPlayer });
}

export { canMinionAttack, checkWinCondition, isGameOver, otherPlayer };
