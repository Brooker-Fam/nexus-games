import { CARD_CATALOG, getCard } from './cards.js';

/**
 * 20-card deterministic starter list: every one of the 9 cards appears 2 times,
 * with Feature Flag and Insight getting a third copy to reach 20.
 */
export const STARTER_DECK_CARD_IDS = Object.freeze([
  'feature-flag',
  'feature-flag',
  'feature-flag',
  'session-replay',
  'session-replay',
  'ab-test',
  'ab-test',
  'funnel',
  'funnel',
  'cohort',
  'cohort',
  'insight',
  'insight',
  'insight',
  'experiment',
  'experiment',
  'heatmap',
  'heatmap',
  'dashboard',
  'dashboard',
]);

/**
 * @typedef {import('./cards.js').Card} Card
 * @typedef {import('./rng.js').Rng} Rng
 */

/**
 * @param {{ rng?: Rng, shuffle?: boolean }} [options]
 * @returns {Card[]}
 */
export function buildStarterDeck(options = {}){
  const { rng = Math.random, shuffle = true } = options;
  const deck = STARTER_DECK_CARD_IDS.map(getCard);
  return shuffle ? shuffleDeck(deck, rng) : deck;
}

/**
 * @param {Card[]} cards
 * @param {Rng} rng
 * @returns {Card[]}
 */
export function shuffleDeck(cards, rng){
  const shuffled = [...cards];
  for(let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * @param {Card[]} deck
 * @returns {Record<string, number>}
 */
export function countCards(deck){
  return deck.reduce((counts, card) => {
    counts[card.id] = (counts[card.id] || 0) + 1;
    return counts;
  }, /** @type {Record<string, number>} */ ({}));
}

export const UNIQUE_STARTER_CARD_COUNT = CARD_CATALOG.length;
