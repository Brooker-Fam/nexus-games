import { attackHero, isGameOver, playCard } from './state.js';

const MIN_AI_CARD_PLAY_GUARD = 500;

function isAffordable(card, events){
  return card.cost <= events;
}

export function chooseGreedyCard(hand, events){
  let best = null;
  let bestIndex = -1;

  for(let index = 0; index < hand.length; index++){
    const card = hand[index];
    if(!isAffordable(card, events)) continue;
    if(!best || card.cost > best.cost){
      best = card;
      bestIndex = index;
    }
  }

  return best ? { card: best, index: bestIndex } : null;
}

export function chooseStrongestEnemyMinion(board){
  let best = null;
  let bestIndex = -1;

  for(let index = 0; index < board.length; index++){
    const minion = board[index];
    if(
      !best
      || minion.attack > best.attack
      || (minion.attack === best.attack && minion.hp > best.hp)
    ){
      best = minion;
      bestIndex = index;
    }
  }

  return best ? { minion: best, index: bestIndex } : null;
}

export function chooseAiTarget(state, card){
  switch(card.definitionKey){
    case 'heatmap':
      return { type: 'hero', player: 'player' };
    case 'feature-flag': {
      const target = chooseStrongestEnemyMinion(state.players.player.board);
      return target
        ? { type: 'minion', player: 'player', minionId: target.minion.id }
        : null;
    }
    case 'ab-test':
      return { type: 'hero', player: 'player' };
    case 'surveys':
      return { type: 'hero', player: 'ai' };
    default:
      return undefined;
  }
}

function playGreedyCards(state, deadlineMs){
  let nextState = state;
  let cardsPlayed = 0;
  const maxCardPlays = Math.max(
    MIN_AI_CARD_PLAY_GUARD,
    state.players.ai.hand.length + state.players.ai.deck.length + 5,
  );

  while(!isGameOver(nextState) && cardsPlayed < maxCardPlays && Date.now() < deadlineMs){
    const ai = nextState.players.ai;
    const choice = chooseGreedyCard(ai.hand, ai.mana);
    if(!choice) break;

    const target = chooseAiTarget(nextState, choice.card);
    const playedState = playCard(nextState, 'ai', choice.card.id, target);
    const cardStillInHand = playedState.players.ai.hand.some((card) => card.id === choice.card.id);

    if(playedState === nextState || cardStillInHand){
      nextState = {
        ...playedState,
        log: [...playedState.log, 'AI stopped card play because no progress was made.'],
      };
      break;
    }

    nextState = playedState;
    cardsPlayed++;
  }

  if(cardsPlayed >= maxCardPlays || Date.now() >= deadlineMs){
    nextState = {
      ...nextState,
      log: [...nextState.log, 'AI stopped early to keep the turn within the time budget.'],
    };
  }

  return nextState;
}

function attackFaceWithMinions(state, deadlineMs){
  let nextState = state;
  const attackerIds = state.players.ai.board.map((minion) => minion.id);

  for(const minionId of attackerIds){
    if(isGameOver(nextState) || Date.now() >= deadlineMs) break;
    nextState = attackHero(nextState, 'ai', minionId, 'player');
  }

  return nextState;
}

export function runAiTurn(state, options = {}){
  if(state.activePlayer !== 'ai' || isGameOver(state)) return state;

  const startedAt = Date.now();
  const budgetMs = Math.min(Math.max(options.budgetMs ?? 1900, 1), 1995);
  const deadlineMs = startedAt + budgetMs;

  let nextState = {
    ...state,
    log: [...state.log, 'Dark Funnel PM starts plotting.'],
  };

  try{
    nextState = playGreedyCards(nextState, deadlineMs);
    nextState = attackFaceWithMinions(nextState, deadlineMs);
  }catch(error){
    nextState = {
      ...nextState,
      log: [...nextState.log, `AI recovered from an error: ${error.message}`],
    };
  }

  return {
    ...nextState,
    log: [...nextState.log, 'Dark Funnel PM ends its actions.'],
  };
}
