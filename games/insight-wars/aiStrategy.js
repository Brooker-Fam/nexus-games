import { getCardDefinition } from './cards.js';
import { attack, endTurn, playCard } from './gameState.js';

export const AI_MAX_ACTION_ITERATIONS = 50;

function highestAttackMinionIndex(minions) {
  if (!minions.length) return undefined;

  let bestIndex = 0;
  for (let index = 1; index < minions.length; index += 1) {
    if (minions[index].attack > minions[bestIndex].attack) bestIndex = index;
  }
  return bestIndex;
}

function chooseAiTarget(state, card) {
  const playerMinions = state.boards.player;

  if (card.type === 'heatmap') return 'hero';
  if (card.type === 'feature-flag') {
    return playerMinions.length ? highestAttackMinionIndex(playerMinions) : 'hero';
  }
  if (card.type === 'ab-test') {
    return playerMinions.length ? highestAttackMinionIndex(playerMinions) : 'hero';
  }

  return undefined;
}

function findHighestCostAffordableCardIndex(state) {
  const { hand } = { hand: state.hands.ai };
  let bestIndex = -1;

  for (let index = 0; index < hand.length; index += 1) {
    const card = hand[index];
    if (card.cost > state.mana.ai.current) continue;

    if (bestIndex === -1 || card.cost > hand[bestIndex].cost) {
      bestIndex = index;
      continue;
    }

    if (bestIndex !== -1 && card.cost === hand[bestIndex].cost) {
      const cardKind = getCardDefinition(card).kind;
      const bestKind = getCardDefinition(hand[bestIndex]).kind;
      if (cardKind === 'spell' && bestKind === 'minion') bestIndex = index;
    }
  }

  return bestIndex;
}

export function takeAiTurn(state) {
  let nextState = state.activePlayer === 'ai' ? state : endTurn(state);
  let iterations = 0;

  while (!nextState.winner && iterations < AI_MAX_ACTION_ITERATIONS) {
    iterations += 1;
    const cardIndex = findHighestCostAffordableCardIndex(nextState);
    if (cardIndex < 0) break;

    const card = nextState.hands.ai[cardIndex];
    const target = chooseAiTarget(nextState, card);
    const before = nextState;
    nextState = playCard(nextState, 'ai', cardIndex, target);

    if (nextState === before) break;
  }

  for (let index = 0; index < nextState.boards.ai.length && !nextState.winner; index += 1) {
    if (nextState.boards.ai[index]?.canAttack) {
      nextState = attack(nextState, 'ai', index, 'hero');
    }
  }

  if (!nextState.winner && nextState.activePlayer === 'ai') {
    nextState = endTurn(nextState);
  }

  return nextState;
}
