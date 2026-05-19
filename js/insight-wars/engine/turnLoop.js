import { runAiTurn } from './aiController.js';
import { endTurn as advanceTurn, isGameOver } from './state.js';

export function endTurn(state, options = {}){
  const autoRunAi = options.autoRunAi !== false;
  let nextState = advanceTurn(state);

  if(autoRunAi && nextState.activePlayer === 'ai' && !isGameOver(nextState)){
    nextState = runAiTurn(nextState, options.aiOptions || {});
    if(nextState.activePlayer === 'ai' && !isGameOver(nextState)){
      nextState = advanceTurn(nextState);
    }
  }

  return nextState;
}

export { advanceTurn };
