import { HERO_MAX_HP } from './types.js';

function noOpResolve(state){
  // TODO(next-hoglet): Replace placeholder spell resolves with real card effects.
  return state;
}

function summonMinionResolve(state, ctx){
  // TODO(next-hoglet): Add any minion battlecry-style card effects here.
  const stats = ctx.card.minionStats;
  if(!stats) return state;

  const minion = {
    id: ctx.minionId || `${ctx.player}-minion-${state.nextId}`,
    owner: ctx.player,
    name: ctx.card.name,
    attack: stats.attack,
    hp: Math.min(stats.hp, HERO_MAX_HP),
    maxHp: Math.min(stats.hp, HERO_MAX_HP),
    summoningSick: true,
  };

  return {
    ...state,
    players: {
      ...state.players,
      [ctx.player]: {
        ...state.players[ctx.player],
        board: [...state.players[ctx.player].board, minion],
      },
    },
  };
}

/** @type {import('./types.js').CardDefinition[]} */
export const CARD_DEFINITIONS = [
  { key: 'feature-flag', name: 'Feature Flag', cost: 1, type: 'spell', count: 3, resolve: noOpResolve },
  { key: 'session-replay', name: 'Session Replay', cost: 2, type: 'spell', count: 2, resolve: noOpResolve },
  { key: 'ab-test', name: 'A/B Test', cost: 3, type: 'spell', count: 2, resolve: noOpResolve },
  { key: 'funnel', name: 'Funnel', cost: 4, type: 'spell', count: 2, resolve: noOpResolve },
  { key: 'cohort', name: 'Cohort', cost: 3, type: 'minion', count: 3, minionStats: { attack: 2, hp: 3 }, resolve: summonMinionResolve },
  { key: 'insight', name: 'Insight', cost: 1, type: 'spell', count: 3, resolve: noOpResolve },
  { key: 'surveys', name: 'Surveys', cost: 2, type: 'spell', count: 2, resolve: noOpResolve },
  { key: 'heatmap', name: 'Heatmap', cost: 3, type: 'spell', count: 2, resolve: noOpResolve },
  { key: 'experiment', name: 'Experiment', cost: 5, type: 'minion', count: 2, minionStats: { attack: 5, hp: 5 }, resolve: summonMinionResolve },
];

export function getDeckComposition(){
  return CARD_DEFINITIONS.map(({ key, name, cost, type, count, minionStats }) => ({
    key,
    name,
    cost,
    type,
    count,
    ...(minionStats ? { minionStats: { ...minionStats } } : {}),
  }));
}

export function getCardDefinition(key){
  return CARD_DEFINITIONS.find((card) => card.key === key) || null;
}

export function createDeck(rng = Math.random){
  const cards = [];
  for(const definition of CARD_DEFINITIONS){
    for(let copy = 1; copy <= definition.count; copy++){
      cards.push({
        id: `${definition.key}-${copy}`,
        definitionKey: definition.key,
        name: definition.name,
        cost: definition.cost,
        type: definition.type,
        ...(definition.minionStats ? { minionStats: { ...definition.minionStats } } : {}),
      });
    }
  }
  return shuffle(cards, rng);
}

export function shuffle(cards, rng = Math.random){
  const shuffled = [...cards];
  for(let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCards(playerState, count = 1){
  let deck = [...playerState.deck];
  let hand = [...playerState.hand];
  for(let i = 0; i < count && deck.length > 0; i++){
    const [drawn, ...rest] = deck;
    hand = [...hand, drawn];
    deck = rest;
  }
  return { ...playerState, deck, hand };
}
