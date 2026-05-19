import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARDS, DECK_CARD_IDS } from './cards.js';
import {
  BOARD_CAP,
  CARD_RESOLVERS,
  HERO_MAX_HP,
  MAX_MANA,
  OPENING_HAND_SIZE,
  attackTarget,
  canMinionAttack,
  checkWin,
  createInitialState,
  endTurn,
  resolveCard,
  startTurn,
} from './gameState.js';

function readyState(card, caster = 'player'){
  const state = createInitialState(100);
  state.activePlayer = caster;
  state.hands[caster] = [card];
  const mana = caster === 'player' ? state.playerMana : state.aiMana;
  mana.current = card.cost;
  mana.max = card.cost;
  return state;
}

function existingMinion(id, cardId = 'cohort', attack = 3, hp = 2){
  return {
    id,
    cardId,
    attack,
    hp,
    summonedOnTurn: 0,
    summonedThisTurn: false,
  };
}

function assertSpent(state, caster, cost){
  const mana = caster === 'player' ? state.playerMana : state.aiMana;
  assert.equal(mana.current, 0);
  assert.equal(state.hands[caster].length, 0);
  assert.equal(cost > 0, true);
}

describe('Insight Wars game state', () => {
  it('createInitialState returns the expected opening shape', () => {
    const state = createInitialState(1234);
    const sameSeed = createInitialState(1234);

    assert.deepEqual(state.heroes.player, { name: 'Analyst', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP });
    assert.deepEqual(state.heroes.ai, { name: 'HogBot', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP });
    assert.deepEqual(state.boards.player, []);
    assert.deepEqual(state.boards.ai, []);
    assert.equal(state.hands.player.length, OPENING_HAND_SIZE);
    assert.equal(state.hands.ai.length, OPENING_HAND_SIZE);
    assert.equal(state.decks.player.length, 18);
    assert.equal(state.decks.ai.length, 18);
    assert.equal(state.turn, 1);
    assert.equal(state.activePlayer, 'player');
    assert.deepEqual(state.playerMana, { current: 1, max: 1 });
    assert.deepEqual(state.aiMana, { current: 1, max: 1 });
    assert.equal(state.phase, 'playing');
    assert.deepEqual(
      state.hands.player.map((card) => card.id),
      sameSeed.hands.player.map((card) => card.id),
    );
  });

  it('exports a resolver for each of the 9 cards', () => {
    assert.deepEqual(Object.keys(CARD_RESOLVERS).sort(), [...new Set(DECK_CARD_IDS)].sort());
  });

  it('ramps mana from 1 to 10 and caps at 10 on turns 1, 5, 10, 11, and 15', () => {
    const state = createInitialState(1);
    assert.equal(state.turn, 1);
    assert.equal(state.playerMana.max, 1);

    for(let i = 0; i < 4; i += 1) startTurn(state);
    assert.equal(state.turn, 5);
    assert.equal(state.playerMana.max, 5);
    assert.equal(state.playerMana.current, 5);

    for(let i = 0; i < 5; i += 1) startTurn(state);
    assert.equal(state.turn, 10);
    assert.equal(state.playerMana.max, MAX_MANA);
    assert.equal(state.playerMana.current, MAX_MANA);

    startTurn(state);
    assert.equal(state.turn, 11);
    assert.equal(state.playerMana.max, MAX_MANA);

    for(let i = 0; i < 4; i += 1) startTurn(state);
    assert.equal(state.turn, 15);
    assert.equal(state.playerMana.max, MAX_MANA);
  });

  it('Feature Flag spends mana and disables one enemy minion on the opponent next turn without removing it', () => {
    const state = readyState(CARDS['feature-flag']);
    state.boards.ai = [existingMinion('ai-target'), existingMinion('ai-other')];

    const result = resolveCard(state, CARDS['feature-flag'], 'player', {
      type: 'minion',
      owner: 'ai',
      minionId: 'ai-target',
    });

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS['feature-flag'].cost);
    assert.equal(state.boards.ai.length, 2);
    assert.equal(state.boards.ai[0].disabledUntilTurn, 2);

    endTurn(state);
    startTurn(state);
    assert.equal(state.activePlayer, 'ai');
    assert.equal(state.turn, 2);
    assert.equal(canMinionAttack(state, state.boards.ai[0]), false);
    assert.equal(state.boards.ai.length, 2);
  });

  it('Session Replay reveals the AI hand for player casts until the start of the player next turn', () => {
    const state = readyState(CARDS['session-replay']);

    const result = resolveCard(state, CARDS['session-replay'], 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS['session-replay'].cost);
    assert.equal(state.aiHandRevealedUntilTurn, 2);

    endTurn(state);
    startTurn(state);
    assert.equal(state.activePlayer, 'ai');
    assert.equal(state.aiHandRevealedUntilTurn, 2);

    endTurn(state);
    startTurn(state);
    assert.equal(state.activePlayer, 'player');
    assert.equal(state.turn, 3);
    assert.equal(state.aiHandRevealedUntilTurn, undefined);
  });

  it('Session Replay is an intentional AI no-op that still spends AI mana and removes the card', () => {
    const state = readyState(CARDS['session-replay'], 'ai');

    const result = resolveCard(state, CARDS['session-replay'], 'ai');

    assert.equal(result.ok, true);
    assertSpent(state, 'ai', CARDS['session-replay'].cost);
    assert.equal(state.aiHandRevealedUntilTurn, undefined);
    assert.equal(state.log.at(-1), 'Session Replay is an intentional no-op for AI.');
  });

  it('A/B Test spends mana and summons a 2/3 minion with summoning sickness', () => {
    const state = readyState(CARDS['ab-test']);

    const result = resolveCard(state, CARDS['ab-test'], 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS['ab-test'].cost);
    assert.equal(state.boards.player.length, 1);
    assert.deepEqual(
      { cardId: state.boards.player[0].cardId, attack: state.boards.player[0].attack, hp: state.boards.player[0].hp, summonedThisTurn: state.boards.player[0].summonedThisTurn },
      { cardId: 'ab-test', attack: 2, hp: 3, summonedThisTurn: true },
    );
  });

  it('Funnel spends mana and summons a 4/4 minion', () => {
    const state = readyState(CARDS.funnel);

    const result = resolveCard(state, CARDS.funnel, 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS.funnel.cost);
    assert.equal(state.boards.player.length, 1);
    assert.equal(state.boards.player[0].attack, 4);
    assert.equal(state.boards.player[0].hp, 4);
  });

  it('Cohort spends mana and summons a 3/2 minion', () => {
    const state = readyState(CARDS.cohort);

    const result = resolveCard(state, CARDS.cohort, 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS.cohort.cost);
    assert.equal(state.boards.player.length, 1);
    assert.equal(state.boards.player[0].attack, 3);
    assert.equal(state.boards.player[0].hp, 2);
  });

  it('Insight spends mana and deals 2 damage to an enemy hero or enemy minion', () => {
    const heroState = readyState(CARDS.insight);
    const heroResult = resolveCard(heroState, CARDS.insight, 'player', { type: 'hero', owner: 'ai' });

    assert.equal(heroResult.ok, true);
    assertSpent(heroState, 'player', CARDS.insight.cost);
    assert.equal(heroState.heroes.ai.hp, 18);

    const minionState = readyState(CARDS.insight);
    minionState.boards.ai = [existingMinion('ai-target', 'cohort', 3, 3)];
    const minionResult = resolveCard(minionState, CARDS.insight, 'player', {
      type: 'minion',
      owner: 'ai',
      minionId: 'ai-target',
    });

    assert.equal(minionResult.ok, true);
    assert.equal(minionState.boards.ai[0].hp, 1);
  });

  it('Surveys spends mana and heals hero by 4 with a 20 HP cap', () => {
    const state = readyState(CARDS.surveys);
    state.heroes.player.hp = 18;

    const result = resolveCard(state, CARDS.surveys, 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS.surveys.cost);
    assert.equal(state.heroes.player.hp, 20);
  });

  it('Heatmap spends mana and deals 3 damage to a supplied target', () => {
    const state = readyState(CARDS.heatmap);
    state.boards.ai = [existingMinion('ai-target', 'cohort', 3, 4)];

    const result = resolveCard(state, CARDS.heatmap, 'player', {
      type: 'minion',
      owner: 'ai',
      minionId: 'ai-target',
    });

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS.heatmap.cost);
    assert.equal(state.boards.ai[0].hp, 1);
  });

  it('Heatmap defaults to the player hero when AI plays it without a target', () => {
    const state = readyState(CARDS.heatmap, 'ai');

    const result = resolveCard(state, CARDS.heatmap, 'ai');

    assert.equal(result.ok, true);
    assertSpent(state, 'ai', CARDS.heatmap.cost);
    assert.equal(state.heroes.player.hp, 17);
  });

  it('Experiment spends mana and summons a 5/5 minion', () => {
    const state = readyState(CARDS.experiment);

    const result = resolveCard(state, CARDS.experiment, 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS.experiment.cost);
    assert.equal(state.boards.player.length, 1);
    assert.equal(state.boards.player[0].attack, 5);
    assert.equal(state.boards.player[0].hp, 5);
  });

  it('enforces summoning sickness: minions cannot attack when played, but can attack next player turn', () => {
    const state = readyState(CARDS.cohort);
    resolveCard(state, CARDS.cohort, 'player');
    const minion = state.boards.player[0];

    assert.equal(canMinionAttack(state, minion), false);
    assert.equal(attackTarget(state, minion.id, { type: 'hero', owner: 'ai' }).ok, false);

    endTurn(state);
    startTurn(state);
    endTurn(state);
    startTurn(state);

    assert.equal(state.activePlayer, 'player');
    assert.equal(minion.summonedThisTurn, false);
    assert.equal(canMinionAttack(state, minion), true);
  });

  it('rejects cards without enough mana without spending mana or removing the card', () => {
    const state = readyState(CARDS.experiment);
    state.playerMana.current = CARDS.experiment.cost - 1;

    const result = resolveCard(state, CARDS.experiment, 'player');

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'Not enough mana.');
    assert.equal(state.playerMana.current, 4);
    assert.equal(state.hands.player.length, 1);
    assert.equal(state.boards.player.length, 0);
  });

  it('summon cards fizzle gracefully on a full board while still spending mana', () => {
    const state = readyState(CARDS.experiment);
    state.boards.player = Array.from({ length: BOARD_CAP }, (_, index) => existingMinion(`existing-${index}`));

    const result = resolveCard(state, CARDS.experiment, 'player');

    assert.equal(result.ok, true);
    assertSpent(state, 'player', CARDS.experiment.cost);
    assert.equal(state.boards.player.length, BOARD_CAP);
  });

  it('sets the game-over phase when a hero reaches 0 HP or below', () => {
    const wonState = readyState(CARDS.insight);
    wonState.heroes.ai.hp = 2;
    const wonResult = resolveCard(wonState, CARDS.insight, 'player', { type: 'hero', owner: 'ai' });
    assert.equal(wonResult.ok, true);
    assert.equal(wonState.heroes.ai.hp, 0);
    assert.equal(wonState.phase, 'won');

    const lostState = createInitialState(3);
    lostState.heroes.player.hp = 0;
    checkWin(lostState);
    assert.equal(lostState.phase, 'lost');
  });
});
