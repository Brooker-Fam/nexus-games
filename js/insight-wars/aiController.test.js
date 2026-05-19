import { describe, expect, it } from 'vitest';
import { CARDS } from './cards.js';
import { chooseAiCardTarget, runAiTurn } from './aiController.js';
import { createInitialState, startTurn } from './gameState.js';

function setupAiTurn(seed = 100){
  const state = createInitialState(seed);
  state.activePlayer = 'ai';
  state.turn = 2;
  state.aiMana = { current: 0, max: 0 };
  state.hands.ai = [];
  state.decks.ai = [];
  state.decks.player = [];
  state.boards.ai = [];
  state.boards.player = [];
  state.log = [];
  return state;
}

describe('Insight Wars AI controller', () => {
  it('ends cleanly with no playable cards and no eligible attackers', () => {
    const state = setupAiTurn();
    state.hands.ai = [CARDS.experiment];
    state.aiMana = { current: 1, max: 1 };
    state.boards.ai = [{
      id: 'ai-m-sick',
      cardId: 'cohort',
      attack: 2,
      hp: 3,
      summonedOnTurn: state.turn,
    }];

    runAiTurn(state, 'ai');

    expect(state.phase).toBe('playing');
    expect(state.activePlayer).toBe('player');
    expect(state.hands.ai).toEqual([CARDS.experiment]);
    expect(state.heroes.player.hp).toBe(20);
  });

  it('prioritizes the highest-cost affordable card and keeps playing while it can', () => {
    const state = setupAiTurn();
    state.aiMana = { current: 4, max: 4 };
    state.hands.ai = [CARDS.insight, CARDS.heatmap, CARDS.surveys];

    runAiTurn(state, 'ai');

    expect(state.heroes.player.hp).toBe(17);
    expect(state.aiMana.current).toBe(0);
    expect(state.hands.ai.map((card) => card.id)).toEqual(['surveys']);
    expect(state.log.findIndex((entry) => entry.startsWith('Heatmap')))
      .toBeLessThan(state.log.findIndex((entry) => entry.startsWith('Insight')));
  });

  it('targets Heatmap at the opposing hero instead of enemy minions', () => {
    const state = setupAiTurn();
    state.aiMana = { current: 3, max: 3 };
    state.hands.ai = [CARDS.heatmap];
    state.boards.player = [{
      id: 'player-m1',
      cardId: 'experiment',
      attack: 4,
      hp: 4,
      summonedOnTurn: 0,
    }];

    expect(chooseAiCardTarget(state, 'ai', CARDS.heatmap)).toEqual({ type: 'hero', owner: 'player' });

    runAiTurn(state, 'ai');

    expect(state.heroes.player.hp).toBe(17);
    expect(state.boards.player[0].hp).toBe(4);
  });


  it('targets Feature Flag at the strongest enemy minion and skips it when no minions exist', () => {
    const state = setupAiTurn();
    state.aiMana = { current: 1, max: 1 };
    state.hands.ai = [CARDS['feature-flag']];
    state.boards.player = [
      { id: 'player-m1', cardId: 'cohort', attack: 2, hp: 3, summonedOnTurn: 0 },
      { id: 'player-m2', cardId: 'experiment', attack: 4, hp: 4, summonedOnTurn: 0 },
    ];

    expect(chooseAiCardTarget(state, 'ai', CARDS['feature-flag']))
      .toEqual({ type: 'minion', owner: 'player', minionId: 'player-m2' });

    runAiTurn(state, 'ai');

    expect(state.boards.player[0].disabledUntilTurn).toBeUndefined();
    expect(state.boards.player[1].disabledUntilTurn).toBe(3);

    const skipState = setupAiTurn();
    skipState.aiMana = { current: 1, max: 1 };
    skipState.hands.ai = [CARDS['feature-flag'], CARDS.insight];

    runAiTurn(skipState, 'ai');

    expect(skipState.hands.ai.map((card) => card.id)).toEqual(['feature-flag']);
    expect(skipState.aiMana.current).toBe(0);
  });

  it('treats AI Session Replay as a no-op beyond spending events and the card', () => {
    const state = setupAiTurn();
    state.aiMana = { current: 2, max: 2 };
    state.hands.ai = [CARDS['session-replay']];
    const heroesBefore = structuredClone(state.heroes);
    const boardsBefore = structuredClone(state.boards);
    const decksBefore = structuredClone(state.decks);

    runAiTurn(state, 'ai');

    expect(state.aiMana.current).toBe(0);
    expect(state.hands.ai).toEqual([]);
    expect(state.aiHandRevealedUntilTurn).toBeUndefined();
    expect(state.heroes).toEqual(heroesBefore);
    expect(state.boards).toEqual(boardsBefore);
    expect(state.decks).toEqual(decksBefore);
    expect(state.activePlayer).toBe('player');
  });

  it('finishes a deterministic AI-vs-AI simulation within the turn cap', () => {
    const state = createInitialState(2);
    const turnCap = 50;

    while(state.phase === 'playing' && state.turn < turnCap){
      runAiTurn(state);
      if(state.phase === 'playing') startTurn(state);
    }

    expect(state.phase).not.toBe('playing');
    expect(Math.min(state.heroes.player.hp, state.heroes.ai.hp)).toBeLessThanOrEqual(0);
    expect(state.turn).toBeLessThan(turnCap);
  });
});
