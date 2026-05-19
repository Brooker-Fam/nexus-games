import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attackWithMinion,
  createInitialState,
  endTurn,
  getDeckComposition,
  playCard,
} from '../engine/index.js';

function deterministicRng(){
  return 0.42;
}

function card(key, id = `${key}-test`){
  const definition = getDeckComposition().find((entry) => entry.key === key);
  if(!definition) throw new Error(`Unknown card ${key}`);
  return {
    id,
    definitionKey: definition.key,
    name: definition.name,
    cost: definition.cost,
    type: definition.type,
    ...(definition.minionStats ? { minionStats: { ...definition.minionStats } } : {}),
  };
}

function minion(overrides = {}){
  return {
    id: 'minion-test',
    owner: 'player',
    name: 'Test Minion',
    attack: 2,
    hp: 3,
    maxHp: 3,
    summoningSick: false,
    hasAttacked: false,
    disabled: false,
    ...overrides,
  };
}

function stateWithHand(cardKey, options = {}){
  const state = createInitialState({ rng: deterministicRng });
  const player = options.player || 'player';
  const testCard = card(cardKey);

  return {
    ...state,
    activePlayer: options.activePlayer || player,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        mana: options.mana ?? 10,
        maxMana: options.maxMana ?? 10,
        hand: [testCard],
        deck: options.deck || [],
        discard: [],
        board: options.board || [],
        hero: options.hero || state.players[player].hero,
      },
      ...(options.otherPlayerState || {}),
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Insight Wars card resolves', () => {
  it('Feature Flag disables a chosen enemy minion until that minion owner ends their next turn', () => {
    const enemyMinion = minion({ id: 'ai-minion-1', owner: 'ai' });
    const state = stateWithHand('feature-flag', {
      otherPlayerState: {
        ai: {
          ...createInitialState({ rng: deterministicRng }).players.ai,
          board: [enemyMinion],
        },
      },
    });

    const next = playCard(state, 'player', 'feature-flag-test', {
      type: 'minion',
      player: 'ai',
      minionId: enemyMinion.id,
    });

    expect(next.players.ai.board[0].disabled).toBe(true);

    const aiTurn = endTurn(next);
    expect(aiTurn.players.ai.board[0].disabled).toBe(true);

    const playerTurn = endTurn(aiTurn);
    expect(playerTurn.players.ai.board[0].disabled).toBe(false);
  });

  it('Session Replay reveals the AI hand for the player and is a no-op for AI', () => {
    const state = stateWithHand('session-replay');
    const next = playCard(state, 'player', 'session-replay-test');

    expect(next.revealedHands.ai).toBe(true);
    expect(endTurn(next).revealedHands.ai).toBe(false);

    const aiState = stateWithHand('session-replay', { player: 'ai', activePlayer: 'ai' });
    const aiNext = playCard(aiState, 'ai', 'session-replay-test');
    expect(aiNext.revealedHands.ai).toBe(false);
  });

  it('A/B Test randomly damages the enemy hero or heals own hero with a cap at 20', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.25);
    const damageState = stateWithHand('ab-test');
    const damaged = playCard(damageState, 'player', 'ab-test-test');
    expect(damaged.players.ai.hero.hp).toBe(15);

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.75);
    const healState = stateWithHand('ab-test', {
      hero: { hp: 18, maxHp: 20 },
    });
    const healed = playCard(healState, 'player', 'ab-test-test');
    expect(healed.players.player.hero.hp).toBe(20);
  });

  it('Funnel damages the enemy hero and every enemy minion', () => {
    const enemyOne = minion({ id: 'ai-1', owner: 'ai', hp: 3, maxHp: 3 });
    const enemyTwo = minion({ id: 'ai-2', owner: 'ai', hp: 1, maxHp: 1 });
    const state = stateWithHand('funnel', {
      otherPlayerState: {
        ai: {
          ...createInitialState({ rng: deterministicRng }).players.ai,
          board: [enemyOne, enemyTwo],
        },
      },
    });

    const next = playCard(state, 'player', 'funnel-test');

    expect(next.players.ai.hero.hp).toBe(18);
    expect(next.players.ai.board).toHaveLength(1);
    expect(next.players.ai.board[0].id).toBe('ai-1');
    expect(next.players.ai.board[0].hp).toBe(2);
  });

  it('Cohort summons a 2/3 minion with summoning sickness', () => {
    const state = stateWithHand('cohort');
    const next = playCard(state, 'player', 'cohort-test');

    expect(next.players.player.board).toHaveLength(1);
    expect(next.players.player.board[0]).toMatchObject({
      name: 'Cohort',
      attack: 2,
      hp: 3,
      maxHp: 3,
      summoningSick: true,
    });
  });

  it('Insight draws a card', () => {
    const drawCard = card('surveys', 'drawn-surveys');
    const state = stateWithHand('insight', { deck: [drawCard] });
    const next = playCard(state, 'player', 'insight-test');

    expect(next.players.player.hand).toEqual([drawCard]);
    expect(next.players.player.deck).toHaveLength(0);
  });

  it('Surveys heals the own hero for 4 HP and caps at 20', () => {
    const state = stateWithHand('surveys', {
      hero: { hp: 18, maxHp: 20 },
    });
    const next = playCard(state, 'player', 'surveys-test');

    expect(next.players.player.hero.hp).toBe(20);
  });

  it('Heatmap deals 4 damage to any chosen target', () => {
    const enemyMinion = minion({ id: 'ai-minion-1', owner: 'ai', hp: 5, maxHp: 5 });
    const state = stateWithHand('heatmap', {
      otherPlayerState: {
        ai: {
          ...createInitialState({ rng: deterministicRng }).players.ai,
          board: [enemyMinion],
        },
      },
    });

    const next = playCard(state, 'player', 'heatmap-test', {
      type: 'minion',
      player: 'ai',
      minionId: enemyMinion.id,
    });

    expect(next.players.ai.board[0].hp).toBe(1);
  });

  it('Experiment summons a 5/5 minion with summoning sickness', () => {
    const state = stateWithHand('experiment');
    const next = playCard(state, 'player', 'experiment-test');

    expect(next.players.player.board).toHaveLength(1);
    expect(next.players.player.board[0]).toMatchObject({
      name: 'Experiment',
      attack: 5,
      hp: 5,
      maxHp: 5,
      summoningSick: true,
    });
  });
});

describe('Insight Wars minion combat', () => {
  it('prevents a newly summoned minion from attacking until the following owner turn', () => {
    const state = stateWithHand('cohort');
    const summoned = playCard(state, 'player', 'cohort-test');
    const summonedMinionId = summoned.players.player.board[0].id;

    expect(attackWithMinion(summoned, 'player', summonedMinionId, { type: 'hero', player: 'ai' })).toBe(summoned);

    const aiTurn = endTurn(summoned);
    const playerTurn = endTurn(aiTurn);
    const attacked = attackWithMinion(playerTurn, 'player', summonedMinionId, { type: 'hero', player: 'ai' });

    expect(attacked.players.ai.hero.hp).toBe(18);
    expect(attacked.players.player.board[0].hasAttacked).toBe(true);
  });

  it('applies reciprocal combat damage and removes minions at 0 HP', () => {
    const attacker = minion({ id: 'player-attacker', owner: 'player', attack: 2, hp: 3, maxHp: 3 });
    const defender = minion({ id: 'ai-defender', owner: 'ai', attack: 1, hp: 2, maxHp: 2 });
    const state = createInitialState({ rng: deterministicRng });
    const combatState = {
      ...state,
      activePlayer: 'player',
      players: {
        ...state.players,
        player: { ...state.players.player, board: [attacker] },
        ai: { ...state.players.ai, board: [defender] },
      },
    };

    const next = attackWithMinion(combatState, 'player', attacker.id, {
      type: 'minion',
      player: 'ai',
      minionId: defender.id,
    });

    expect(next.players.ai.board).toHaveLength(0);
    expect(next.players.player.board[0].hp).toBe(2);
    expect(next.players.player.board[0].hasAttacked).toBe(true);
  });
});
