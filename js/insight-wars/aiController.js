import {
  attackTarget,
  canMinionAttack,
  endTurn,
  manaFor,
  opponentOf,
  resolveCard,
} from './gameState.js';

const MAX_AI_CARD_PLAYS_PER_TURN = 50;

/**
 * @typedef {import('./gameState.js').GameState} GameState
 * @typedef {import('./gameState.js').PlayerId} PlayerId
 * @typedef {import('./gameState.js').Target} Target
 * @typedef {import('./cards.js').Card} Card
 */

/**
 * Finds the strongest opposing minion for Feature Flag. Ties are stable so tests
 * and replays remain deterministic.
 * @param {GameState} state
 * @param {PlayerId} player
 * @returns {Target|undefined}
 */
function strongestEnemyMinionTarget(state, player){
  const opponent = opponentOf(player);
  const strongest = state.boards[opponent].reduce((best, minion) => {
    if(!best || minion.attack > best.attack) return minion;
    return best;
  }, undefined);

  if(!strongest) return undefined;
  return { type: 'minion', owner: opponent, minionId: strongest.id };
}

/**
 * Chooses the deterministic target the greedy AI should pass to card resolution.
 * @param {GameState} state
 * @param {PlayerId} player
 * @param {Card} card
 * @returns {Target|undefined}
 */
export function chooseAiCardTarget(state, player, card){
  const opponent = opponentOf(player);

  if(card.effectType === 'disableMinion'){
    return strongestEnemyMinionTarget(state, player);
  }

  if(card.effectType === 'damageTarget' || card.id === 'heatmap' || card.id === 'insight'){
    return { type: 'hero', owner: opponent };
  }

  return undefined;
}

/**
 * @param {GameState} state
 * @param {PlayerId} player
 * @param {Card} card
 * @returns {boolean}
 */
function isAiCardPlayable(state, player, card){
  if(state.phase !== 'playing') return false;
  if(state.activePlayer !== player) return false;
  if(manaFor(state, player).current < card.cost) return false;
  if(card.effectType === 'disableMinion' && !chooseAiCardTarget(state, player, card)) return false;
  return true;
}

/**
 * @param {GameState} state
 * @param {PlayerId} player
 * @param {Set<Card>} skippedCards
 * @returns {Card|undefined}
 */
function findHighestCostPlayableCard(state, player, skippedCards){
  return state.hands[player].reduce((best, card) => {
    if(skippedCards.has(card)) return best;
    if(!isAiCardPlayable(state, player, card)) return best;
    if(!best || card.cost > best.cost) return card;
    return best;
  }, undefined);
}

/**
 * Restores Session Replay's AI-controller no-op semantics when the greedy
 * controller is driving the player side in AI-vs-AI simulations.
 * @param {GameState} state
 * @param {number|undefined} previousRevealTurn
 */
function restoreSessionReplayNoOp(state, previousRevealTurn){
  if(previousRevealTurn === undefined){
    delete state.aiHandRevealedUntilTurn;
  } else {
    state.aiHandRevealedUntilTurn = previousRevealTurn;
  }

  state.log[state.log.length - 1] = 'Session Replay has no AI effect.';
}

/**
 * Runs one greedy AI-controlled turn for the active player.
 *
 * Step A: repeatedly play the highest-cost affordable playable card.
 * Step B: attack the opposing hero once with each currently eligible minion.
 * Step C: end the turn.
 *
 * The controller is stateless and deterministic for a given GameState. It mutates
 * the supplied state, matching the rest of the Insight Wars game-state helpers.
 * @param {GameState} state
 * @param {PlayerId=} player defaults to the current active player so tests can run AI-vs-AI.
 * @returns {GameState}
 */
export function runAiTurn(state, player = state.activePlayer){
  if(state.phase !== 'playing') return state;
  if(state.activePlayer !== player) return state;

  const skippedCards = new Set();
  let cardPlays = 0;

  while(state.phase === 'playing' && cardPlays < MAX_AI_CARD_PLAYS_PER_TURN){
    const card = findHighestCostPlayableCard(state, player, skippedCards);
    if(!card) break;

    const target = chooseAiCardTarget(state, player, card);
    const previousRevealTurn = state.aiHandRevealedUntilTurn;
    const result = resolveCard(state, card, player, target);
    if(!result.ok){
      skippedCards.add(card);
      continue;
    }

    if(card.effectType === 'revealHand'){
      restoreSessionReplayNoOp(state, previousRevealTurn);
    }

    cardPlays += 1;
  }

  if(state.phase !== 'playing') return state;

  const opponent = opponentOf(player);
  const attackers = state.boards[player]
    .filter((minion) => canMinionAttack(state, minion))
    .map((minion) => minion.id);

  for(const attackerId of attackers){
    if(state.phase !== 'playing') break;
    attackTarget(state, attackerId, { type: 'hero', owner: opponent });
  }

  endTurn(state);
  return state;
}
