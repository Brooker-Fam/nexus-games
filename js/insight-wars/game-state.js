// ── INSIGHT WARS FOUNDATION STATE ──
// This module is intentionally UI-free: no DOM, no Canvas, no analytics imports.
// Tests and future gameplay layers should inject a seeded rng into createInitialState()
// or shuffle() whenever deterministic card order is required.

/**
 * @typedef {'feature_flag' | 'session_replay' | 'ab_test' | 'funnel' | 'cohort' | 'insight' | 'surveys' | 'heatmap' | 'experiment'} CardId
 */

/**
 * @typedef {{ id: CardId, name: string, cost: number, description: string }} Card
 */

/**
 * @typedef {{ instanceId: string, name: string, attack: number, hp: number, maxHp: number, summoningSickness: boolean, disabledNextAttack: boolean }} Minion
 */

/** @typedef {'player' | 'ai'} PlayerSide */

/**
 * @typedef {{ hp: number, maxHp: number, events: number, maxEvents: number, deck: Card[], hand: Card[], board: Minion[] }} PlayerState
 */

/**
 * @typedef {{ player: PlayerState, ai: PlayerState, turn: number, activeSide: PlayerSide, aiHandRevealed: boolean, phase: 'playing' | 'player_won' | 'ai_won', rng: () => number }} GameState
 */

export const CARD_CATALOG = Object.freeze({
  feature_flag: Object.freeze({
    id: 'feature_flag',
    name: 'Feature Flag',
    cost: 1,
    description: "Disable one enemy minion's next attack.",
  }),
  session_replay: Object.freeze({
    id: 'session_replay',
    name: 'Session Replay',
    cost: 2,
    description: 'Reveal the AI hand for the current turn.',
  }),
  ab_test: Object.freeze({
    id: 'ab_test',
    name: 'A/B Test',
    cost: 3,
    description: '50/50: deal 5 damage to the enemy hero or heal 5 HP.',
  }),
  funnel: Object.freeze({
    id: 'funnel',
    name: 'Funnel',
    cost: 4,
    description: 'Deal 2 damage to the enemy hero and 1 damage to each enemy minion.',
  }),
  cohort: Object.freeze({
    id: 'cohort',
    name: 'Cohort',
    cost: 3,
    description: 'Summon a 2/3 Cohort minion.',
  }),
  insight: Object.freeze({
    id: 'insight',
    name: 'Insight',
    cost: 1,
    description: 'Draw a card.',
  }),
  surveys: Object.freeze({
    id: 'surveys',
    name: 'Surveys',
    cost: 2,
    description: 'Heal 4 HP.',
  }),
  heatmap: Object.freeze({
    id: 'heatmap',
    name: 'Heatmap',
    cost: 3,
    description: 'Deal 4 damage to a single target.',
  }),
  experiment: Object.freeze({
    id: 'experiment',
    name: 'Experiment',
    cost: 5,
    description: 'Summon a 5/5 Experiment minion.',
  }),
});

// Fixed 22-card shared deck composition for v1:
// 3× feature_flag, 2× session_replay, 2× ab_test, 2× funnel,
// 3× cohort, 3× insight, 2× surveys, 3× heatmap, 2× experiment.
// Both player and AI use this identical list, then shuffle independently.
export const DECK_COMPOSITION = Object.freeze({
  feature_flag: 3,
  session_replay: 2,
  ab_test: 2,
  funnel: 2,
  cohort: 3,
  insight: 3,
  surveys: 2,
  heatmap: 3,
  experiment: 2,
});

/**
 * @returns {Card[]}
 */
export function buildDeck(){
  return Object.entries(DECK_COMPOSITION).flatMap(([id, count]) =>
    Array.from({ length: count }, () => CARD_CATALOG[id])
  );
}

/**
 * Fisher-Yates shuffle using an injected rng so tests and AI simulations can be deterministic.
 * The input array is never mutated; callers receive a new shuffled array.
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(arr, rng){
  const copy = [...arr];
  for(let i = copy.length - 1; i > 0; i -= 1){
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {Card[]} deck
 * @param {number} count
 * @returns {{ hand: Card[], deck: Card[] }}
 */
function drawOpeningHand(deck, count){
  return {
    hand: deck.slice(0, count),
    deck: deck.slice(count),
  };
}

/**
 * @param {Card[]} deck
 * @param {Card[]} hand
 * @param {number} events
 * @param {number} maxEvents
 * @returns {PlayerState}
 */
function createPlayerState(deck, hand, events, maxEvents){
  return {
    hp: 20,
    maxHp: 20,
    events,
    maxEvents,
    deck,
    hand,
    board: [],
  };
}

/**
 * Creates a new game with both 22-card decks shuffled by the same injected rng stream.
 * The default rng is Math.random for browser play; tests should pass a seeded function.
 * Opening hands are the top 3 cards. Deck exhaustion is non-lethal in v1: no fatigue.
 * @param {() => number} [rng]
 * @returns {GameState}
 */
export function createInitialState(rng = Math.random){
  const playerOpening = drawOpeningHand(shuffle(buildDeck(), rng), 3);
  const aiOpening = drawOpeningHand(shuffle(buildDeck(), rng), 3);

  return {
    player: createPlayerState(playerOpening.deck, playerOpening.hand, 1, 1),
    ai: createPlayerState(aiOpening.deck, aiOpening.hand, 0, 0),
    turn: 1,
    activeSide: 'player',
    aiHandRevealed: false,
    phase: 'playing',
    rng,
  };
}

/**
 * Draws from deck[0] into hand. Empty deck is a no-op in foundation v1;
 * future hoglets should not add fatigue damage without changing this contract.
 * @param {GameState} state
 * @param {PlayerSide} side
 * @returns {GameState}
 */
export function drawCard(state, side){
  const playerState = state[side];
  if(playerState.deck.length === 0){
    return state;
  }

  const [card, ...deck] = playerState.deck;
  return {
    ...state,
    [side]: {
      ...playerState,
      deck,
      hand: [...playerState.hand, card],
    },
  };
}

/**
 * Starts a side's turn and returns a new state.
 * Turn counter policy: `turn` is the player-round number. It increments only when
 * control moves from AI back to player, so player and AI both use the same turn value
 * during a round. Event ramp is maxEvents = min(turn, 10), then events refill to max.
 *
 * Minion timing: summoning sickness clears at the start of that minion owner's turn.
 * Feature Flag's disabledNextAttack flag is intentionally preserved here so a freshly
 * disabled minion does not get re-enabled before its next attack window. The future
 * attackWith implementation should clear disabledNextAttack when that skipped attack
 * is consumed. AI hand reveal is hidden when a new player turn starts.
 * @param {GameState} state
 * @param {PlayerSide} side
 * @returns {GameState}
 */
export function startTurn(state, side){
  const nextTurn = side === 'player' && state.activeSide === 'ai'
    ? state.turn + 1
    : state.turn;
  const maxEvents = Math.min(nextTurn, 10);
  const playerState = state[side];

  const nextState = {
    ...state,
    turn: nextTurn,
    activeSide: side,
    aiHandRevealed: side === 'player' ? false : state.aiHandRevealed,
    [side]: {
      ...playerState,
      events: maxEvents,
      maxEvents,
      board: playerState.board.map((minion) => ({
        ...minion,
        summoningSickness: false,
      })),
    },
  };

  return drawCard(nextState, side);
}

/**
 * Ends the active turn and starts the other side's turn.
 * @param {GameState} state
 * @returns {GameState}
 */
export function endTurn(state){
  const nextSide = state.activeSide === 'player' ? 'ai' : 'player';
  return startTurn(state, nextSide);
}

/**
 * Resolves hero lethal damage. There is no draw phase in v1; simultaneous lethal
 * resolves in the player's favor to keep single-player outcomes deterministic.
 * @param {GameState} state
 * @returns {GameState}
 */
export function checkWinCondition(state){
  if(state.ai.hp <= 0){
    return { ...state, phase: 'player_won' };
  }
  if(state.player.hp <= 0){
    return { ...state, phase: 'ai_won' };
  }
  return { ...state, phase: 'playing' };
}

/**
 * @param {GameState} state
 * @param {PlayerSide} side
 * @param {number} handIndex
 * @param {unknown} [target]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canPlayCard(state, side, handIndex, target){
  void state;
  void side;
  void handIndex;
  void target;
  return { ok: false, reason: 'not_implemented' };
}

/**
 * @param {GameState} state
 * @param {PlayerSide} side
 * @param {number} handIndex
 * @param {unknown} [target]
 * @returns {GameState}
 */
export function playCard(state, side, handIndex, target){
  void side;
  void handIndex;
  void target;
  return state;
}

/**
 * @param {GameState} state
 * @param {PlayerSide} attackerSide
 * @param {string} attackerInstanceId
 * @param {unknown} defenderTarget
 * @returns {GameState}
 */
export function attackWith(state, attackerSide, attackerInstanceId, defenderTarget){
  void attackerSide;
  void attackerInstanceId;
  void defenderTarget;
  return state;
}

/**
 * Temporary AI stub: immediately ends the AI turn so UI loops cannot hang.
 * @param {GameState} state
 * @returns {GameState}
 */
export function runAiTurn(state){
  return endTurn(state);
}


