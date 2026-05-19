import { HERO_MAX_HP } from './types.js';
import {
  damageAllMinions,
  damageHero,
  disableMinionUntilTurn,
  healHero,
  isGameOver,
  otherPlayer,
} from './rules.js';

function noOpResolve(state){
  return state;
}

function targetPlayer(target, fallback){
  if(target && typeof target === 'object' && target.type === 'hero' && target.player){
    return target.player;
  }
  if(target === 'player' || target === 'ai') return target;
  return fallback;
}

function targetMinion(target){
  if(target && typeof target === 'object' && target.type === 'minion'){
    return { owner: target.player || target.owner, minionId: target.minionId || target.id };
  }
  return null;
}

function heatmapResolve(state, ctx){
  const fallback = otherPlayer(ctx.player);
  return damageHero(state, targetPlayer(ctx.target, fallback), 2);
}

function featureFlagResolve(state, ctx){
  const target = targetMinion(ctx.target);
  if(!target?.owner || !target?.minionId) return state;
  return disableMinionUntilTurn(state, target.owner, target.minionId, state.turnNumber + 1);
}

function abTestResolve(state, ctx){
  const rng = state.rng || Math.random;
  const enemy = otherPlayer(ctx.player);
  const didDamage = rng() < 0.5;
  const nextState = didDamage
    ? damageHero(state, enemy, 5)
    : healHero(state, ctx.player, 5);

  return {
    ...nextState,
    log: [
      ...nextState.log,
      didDamage
        ? `${ctx.card.name} variant shipped damage.`
        : `${ctx.card.name} variant shipped healing.`,
    ],
  };
}

function funnelResolve(state, ctx){
  const enemy = otherPlayer(ctx.player);
  let nextState = damageHero(state, enemy, 2);
  if(isGameOver(nextState)) return nextState;
  nextState = damageAllMinions(nextState, enemy, 1);
  return nextState;
}

function insightResolve(state, ctx){
  const playerState = state.players[ctx.player];
  const afterDraw = drawCards(playerState, 1);
  return {
    ...state,
    players: {
      ...state.players,
      [ctx.player]: afterDraw,
    },
  };
}

function surveysResolve(state, ctx){
  return healHero(state, ctx.player, 3);
}

function summonMinionResolve(state, ctx){
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
    attackedThisTurn: false,
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
  { key: 'feature-flag', name: 'Feature Flag', cost: 1, type: 'spell', count: 3, resolve: featureFlagResolve },
  { key: 'session-replay', name: 'Session Replay', cost: 2, type: 'spell', count: 2, resolve: noOpResolve },
  { key: 'ab-test', name: 'A/B Test', cost: 3, type: 'spell', count: 2, resolve: abTestResolve },
  { key: 'funnel', name: 'Funnel', cost: 4, type: 'spell', count: 2, resolve: funnelResolve },
  { key: 'cohort', name: 'Cohort', cost: 3, type: 'minion', count: 3, minionStats: { attack: 2, hp: 3 }, resolve: summonMinionResolve },
  { key: 'insight', name: 'Insight', cost: 1, type: 'spell', count: 3, resolve: insightResolve },
  { key: 'surveys', name: 'Surveys', cost: 2, type: 'spell', count: 2, resolve: surveysResolve },
  { key: 'heatmap', name: 'Heatmap', cost: 3, type: 'spell', count: 2, resolve: heatmapResolve },
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
