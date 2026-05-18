// ── INSIGHT WARS VANILLA UI ──
// The UI is deliberately DOM-only. Game rules stay in game-state.js and future effects modules.

import * as rules from './game-state.js';
import { GameBoard } from './components.js';
import {
  AI_SIDE,
  PLAYER_SIDE,
  canAffordCard,
  cardNeedsTarget,
  getActiveSide,
  getHand,
  getMinionId,
  hasValidTargetsForCard,
  isTerminalPhase,
  isValidAttackTarget,
  isValidCardTarget,
  makeHeroTarget,
  makeMinionTarget,
  normalizeCardId,
  targetToRulesTarget,
} from './view-model.js';

const AI_STEP_DELAY_MS = 400;
const MAX_AI_STEPS = 24;
const STYLE_ID = 'insight-wars-stylesheet';

let rootEl = null;
let state = null;
let targetMode = null;
let message = 'Click New Game to begin.';
let aiTimer = null;
let aiStepCount = 0;
let isAiThinking = false;
let keydownHandler = null;

/**
 * Renders the Insight Wars UI into the tab root.
 * @param {HTMLElement | null} [root]
 */
export function InsightWarsGame(root = document.getElementById('insight-wars-root')){
  if(!root) return;
  rootEl = root;
  ensureStylesheet();
  attachKeyboard();
  render();
}

export function cleanupInsightWarsGame(){
  clearAiTimer();
  detachKeyboard();
}

function render(){
  if(!rootEl) return;
  rootEl.replaceChildren(GameBoard({
    state,
    targetMode,
    message,
    isAiThinking,
    onNewGame: startNewGame,
    onEndTurn: endPlayerTurn,
    onHandCard: handleHandCard,
    onHeroTarget: handleHeroTarget,
    onMinionClick: handleMinionClick,
    isTargetHighlighted,
  }));
}

function startNewGame(){
  clearAiTimer();
  state = createNewGameState();
  targetMode = null;
  isAiThinking = false;
  aiStepCount = 0;
  message = 'Your turn. Play a card or send a ready minion into the funnel.';
  render();
}

function createNewGameState(){
  const factory = rules.newGame || rules.createInitialState;
  if(typeof factory !== 'function'){
    throw new Error('Insight Wars game-state module must export newGame() or createInitialState().');
  }
  return factory();
}

function handleHandCard(handIndex, card){
  if(!state || isAiThinking || isTerminalPhase(state)) return;
  if(getActiveSide(state) !== PLAYER_SIDE){
    message = 'Wait for the AI turn to finish.';
    render();
    return;
  }

  if(targetMode?.type === 'card' && targetMode.handIndex === handIndex){
    cancelTargeting('Targeting canceled.');
    return;
  }

  if(!canAffordCard(state, PLAYER_SIDE, card)){
    message = `${card.name || 'That card'} needs ${card.cost ?? 0} Events.`;
    render();
    return;
  }

  if(cardNeedsTarget(card)){
    if(!hasValidTargetsForCard(state, PLAYER_SIDE, card)){
      message = `${card.name || 'That card'} has no valid targets.`;
      render();
      return;
    }
    targetMode = { type: 'card', handIndex, cardId: normalizeCardId(card.id), cardName: card.name || 'Card' };
    message = `Choose a target for ${card.name || 'that card'} — click the card again or press Escape to cancel.`;
    render();
    return;
  }

  resolveCardPlay(handIndex, undefined);
}

function handleHeroTarget(side){
  if(!targetMode || !state || isAiThinking) return;
  const target = makeHeroTarget(side);
  if(!isTargetHighlighted(target)) return;

  if(targetMode.type === 'card'){
    resolveCardPlay(targetMode.handIndex, targetToRulesTarget(target));
  } else if(targetMode.type === 'attack'){
    resolveMinionAttack(targetMode.attackerId, targetToRulesTarget(target));
  }
}

function handleMinionClick(side, minion){
  if(!state || isAiThinking || isTerminalPhase(state)) return;
  const target = makeMinionTarget(side, minion);

  if(targetMode && isTargetHighlighted(target)){
    if(targetMode.type === 'card'){
      resolveCardPlay(targetMode.handIndex, targetToRulesTarget(target));
    } else if(targetMode.type === 'attack'){
      resolveMinionAttack(targetMode.attackerId, targetToRulesTarget(target));
    }
    return;
  }

  if(side !== PLAYER_SIDE || getActiveSide(state) !== PLAYER_SIDE) return;

  const disabled = minion.disabled ?? minion.disabledNextAttack;
  const sick = minion.summoningSick ?? minion.summoningSickness;
  if(disabled || sick){
    message = disabled ? 'That minion is disabled for its next attack.' : 'That minion is still summoning-sick.';
    render();
    return;
  }

  targetMode = { type: 'attack', attackerId: getMinionId(minion), attackerName: minion.name || 'Minion' };
  message = `Choose an enemy target for ${minion.name || 'that minion'} — press Escape to cancel.`;
  render();
}

function isTargetHighlighted(target){
  if(!targetMode || !state) return false;
  if(targetMode.type === 'card'){
    const card = getHand(state, PLAYER_SIDE)[targetMode.handIndex];
    return isValidCardTarget(state, PLAYER_SIDE, card, target);
  }
  if(targetMode.type === 'attack'){
    return isValidAttackTarget(PLAYER_SIDE, target);
  }
  return false;
}

function resolveCardPlay(handIndex, target){
  if(!state) return;
  const fn = rules.playCard;
  if(typeof fn !== 'function'){
    message = 'Card effects are not available yet.';
    targetMode = null;
    render();
    return;
  }

  try {
    const result = fn.length >= 4
      ? fn(state, PLAYER_SIDE, handIndex, target)
      : fn(state, handIndex, target);
    const applied = unwrapRulesResult(result, state);
    state = applied.state;
    targetMode = null;
    message = applied.ok === false
      ? reasonToMessage(applied.reason, 'Card could not be played yet.')
      : 'Card played.';
    render();
  } catch(error){
    targetMode = null;
    message = reasonToMessage(error?.message, 'Card could not be played.');
    render();
  }
}

function resolveMinionAttack(attackerId, target){
  if(!state) return;
  const fn = rules.minionAttack || rules.attackWith || rules.attack;
  if(typeof fn !== 'function'){
    message = 'Minion combat is not available yet.';
    targetMode = null;
    render();
    return;
  }

  try {
    const result = fn === rules.attackWith || fn.length >= 4
      ? fn(state, PLAYER_SIDE, attackerId, target)
      : fn(state, attackerId, target);
    const applied = unwrapRulesResult(result, state);
    state = applied.state;
    targetMode = null;
    message = applied.ok === false
      ? reasonToMessage(applied.reason, 'Attack could not be resolved yet.')
      : 'Attack resolved.';
    render();
  } catch(error){
    targetMode = null;
    message = reasonToMessage(error?.message, 'Attack could not be resolved.');
    render();
  }
}

function endPlayerTurn(){
  if(!state || isAiThinking || isTerminalPhase(state) || getActiveSide(state) !== PLAYER_SIDE) return;
  const fn = rules.endPlayerTurn || rules.endTurn;
  if(typeof fn !== 'function'){
    message = 'Turn controls are not available yet.';
    render();
    return;
  }

  try {
    state = unwrapRulesResult(fn(state), state).state;
    targetMode = null;
    if(!isTerminalPhase(state) && getActiveSide(state) === AI_SIDE){
      isAiThinking = true;
      aiStepCount = 0;
      message = 'AI turn started.';
      render();
      scheduleAiStep();
      return;
    }
    message = isTerminalPhase(state) ? 'Match complete.' : 'Your turn.';
    render();
  } catch(error){
    message = reasonToMessage(error?.message, 'Could not end the turn.');
    render();
  }
}

function scheduleAiStep(){
  clearAiTimer();
  aiTimer = window.setTimeout(runAiStep, AI_STEP_DELAY_MS);
}

function runAiStep(){
  aiTimer = null;
  if(!state || isTerminalPhase(state) || getActiveSide(state) !== AI_SIDE){
    isAiThinking = false;
    message = isTerminalPhase(state) ? 'Match complete.' : 'Your turn.';
    render();
    return;
  }

  const fn = rules.runAiTurn || rules.runAITurn || rules.runAiAction;
  try {
    if(typeof fn === 'function'){
      state = unwrapRulesResult(fn(state), state).state;
    } else {
      const endFn = rules.endTurn || rules.endPlayerTurn;
      state = typeof endFn === 'function' ? unwrapRulesResult(endFn(state), state).state : state;
    }
  } catch(error){
    message = reasonToMessage(error?.message, 'AI turn stopped early.');
  }

  aiStepCount += 1;
  render();

  if(!isTerminalPhase(state) && getActiveSide(state) === AI_SIDE && aiStepCount < MAX_AI_STEPS){
    scheduleAiStep();
    return;
  }

  if(getActiveSide(state) === AI_SIDE && !isTerminalPhase(state)){
    const endFn = rules.endTurn || rules.endPlayerTurn;
    if(typeof endFn === 'function') state = unwrapRulesResult(endFn(state), state).state;
  }
  isAiThinking = false;
  targetMode = null;
  message = isTerminalPhase(state) ? 'Match complete.' : 'Your turn. The AI is done.';
  render();
}

function unwrapRulesResult(result, previousState){
  if(result && typeof result === 'object' && 'state' in result){
    return {
      ok: result.ok !== false,
      reason: result.reason,
      state: result.state || previousState,
    };
  }
  if(result && typeof result === 'object'){
    return { ok: true, state: result };
  }
  return { ok: true, state: previousState };
}

function cancelTargeting(nextMessage = 'Targeting canceled.'){
  targetMode = null;
  message = nextMessage;
  render();
}

function attachKeyboard(){
  if(keydownHandler) return;
  keydownHandler = (event) => {
    if(event.key === 'Escape' && targetMode){
      event.preventDefault();
      cancelTargeting();
    }
  };
  window.addEventListener('keydown', keydownHandler);
}

function detachKeyboard(){
  if(!keydownHandler) return;
  window.removeEventListener('keydown', keydownHandler);
  keydownHandler = null;
}

function clearAiTimer(){
  if(aiTimer){
    window.clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function ensureStylesheet(){
  if(document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = 'js/insight-wars/styles.css';
  document.head.appendChild(link);
}

function reasonToMessage(reason, fallback){
  if(!reason) return fallback;
  if(reason === 'not_implemented') return 'Card effects are waiting on the effects module.';
  return String(reason).replaceAll('_', ' ').replaceAll('-', ' ');
}

if(typeof window !== 'undefined'){
  window.InsightWarsGame = InsightWarsGame;

  const tabButton = document.getElementById('tab-btn-insight-wars');
  if(tabButton){
    tabButton.addEventListener('click', function(){
      window.switchTab('insight-wars', this);
    });
  }

  if(typeof window.registerGame === 'function'){
    window.registerGame('insight-wars', {
      init(){
        InsightWarsGame();
      },
      cleanup(){
        cleanupInsightWarsGame();
      },
    });
  }

  InsightWarsGame();
}

//# sourceMappingURL=game.js.map
