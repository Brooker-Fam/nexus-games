import { HERO_MAX_HP } from './types.js';
import {
  damageHeroState,
  damageMinionState,
  findMinion,
  healHeroState,
  isHeroTarget,
  isMinionTarget,
  mapMinion,
  removeDeadMinions,
} from './effects.js';

function otherPlayer(player){
  return player === 'player' ? 'ai' : 'player';
}

function featureFlagResolve(state, ctx){
  if(!isMinionTarget(ctx.target)) return state;
  const enemy = otherPlayer(ctx.player);
  if(ctx.target.player !== enemy || !findMinion(state, enemy, ctx.target.minionId)) return state;

  return mapMinion(state, enemy, ctx.target.minionId, (minion) => ({
    ...minion,
    disabled: true,
  }));
}

function sessionReplayResolve(state, ctx){
  if(ctx.player !== 'player') return state;

  return {
    ...state,
    revealedHands: {
      ...(state.revealedHands || {}),
      ai: true,
    },
  };
}

function abTestResolve(state, ctx){
  const roll = Math.random();
  if(roll < 0.5){
    return damageHeroState(state, otherPlayer(ctx.player), 5);
  }
  return healHeroState(state, ctx.player, 5);
}

function funnelResolve(state, ctx){
  const enemy = otherPlayer(ctx.player);
  let nextState = damageHeroState(state, enemy, 2);
  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [enemy]: {
        ...nextState.players[enemy],
        board: nextState.players[enemy].board.map((minion) => ({
          ...minion,
          hp: minion.hp - 1,
        })),
      },
    },
  };
  return removeDeadMinions(nextState);
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
    hasAttacked: false,
    disabled: false,
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

function insightResolve(state, ctx){
  return {
    ...state,
    players: {
      ...state.players,
      [ctx.player]: drawCards(state.players[ctx.player], 1),
    },
  };
}

function surveysResolve(state, ctx){
  return healHeroState(state, ctx.player, 4);
}

function heatmapResolve(state, ctx){
  if(isHeroTarget(ctx.target)){
    return damageHeroState(state, ctx.target.player, 4);
  }

  if(isMinionTarget(ctx.target) && findMinion(state, ctx.target.player, ctx.target.minionId)){
    return damageMinionState(state, ctx.target.player, ctx.target.minionId, 4);
  }

  return state;
}

/** @type {import('./types.js').CardDefinition[]} */
export const CARD_DEFINITIONS = [
  { key: 'feature-flag', name: 'Feature Flag', cost: 1, type: 'spell', count: 3, effectText: 'Disable an enemy minion next turn.', resolve: featureFlagResolve },
  { key: 'session-replay', name: 'Session Replay', cost: 2, type: 'spell', count: 2, effectText: 'Reveal the AI hand this turn.', resolve: sessionReplayResolve },
  { key: 'ab-test', name: 'A/B Test', cost: 3, type: 'spell', count: 2, effectText: '50/50: deal 5 damage or heal 5.', resolve: abTestResolve },
  { key: 'funnel', name: 'Funnel', cost: 4, type: 'spell', count: 2, effectText: 'Deal 2 to hero and 1 to all minions.', resolve: funnelResolve },
  { key: 'cohort', name: 'Cohort', cost: 3, type: 'minion', count: 3, minionStats: { attack: 2, hp: 3 }, effectText: 'Summon a 2/3 minion.', resolve: summonMinionResolve },
  { key: 'insight', name: 'Insight', cost: 1, type: 'spell', count: 3, effectText: 'Draw 1 card.', resolve: insightResolve },
  { key: 'surveys', name: 'Surveys', cost: 2, type: 'spell', count: 2, effectText: 'Heal your hero for 4 HP.', resolve: surveysResolve },
  { key: 'heatmap', name: 'Heatmap', cost: 3, type: 'spell', count: 2, effectText: 'Deal 4 damage to any target.', resolve: heatmapResolve },
  { key: 'experiment', name: 'Experiment', cost: 5, type: 'minion', count: 2, minionStats: { attack: 5, hp: 5 }, effectText: 'Summon a 5/5 minion.', resolve: summonMinionResolve },
];

export function getDeckComposition(){
  return CARD_DEFINITIONS.map(({ key, name, cost, type, count, minionStats, effectText }) => ({
    key,
    name,
    cost,
    type,
    count,
    effectText,
    ...(minionStats ? { minionStats: { ...minionStats } } : {}),
  }));
}

export function getCardDefinition(key){
  return CARD_DEFINITIONS.find((card) => card.key === key) || null;
}

export function cardRequiresTarget(cardOrKey){
  const key = typeof cardOrKey === 'string' ? cardOrKey : cardOrKey?.definitionKey;
  return key === 'feature-flag' || key === 'heatmap';
}

export function isValidCardTarget(state, player, cardOrKey, target){
  const key = typeof cardOrKey === 'string' ? cardOrKey : cardOrKey?.definitionKey;
  if(key === 'feature-flag'){
    const enemy = otherPlayer(player);
    return isMinionTarget(target)
      && target.player === enemy
      && Boolean(findMinion(state, enemy, target.minionId));
  }

  if(key === 'heatmap'){
    if(isHeroTarget(target)) return true;
    return isMinionTarget(target) && Boolean(findMinion(state, target.player, target.minionId));
  }

  return true;
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
        effectText: definition.effectText,
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
