/**
 * Insight Wars card taxonomy.
 *
 * Deck composition (same for player and AI, 21 cards total):
 * - 3x Feature Flag, Insight, Surveys
 * - 2x Session Replay, A/B Test, Funnel, Cohort, Heatmap, Experiment
 *
 * @typedef {'feature-flag'|'session-replay'|'ab-test'|'funnel'|'cohort'|'insight'|'surveys'|'heatmap'|'experiment'} CardId
 * @typedef {'disableMinion'|'revealHand'|'summon'|'heal'|'damageTarget'} EffectType
 * @typedef {{ attack: number, hp: number, name: string }} SummonEffect
 * @typedef {{ amount?: number, heroDamage?: number, minionDamage?: number, summon?: SummonEffect }} CardEffect
 * @typedef {{ id: CardId, name: string, cost: number, effectType: EffectType, text: string, effect: CardEffect }} Card
 */

/** @type {Record<CardId, Card>} */
export const CARDS = Object.freeze({
  'feature-flag': Object.freeze({
    id: 'feature-flag',
    name: 'Feature Flag',
    cost: 1,
    effectType: 'disableMinion',
    text: 'Disable one enemy minion next turn.',
    effect: {},
  }),
  'session-replay': Object.freeze({
    id: 'session-replay',
    name: 'Session Replay',
    cost: 2,
    effectType: 'revealHand',
    text: 'Reveal the AI hand for 1 turn. No-op for AI.',
    effect: { amount: 1 },
  }),
  'ab-test': Object.freeze({
    id: 'ab-test',
    name: 'A/B Test',
    cost: 3,
    effectType: 'summon',
    text: 'Summon a 2/3 experiment variant.',
    effect: { summon: { name: 'A/B Test Variant', attack: 2, hp: 3 } },
  }),
  funnel: Object.freeze({
    id: 'funnel',
    name: 'Funnel',
    cost: 4,
    effectType: 'summon',
    text: 'Summon a 4/4 Funnel minion.',
    effect: { summon: { name: 'Funnel', attack: 4, hp: 4 } },
  }),
  cohort: Object.freeze({
    id: 'cohort',
    name: 'Cohort',
    cost: 3,
    effectType: 'summon',
    text: 'Summon a 3/2 Cohort minion.',
    effect: { summon: { name: 'Cohort', attack: 3, hp: 2 } },
  }),
  insight: Object.freeze({
    id: 'insight',
    name: 'Insight',
    cost: 1,
    effectType: 'damageTarget',
    text: 'Deal 2 damage to an enemy target.',
    effect: { amount: 2 },
  }),
  surveys: Object.freeze({
    id: 'surveys',
    name: 'Surveys',
    cost: 2,
    effectType: 'heal',
    text: 'Heal your hero 4 (cap at 20).',
    effect: { amount: 4 },
  }),
  heatmap: Object.freeze({
    id: 'heatmap',
    name: 'Heatmap',
    cost: 3,
    effectType: 'damageTarget',
    text: 'Deal 3 damage to a target. AI auto-targets the enemy hero.',
    effect: { amount: 3 },
  }),
  experiment: Object.freeze({
    id: 'experiment',
    name: 'Experiment',
    cost: 5,
    effectType: 'summon',
    text: 'Summon a 5/5 Experiment minion.',
    effect: { summon: { name: 'Experiment', attack: 5, hp: 5 } },
  }),
});

/** @type {CardId[]} */
export const DECK_CARD_IDS = Object.freeze([
  'feature-flag', 'feature-flag', 'feature-flag',
  'insight', 'insight', 'insight',
  'surveys', 'surveys', 'surveys',
  'session-replay', 'session-replay',
  'ab-test', 'ab-test',
  'funnel', 'funnel',
  'cohort', 'cohort',
  'heatmap', 'heatmap',
  'experiment', 'experiment',
]);

/**
 * @returns {Card[]}
 */
export function createDeck(){
  return DECK_CARD_IDS.map((id) => CARDS[id]);
}

/**
 * @param {CardId} id
 * @returns {Card}
 */
export function getCard(id){
  return CARDS[id];
}
