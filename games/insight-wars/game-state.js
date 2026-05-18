/**
 * @typedef {'minion' | 'spell'} InsightWarsCardType
 *
 * @typedef {object} Card
 * @property {string} id
 * @property {string} name
 * @property {number} cost
 * @property {InsightWarsCardType} type
 * @property {number=} attack
 * @property {number=} hp
 * @property {string} effectText
 * @property {string} emoji
 *
 * @typedef {object} Minion
 * @property {string} id
 * @property {string} name
 * @property {number} attack
 * @property {number} hp
 * @property {boolean} hasSummoningSickness
 * @property {string} emoji
 *
 * @typedef {object} InsightWarsHero
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {number} hp
 * @property {{ current: number, max: number }=} mana
 *
 * @typedef {object} GameState
 * @property {number} turn
 * @property {'player' | 'ai'} activePlayer
 * @property {'win' | 'lose' | null} gameOver
 * @property {InsightWarsHero} player
 * @property {InsightWarsHero} ai
 * @property {Card[]} playerHand
 * @property {Minion[]} playerBoard
 * @property {Minion[]} aiBoard
 */

export const INSIGHT_WARS_CARD_SET = Object.freeze([
  Object.freeze({
    id: 'feature-flag',
    name: 'Feature Flag',
    cost: 1,
    type: 'spell',
    effectText: 'Toggle a tactical advantage.',
    emoji: '🚩',
  }),
  Object.freeze({
    id: 'session-replay',
    name: 'Session Replay',
    cost: 2,
    type: 'minion',
    attack: 1,
    hp: 3,
    effectText: 'Records every move.',
    emoji: '🎥',
  }),
  Object.freeze({
    id: 'ab-test',
    name: 'A/B Test',
    cost: 3,
    type: 'spell',
    effectText: 'Random 50/50 outcome.',
    emoji: '🅰️🅱️',
  }),
  Object.freeze({
    id: 'funnel',
    name: 'Funnel',
    cost: 4,
    type: 'minion',
    attack: 3,
    hp: 4,
    effectText: 'Converts pressure into value.',
    emoji: '🔻',
  }),
  Object.freeze({
    id: 'cohort',
    name: 'Cohort',
    cost: 2,
    type: 'spell',
    effectText: 'Group users for a focused play.',
    emoji: '👥',
  }),
  Object.freeze({
    id: 'insight',
    name: 'Insight',
    cost: 3,
    type: 'spell',
    effectText: 'Draw cards.',
    emoji: '💡',
  }),
  Object.freeze({
    id: 'surveys',
    name: 'Surveys',
    cost: 1,
    type: 'spell',
    effectText: 'Ask, learn, adapt.',
    emoji: '📋',
  }),
  Object.freeze({
    id: 'heatmap',
    name: 'Heatmap',
    cost: 4,
    type: 'spell',
    effectText: 'Deal direct damage.',
    emoji: '🔥',
  }),
  Object.freeze({
    id: 'experiment',
    name: 'Experiment',
    cost: 5,
    type: 'minion',
    attack: 4,
    hp: 5,
    effectText: 'Big test, bigger payoff.',
    emoji: '🧪',
  }),
]);

function cloneCard(card) {
  return { ...card };
}

function cloneMinion(minion) {
  return { ...minion };
}

function cloneHero(hero) {
  return {
    ...hero,
    mana: hero.mana ? { ...hero.mana } : undefined,
  };
}

/**
 * Creates the UI stub state consumed by the Insight Wars board.
 * Later stacked work can replace this implementation without changing the UI surface.
 *
 * @returns {GameState}
 */
export function createInitialGameState() {
  return {
    turn: 1,
    activePlayer: 'player',
    gameOver: null,
    player: {
      id: 'player',
      name: 'Max the Hedgehog',
      emoji: '🦔',
      hp: 20,
      mana: { current: 1, max: 1 },
    },
    ai: {
      id: 'ai',
      name: 'Dark Funnel PM',
      emoji: '🕴️',
      hp: 20,
    },
    playerHand: INSIGHT_WARS_CARD_SET.slice(0, 3).map(cloneCard),
    playerBoard: [],
    aiBoard: [],
  };
}

/**
 * Stub card play resolver. Hoglet 2 owns real resolution and validation.
 *
 * @param {GameState} state
 * @param {string} cardId
 * @param {string=} target
 * @returns {GameState}
 */
export function playCard(state, cardId, target) {
  void cardId;
  void target;
  return state;
}

/**
 * Stub attack resolver. Hoglet 2 owns combat rules and targeting.
 *
 * @param {GameState} state
 * @param {string} attackerId
 * @param {string} targetId
 * @returns {GameState}
 */
export function attack(state, attackerId, targetId) {
  void attackerId;
  void targetId;
  return state;
}

/**
 * Trivial turn flipper for UI testing. Real turn progression belongs to game-state logic.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function endTurn(state) {
  const nextActivePlayer = state.activePlayer === 'player' ? 'ai' : 'player';
  const nextTurn = nextActivePlayer === 'player' ? state.turn + 1 : state.turn;
  const nextPlayer = cloneHero(state.player);

  if (nextActivePlayer === 'player' && nextPlayer.mana) {
    const nextMax = Math.min(10, nextPlayer.mana.max + 1);
    nextPlayer.mana = { current: nextMax, max: nextMax };
  }

  return {
    ...state,
    turn: nextTurn,
    activePlayer: nextActivePlayer,
    player: nextPlayer,
    ai: cloneHero(state.ai),
    playerHand: state.playerHand.map(cloneCard),
    playerBoard: state.playerBoard.map(cloneMinion),
    aiBoard: state.aiBoard.map(cloneMinion),
  };
}
