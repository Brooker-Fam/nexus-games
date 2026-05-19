import { describe, expect, it } from 'vitest';
import { createInitialState, endTurn, healHero, playCard, startTurn } from '../engine/index.js';

function deterministicRng(){
  return 0.42;
}

describe('Insight Wars engine state', () => {
  it('creates both heroes at 20 HP with player turn 1 mana and opening hands', () => {
    const state = createInitialState({ rng: deterministicRng });

    expect(state.players.player.hero.hp).toBe(20);
    expect(state.players.ai.hero.hp).toBe(20);
    expect(state.players.player.mana).toBe(1);
    expect(state.players.player.maxMana).toBe(1);
    expect(state.players.player.hand).toHaveLength(3);
    expect(state.players.ai.hand).toHaveLength(3);
  });

  it('ramps events to min(turnNumber, 10) for turns 1 through 15', () => {
    for(let turnNumber = 1; turnNumber <= 15; turnNumber++){
      const state = createInitialState({ rng: deterministicRng });
      const next = startTurn({ ...state, turnNumber }, 'player');
      const expected = Math.min(turnNumber, 10);

      expect(next.players.player.maxMana).toBe(expected);
      expect(next.players.player.mana).toBe(expected);
    }
  });

  it('endTurn toggles active player and advances turn number', () => {
    const state = createInitialState({ rng: deterministicRng });
    const aiTurn = endTurn(state);

    expect(aiTurn.activePlayer).toBe('ai');
    expect(aiTurn.turnNumber).toBe(2);
    expect(aiTurn.players.ai.mana).toBe(2);

    const playerTurn = endTurn(aiTurn);
    expect(playerTurn.activePlayer).toBe('player');
    expect(playerTurn.turnNumber).toBe(3);
    expect(playerTurn.players.player.mana).toBe(3);
  });

  it('caps hero healing at 20 HP', () => {
    const state = createInitialState({ rng: deterministicRng });
    const healed = healHero(state, 'player', 99);

    expect(healed.players.player.hero.hp).toBe(20);
  });

  it('rejects card play when mana is insufficient and returns unchanged state', () => {
    const state = createInitialState({ rng: deterministicRng });
    const expensiveCard = state.players.player.hand.find((card) => card.cost > state.players.player.mana);

    if(!expensiveCard) return;
    expect(playCard(state, 'player', expensiveCard.id)).toBe(state);
  });

  it('plays a minion card end-to-end when enough mana is available', () => {
    const state = createInitialState({ rng: deterministicRng });
    const player = state.players.player;
    const minionCard = player.deck.find((card) => card.type === 'minion');
    const readyState = {
      ...state,
      players: {
        ...state.players,
        player: {
          ...player,
          mana: 10,
          maxMana: 10,
          deck: player.deck.filter((card) => card.id !== minionCard.id),
          hand: [minionCard],
        },
      },
    };

    const next = playCard(readyState, 'player', minionCard.id);

    expect(next.players.player.hand).toHaveLength(0);
    expect(next.players.player.discard).toHaveLength(1);
    expect(next.players.player.board).toHaveLength(1);
    expect(next.players.player.board[0].summoningSick).toBe(true);
    expect(next.players.player.mana).toBe(10 - minionCard.cost);
  });
});
