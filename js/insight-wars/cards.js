// Insight Wars card catalogue and deck helpers.
// This module is deliberately UI-free so it can be reused by tests and any future renderer.

export const CARD_IDS = Object.freeze({
  FEATURE_FLAG: 'feature-flag',
  SESSION_REPLAY: 'session-replay',
  AB_TEST: 'ab-test',
  FUNNEL: 'funnel',
  COHORT: 'cohort',
  INSIGHT: 'insight',
  SURVEYS: 'surveys',
  HEATMAP: 'heatmap',
  EXPERIMENT: 'experiment',
});

export const CARD_DEFINITIONS = Object.freeze({
  [CARD_IDS.FEATURE_FLAG]: Object.freeze({
    id: CARD_IDS.FEATURE_FLAG,
    name: 'Feature Flag',
    cost: 1,
    text: 'Disable one enemy minion for its next turn.',
  }),
  [CARD_IDS.SESSION_REPLAY]: Object.freeze({
    id: CARD_IDS.SESSION_REPLAY,
    name: 'Session Replay',
    cost: 2,
    text: "Reveal the opponent's hand until end of turn.",
  }),
  [CARD_IDS.AB_TEST]: Object.freeze({
    id: CARD_IDS.AB_TEST,
    name: 'A/B Test',
    cost: 3,
    text: '50/50: deal 5 damage to the enemy hero or heal yourself for 5.',
  }),
  [CARD_IDS.FUNNEL]: Object.freeze({
    id: CARD_IDS.FUNNEL,
    name: 'Funnel',
    cost: 4,
    text: 'Deal 2 damage to all enemy minions.',
  }),
  [CARD_IDS.COHORT]: Object.freeze({
    id: CARD_IDS.COHORT,
    name: 'Cohort',
    cost: 3,
    text: 'Summon a 2/3 minion.',
  }),
  [CARD_IDS.INSIGHT]: Object.freeze({
    id: CARD_IDS.INSIGHT,
    name: 'Insight',
    cost: 1,
    text: 'Draw 1 card.',
  }),
  [CARD_IDS.SURVEYS]: Object.freeze({
    id: CARD_IDS.SURVEYS,
    name: 'Surveys',
    cost: 2,
    text: 'Heal your hero for 4.',
  }),
  [CARD_IDS.HEATMAP]: Object.freeze({
    id: CARD_IDS.HEATMAP,
    name: 'Heatmap',
    cost: 3,
    text: 'Deal 4 damage to a target.',
  }),
  [CARD_IDS.EXPERIMENT]: Object.freeze({
    id: CARD_IDS.EXPERIMENT,
    name: 'Experiment',
    cost: 5,
    text: 'Summon a 5/5 minion.',
  }),
});

export const ALL_CARD_IDS = Object.freeze(Object.values(CARD_IDS));

let nextCardInstance = 1;

export function getCardDefinition(cardOrId){
  const id = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
  return CARD_DEFINITIONS[id] ?? null;
}

export function createCard(cardOrId){
  const definition = getCardDefinition(cardOrId);
  if(!definition) throw new Error(`Unknown Insight Wars card: ${String(cardOrId)}`);
  return {
    ...definition,
    instanceId: `card-${nextCardInstance++}`,
  };
}

export function buildDeck({ copies = 2, shuffle = true, rng = Math.random } = {}){
  const deck = [];
  for(let i = 0; i < copies; i++){
    for(const id of ALL_CARD_IDS) deck.push(createCard(id));
  }
  return shuffle ? shuffleDeck(deck, rng) : deck;
}

export function shuffleDeck(cards, rng = Math.random){
  const deck = [...cards];
  for(let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
