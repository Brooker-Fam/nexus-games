import test from 'node:test';
import assert from 'node:assert/strict';

import { CARD_EFFECTS, getCard } from './cards.js';
import { runAiTurn } from './ai.js';
import { createSide } from './state.js';
import { attackWithMinion, endTurn, playCard } from './turn-engine.js';

function makeState({
  activePlayer = 'player',
  turn = 1,
  playerHp = 20,
  aiHp = 20,
  playerMana = 10,
  aiMana = 10,
  playerHand = [],
  aiHand = [],
  playerDeck = [],
  aiDeck = [],
  playerBoard = [],
  aiBoard = [],
  rng = () => 0.25,
  nextMinionId = 1,
} = {}){
  return {
    player: {
      ...createSide(playerDeck),
      hp: playerHp,
      maxMana: playerMana,
      currentMana: playerMana,
      hand: playerHand.map(getCard),
      board: playerBoard,
    },
    ai: {
      ...createSide(aiDeck),
      hp: aiHp,
      maxMana: aiMana,
      currentMana: aiMana,
      hand: aiHand.map(getCard),
      board: aiBoard,
    },
    turn,
    activePlayer,
    phase: 'playing',
    nextMinionId,
    revealedAiHand: false,
    rng,
    log: [],
  };
}

function makeMinion({ id, name = 'Test Minion', attack = 2, hp = 4, canAttack = true, sourceCardId = 'cohort', stunnedNextTurn = false }){
  return {
    id,
    name,
    attack,
    hp,
    maxHp: hp,
    canAttack,
    sourceCardId,
    ...(stunnedNextTurn ? { stunnedNextTurn } : {}),
  };
}

test('Feature Flag resolver deducts mana and stuns an enemy minion for one owner turn', () => {
  const enemy = makeMinion({ id: 'ai-minion-1', canAttack: true });
  const state = makeState({ playerMana: 3, playerHand: ['feature-flag'], aiBoard: [enemy] });

  const next = playCard(state, 0, { type: 'minion', owner: 'ai', id: enemy.id });

  assert.equal(next.player.currentMana, 2);
  assert.equal(next.player.hand.length, 0);
  assert.equal(next.ai.board[0].stunnedNextTurn, true);
});

test('Session Replay resolver deducts mana and reveals AI hand for the current player turn only', () => {
  const state = makeState({ playerMana: 2, playerHand: ['session-replay'], aiHand: ['dashboard'] });

  const revealed = playCard(state, 0);
  assert.equal(revealed.player.currentMana, 0);
  assert.equal(revealed.revealedAiHand, true);

  const hidden = endTurn(revealed);
  assert.equal(hidden.revealedAiHand, false);
});

test('A/B Test resolver deducts mana, supports deterministic damage and capped healing branches', () => {
  const damageState = makeState({ playerMana: 2, playerHand: ['ab-test'], rng: () => 0.1 });
  const damaged = playCard(damageState, 0);
  assert.equal(damaged.player.currentMana, 0);
  assert.equal(damaged.ai.hp, 15);
  assert.equal(damaged.player.hp, 20);

  const healState = makeState({ playerHp: 18, playerMana: 2, playerHand: ['ab-test'], rng: () => 0.9 });
  const healed = playCard(healState, 0);
  assert.equal(healed.player.currentMana, 0);
  assert.equal(healed.player.hp, 20);
  assert.equal(healed.ai.hp, 20);
});

test('Funnel resolver deducts mana, damages every enemy minion, and removes defeated minions', () => {
  const state = makeState({
    playerMana: 3,
    playerHand: ['funnel'],
    aiBoard: [
      makeMinion({ id: 'ai-minion-1', hp: 4 }),
      makeMinion({ id: 'ai-minion-2', hp: 2 }),
    ],
  });

  const next = playCard(state, 0);

  assert.equal(next.player.currentMana, 0);
  assert.deepEqual(next.ai.board.map((minion) => [minion.id, minion.hp]), [['ai-minion-1', 2]]);
});

test('Cohort resolver deducts mana and summons a 2/4 minion with summoning sickness', () => {
  const state = makeState({ playerMana: 3, playerHand: ['cohort'] });

  const next = playCard(state, 0);
  const [minion] = next.player.board;

  assert.equal(next.player.currentMana, 0);
  assert.equal(minion.sourceCardId, 'cohort');
  assert.equal(minion.attack, CARD_EFFECTS.cohort.attack);
  assert.equal(minion.hp, CARD_EFFECTS.cohort.hp);
  assert.equal(minion.canAttack, false);
});

test('Insight resolver deducts mana and draws two cards', () => {
  const state = makeState({ playerMana: 4, playerHand: ['insight'], playerDeck: [getCard('cohort'), getCard('heatmap')] });

  const next = playCard(state, 0);

  assert.equal(next.player.currentMana, 0);
  assert.deepEqual(next.player.hand.map((card) => card.id), ['cohort', 'heatmap']);
  assert.equal(next.player.deck.length, 0);
});

test('Experiment resolver deducts mana and summons a 4/3 minion with summoning sickness', () => {
  const state = makeState({ playerMana: 4, playerHand: ['experiment'] });

  const next = playCard(state, 0);
  const [minion] = next.player.board;

  assert.equal(next.player.currentMana, 0);
  assert.equal(minion.sourceCardId, 'experiment');
  assert.equal(minion.attack, CARD_EFFECTS.experiment.attack);
  assert.equal(minion.hp, CARD_EFFECTS.experiment.hp);
  assert.equal(minion.canAttack, false);
});

test('Heatmap resolver deducts mana and defaults to damaging the enemy hero', () => {
  const state = makeState({ playerMana: 5, playerHand: ['heatmap'] });

  const next = playCard(state, 0);

  assert.equal(next.player.currentMana, 0);
  assert.equal(next.ai.hp, 20 - CARD_EFFECTS.heatmap.damage);
});

test('Dashboard resolver deducts mana and summons a 5/7 minion with summoning sickness', () => {
  const state = makeState({ playerMana: 6, playerHand: ['dashboard'] });

  const next = playCard(state, 0);
  const [minion] = next.player.board;

  assert.equal(next.player.currentMana, 0);
  assert.equal(minion.sourceCardId, 'dashboard');
  assert.equal(minion.attack, CARD_EFFECTS.dashboard.attack);
  assert.equal(minion.hp, CARD_EFFECTS.dashboard.hp);
  assert.equal(minion.canAttack, false);
});

test('insufficient mana rejects card play without deducting mana or removing the card', () => {
  const state = makeState({ playerMana: 1, playerHand: ['dashboard'] });

  const next = playCard(state, 0);

  assert.equal(next.player.currentMana, 1);
  assert.deepEqual(next.player.hand.map((card) => card.id), ['dashboard']);
  assert.equal(next.player.board.length, 0);
});

test('summoning sickness prevents attacking on summon turn and clears on the owner next turn', () => {
  const summoned = playCard(makeState({ playerMana: 3, playerHand: ['cohort'] }), 0);
  const minionId = summoned.player.board[0].id;

  const sameTurnAttack = attackWithMinion(summoned, minionId, { type: 'hero', owner: 'ai' });
  assert.equal(sameTurnAttack.ai.hp, 20);
  assert.equal(sameTurnAttack.player.board[0].canAttack, false);

  const aiTurn = endTurn(summoned);
  const playerNextTurn = endTurn(aiTurn);
  assert.equal(playerNextTurn.player.board[0].canAttack, true);

  const attacked = attackWithMinion(playerNextTurn, minionId, { type: 'hero', owner: 'ai' });
  assert.equal(attacked.ai.hp, 20 - CARD_EFFECTS.cohort.attack);
  assert.equal(attacked.player.board[0].canAttack, false);
});

test('minion combat exchanges damage and removes minions at 0 HP', () => {
  const attacker = makeMinion({ id: 'player-minion-1', attack: 3, hp: 2, canAttack: true });
  const defender = makeMinion({ id: 'ai-minion-1', attack: 2, hp: 3, canAttack: true });
  const state = makeState({ playerBoard: [attacker], aiBoard: [defender] });

  const next = attackWithMinion(state, attacker.id, { type: 'minion', owner: 'ai', id: defender.id });

  assert.equal(next.player.board.length, 0);
  assert.equal(next.ai.board.length, 0);
});

test('AI turn never hangs when it has no playable cards and no eligible minions', () => {
  const state = makeState({
    activePlayer: 'ai',
    aiMana: 0,
    aiHand: ['dashboard'],
    aiBoard: [makeMinion({ id: 'ai-minion-1', canAttack: false })],
  });

  const next = runAiTurn(state);

  assert.equal(next.activePlayer, 'player');
  assert.equal(next.turn, 2);
});

test('AI greedily plays affordable cards then attacks the player hero with ready minions', () => {
  const state = makeState({
    activePlayer: 'ai',
    aiMana: 8,
    aiHand: ['feature-flag', 'heatmap', 'cohort'],
    aiBoard: [makeMinion({ id: 'ai-minion-ready', attack: 2, canAttack: true })],
  });

  const next = runAiTurn(state);

  assert.equal(next.player.hp, 20 - CARD_EFFECTS.heatmap.damage - 2);
  assert.equal(next.ai.currentMana, 0);
  assert.equal(next.ai.hand.length, 1);
  assert.equal(next.activePlayer, 'player');
});

test('Feature Flag stun prevents a minion from attacking next turn and allows attacking the turn after', () => {
  const aiMinion = makeMinion({ id: 'ai-minion-1', attack: 3, canAttack: true });
  const flagged = playCard(
    makeState({ playerMana: 1, playerHand: ['feature-flag'], aiBoard: [aiMinion] }),
    0,
    { type: 'minion', owner: 'ai', id: aiMinion.id }
  );

  const aiTurn = endTurn(flagged);
  assert.equal(aiTurn.ai.board[0].stunnedNextTurn, false);
  assert.equal(aiTurn.ai.board[0].canAttack, false);

  const stunnedAttack = attackWithMinion(aiTurn, aiMinion.id, { type: 'hero', owner: 'player' });
  assert.equal(stunnedAttack.player.hp, 20);

  const playerTurn = endTurn(aiTurn);
  const aiTurnAfterStun = endTurn(playerTurn);
  assert.equal(aiTurnAfterStun.ai.board[0].canAttack, true);

  const attackAfterStun = attackWithMinion(aiTurnAfterStun, aiMinion.id, { type: 'hero', owner: 'player' });
  assert.equal(attackAfterStun.player.hp, 17);
});
