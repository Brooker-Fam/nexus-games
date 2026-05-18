import { CARD_DEFINITIONS } from './cards.js';
import { createRng, normalizeSeed } from './rng.js';

export const DEFAULT_DECK_COMPOSITION = Object.freeze([
  ['feature-flag', 3],
  ['session-replay', 2],
  ['ab-test', 2],
  ['funnel', 3],
  ['cohort', 2],
  ['insight', 3],
  ['surveys', 2],
  ['heatmap', 2],
  ['experiment', 3],
]);

export function cloneCardDefinition(type, copyIndex) {
  const definition = CARD_DEFINITIONS[type];
  if (!definition) throw new Error(`Unknown Insight Wars card type: ${type}`);

  const { resolve: _resolve, ...serializableDefinition } = definition;
  return {
    ...serializableDefinition,
    id: `${type}-${copyIndex}`,
    type,
  };
}

export function buildDeck(composition = DEFAULT_DECK_COMPOSITION) {
  const copyCounts = new Map();

  return composition.flatMap(([type, copies]) => {
    const cards = [];
    for (let index = 0; index < copies; index += 1) {
      const nextCopy = (copyCounts.get(type) || 0) + 1;
      copyCounts.set(type, nextCopy);
      cards.push(cloneCardDefinition(type, nextCopy));
    }
    return cards;
  });
}

export function shuffle(deck, rng = createRng()) {
  const shuffled = deck.map((card) => ({ ...card }));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export { createRng, normalizeSeed } from './rng.js';
