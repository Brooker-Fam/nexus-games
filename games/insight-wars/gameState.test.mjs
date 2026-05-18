import test from 'node:test';
import assert from 'node:assert/strict';

import { takeAiTurn } from './aiStrategy.js';
import { buildDeck, cloneCardDefinition } from './deck.js';
import {
  attack,
  checkWinCondition,
  createInitialState,
  drawCard,
  endTurn,
  playCard,
  startTurn,
} from './gameState.js';

function card(type, copy = 1) {
  return cloneCardDefinition(type, copy);
}

function minion(cardId, attackValue, hp, canAttack = false) {
  return { cardId, name: cardId, attack: attackValue, hp, maxHp: hp, canAttack };
}

function stateWith({
  playerHand = [],
  aiHand = [],
  playerDeck = [],
  aiDeck = [],
  playerBoard = [],
  aiBoard = [],
  playerMana = 10,
  aiMana = 10,
  activePlayer = 'player',
  turn = 1,
  playerHp = 20,
  aiHp = 20,
  rngSeed = 123,
} = {}) {
  return {
    turn,
    activePlayer,
    heroes: {
      player: { id: 'player', hp: playerHp, maxHp: 20 },
      ai: { id: 'ai', hp: aiHp, maxHp: 20 },
    },
    mana: {
      player: { current: playerMana, max: playerMana },
      ai: { current: aiMana, max: aiMana },
    },
    hands: {
      player: playerHand,
      ai: aiHand,
    },
    decks: {
      player: playerDeck,
      ai: aiDeck,
    },
    boards: {
      player: playerBoard,
      ai: aiBoard,
    },
    winner: null,
    rngSeed,
  };
}

test('createInitialState starts both heroes at 20 HP, player at 1/1 mana, and both players with 3 cards', () => {
  const state = createInitialState(42);

  assert.equal(state.activePlayer, 'player');
  assert.equal(state.turn, 1);
  assert.equal(state.heroes.player.hp, 20);
  assert.equal(state.heroes.ai.hp, 20);
  assert.deepEqual(state.mana.player, { current: 1, max: 1 });
  assert.equal(state.hands.player.length, 3);
  assert.equal(state.hands.ai.length, 3);
  assert.equal(state.decks.player.length, 19);
  assert.equal(state.decks.ai.length, 19);
});

test('mana ramp follows turn number and caps at 10', () => {
  for (const [turn, expectedMana] of [[1, 1], [5, 5], [10, 10], [11, 10]]) {
    const state = startTurn(stateWith({ turn, playerMana: 0 }), 'player');
    assert.deepEqual(state.mana.player, { current: expectedMana, max: expectedMana });
  }
});

test('buildDeck creates the fixed 22-card composition', () => {
  const deck = buildDeck();
  const counts = deck.reduce((nextCounts, nextCard) => {
    nextCounts[nextCard.type] = (nextCounts[nextCard.type] || 0) + 1;
    return nextCounts;
  }, {});

  assert.equal(deck.length, 22);
  assert.deepEqual(counts, {
    'feature-flag': 3,
    'session-replay': 2,
    'ab-test': 2,
    funnel: 3,
    cohort: 2,
    insight: 3,
    surveys: 2,
    heatmap: 2,
    experiment: 3,
  });
});

test('drawCard moves the top deck card into hand without mutating the input state', () => {
  const first = card('feature-flag');
  const second = card('heatmap');
  const state = stateWith({ playerHand: [card('insight')], playerDeck: [first, second] });
  const drawn = drawCard(state, 'player');

  assert.deepEqual(drawn.hands.player.map((nextCard) => nextCard.type), ['insight', 'feature-flag']);
  assert.deepEqual(drawn.decks.player.map((nextCard) => nextCard.type), ['heatmap']);
  assert.deepEqual(state.hands.player.map((nextCard) => nextCard.type), ['insight']);
  assert.deepEqual(state.decks.player.map((nextCard) => nextCard.type), ['feature-flag', 'heatmap']);
});

test('Feature Flag costs 1 and damages a target minion, or hero when there are no minions', () => {
  const state = stateWith({
    playerHand: [card('feature-flag')],
    playerMana: 5,
    aiBoard: [minion('enemy-a', 1, 3), minion('enemy-b', 4, 4)],
  });

  const damagedMinionState = playCard(state, 'player', 0, 1);
  assert.equal(damagedMinionState.mana.player.current, 4);
  assert.equal(damagedMinionState.hands.player.length, 0);
  assert.equal(damagedMinionState.boards.ai[1].hp, 2);
  assert.equal(damagedMinionState.heroes.ai.hp, 20);

  const heroState = playCard(stateWith({ playerHand: [card('feature-flag')], playerMana: 5 }), 'player', 0, 'hero');
  assert.equal(heroState.mana.player.current, 4);
  assert.equal(heroState.heroes.ai.hp, 18);
});

test('Session Replay costs 2 and draws 2 cards for player; AI version discards the effect', () => {
  const playerState = stateWith({
    playerHand: [card('session-replay')],
    playerDeck: [card('funnel'), card('cohort'), card('heatmap')],
    playerMana: 5,
  });

  const playerResolved = playCard(playerState, 'player', 0);
  assert.equal(playerResolved.mana.player.current, 3);
  assert.equal(playerResolved.hands.player.length, 2);
  assert.deepEqual(playerResolved.hands.player.map((nextCard) => nextCard.type), ['funnel', 'cohort']);
  assert.equal(playerResolved.decks.player.length, 1);

  const aiState = stateWith({
    activePlayer: 'ai',
    aiHand: [card('session-replay')],
    aiDeck: [card('funnel'), card('cohort')],
    aiMana: 5,
  });

  const aiResolved = playCard(aiState, 'ai', 0);
  assert.equal(aiResolved.mana.ai.current, 3);
  assert.equal(aiResolved.hands.ai.length, 0);
  assert.equal(aiResolved.decks.ai.length, 2);
});

test('A/B Test costs 3 and deterministically supports damage and heal outcomes by seed', () => {
  const damageState = stateWith({
    playerHand: [card('ab-test')],
    playerMana: 5,
    aiHp: 20,
    rngSeed: 0,
  });

  const damageResolved = playCard(damageState, 'player', 0, 'hero');
  assert.equal(damageResolved.mana.player.current, 2);
  assert.equal(damageResolved.heroes.ai.hp, 16);
  assert.notEqual(damageResolved.rngSeed, 0);

  const healState = stateWith({
    playerHand: [card('ab-test')],
    playerMana: 5,
    playerHp: 12,
    aiHp: 20,
    rngSeed: 1,
  });

  const healResolved = playCard(healState, 'player', 0, 'hero');
  assert.equal(healResolved.mana.player.current, 2);
  assert.equal(healResolved.heroes.player.hp, 16);
  assert.equal(healResolved.heroes.ai.hp, 20);
  assert.notEqual(healResolved.rngSeed, 1);
});

test('Funnel costs 4 and summons a 3/4 minion with summoning sickness', () => {
  const resolved = playCard(stateWith({ playerHand: [card('funnel')], playerMana: 6 }), 'player', 0);

  assert.equal(resolved.mana.player.current, 2);
  assert.equal(resolved.boards.player.length, 1);
  assert.deepEqual(
    {
      attack: resolved.boards.player[0].attack,
      hp: resolved.boards.player[0].hp,
      canAttack: resolved.boards.player[0].canAttack,
    },
    { attack: 3, hp: 4, canAttack: false },
  );
});

test('Cohort costs 5 and summons a 4/5 minion plus a 1/1 Subscriber', () => {
  const resolved = playCard(stateWith({ playerHand: [card('cohort')], playerMana: 7 }), 'player', 0);

  assert.equal(resolved.mana.player.current, 2);
  assert.deepEqual(resolved.boards.player.map(({ name, attack: atk, hp }) => ({ name, attack: atk, hp })), [
    { name: 'Cohort', attack: 4, hp: 5 },
    { name: 'Subscriber', attack: 1, hp: 1 },
  ]);
  assert.equal(resolved.boards.player.every((nextMinion) => nextMinion.canAttack === false), true);
});

test('Insight costs 2 and draws 1 card', () => {
  const resolved = playCard(stateWith({
    playerHand: [card('insight')],
    playerDeck: [card('experiment'), card('heatmap')],
    playerMana: 4,
  }), 'player', 0);

  assert.equal(resolved.mana.player.current, 2);
  assert.deepEqual(resolved.hands.player.map((nextCard) => nextCard.type), ['experiment']);
  assert.deepEqual(resolved.decks.player.map((nextCard) => nextCard.type), ['heatmap']);
});

test('Surveys costs 3 and deals 1 damage to all enemy minions, removing defeated ones', () => {
  const resolved = playCard(stateWith({
    playerHand: [card('surveys')],
    playerMana: 5,
    aiBoard: [minion('one-hp', 5, 1), minion('three-hp', 2, 3)],
  }), 'player', 0);

  assert.equal(resolved.mana.player.current, 2);
  assert.equal(resolved.boards.ai.length, 1);
  assert.equal(resolved.boards.ai[0].cardId, 'three-hp');
  assert.equal(resolved.boards.ai[0].hp, 2);
});

test('Heatmap costs 4 and deals 3 damage to target; AI always targets player hero', () => {
  const playerResolved = playCard(stateWith({
    playerHand: [card('heatmap')],
    playerMana: 6,
    aiBoard: [minion('target', 2, 5)],
  }), 'player', 0, 0);

  assert.equal(playerResolved.mana.player.current, 2);
  assert.equal(playerResolved.boards.ai[0].hp, 2);
  assert.equal(playerResolved.heroes.ai.hp, 20);

  const aiResolved = playCard(stateWith({
    activePlayer: 'ai',
    aiHand: [card('heatmap')],
    aiMana: 6,
    playerBoard: [minion('would-be-target', 8, 5)],
  }), 'ai', 0, 0);

  assert.equal(aiResolved.mana.ai.current, 2);
  assert.equal(aiResolved.heroes.player.hp, 17);
  assert.equal(aiResolved.boards.player[0].hp, 5);
});

test('Experiment costs 6, summons a 5/5 minion, and deals 2 battlecry damage to enemy hero', () => {
  const resolved = playCard(stateWith({ playerHand: [card('experiment')], playerMana: 8 }), 'player', 0);

  assert.equal(resolved.mana.player.current, 2);
  assert.equal(resolved.boards.player.length, 1);
  assert.deepEqual(
    { attack: resolved.boards.player[0].attack, hp: resolved.boards.player[0].hp, canAttack: resolved.boards.player[0].canAttack },
    { attack: 5, hp: 5, canAttack: false },
  );
  assert.equal(resolved.heroes.ai.hp, 18);
});

test('summoning sickness prevents attack on play turn and clears on the controller next turn', () => {
  const played = playCard(stateWith({
    playerHand: [card('funnel')],
    playerMana: 4,
    turn: 4,
  }), 'player', 0);

  assert.equal(played.boards.player[0].canAttack, false);

  const sameTurnAttack = attack(played, 'player', 0, 'hero');
  assert.equal(sameTurnAttack.heroes.ai.hp, 20);

  const aiTurn = endTurn(played);
  const playerNextTurn = endTurn(aiTurn);
  assert.equal(playerNextTurn.activePlayer, 'player');
  assert.equal(playerNextTurn.boards.player[0].canAttack, true);

  const attacked = attack(playerNextTurn, 'player', 0, 'hero');
  assert.equal(attacked.heroes.ai.hp, 17);
  assert.equal(attacked.boards.player[0].canAttack, false);
});

test('minion combat damages both minions and removes defeated ones', () => {
  const resolved = attack(stateWith({
    playerBoard: [minion('attacker', 3, 2, true)],
    aiBoard: [minion('defender', 2, 3, true)],
  }), 'player', 0, 0);

  assert.equal(resolved.boards.player.length, 0);
  assert.equal(resolved.boards.ai.length, 0);
  assert.equal(resolved.heroes.player.hp, 20);
  assert.equal(resolved.heroes.ai.hp, 20);
});

test('hero at 0 HP triggers winner', () => {
  const checked = checkWinCondition(stateWith({ aiHp: 0 }));
  assert.equal(checked.winner, 'player');
  assert.equal(checked.heroes.ai.hp, 0);
});

test('takeAiTurn terminates across varied states and returns control to the player', () => {
  const states = [
    stateWith({ activePlayer: 'ai', aiMana: 10, aiHand: [card('experiment'), card('heatmap'), card('feature-flag')], playerBoard: [minion('threat', 6, 5)] }),
    stateWith({ activePlayer: 'ai', aiMana: 10, aiHand: Array.from({ length: 20 }, (_, index) => card(index % 2 === 0 ? 'feature-flag' : 'insight', index + 1)), aiDeck: Array.from({ length: 20 }, (_, index) => card('funnel', index + 1)) }),
    createInitialState(99),
  ];

  for (const nextState of states.map((candidate) => takeAiTurn(candidate))) {
    assert.equal(nextState.activePlayer, 'player');
    assert.equal(nextState.turn >= 2, true);
    assert.equal(nextState.hands.ai.length < 100, true);
  }
});
