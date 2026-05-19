import { describe, expect, it } from 'vitest';
import { CARDS } from './cards.js';
import {
  BOARD_CAP,
  HERO_MAX_HP,
  MAX_MANA,
  OPENING_HAND_SIZE,
  canMinionAttack,
  checkWin,
  createInitialState,
  resolveCard,
  startTurn,
} from './gameState.js';

describe('Insight Wars game state', () => {
  it('createInitialState returns the expected opening shape', () => {
    const state = createInitialState(1234);
    const sameSeed = createInitialState(1234);

    expect(state.heroes.player).toEqual({ name: 'Max', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP });
    expect(state.heroes.ai).toEqual({ name: 'Dark Funnel PM', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP });
    expect(state.boards.player).toEqual([]);
    expect(state.boards.ai).toEqual([]);
    expect(state.hands.player).toHaveLength(OPENING_HAND_SIZE);
    expect(state.hands.ai).toHaveLength(OPENING_HAND_SIZE);
    expect(state.decks.player).toHaveLength(18);
    expect(state.decks.ai).toHaveLength(18);
    expect(state.turn).toBe(1);
    expect(state.activePlayer).toBe('player');
    expect(state.playerMana).toEqual({ current: 1, max: 1 });
    expect(state.aiMana).toEqual({ current: 1, max: 1 });
    expect(state.phase).toBe('playing');
    expect(state.hands.player.map((card) => card.id)).toEqual(sameSeed.hands.player.map((card) => card.id));
  });

  it('ramps mana from 1 to 10 and caps at 10', () => {
    const state = createInitialState(1);

    for(let i = 0; i < 12; i += 1){
      startTurn(state);
    }

    expect(state.playerMana.max).toBe(MAX_MANA);
    expect(state.playerMana.current).toBe(MAX_MANA);
  });

  it('sets phase to won or lost when a hero reaches 0 HP', () => {
    const wonState = createInitialState(2);
    wonState.heroes.ai.hp = -3;
    expect(checkWin(wonState).phase).toBe('won');
    expect(wonState.heroes.ai.hp).toBe(0);

    const lostState = createInitialState(3);
    lostState.heroes.player.hp = -2;
    expect(checkWin(lostState).phase).toBe('lost');
    expect(lostState.heroes.player.hp).toBe(0);
  });

  it('keeps the match playing when both heroes still have HP', () => {
    const state = createInitialState(33);
    state.heroes.player.hp = 1;
    state.heroes.ai.hp = 1;

    expect(checkWin(state).phase).toBe('playing');
  });

  it('prevents minions from attacking on the turn they were summoned', () => {
    const state = createInitialState(4);
    state.hands.player = [CARDS.cohort];
    state.playerMana = { current: 3, max: 3 };

    const result = resolveCard(state, CARDS.cohort, 'player');

    expect(result.ok).toBe(true);
    expect(state.boards.player).toHaveLength(1);
    expect(state.boards.player[0].summonedOnTurn).toBe(state.turn);
    expect(canMinionAttack(state, state.boards.player[0])).toBe(false);
  });

  it('resolves Cohort by spending mana, removing the card, and summoning a 2/3 minion', () => {
    const state = createInitialState(5);
    state.hands.player = [CARDS.cohort];
    state.playerMana = { current: 3, max: 3 };

    const result = resolveCard(state, CARDS.cohort, 'player');

    expect(result.ok).toBe(true);
    expect(state.playerMana.current).toBe(0);
    expect(state.hands.player).toHaveLength(0);
    expect(state.boards.player).toEqual([
      expect.objectContaining({ cardId: 'cohort', attack: 2, hp: 3, summonedOnTurn: state.turn }),
    ]);
  });

  it('resolves Surveys by healing with a cap at max HP', () => {
    const state = createInitialState(6);
    state.heroes.player.hp = 18;
    state.hands.player = [CARDS.surveys];
    state.playerMana = { current: 2, max: 2 };

    const result = resolveCard(state, CARDS.surveys, 'player');

    expect(result.ok).toBe(true);
    expect(state.playerMana.current).toBe(0);
    expect(state.hands.player).toHaveLength(0);
    expect(state.heroes.player.hp).toBe(20);
  });

  it('rejects summons beyond the board cap gracefully', () => {
    const state = createInitialState(7);
    state.hands.player = [CARDS.experiment];
    state.playerMana = { current: 5, max: 5 };
    state.boards.player = Array.from({ length: BOARD_CAP }, (_, index) => ({
      id: `existing-${index}`,
      cardId: 'cohort',
      attack: 2,
      hp: 3,
      summonedOnTurn: 0,
    }));

    const result = resolveCard(state, CARDS.experiment, 'player');

    expect(result.ok).toBe(true);
    expect(state.boards.player).toHaveLength(BOARD_CAP);
  });
});
