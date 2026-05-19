import { describe, expect, it } from 'vitest';
import { checkWinCondition, createInitialState } from '../engine/index.js';

function deterministicRng(){
  return 0.42;
}

function withHeroHp({ playerHp = 20, aiHp = 20 } = {}){
  const state = createInitialState({ rng: deterministicRng });
  return {
    ...state,
    status: 'playing',
    players: {
      ...state.players,
      player: {
        ...state.players.player,
        hero: { ...state.players.player.hero, hp: playerHp },
      },
      ai: {
        ...state.players.ai,
        hero: { ...state.players.ai.hero, hp: aiHp },
      },
    },
    winner: null,
  };
}

describe('Insight Wars win condition', () => {
  it('sets player as winner when the AI hero reaches 0 HP', () => {
    const state = withHeroHp({ aiHp: 0 });

    const next = checkWinCondition(state);

    expect(next.status).toBe('ended');
    expect(next.winner).toBe('player');
  });

  it('sets AI as winner when the player hero reaches 0 HP', () => {
    const state = withHeroHp({ playerHp: 0 });

    const next = checkWinCondition(state);

    expect(next.status).toBe('ended');
    expect(next.winner).toBe('ai');
  });

  it('uses the player-favorable tie-break when both heroes reach 0 HP', () => {
    const state = withHeroHp({ playerHp: 0, aiHp: 0 });

    const next = checkWinCondition(state);

    expect(next.status).toBe('ended');
    expect(next.winner).toBe('player');
  });

  it('does nothing while both heroes are above 0 HP', () => {
    const state = withHeroHp({ playerHp: 4, aiHp: 1 });

    const next = checkWinCondition(state);

    expect(next).toBe(state);
    expect(next.winner).toBeNull();
  });
});
