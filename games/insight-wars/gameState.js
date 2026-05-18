import { CARD_DEFINITIONS, getCardDefinition, getOpponent, PLAYER_IDS } from './cards.js';
import { buildDeck, createRng, normalizeSeed, shuffle } from './deck.js';

export const MAX_HERO_HP = 20;
export const MAX_MANA = 10;
export const OPENING_HAND_SIZE = 3;

/**
 * @typedef {'player' | 'ai'} PlayerId
 * @typedef {{ id: PlayerId, hp: number, maxHp: 20 }} Hero
 * @typedef {{ id: string, type: string, name: string, cost: number, kind: 'minion' | 'spell', attack?: number, hp?: number }} Card
 * @typedef {{ cardId: string, name?: string, attack: number, hp: number, maxHp?: number, canAttack: boolean }} Minion
 * @typedef {{ current: number, max: number }} ManaPool
 * @typedef {{ turn: number, activePlayer: PlayerId, heroes: Record<PlayerId, Hero>, mana: Record<PlayerId, ManaPool>, hands: Record<PlayerId, Card[]>, decks: Record<PlayerId, Card[]>, boards: Record<PlayerId, Minion[]>, winner: PlayerId | null, rngSeed: number }} GameState
 */

function assertPlayer(player) {
  if (!PLAYER_IDS.includes(player)) throw new Error(`Unknown Insight Wars player: ${player}`);
}

export function cloneGameState(state) {
  return {
    ...state,
    heroes: {
      player: { ...state.heroes.player },
      ai: { ...state.heroes.ai },
    },
    mana: {
      player: { ...state.mana.player },
      ai: { ...state.mana.ai },
    },
    hands: {
      player: state.hands.player.map((card) => ({ ...card })),
      ai: state.hands.ai.map((card) => ({ ...card })),
    },
    decks: {
      player: state.decks.player.map((card) => ({ ...card })),
      ai: state.decks.ai.map((card) => ({ ...card })),
    },
    boards: {
      player: state.boards.player.map((minion) => ({ ...minion })),
      ai: state.boards.ai.map((minion) => ({ ...minion })),
    },
  };
}

function drawOpeningHand(deck) {
  return {
    hand: deck.slice(0, OPENING_HAND_SIZE),
    deck: deck.slice(OPENING_HAND_SIZE),
  };
}

export function createInitialState(seed = Date.now()) {
  const seedValue = normalizeSeed(seed);
  const playerDeck = shuffle(buildDeck(), createRng(seedValue ^ 0xa53a9d1b));
  const aiDeck = shuffle(buildDeck(), createRng(seedValue ^ 0x5f356495));
  const playerOpening = drawOpeningHand(playerDeck);
  const aiOpening = drawOpeningHand(aiDeck);

  return {
    turn: 1,
    activePlayer: 'player',
    heroes: {
      player: { id: 'player', hp: MAX_HERO_HP, maxHp: MAX_HERO_HP },
      ai: { id: 'ai', hp: MAX_HERO_HP, maxHp: MAX_HERO_HP },
    },
    mana: {
      player: { current: 1, max: 1 },
      ai: { current: 0, max: 0 },
    },
    hands: {
      player: playerOpening.hand,
      ai: aiOpening.hand,
    },
    decks: {
      player: playerOpening.deck,
      ai: aiOpening.deck,
    },
    boards: {
      player: [],
      ai: [],
    },
    winner: null,
    rngSeed: seedValue ^ 0x9e3779b9,
  };
}

export function checkWinCondition(state) {
  const nextState = cloneGameState(state);
  let winner = nextState.winner || null;

  nextState.heroes.player.hp = Math.max(0, Math.min(nextState.heroes.player.maxHp, nextState.heroes.player.hp));
  nextState.heroes.ai.hp = Math.max(0, Math.min(nextState.heroes.ai.maxHp, nextState.heroes.ai.hp));

  if (!winner) {
    if (nextState.heroes.player.hp <= 0) winner = 'ai';
    else if (nextState.heroes.ai.hp <= 0) winner = 'player';
  }

  return {
    ...nextState,
    winner,
  };
}

function removeDeadMinions(state) {
  const nextState = cloneGameState(state);
  nextState.boards.player = nextState.boards.player.filter((minion) => minion.hp > 0);
  nextState.boards.ai = nextState.boards.ai.filter((minion) => minion.hp > 0);
  return nextState;
}

export function drawCard(state, player) {
  assertPlayer(player);
  if (state.winner) return state;

  const nextState = cloneGameState(state);
  const [drawnCard, ...remainingDeck] = nextState.decks[player];
  if (!drawnCard) return nextState;

  nextState.hands[player] = [...nextState.hands[player], drawnCard];
  nextState.decks[player] = remainingDeck;
  return nextState;
}

export function startTurn(state, player) {
  assertPlayer(player);
  if (state.winner) return state;

  const nextState = drawCard({
    ...cloneGameState(state),
    activePlayer: player,
    mana: {
      ...state.mana,
      [player]: {
        max: Math.min(MAX_MANA, Math.max(1, state.turn)),
        current: Math.min(MAX_MANA, Math.max(1, state.turn)),
      },
    },
    boards: {
      ...state.boards,
      [player]: state.boards[player].map((minion) => ({
        ...minion,
        canAttack: true,
      })),
    },
  }, player);

  return checkWinCondition(nextState);
}

export function endTurn(state) {
  if (state.winner) return state;

  const nextPlayer = getOpponent(state.activePlayer);
  const nextTurnState = {
    ...cloneGameState(state),
    turn: state.turn + 1,
    activePlayer: nextPlayer,
  };

  return startTurn(nextTurnState, nextPlayer);
}

function summonMinion(state, player, card) {
  const definition = getCardDefinition(card);
  if (definition.kind !== 'minion') return state;

  const nextState = cloneGameState(state);
  nextState.boards[player] = [
    ...nextState.boards[player],
    {
      cardId: card.id,
      name: card.name,
      attack: definition.attack,
      hp: definition.hp,
      maxHp: definition.hp,
      canAttack: false,
    },
  ];
  return nextState;
}

function removeCardFromHandAndSpendMana(state, player, cardIndex) {
  const nextState = cloneGameState(state);
  const hand = nextState.hands[player];
  const card = hand[cardIndex];
  if (!card) return null;
  if (nextState.mana[player].current < card.cost) return null;

  nextState.hands[player] = hand.filter((_card, index) => index !== cardIndex);
  nextState.mana[player] = {
    ...nextState.mana[player],
    current: nextState.mana[player].current - card.cost,
  };

  return { nextState, card };
}

export function playCard(state, player, cardIndex, targetId) {
  assertPlayer(player);
  if (state.winner || state.activePlayer !== player) return state;

  const paid = removeCardFromHandAndSpendMana(state, player, cardIndex);
  if (!paid) return state;

  const { card } = paid;
  const definition = getCardDefinition(card);
  let nextState = paid.nextState;

  if (definition.kind === 'minion') {
    nextState = summonMinion(nextState, player, card);
  }

  nextState = definition.resolve(nextState, player, targetId, card);
  return checkWinCondition(removeDeadMinions(nextState));
}

export function attack(state, player, attackerIndex, targetIndexOrHero) {
  assertPlayer(player);
  if (state.winner || state.activePlayer !== player) return state;

  const opponent = getOpponent(player);
  const attacker = state.boards[player][attackerIndex];
  if (!attacker || !attacker.canAttack || attacker.hp <= 0) return state;

  const nextState = cloneGameState(state);
  const attackingMinion = nextState.boards[player][attackerIndex];
  attackingMinion.canAttack = false;

  if (targetIndexOrHero === 'hero') {
    nextState.heroes[opponent].hp -= attackingMinion.attack;
    return checkWinCondition(removeDeadMinions(nextState));
  }

  const defender = nextState.boards[opponent][targetIndexOrHero];
  if (!defender) return state;

  defender.hp -= attackingMinion.attack;
  attackingMinion.hp -= defender.attack;

  return checkWinCondition(removeDeadMinions(nextState));
}

export { CARD_DEFINITIONS };
