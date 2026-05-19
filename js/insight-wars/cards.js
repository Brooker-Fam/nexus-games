/**
 * Insight Wars card catalog.
 *
 * Costs were chosen as a sensible foundation because the operator transcript with
 * exact card effects was not present in this repository. Hoglet 2 can keep the
 * public IDs/cost shape and replace the stub resolvers with full effects.
 *
 * @typedef {'player' | 'ai'} Owner
 * @typedef {'spell' | 'minion'} CardType
 * @typedef {import('./state.js').GameState} GameState
 *
 * @typedef {object} Card
 * @property {string} id
 * @property {string} name
 * @property {number} cost
 * @property {string} emoji
 * @property {string} description
 * @property {CardType} type
 */

/** @type {Record<string, number>} */
export const CARD_COSTS = Object.freeze({
  'feature-flag': 1,
  'session-replay': 2,
  'ab-test': 2,
  funnel: 3,
  cohort: 3,
  insight: 4,
  experiment: 4,
  heatmap: 5,
  dashboard: 6,
});

export const CARD_EFFECTS = Object.freeze({
  'feature-flag': Object.freeze({ stunTurns: 1 }),
  'session-replay': Object.freeze({ revealAiHand: true }),
  'ab-test': Object.freeze({ heroDamage: 5, heroHeal: 5 }),
  funnel: Object.freeze({ enemyBoardDamage: 2 }),
  cohort: Object.freeze({ attack: 2, hp: 4 }),
  insight: Object.freeze({ drawCards: 2 }),
  experiment: Object.freeze({ attack: 4, hp: 3 }),
  heatmap: Object.freeze({ damage: 4 }),
  dashboard: Object.freeze({ attack: 5, hp: 7 }),
});

/**
 * @param {Card} card
 * @returns {Card}
 */
function defineCard(card){
  return Object.freeze({ ...card });
}

/** @type {readonly Card[]} */
export const CARD_CATALOG = Object.freeze([
  defineCard({
    id: 'feature-flag',
    name: 'Feature Flag',
    cost: CARD_COSTS['feature-flag'],
    emoji: '🚩',
    description: 'Stun an enemy minion for its next turn.',
    type: 'spell',
  }),
  defineCard({
    id: 'session-replay',
    name: 'Session Replay',
    cost: CARD_COSTS['session-replay'],
    emoji: '🎥',
    description: 'Player: reveal the AI hand this turn. AI: no effect.',
    type: 'spell',
  }),
  defineCard({
    id: 'ab-test',
    name: 'A/B Test',
    cost: CARD_COSTS['ab-test'],
    emoji: '🧪',
    description: 'Randomly deal 5 damage to the enemy hero or heal your hero for 5.',
    type: 'spell',
  }),
  defineCard({
    id: 'funnel',
    name: 'Funnel',
    cost: CARD_COSTS.funnel,
    emoji: '🔻',
    description: 'Deal 2 damage to each enemy minion.',
    type: 'spell',
  }),
  defineCard({
    id: 'cohort',
    name: 'Cohort',
    cost: CARD_COSTS.cohort,
    emoji: '👥',
    description: 'Summon a 2/4 minion.',
    type: 'minion',
  }),
  defineCard({
    id: 'insight',
    name: 'Insight',
    cost: CARD_COSTS.insight,
    emoji: '💡',
    description: 'Draw 2 cards.',
    type: 'spell',
  }),
  defineCard({
    id: 'experiment',
    name: 'Experiment',
    cost: CARD_COSTS.experiment,
    emoji: '⚗️',
    description: 'Summon a 4/3 minion.',
    type: 'minion',
  }),
  defineCard({
    id: 'heatmap',
    name: 'Heatmap',
    cost: CARD_COSTS.heatmap,
    emoji: '🔥',
    description: 'Deal 4 damage to a target; defaults to the enemy hero.',
    type: 'spell',
  }),
  defineCard({
    id: 'dashboard',
    name: 'Dashboard',
    cost: CARD_COSTS.dashboard,
    emoji: '📊',
    description: 'Summon a 5/7 minion.',
    type: 'minion',
  }),
]);

/** @type {ReadonlyMap<string, Card>} */
export const CARD_REGISTRY = Object.freeze(new Map(CARD_CATALOG.map((card) => [card.id, card])));

/**
 * @param {string} cardId
 * @returns {Card}
 */
export function getCard(cardId){
  const card = CARD_REGISTRY.get(cardId);
  if(!card) throw new Error(`Unknown card: ${cardId}`);
  return card;
}
