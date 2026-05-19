import { attackWithMinion, endTurn, playCard } from './turn-engine.js';

/**
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./cards.js').Card} Card
 */

/**
 * Runs a simple greedy AI turn:
 * 1. Repeatedly play the highest-cost affordable card.
 * 2. Send every ready minion at the player hero.
 * 3. End the AI turn.
 *
 * The AI intentionally has no targeting intelligence beyond hero damage. The
 * only exception is Feature Flag, which needs a minion target to have any effect;
 * it uses the first player minion if one exists, otherwise it fizzles after mana
 * is spent.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function runAiTurn(state){
  if(state.phase !== 'playing' || state.activePlayer !== 'ai') return state;

  let next = state;
  let safety = 100;

  while(next.phase === 'playing' && safety-- > 0){
    const cardIndex = findHighestCostPlayableCardIndex(next.ai.hand, next.ai.currentMana);
    if(cardIndex === -1) break;

    const card = next.ai.hand[cardIndex];
    next = playCard(next, cardIndex, targetForAiCard(next, card));
  }

  while(next.phase === 'playing'){
    const attacker = next.ai.board.find((minion) => minion.canAttack);
    if(!attacker) break;
    next = attackWithMinion(next, attacker.id, { type: 'hero', owner: 'player' });
  }

  return next.phase === 'playing' ? endTurn(next) : next;
}

/**
 * @param {Card[]} hand
 * @param {number} currentMana
 * @returns {number}
 */
function findHighestCostPlayableCardIndex(hand, currentMana){
  let bestIndex = -1;
  let bestCost = -1;

  for(let index = 0; index < hand.length; index++){
    const card = hand[index];
    if(card.cost <= currentMana && card.cost > bestCost){
      bestIndex = index;
      bestCost = card.cost;
    }
  }

  return bestIndex;
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @returns {{type: 'hero' | 'minion', owner?: 'player' | 'ai', id?: string} | undefined}
 */
function targetForAiCard(state, card){
  if(card.id === 'heatmap'){
    return { type: 'hero', owner: 'player' };
  }

  if(card.id === 'feature-flag'){
    const [firstPlayerMinion] = state.player.board;
    return firstPlayerMinion
      ? { type: 'minion', owner: 'player', id: firstPlayerMinion.id }
      : undefined;
  }

  return undefined;
}
