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
 * @property {(state: GameState, owner: Owner) => GameState} resolve
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

/**
 * Stub resolver used by every card in the foundation pass. It pays the card's
 * mana cost and appends a log entry, but intentionally applies no gameplay
 * effect yet.
 *
 * @param {Card} card
 * @returns {(state: GameState, owner: Owner) => GameState}
 */
function createStubResolver(card){
  return (state, owner) => {
    const side = state[owner];
    if(side.currentMana < card.cost){
      throw new Error(`${sideLabel(owner)} does not have enough mana for ${card.name}.`);
    }

    return {
      ...state,
      [owner]: {
        ...side,
        currentMana: side.currentMana - card.cost,
      },
      log: [
        ...state.log,
        `${sideLabel(owner)} played ${card.emoji} ${card.name}. Effect pending.`,
      ],
    };
  };
}

/**
 * @param {Owner} owner
 */
function sideLabel(owner){
  return owner === 'player' ? 'Player' : 'AI';
}

/**
 * @param {Omit<Card, 'resolve'>} card
 * @returns {Card}
 */
function defineCard(card){
  const fullCard = /** @type {Card} */ ({ ...card, resolve: undefined });
  fullCard.resolve = createStubResolver(fullCard);
  return Object.freeze(fullCard);
}

/** @type {readonly Card[]} */
export const CARD_CATALOG = Object.freeze([
  defineCard({
    id: 'feature-flag',
    name: 'Feature Flag',
    cost: CARD_COSTS['feature-flag'],
    emoji: '🚩',
    description: 'Stub: toggle a rollout lever. Future effect will modify the next play.',
    type: 'spell',
  }),
  defineCard({
    id: 'session-replay',
    name: 'Session Replay',
    cost: CARD_COSTS['session-replay'],
    emoji: '🎥',
    description: 'Stub: review the previous move. Future effect will reveal and copy information.',
    type: 'spell',
  }),
  defineCard({
    id: 'ab-test',
    name: 'A/B Test',
    cost: CARD_COSTS['ab-test'],
    emoji: '🧪',
    description: 'Stub minion: compare variants before shipping a stronger result.',
    type: 'minion',
  }),
  defineCard({
    id: 'funnel',
    name: 'Funnel',
    cost: CARD_COSTS.funnel,
    emoji: '🔻',
    description: 'Stub: pressure enemy conversion paths. Future effect will damage or filter targets.',
    type: 'spell',
  }),
  defineCard({
    id: 'cohort',
    name: 'Cohort',
    cost: CARD_COSTS.cohort,
    emoji: '👥',
    description: 'Stub minion: gather matching users into a durable board presence.',
    type: 'minion',
  }),
  defineCard({
    id: 'insight',
    name: 'Insight',
    cost: CARD_COSTS.insight,
    emoji: '💡',
    description: 'Stub: turn evidence into advantage. Future effect will draw or discover cards.',
    type: 'spell',
  }),
  defineCard({
    id: 'experiment',
    name: 'Experiment',
    cost: CARD_COSTS.experiment,
    emoji: '⚗️',
    description: 'Stub minion: run a hypothesis on the board until results are significant.',
    type: 'minion',
  }),
  defineCard({
    id: 'heatmap',
    name: 'Heatmap',
    cost: CARD_COSTS.heatmap,
    emoji: '🔥',
    description: 'Stub: expose hot zones. Future effect will affect multiple enemies.',
    type: 'spell',
  }),
  defineCard({
    id: 'dashboard',
    name: 'Dashboard',
    cost: CARD_COSTS.dashboard,
    emoji: '📊',
    description: 'Stub minion: consolidate metrics into a late-game threat.',
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
