import { CARD_IDS, getCardDefinition } from './cards.js';
import { PLAYERS, endTurn, expireDisabledMinionsForPlayer, opponentOf, registerAiTurnRunner, startTurn } from './state.js';
import { attack, heroTarget, resolveCard } from './effects.js';

export function runAiTurn(state){
  if(state.gameOver) return state;

  if(state.activePlayer !== PLAYERS.AI){
    startTurn(state, PLAYERS.AI);
  }

  const ai = state.players[PLAYERS.AI];
  const skippedInstances = new Set();
  let safety = ai.hand.length + 20;

  while(!state.gameOver && safety-- > 0){
    const playable = ai.hand
      .map((card, index) => ({ card, index, definition: getCardDefinition(card) }))
      .filter(({ card, definition }) => definition && definition.cost <= ai.events && !skippedInstances.has(card.instanceId ?? `${card.id}`))
      .filter(({ card }) => isAiCardLegallyPlayable(state, card.id))
      .sort((a, b) => b.definition.cost - a.definition.cost || a.index - b.index);

    if(playable.length === 0) break;

    const { card } = playable[0];
    const result = resolveCard(state, PLAYERS.AI, card.instanceId ?? card.id, chooseAiTarget(state, card.id));
    if(!result.ok){
      skippedInstances.add(card.instanceId ?? `${card.id}:${skippedInstances.size}`);
    }
  }

  // Force termination even under unexpected resolver failures.
  if(safety <= 0){
    state.history.push({ type: 'ai-safety-stop' });
  }

  for(const minion of [...ai.board]){
    if(state.gameOver) break;
    if(minion.disabled){
      minion.disabled = false;
      state.history.push({ type: 'minion-disable-expired', player: PLAYERS.AI, minionId: minion.id });
      continue;
    }
    if(minion.summoningSickness) continue;
    attack(state, minion.id, heroTarget(PLAYERS.PLAYER));
  }

  // Any disabled minions that did not get iterated should still expire once the AI's attack window passes.
  expireDisabledMinionsForPlayer(state, PLAYERS.AI);

  if(!state.gameOver && state.activePlayer === PLAYERS.AI){
    endTurn(state, { runAi: false });
  }

  return state;
}

export function chooseAiTarget(state, cardId){
  switch(cardId){
    case CARD_IDS.HEATMAP:
      return heroTarget(PLAYERS.PLAYER);
    case CARD_IDS.FEATURE_FLAG: {
      const enemy = state.players[opponentOf(PLAYERS.AI)];
      return enemy.board[0] ? { type: 'minion', id: enemy.board[0].id } : undefined;
    }
    default:
      return undefined;
  }
}

export function isAiCardLegallyPlayable(state, cardId){
  switch(cardId){
    case CARD_IDS.SESSION_REPLAY:
      return false;
    case CARD_IDS.FEATURE_FLAG:
      return state.players[PLAYERS.PLAYER].board.length > 0;
    default:
      return true;
  }
}

registerAiTurnRunner(runAiTurn);
