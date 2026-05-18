// ── INSIGHT WARS UI VIEW HELPERS ──
// Shape adapters only. Game rules remain in game-state.js / future effects modules.

export const PLAYER_SIDE = 'player';
export const AI_SIDE = 'ai';

export const CARD_EMOJI = Object.freeze({
  feature_flag: '🚩',
  session_replay: '🎬',
  ab_test: '🧪',
  funnel: '🪤',
  cohort: '👥',
  insight: '💡',
  surveys: '📋',
  heatmap: '🔥',
  experiment: '⚗️',
});

export function normalizeCardId(id){
  return String(id ?? '').trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
}

export function cardEmoji(cardOrId){
  const normalized = normalizeCardId(typeof cardOrId === 'string' ? cardOrId : cardOrId?.id ?? cardOrId?.sourceCardId);
  return cardOrId?.emoji || CARD_EMOJI[normalized] || '◆';
}

export function cardDescription(card){
  return card?.description || card?.text || '';
}

export function getSideState(state, side){
  if(!state) return null;
  return state[side] || state.players?.[side] || null;
}

export function getHeroHp(state, side){
  const sideState = getSideState(state, side);
  return sideState?.hp ?? sideState?.hero?.hp ?? 0;
}

export function getHeroMaxHp(state, side){
  const sideState = getSideState(state, side);
  return sideState?.maxHp ?? sideState?.hero?.maxHp ?? 20;
}

export function getActiveSide(state){
  return state?.activeSide || state?.activePlayer || PLAYER_SIDE;
}

export function getPhase(state){
  if(!state) return 'not_started';
  if(state.phase) return state.phase;
  if(state.gameOver){
    if(state.winner === PLAYER_SIDE) return 'player_won';
    if(state.winner === AI_SIDE) return 'ai_won';
    return 'draw';
  }
  return 'playing';
}

export function isTerminalPhase(state){
  const phase = getPhase(state);
  return phase === 'player_won' || phase === 'player-won' || phase === 'ai_won' || phase === 'ai-won' || phase === 'draw';
}

export function didPlayerWin(state){
  const phase = getPhase(state);
  return phase === 'player_won' || phase === 'player-won' || state?.winner === PLAYER_SIDE;
}

export function getBoard(state, side){
  return getSideState(state, side)?.board || [];
}

export function getHand(state, side){
  return getSideState(state, side)?.hand || [];
}

export function getEvents(state, side){
  const sideState = getSideState(state, side);
  return sideState?.events ?? 0;
}

export function getMaxEvents(state, side){
  const sideState = getSideState(state, side);
  return sideState?.maxEvents ?? 0;
}

export function getMinionId(minion){
  return minion?.instanceId || minion?.id || '';
}

export function getMinionName(minion){
  return minion?.name || toTitle(normalizeCardId(minion?.sourceCardId || 'minion'));
}

export function getMinionEmoji(minion){
  return minion?.emoji || cardEmoji(minion?.sourceCardId || minion?.name) || '◆';
}

export function isMinionSick(minion){
  return Boolean(minion?.summoningSick ?? minion?.summoningSickness);
}

export function isMinionDisabled(minion){
  return Boolean(minion?.disabled ?? minion?.disabledNextAttack);
}

export function canMinionAttack(state, side, minion){
  return getActiveSide(state) === side
    && side === PLAYER_SIDE
    && !isTerminalPhase(state)
    && !isMinionSick(minion)
    && !isMinionDisabled(minion)
    && (minion?.attack ?? 0) > 0;
}

export function canAffordCard(state, side, card){
  return getActiveSide(state) === side
    && !isTerminalPhase(state)
    && getEvents(state, side) >= (card?.cost ?? Infinity);
}

export function cardNeedsTarget(card){
  const id = normalizeCardId(card?.id);
  return id === 'feature_flag' || id === 'heatmap';
}

export function hasValidTargetsForCard(state, side, card){
  const opponent = oppositeSide(side);
  const id = normalizeCardId(card?.id);
  if(id === 'feature_flag') return getBoard(state, opponent).length > 0;
  if(id === 'heatmap') return getHeroHp(state, opponent) > 0 || getBoard(state, opponent).length > 0;
  return true;
}

export function isValidCardTarget(state, side, card, target){
  const opponent = oppositeSide(side);
  const id = normalizeCardId(card?.id);
  if(id === 'feature_flag') return target?.kind === 'minion' && target.side === opponent;
  if(id === 'heatmap') return target?.side === opponent && (target.kind === 'hero' || target.kind === 'minion');
  return false;
}

export function isValidAttackTarget(side, target){
  return target?.side === oppositeSide(side) && (target.kind === 'hero' || target.kind === 'minion');
}

export function oppositeSide(side){
  return side === PLAYER_SIDE ? AI_SIDE : PLAYER_SIDE;
}

export function makeHeroTarget(side){
  return {
    kind: 'hero',
    side,
    player: side,
    owner: side,
    type: 'hero',
  };
}

export function makeMinionTarget(side, minion){
  const id = getMinionId(minion);
  return {
    kind: 'minion',
    side,
    player: side,
    owner: side,
    type: 'minion',
    id,
    minionId: id,
    minionInstanceId: id,
    instanceId: id,
  };
}

export function targetToRulesTarget(target){
  if(!target) return undefined;
  if(target.kind === 'hero'){
    return {
      side: target.side,
      player: target.side,
      owner: target.side,
      type: 'hero',
    };
  }
  return {
    side: target.side,
    player: target.side,
    owner: target.side,
    type: 'minion',
    id: target.id,
    minionId: target.id,
    minionInstanceId: target.id,
    instanceId: target.id,
  };
}

export function phaseTitle(state){
  const phase = getPhase(state);
  if(phase === 'draw') return 'Draw!';
  return didPlayerWin(state) ? 'Victory!' : 'Defeat!';
}

export function phaseBody(state){
  const phase = getPhase(state);
  if(phase === 'draw') return 'Both roadmaps collapsed at the same time.';
  return didPlayerWin(state)
    ? 'Max the Hedgehog shipped the winning insight.'
    : 'The Dark Funnel PM buried the roadmap in conversion debt.';
}

function toTitle(value){
  return String(value || 'Minion')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

//# sourceMappingURL=view-model.js.map
