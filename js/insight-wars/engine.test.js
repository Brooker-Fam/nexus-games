import test from 'node:test';
import assert from 'node:assert/strict';

import { CARD_CATALOG, CARD_COSTS } from './cards.js';
import { buildStarterDeck, countCards, STARTER_DECK_CARD_IDS } from './deck.js';
import { createSide } from './state.js';
import { createSeededRng } from './rng.js';
import { checkWinCondition, newGame, startTurn } from './turn-engine.js';

test('new game initializes player, AI, opening hands, shuffled decks, and player mana', () => {
  const state = newGame('init-test');

  assert.equal(state.player.hp, 20);
  assert.equal(state.ai.hp, 20);
  assert.equal(state.player.hand.length, 3);
  assert.equal(state.ai.hand.length, 3);
  assert.equal(state.player.deck.length, 17);
  assert.equal(state.ai.deck.length, 17);
  assert.equal(state.turn, 1);
  assert.equal(state.activePlayer, 'player');
  assert.equal(state.phase, 'playing');
  assert.equal(state.player.maxMana, 1);
  assert.equal(state.player.currentMana, 1);
  assert.equal(state.ai.maxMana, 1);
  assert.equal(state.ai.currentMana, 0);

  const unshuffledIds = buildStarterDeck({ shuffle: false }).map((card) => card.id);
  const initialPlayerOrder = [...state.player.hand, ...state.player.deck].map((card) => card.id);
  assert.notDeepEqual(initialPlayerOrder, unshuffledIds);
});

test('mana ramps with the turn number and caps at 10', () => {
  for(const [turn, expectedMana] of [[1, 1], [5, 5], [10, 10], [11, 10], [15, 10]]){
    const state = {
      player: createSide(buildStarterDeck({ rng: createSeededRng(`mana-${turn}`) })),
      ai: createSide(buildStarterDeck({ rng: createSeededRng(`ai-${turn}`) })),
      turn,
      activePlayer: 'player',
      phase: 'playing',
      log: [],
    };

    const next = startTurn(state);
    assert.equal(next.player.maxMana, expectedMana, `turn ${turn} maxMana`);
    assert.equal(next.player.currentMana, expectedMana, `turn ${turn} currentMana`);
  }
});

test('currentMana refills to maxMana at start of turn', () => {
  const state = newGame('refill-test');
  const spentState = {
    ...state,
    turn: 5,
    player: {
      ...state.player,
      maxMana: 5,
      currentMana: 0,
    },
  };

  const next = startTurn(spentState);
  assert.equal(next.player.maxMana, 5);
  assert.equal(next.player.currentMana, 5);
});

test('win condition resolves from the player point of view', () => {
  const playerDefeated = newGame('lost-test');
  const lost = checkWinCondition({
    ...playerDefeated,
    player: { ...playerDefeated.player, hp: 0 },
  });
  assert.equal(lost.phase, 'lost');

  const aiDefeated = newGame('won-test');
  const won = checkWinCondition({
    ...aiDefeated,
    ai: { ...aiDefeated.ai, hp: 0 },
  });
  assert.equal(won.phase, 'won');
});

test('card catalog has exactly 9 unique cards with the foundation costs', () => {
  assert.equal(CARD_CATALOG.length, 9);
  assert.equal(new Set(CARD_CATALOG.map((card) => card.id)).size, 9);

  const actualCosts = Object.fromEntries(CARD_CATALOG.map((card) => [card.id, card.cost]));
  assert.deepEqual(actualCosts, CARD_COSTS);
});

test('starter deck has 20 cards built from the 9 unique catalog cards', () => {
  const deck = buildStarterDeck({ shuffle: false });
  const counts = countCards(deck);

  assert.equal(deck.length, 20);
  assert.equal(STARTER_DECK_CARD_IDS.length, 20);
  assert.equal(Object.keys(counts).length, 9);
  for(const count of Object.values(counts)){
    assert.ok(count >= 2 && count <= 3, `expected 2-3 copies, got ${count}`);
  }
});
