import { describe, expect, it } from 'vitest';
import {
  advanceTurn,
  createInitialState,
  endTurn,
  getCardDefinition,
  healHero,
  playCard,
  runAiTurn,
  startTurn,
} from '../engine/index.js';

function deterministicRng(){
  return 0.42;
}

function makeCard(key, id = key){
  const definition = getCardDefinition(key);
  return {
    id,
    definitionKey: definition.key,
    name: definition.name,
    cost: definition.cost,
    type: definition.type,
    ...(definition.minionStats ? { minionStats: { ...definition.minionStats } } : {}),
  };
}

function makeAiState(overrides = {}){
  const state = createInitialState({ rng: deterministicRng });
  return {
    ...state,
    turnNumber: 2,
    activePlayer: 'ai',
    players: {
      player: {
        ...state.players.player,
        hand: [],
        deck: [],
        board: [],
        ...(overrides.player || {}),
      },
      ai: {
        ...state.players.ai,
        mana: 10,
        maxMana: 10,
        hand: [],
        deck: [],
        board: [],
        ...(overrides.ai || {}),
      },
    },
    ...(overrides.state || {}),
  };
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

  it('advanceTurn toggles active player and advances turn number', () => {
    const state = createInitialState({ rng: deterministicRng });
    const aiTurn = advanceTurn(state);

    expect(aiTurn.activePlayer).toBe('ai');
    expect(aiTurn.turnNumber).toBe(2);
    expect(aiTurn.players.ai.mana).toBe(2);

    const playerTurn = advanceTurn(aiTurn);
    expect(playerTurn.activePlayer).toBe('player');
    expect(playerTurn.turnNumber).toBe(3);
    expect(playerTurn.players.player.mana).toBe(3);
  });

  it('endTurn auto-runs the AI turn and returns control to the player', () => {
    const state = createInitialState({ rng: deterministicRng });
    const next = endTurn({
      ...state,
      players: {
        ...state.players,
        ai: {
          ...state.players.ai,
          hand: [],
          deck: [],
          board: [],
        },
      },
    });

    expect(next.activePlayer).toBe('player');
    expect(next.turnNumber).toBe(3);
    expect(next.log.some((line) => line.includes('Dark Funnel PM'))).toBe(true);
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

describe('Insight Wars greedy AI opponent', () => {
  it('plays the highest-cost affordable card first with hand-order tie breaking', () => {
    const heatmap = makeCard('heatmap', 'heatmap-a');
    const cohort = makeCard('cohort', 'cohort-a');
    const surveys = makeCard('surveys', 'surveys-a');
    const state = makeAiState({
      ai: {
        mana: 3,
        hand: [surveys, heatmap, cohort],
      },
    });

    const next = runAiTurn(state);

    expect(next.players.ai.discard.map((card) => card.id)).toEqual(['heatmap-a']);
    expect(next.players.ai.mana).toBe(0);
  });

  it('targets the player hero with Heatmap', () => {
    const state = makeAiState({
      ai: {
        mana: 3,
        hand: [makeCard('heatmap', 'heatmap-face')],
      },
    });

    const next = runAiTurn(state);

    expect(next.players.player.hero.hp).toBe(18);
    expect(next.players.ai.hero.hp).toBe(20);
  });

  it('resolves Session Replay as an AI no-op while consuming the card and events', () => {
    const state = makeAiState({
      ai: {
        mana: 2,
        hand: [makeCard('session-replay', 'session-replay-ai')],
      },
    });

    const next = runAiTurn(state);

    expect(next.players.player.hero.hp).toBe(20);
    expect(next.players.ai.hero.hp).toBe(20);
    expect(next.players.ai.hand).toHaveLength(0);
    expect(next.players.ai.discard.map((card) => card.id)).toEqual(['session-replay-ai']);
    expect(next.players.ai.mana).toBe(0);
  });

  it('attacks the player hero with every eligible AI minion', () => {
    const state = makeAiState({
      ai: {
        hand: [],
        board: [
          { id: 'ai-minion-1', owner: 'ai', name: 'Cohort', attack: 2, hp: 3, maxHp: 3, summoningSick: false },
          { id: 'ai-minion-2', owner: 'ai', name: 'Experiment', attack: 5, hp: 5, maxHp: 5, summoningSick: false },
          { id: 'ai-minion-3', owner: 'ai', name: 'Fresh Cohort', attack: 2, hp: 3, maxHp: 3, summoningSick: true },
          { id: 'ai-minion-4', owner: 'ai', name: 'Flagged Experiment', attack: 5, hp: 5, maxHp: 5, summoningSick: false, disabledUntilTurn: 2 },
        ],
      },
    });

    const next = runAiTurn(state);

    expect(next.players.player.hero.hp).toBe(13);
    expect(next.players.ai.board.find((minion) => minion.id === 'ai-minion-1').attackedThisTurn).toBe(true);
    expect(next.players.ai.board.find((minion) => minion.id === 'ai-minion-2').attackedThisTurn).toBe(true);
    expect(next.players.ai.board.find((minion) => minion.id === 'ai-minion-3').attackedThisTurn).toBeFalsy();
    expect(next.players.ai.board.find((minion) => minion.id === 'ai-minion-4').attackedThisTurn).toBeFalsy();
  });

  it('completes a synthetic large AI turn within 2 seconds', () => {
    const manyCards = Array.from({ length: 250 }, (_, index) => ({
      ...makeCard('session-replay', `session-${index}`),
      cost: 1,
    }));
    const manyMinions = Array.from({ length: 250 }, (_, index) => ({
      id: `ai-minion-${index}`,
      owner: 'ai',
      name: 'Tiny Cohort',
      attack: 0,
      hp: 1,
      maxHp: 1,
      summoningSick: false,
    }));
    const state = makeAiState({
      ai: {
        mana: 250,
        hand: manyCards,
        board: manyMinions,
      },
    });

    const startedAt = performance.now();
    const next = runAiTurn(state);
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeLessThan(2000);
    expect(next.players.ai.hand).toHaveLength(0);
    expect(next.players.ai.discard).toHaveLength(250);
  });

  it('detects the AI win condition when minion attacks reduce player HP to 0', () => {
    const state = makeAiState({
      player: {
        hero: { hp: 3, maxHp: 20 },
      },
      ai: {
        hand: [],
        board: [
          { id: 'ai-lethal', owner: 'ai', name: 'Experiment', attack: 3, hp: 5, maxHp: 5, summoningSick: false },
        ],
      },
    });

    const next = runAiTurn(state);

    expect(next.players.player.hero.hp).toBe(0);
    expect(next.status).toBe('ended');
    expect(next.winner).toBe('ai');
  });
});
