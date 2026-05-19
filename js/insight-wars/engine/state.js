import { HERO_MAX_HP, MAX_MANA } from './types.js';
import { createDeck, drawCards, getCardDefinition } from './deck.js';

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
    log: ['New game started. Player turn 1 begins with 1 event.'],
  };
}

export function startTurn(state, player){
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
        board: afterDraw.board.map((minion) => ({ ...minion, summoningSick: false })),
      },
    },
    log: [...state.log, `${player === 'player' ? 'Player' : 'AI'} starts turn ${state.turnNumber}.`],
  };
}

export function endTurn(state){
  const nextPlayer = otherPlayer(state.activePlayer);
  const nextState = {
    ...state,
    turnNumber: state.turnNumber + 1,
    activePlayer: nextPlayer,
    log: [...state.log, `${state.activePlayer === 'player' ? 'Player' : 'AI'} ended the turn.`],
  };
  return startTurn(nextState, nextPlayer);
}

export function healHero(state, player, amount){
  const hero = state.players[player].hero;
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hero: {
          ...hero,
          hp: Math.min(hero.maxHp, hero.hp + Math.max(0, amount)),
        },
      },
    },
  };
}

export function damageHero(state, player, amount){
  const hero = state.players[player].hero;
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        hero: {
          ...hero,
          hp: Math.max(0, hero.hp - Math.max(0, amount)),
        },
      },
    },
  };
}

export function playCard(state, player, cardId, target){
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

export { otherPlayer };
