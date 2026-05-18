import { describe, expect, it } from 'vitest';
import {
  CARD_CATALOG,
  DECK_COMPOSITION,
  buildDeck,
  checkWinCondition,
  createInitialState,
  endTurn,
  shuffle,
} from './game-state.js';

function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cardCounts(cards){
  return cards.reduce((counts, card) => {
    counts[card.id] = (counts[card.id] || 0) + 1;
    return counts;
  }, {});
}

describe('Insight Wars foundation game state', () => {
  it('creates initial state with 20 HP heroes, opening hands, shuffled decks, and player event ramp', () => {
    // Seeded rng injection keeps deck order deterministic in tests; browser play uses Math.random.
    const state = createInitialState(mulberry32(1234));
    const unshuffledIds = buildDeck().map((card) => card.id);
    const playerFullOrder = [...state.player.hand, ...state.player.deck].map((card) => card.id);
    const aiFullOrder = [...state.ai.hand, ...state.ai.deck].map((card) => card.id);

    expect(state.player.hp).toBe(20);
    expect(state.player.maxHp).toBe(20);
    expect(state.ai.hp).toBe(20);
    expect(state.ai.maxHp).toBe(20);
    expect(state.player.events).toBe(1);
    expect(state.player.maxEvents).toBe(1);
    expect(state.ai.events).toBe(0);
    expect(state.ai.maxEvents).toBe(0);
    expect(state.player.hand).toHaveLength(3);
    expect(state.ai.hand).toHaveLength(3);
    expect(state.player.deck).toHaveLength(19);
    expect(state.ai.deck).toHaveLength(19);
    expect(playerFullOrder).not.toEqual(unshuffledIds);
    expect(aiFullOrder).not.toEqual(unshuffledIds);
    expect(cardCounts([...state.player.hand, ...state.player.deck])).toEqual(DECK_COMPOSITION);
    expect(cardCounts([...state.ai.hand, ...state.ai.deck])).toEqual(DECK_COMPOSITION);
  });

  it('ramps events by round through turn 12 and caps maxEvents at 10', () => {
    let state = createInitialState(mulberry32(2026));

    for(let expectedTurn = 1; expectedTurn <= 12; expectedTurn += 1){
      const expectedMaxEvents = Math.min(expectedTurn, 10);

      expect(state.activeSide).toBe('player');
      expect(state.turn).toBe(expectedTurn);
      expect(state.player.maxEvents).toBe(expectedMaxEvents);
      expect(state.player.events).toBe(expectedMaxEvents);

      state = endTurn(state);
      expect(state.activeSide).toBe('ai');
      expect(state.turn).toBe(expectedTurn);
      expect(state.ai.maxEvents).toBe(expectedMaxEvents);
      expect(state.ai.events).toBe(expectedMaxEvents);

      state = endTurn(state);
    }
  });

  it('buildDeck returns the documented 22-card composition', () => {
    const deck = buildDeck();

    expect(deck).toHaveLength(22);
    expect(cardCounts(deck)).toEqual(DECK_COMPOSITION);
    for(const card of deck){
      expect(card).toBe(CARD_CATALOG[card.id]);
    }
  });

  it('shuffles deterministically with a seeded rng and does not mutate input', () => {
    const input = ['feature_flag', 'session_replay', 'ab_test', 'funnel', 'cohort'];
    const first = shuffle(input, mulberry32(42));
    const second = shuffle(input, mulberry32(42));

    expect(first).toEqual(['feature_flag', 'cohort', 'ab_test', 'session_replay', 'funnel']);
    expect(second).toEqual(first);
    expect(input).toEqual(['feature_flag', 'session_replay', 'ab_test', 'funnel', 'cohort']);
  });

  it('sets win phase when either hero is at or below 0 HP', () => {
    const base = createInitialState(mulberry32(7));

    expect(checkWinCondition(base).phase).toBe('playing');
    expect(checkWinCondition({ ...base, ai: { ...base.ai, hp: 0 } }).phase).toBe('player_won');
    expect(checkWinCondition({ ...base, player: { ...base.player, hp: 0 } }).phase).toBe('ai_won');
    expect(checkWinCondition({ ...base, ai: { ...base.ai, hp: -3 } }).phase).toBe('player_won');
    expect(checkWinCondition({ ...base, player: { ...base.player, hp: -1 } }).phase).toBe('ai_won');
  });
});


