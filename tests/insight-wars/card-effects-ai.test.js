import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_IDS,
  PLAYERS,
  attack,
  createCard,
  createMinion,
  endTurn,
  heroTarget,
  newGame,
  resolveCard,
  runAiTurn,
} from '../../js/insight-wars/index.js';

function blankGame(){
  return newGame({ playerDeck: [], aiDeck: [], startingHandSize: 0 });
}

function giveCard(state, player, cardId){
  const card = createCard(cardId);
  state.players[player].hand.push(card);
  return card;
}

function setActive(state, player, events = 10){
  state.activePlayer = player;
  state.players[player].events = events;
  state.players[player].maxEvents = Math.max(state.players[player].maxEvents, events);
  return state;
}

function addMinion(state, player, stats = {}){
  const minion = createMinion({
    name: stats.name ?? 'Test Minion',
    attack: stats.attack ?? 2,
    hp: stats.hp ?? 3,
    owner: player,
    summoningSickness: stats.summoningSickness ?? false,
    disabled: stats.disabled ?? false,
  });
  state.players[player].board.push(minion);
  return minion;
}

test('Feature Flag disables one enemy minion and spends events', () => {
  const state = blankGame();
  const target = addMinion(state, PLAYERS.AI);
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG);
  setActive(state, PLAYERS.PLAYER, 1);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG, { type: 'minion', id: target.id });

  assert.equal(result.ok, true);
  assert.equal(target.disabled, true);
  assert.equal(state.players.player.events, 0);
  assert.equal(state.players.player.hand.length, 0);
});

test('Feature Flag rejects when there are no enemy minions or no valid target', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG);
  setActive(state, PLAYERS.PLAYER, 1);

  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG).reason, 'no-enemy-minions');

  const enemy = addMinion(state, PLAYERS.AI);
  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG).reason, 'invalid-target');
  assert.equal(enemy.disabled, false);
  assert.equal(state.players.player.events, 1);
});

test('Session Replay reveals AI hand for the current player turn and clears on endTurn', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.SESSION_REPLAY);
  setActive(state, PLAYERS.PLAYER, 2);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.SESSION_REPLAY);

  assert.equal(result.ok, true);
  assert.equal(state.aiHandRevealedUntilEndOfTurn, true);
  assert.equal(state.players.player.events, 0);

  endTurn(state, { runAi: false });
  assert.equal(state.aiHandRevealedUntilEndOfTurn, false);
});

test('AI Session Replay is an explicit no-op', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.AI, CARD_IDS.SESSION_REPLAY);
  setActive(state, PLAYERS.AI, 2);

  const result = resolveCard(state, PLAYERS.AI, CARD_IDS.SESSION_REPLAY);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ai-session-replay-no-op');
  assert.equal(state.aiHandRevealedUntilEndOfTurn, false);
  assert.equal(state.players.ai.events, 2);
  assert.equal(state.players.ai.hand.length, 1);
});

test('A/B Test heads deals 5 damage to enemy hero', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.AB_TEST);
  setActive(state, PLAYERS.PLAYER, 3);
  const originalRandom = Math.random;
  Math.random = () => 0.1;
  try {
    const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.AB_TEST);
    assert.equal(result.ok, true);
    assert.equal(state.players.ai.hero.hp, 15);
    assert.equal(state.players.player.hero.hp, 20);
    assert.equal(state.players.player.events, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test('A/B Test tails heals self for 5 capped at 20', () => {
  const state = blankGame();
  state.players.player.hero.hp = 18;
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.AB_TEST);
  setActive(state, PLAYERS.PLAYER, 3);
  const originalRandom = Math.random;
  Math.random = () => 0.9;
  try {
    const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.AB_TEST);
    assert.equal(result.ok, true);
    assert.equal(state.players.player.hero.hp, 20);
    assert.equal(state.players.ai.hero.hp, 20);
    assert.equal(state.players.player.events, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test('Funnel deals 2 AoE damage to all enemy minions and destroys dead minions', () => {
  const state = blankGame();
  addMinion(state, PLAYERS.AI, { hp: 2 });
  const survivor = addMinion(state, PLAYERS.AI, { hp: 5 });
  addMinion(state, PLAYERS.PLAYER, { hp: 2 });
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.FUNNEL);
  setActive(state, PLAYERS.PLAYER, 4);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.FUNNEL);

  assert.equal(result.ok, true);
  assert.deepEqual(state.players.ai.board.map((m) => m.id), [survivor.id]);
  assert.equal(survivor.hp, 3);
  assert.equal(state.players.player.board.length, 1);
  assert.equal(state.players.player.events, 0);
});

test('Cohort summons a 2/3 minion with summoning sickness', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.COHORT);
  setActive(state, PLAYERS.PLAYER, 3);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.COHORT);
  const minion = state.players.player.board[0];

  assert.equal(result.ok, true);
  assert.equal(minion.attack, 2);
  assert.equal(minion.hp, 3);
  assert.equal(minion.summoningSickness, true);
  assert.equal(state.players.player.events, 0);
});

test('Insight draws one card and is a no-op when the deck is empty', () => {
  const state = blankGame();
  state.players.player.deck.push(createCard(CARD_IDS.SURVEYS));
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.INSIGHT);
  setActive(state, PLAYERS.PLAYER, 2);

  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.INSIGHT).ok, true);
  assert.deepEqual(state.players.player.hand.map((card) => card.id), [CARD_IDS.SURVEYS]);
  assert.equal(state.players.player.events, 1);

  giveCard(state, PLAYERS.PLAYER, CARD_IDS.INSIGHT);
  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.INSIGHT).ok, true);
  assert.equal(state.players.player.hand.length, 1);
  assert.equal(state.players.player.events, 0);
});

test('Surveys heals self hero for 4 capped at 20', () => {
  const state = blankGame();
  state.players.player.hero.hp = 18;
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.SURVEYS);
  setActive(state, PLAYERS.PLAYER, 2);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.SURVEYS);

  assert.equal(result.ok, true);
  assert.equal(state.players.player.hero.hp, 20);
  assert.equal(state.players.player.events, 0);
});

test('Heatmap deals 4 damage to enemy hero or any minion and validates targets', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP);
  setActive(state, PLAYERS.PLAYER, 3);

  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP, heroTarget(PLAYERS.AI)).ok, true);
  assert.equal(state.players.ai.hero.hp, 16);
  assert.equal(state.players.player.events, 0);

  giveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP);
  state.players.player.events = 3;
  const minion = addMinion(state, PLAYERS.PLAYER, { hp: 4 });
  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP, { type: 'minion', id: minion.id }).ok, true);
  assert.equal(state.players.player.board.includes(minion), false);

  giveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP);
  state.players.player.events = 3;
  assert.equal(resolveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP).reason, 'invalid-target');
});

test('Experiment summons a 5/5 minion with summoning sickness', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.EXPERIMENT);
  setActive(state, PLAYERS.PLAYER, 5);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.EXPERIMENT);
  const minion = state.players.player.board[0];

  assert.equal(result.ok, true);
  assert.equal(minion.attack, 5);
  assert.equal(minion.hp, 5);
  assert.equal(minion.summoningSickness, true);
  assert.equal(state.players.player.events, 0);
});

test('all cards reject when the active player lacks enough events', () => {
  for(const cardId of Object.values(CARD_IDS)){
    const state = blankGame();
    const card = giveCard(state, PLAYERS.PLAYER, cardId);
    setActive(state, PLAYERS.PLAYER, Math.max(0, card.cost - 1));
    if(cardId === CARD_IDS.FEATURE_FLAG) addMinion(state, PLAYERS.AI);
    const target = cardId === CARD_IDS.FEATURE_FLAG
      ? { type: 'minion', id: state.players.ai.board[0].id }
      : cardId === CARD_IDS.HEATMAP
        ? heroTarget(PLAYERS.AI)
        : undefined;

    const result = resolveCard(state, PLAYERS.PLAYER, cardId, target);
    assert.equal(result.ok, false, `${cardId} should reject`);
    assert.equal(result.reason, 'not-enough-events');
    assert.equal(state.players.player.hand.length, 1);
  }
});

test('summoning sickness prevents attacking until controller next turn', () => {
  const state = blankGame();
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.COHORT);
  setActive(state, PLAYERS.PLAYER, 3);
  resolveCard(state, PLAYERS.PLAYER, CARD_IDS.COHORT);
  const minion = state.players.player.board[0];

  assert.equal(attack(state, minion.id, heroTarget(PLAYERS.AI)).reason, 'summoning-sickness');
  assert.equal(state.players.ai.hero.hp, 20);

  endTurn(state, { runAi: false }); // AI turn
  endTurn(state, { runAi: false }); // player next turn, summoning sickness clears

  assert.equal(minion.summoningSickness, false);
  assert.equal(attack(state, minion.id, heroTarget(PLAYERS.AI)).ok, true);
  assert.equal(state.players.ai.hero.hp, 18);
});

test('Feature Flag disabled minion cannot attack once and then clears', () => {
  const state = blankGame();
  const aiMinion = addMinion(state, PLAYERS.AI, { attack: 3 });
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG);
  setActive(state, PLAYERS.PLAYER, 1);
  resolveCard(state, PLAYERS.PLAYER, CARD_IDS.FEATURE_FLAG, { type: 'minion', id: aiMinion.id });

  setActive(state, PLAYERS.AI, 0);
  const result = attack(state, aiMinion.id, heroTarget(PLAYERS.PLAYER));

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'disabled');
  assert.equal(aiMinion.disabled, false);
  assert.equal(state.players.player.hero.hp, 20);
});

test('simultaneous minion combat can kill both minions', () => {
  const state = blankGame();
  const attacker = addMinion(state, PLAYERS.PLAYER, { attack: 2, hp: 3 });
  const defender = addMinion(state, PLAYERS.AI, { attack: 3, hp: 2 });
  setActive(state, PLAYERS.PLAYER, 0);

  const result = attack(state, attacker.id, { type: 'minion', id: defender.id });

  assert.equal(result.ok, true);
  assert.equal(state.players.player.board.length, 0);
  assert.equal(state.players.ai.board.length, 0);
});

test('simultaneous minion combat preserves surviving minion HP totals', () => {
  const state = blankGame();
  const attacker = addMinion(state, PLAYERS.PLAYER, { attack: 2, hp: 3 });
  const defender = addMinion(state, PLAYERS.AI, { attack: 1, hp: 5 });
  setActive(state, PLAYERS.PLAYER, 0);

  assert.equal(attack(state, attacker.id, { type: 'minion', id: defender.id }).ok, true);
  assert.equal(state.players.player.board[0].hp, 2);
  assert.equal(state.players.ai.board[0].hp, 3);
});

test('AI greedy loop plays highest-cost affordable cards until exhausted', () => {
  const state = blankGame();
  state.players.ai.hand.push(
    createCard(CARD_IDS.SURVEYS),
    createCard(CARD_IDS.INSIGHT),
    createCard(CARD_IDS.HEATMAP),
    createCard(CARD_IDS.EXPERIMENT),
  );
  setActive(state, PLAYERS.AI, 6);

  runAiTurn(state);

  const aiCardSequence = state.history
    .filter((entry) => entry.type === 'card-played' && entry.player === PLAYERS.AI)
    .map((entry) => entry.cardId);
  assert.deepEqual(aiCardSequence, [CARD_IDS.EXPERIMENT, CARD_IDS.INSIGHT]);
  assert.equal(state.activePlayer, PLAYERS.PLAYER);
});

test('AI Heatmap always targets the player hero even when player minions exist', () => {
  const state = blankGame();
  const minion = addMinion(state, PLAYERS.PLAYER, { hp: 10 });
  state.players.ai.hand.push(createCard(CARD_IDS.HEATMAP));
  setActive(state, PLAYERS.AI, 3);

  runAiTurn(state);

  assert.equal(state.players.player.hero.hp, 16);
  assert.equal(minion.hp, 10);
});

test('AI skips Session Replay as a no-op and terminates', () => {
  const state = blankGame();
  state.players.ai.hand.push(createCard(CARD_IDS.SESSION_REPLAY));
  setActive(state, PLAYERS.AI, 2);

  runAiTurn(state);

  assert.equal(state.players.ai.hand.length, 1);
  assert.equal(state.players.ai.events, 2);
  assert.equal(state.aiHandRevealedUntilEndOfTurn, false);
  assert.equal(state.activePlayer, PLAYERS.PLAYER);
  assert.equal(state.history.some((entry) => entry.type === 'ai-safety-stop'), false);
});

test('ending the player turn automatically runs the AI turn when AI is registered', () => {
  const state = blankGame();
  state.players.ai.maxEvents = 2;
  state.players.ai.hand.push(createCard(CARD_IDS.HEATMAP));
  setActive(state, PLAYERS.PLAYER, 0);

  endTurn(state);

  assert.equal(state.players.player.hero.hp, 16);
  assert.equal(state.activePlayer, PLAYERS.PLAYER);
});

test('win condition ends the game with the correct winner when hero HP reaches 0', () => {
  const state = blankGame();
  state.players.ai.hero.hp = 4;
  giveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP);
  setActive(state, PLAYERS.PLAYER, 3);

  const result = resolveCard(state, PLAYERS.PLAYER, CARD_IDS.HEATMAP, heroTarget(PLAYERS.AI));

  assert.equal(result.ok, true);
  assert.equal(state.players.ai.hero.hp, 0);
  assert.equal(state.gameOver, true);
  assert.equal(state.winner, PLAYERS.PLAYER);
});
