import { test, assert } from 'vitest';

import {
  CARD_DEFINITIONS,
  CARD_TYPES,
  GAME_STATUS,
  DEFAULT_DECK_LIST,
  OPPONENT,
  PLAYER,
  attackWithMinion,
  createInitialState,
  endTurn,
  playCard,
} from './game-state.mjs';

function cardState(cardId, options = {}){
  const state = createInitialState({ shuffle: false, startingHandSize: 0 });
  state.players[PLAYER].hand = [{ instanceId: 'test-card', cardId }];
  state.players[PLAYER].events = options.events ?? 10;
  state.players[PLAYER].maxEvents = Math.max(state.players[PLAYER].events, state.players[PLAYER].maxEvents);
  return state;
}

function opponentCardState(cardId, options = {}){
  const state = createInitialState({ shuffle: false, startingHandSize: 0 });
  state.turn.activePlayer = OPPONENT;
  state.turn.number = options.turnNumber ?? 2;
  state.players[OPPONENT].hand = [{ instanceId: 'ai-card', cardId }];
  state.players[OPPONENT].events = options.events ?? 10;
  state.players[OPPONENT].maxEvents = Math.max(state.players[OPPONENT].events, state.players[OPPONENT].maxEvents);
  return state;
}

function minion(id, owner, overrides = {}){
  return {
    id,
    cardId: overrides.cardId ?? 'test_minion',
    owner,
    name: overrides.name ?? 'Test Minion',
    baseAttack: overrides.baseAttack ?? 2,
    currentAttack: overrides.currentAttack ?? 2,
    maxHp: overrides.maxHp ?? 2,
    currentHp: overrides.currentHp ?? 2,
    summoningSick: overrides.summoningSick ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    disabledUntilTurn: overrides.disabledUntilTurn ?? null,
  };
}

test('defines exactly 9 cards with required fields and resolve functions', () => {
  assert.equal(CARD_DEFINITIONS.length, 9);
  for(const card of CARD_DEFINITIONS){
    assert.equal(typeof card.id, 'string');
    assert.equal(typeof card.name, 'string');
    assert.equal(typeof card.cost, 'number');
    assert.ok([CARD_TYPES.MINION, CARD_TYPES.SPELL].includes(card.type));
    assert.equal(typeof card.resolve, 'function');
  }
});

test('default deck has 23 cards with 2-3 copies of each of the 9 unique cards', () => {
  assert.equal(DEFAULT_DECK_LIST.length, 9);
  assert.equal(DEFAULT_DECK_LIST.reduce((sum, [, copies]) => sum + copies, 0), 23);
  for(const [, copies] of DEFAULT_DECK_LIST){
    assert.ok(copies >= 2 && copies <= 3);
  }

  const state = createInitialState({ shuffle: false, startingHandSize: 0 });
  assert.equal(state.players[PLAYER].deck.length, 23);
  assert.equal(state.players[OPPONENT].deck.length, 23);
});

test('turn flow increments turn counter, swaps active player, and refills events', () => {
  let state = createInitialState({ shuffle: false });

  assert.equal(state.turn.number, 1);
  assert.equal(state.turn.activePlayer, PLAYER);
  assert.equal(state.players[PLAYER].events, 1);
  assert.equal(state.players[PLAYER].maxEvents, 1);

  let result = endTurn(state);
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.turn.number, 2);
  assert.equal(state.turn.activePlayer, OPPONENT);
  assert.equal(state.players[OPPONENT].events, 2);
  assert.equal(state.players[OPPONENT].maxEvents, 2);

  result = endTurn(state);
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.turn.number, 3);
  assert.equal(state.turn.activePlayer, PLAYER);
  assert.equal(state.players[PLAYER].events, 3);
  assert.equal(state.players[PLAYER].maxEvents, 3);
});

test('event mana ramps 1 through 10 and caps at 10', () => {
  let state = createInitialState({ shuffle: false });

  for(let expectedTurn = 1; expectedTurn <= 12; expectedTurn++){
    const active = state.turn.activePlayer;
    assert.equal(state.turn.number, expectedTurn);
    assert.equal(state.players[active].maxEvents, Math.min(10, expectedTurn));
    assert.equal(state.players[active].events, Math.min(10, expectedTurn));
    const result = endTurn(state);
    assert.equal(result.ok, true);
    state = result.state;
  }

  const active = state.turn.activePlayer;
  assert.equal(state.turn.number, 13);
  assert.equal(state.players[active].maxEvents, 10);
  assert.equal(state.players[active].events, 10);
});

test('enemy hero at 0 HP makes the player win', () => {
  const state = cardState('hogql_query');
  state.players[OPPONENT].hp = 4;

  const result = playCard(state, 'test-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[OPPONENT].hp, 0);
  assert.equal(result.state.status, GAME_STATUS.WON);
});

test('player hero at 0 HP makes the player lose', () => {
  const state = opponentCardState('hogql_query');
  state.players[PLAYER].hp = 4;

  const result = playCard(state, 'ai-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[PLAYER].hp, 0);
  assert.equal(result.state.status, GAME_STATUS.LOST);
});

test('summoning sickness prevents attacking until the minion controller next starts a turn', () => {
  let state = cardState('cohort');
  let result = playCard(state, 'test-card');
  assert.equal(result.ok, true);
  state = result.state;

  const cohort = state.players[PLAYER].board[0];
  assert.equal(cohort.summoningSick, true);

  result = attackWithMinion(state, cohort.id, { type: 'hero', owner: OPPONENT });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);

  state = endTurn(state).state;
  state = endTurn(state).state;

  const refreshed = state.players[PLAYER].board[0];
  assert.equal(refreshed.summoningSick, false);
  result = attackWithMinion(state, refreshed.id, { type: 'hero', owner: OPPONENT });

  assert.equal(result.ok, true);
  assert.equal(result.state.players[OPPONENT].hp, 18);
});

test('simultaneous minion combat damages both minions and removes 0-HP minions', () => {
  const state = createInitialState({ shuffle: false, startingHandSize: 0 });
  state.players[PLAYER].board = [minion('p1', PLAYER, { currentAttack: 2, currentHp: 2 })];
  state.players[OPPONENT].board = [minion('o1', OPPONENT, { currentAttack: 2, currentHp: 2 })];

  const result = attackWithMinion(state, 'p1', { type: 'minion', owner: OPPONENT, minionId: 'o1' });

  assert.equal(result.ok, true);
  assert.equal(result.state.players[PLAYER].board.length, 0);
  assert.equal(result.state.players[OPPONENT].board.length, 0);
});

test('Feature Flag disables one enemy minion on its next turn', () => {
  let state = cardState('feature_flag');
  state.players[OPPONENT].board = [minion('o1', OPPONENT, { currentAttack: 3, currentHp: 3 })];

  let result = playCard(state, 'test-card', { type: 'minion', owner: OPPONENT, minionId: 'o1' });
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.players[OPPONENT].board[0].disabledUntilTurn, 2);

  state = endTurn(state).state;
  result = attackWithMinion(state, 'o1', { type: 'hero', owner: PLAYER });
  assert.equal(result.ok, false);
  assert.match(result.error, /disabled/i);
});

test('Session Replay reveals AI hand for player turn and clears when AI turn starts', () => {
  let state = cardState('session_replay');
  let result = playCard(state, 'test-card');
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.visibility.opponentHandRevealed, true);

  state = endTurn(state).state;
  assert.equal(state.turn.activePlayer, OPPONENT);
  assert.equal(state.visibility.opponentHandRevealed, false);
});

test('Session Replay is a no-op when AI plays it', () => {
  const state = opponentCardState('session_replay');
  const result = playCard(state, 'ai-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.visibility.opponentHandRevealed, false);
});

test('A/B Test damage branch deals 5 damage to the enemy hero', () => {
  const state = cardState('ab_test');
  const result = playCard(state, 'test-card', null, { rng: () => 0.1 });

  assert.equal(result.ok, true);
  assert.equal(result.state.players[OPPONENT].hp, 15);
});

test('Funnel damages enemy hero and each enemy minion', () => {
  const state = cardState('funnel');
  state.players[OPPONENT].board = [
    minion('o1', OPPONENT, { currentHp: 3, maxHp: 3 }),
    minion('o2', OPPONENT, { currentHp: 1, maxHp: 1 }),
  ];

  const result = playCard(state, 'test-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[OPPONENT].hp, 18);
  assert.equal(result.state.players[OPPONENT].board.length, 1);
  assert.equal(result.state.players[OPPONENT].board[0].currentHp, 2);
});

test('Cohort summons a 2/3 minion', () => {
  const state = cardState('cohort');
  const result = playCard(state, 'test-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[PLAYER].board.length, 1);
  assert.equal(result.state.players[PLAYER].board[0].name, 'Cohort');
  assert.equal(result.state.players[PLAYER].board[0].currentAttack, 2);
  assert.equal(result.state.players[PLAYER].board[0].currentHp, 3);
});

test('Insight draws 2 cards', () => {
  const state = cardState('insight');
  const initialDeckSize = state.players[PLAYER].deck.length;

  const result = playCard(state, 'test-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[PLAYER].hand.length, 2);
  assert.equal(result.state.players[PLAYER].deck.length, initialDeckSize - 2);
});

test('Dashboard summons a 3/5 minion', () => {
  const state = cardState('dashboard');
  const result = playCard(state, 'test-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[PLAYER].board.length, 1);
  assert.equal(result.state.players[PLAYER].board[0].name, 'Dashboard');
  assert.equal(result.state.players[PLAYER].board[0].currentAttack, 3);
  assert.equal(result.state.players[PLAYER].board[0].currentHp, 5);
});

test('Survey heals the hero and draws 1 card', () => {
  const state = cardState('survey');
  state.players[PLAYER].hp = 15;
  const initialDeckSize = state.players[PLAYER].deck.length;

  const result = playCard(state, 'test-card');

  assert.equal(result.ok, true);
  assert.equal(result.state.players[PLAYER].hp, 18);
  assert.equal(result.state.players[PLAYER].hand.length, 1);
  assert.equal(result.state.players[PLAYER].deck.length, initialDeckSize - 1);
});

test('HogQL Query deals 4 damage to a chosen enemy minion', () => {
  const state = cardState('hogql_query');
  state.players[OPPONENT].board = [minion('o1', OPPONENT, { currentHp: 5, maxHp: 5 })];

  const result = playCard(state, 'test-card', { type: 'minion', owner: OPPONENT, minionId: 'o1' });

  assert.equal(result.ok, true);
  assert.equal(result.state.players[OPPONENT].board[0].currentHp, 1);
});

test('playing a card without enough events is rejected and leaves state unchanged', () => {
  const state = cardState('funnel', { events: 3 });
  const snapshot = JSON.parse(JSON.stringify(state));

  const result = playCard(state, 'test-card');

  assert.equal(result.ok, false);
  assert.match(result.error, /insufficient events/i);
  assert.equal(result.state, state);
  assert.deepEqual(state, snapshot);
});
