import { nextRng } from './rng.js';

export const PLAYER_IDS = Object.freeze(['player', 'ai']);

export function getOpponent(player) {
  return player === 'player' ? 'ai' : 'player';
}

function cloneState(state) {
  return {
    ...state,
    heroes: {
      player: { ...state.heroes.player },
      ai: { ...state.heroes.ai },
    },
    mana: {
      player: { ...state.mana.player },
      ai: { ...state.mana.ai },
    },
    hands: {
      player: state.hands.player.map((card) => ({ ...card })),
      ai: state.hands.ai.map((card) => ({ ...card })),
    },
    decks: {
      player: state.decks.player.map((card) => ({ ...card })),
      ai: state.decks.ai.map((card) => ({ ...card })),
    },
    boards: {
      player: state.boards.player.map((minion) => ({ ...minion })),
      ai: state.boards.ai.map((minion) => ({ ...minion })),
    },
  };
}

function clampHeroHp(hero) {
  return {
    ...hero,
    hp: Math.max(0, Math.min(hero.maxHp, hero.hp)),
  };
}

function cleanupDeadMinions(state) {
  return {
    ...state,
    boards: {
      player: state.boards.player.filter((minion) => minion.hp > 0),
      ai: state.boards.ai.filter((minion) => minion.hp > 0),
    },
  };
}

function withWinCondition(state) {
  let winner = state.winner || null;
  if (!winner) {
    if (state.heroes.player.hp <= 0) winner = 'ai';
    else if (state.heroes.ai.hp <= 0) winner = 'player';
  }

  return {
    ...state,
    heroes: {
      player: clampHeroHp(state.heroes.player),
      ai: clampHeroHp(state.heroes.ai),
    },
    winner,
  };
}

function damageHero(state, player, amount) {
  const nextState = cloneState(state);
  nextState.heroes[player].hp -= amount;
  return withWinCondition(nextState);
}

function healHero(state, player, amount) {
  const nextState = cloneState(state);
  nextState.heroes[player].hp = Math.min(nextState.heroes[player].maxHp, nextState.heroes[player].hp + amount);
  return nextState;
}

function damageMinion(state, player, index, amount) {
  if (!Number.isInteger(index) || !state.boards[player][index]) return state;

  const nextState = cloneState(state);
  nextState.boards[player][index].hp -= amount;
  return cleanupDeadMinions(nextState);
}

function drawCards(state, player, count) {
  let nextState = cloneState(state);

  for (let index = 0; index < count; index += 1) {
    const [drawnCard, ...remainingDeck] = nextState.decks[player];
    if (!drawnCard) break;

    nextState = {
      ...nextState,
      hands: {
        ...nextState.hands,
        [player]: [...nextState.hands[player], drawnCard],
      },
      decks: {
        ...nextState.decks,
        [player]: remainingDeck,
      },
    };
  }

  return nextState;
}

function targetEnemyMinionOrHero(state, player, target, damage, { heroAllowedWithMinions = true } = {}) {
  const opponent = getOpponent(player);
  const enemyMinions = state.boards[opponent];

  if (enemyMinions.length > 0) {
    if (target === 'hero' && heroAllowedWithMinions) return damageHero(state, opponent, damage);

    const targetIndex = Number.isInteger(target) && enemyMinions[target] ? target : 0;
    return damageMinion(state, opponent, targetIndex, damage);
  }

  return damageHero(state, opponent, damage);
}

function summonSubscriber(state, player) {
  const nextState = cloneState(state);
  return {
    ...nextState,
    boards: {
      ...nextState.boards,
      [player]: [
        ...nextState.boards[player],
        {
          cardId: 'subscriber',
          name: 'Subscriber',
          attack: 1,
          hp: 1,
          maxHp: 1,
          canAttack: false,
        },
      ],
    },
  };
}

export const CARD_DEFINITIONS = Object.freeze({
  'feature-flag': Object.freeze({
    type: 'feature-flag',
    name: 'Feature Flag',
    cost: 1,
    kind: 'spell',
    resolve(state, player, target) {
      return targetEnemyMinionOrHero(state, player, target, 2, { heroAllowedWithMinions: false });
    },
  }),
  'session-replay': Object.freeze({
    type: 'session-replay',
    name: 'Session Replay',
    cost: 2,
    kind: 'spell',
    resolve(state, player) {
      if (player === 'ai') return state;
      return drawCards(state, player, 2);
    },
  }),
  'ab-test': Object.freeze({
    type: 'ab-test',
    name: 'A/B Test',
    cost: 3,
    kind: 'spell',
    resolve(state, player, target) {
      const roll = nextRng(state.rngSeed);
      const seededState = { ...state, rngSeed: roll.seed };

      if (roll.value < 0.5) {
        return targetEnemyMinionOrHero(seededState, player, target, 4);
      }

      return healHero(seededState, player, 4);
    },
  }),
  funnel: Object.freeze({
    type: 'funnel',
    name: 'Funnel',
    cost: 4,
    kind: 'minion',
    attack: 3,
    hp: 4,
    resolve(state) {
      return state;
    },
  }),
  cohort: Object.freeze({
    type: 'cohort',
    name: 'Cohort',
    cost: 5,
    kind: 'minion',
    attack: 4,
    hp: 5,
    resolve(state, player) {
      return summonSubscriber(state, player);
    },
  }),
  insight: Object.freeze({
    type: 'insight',
    name: 'Insight',
    cost: 2,
    kind: 'spell',
    resolve(state, player) {
      return drawCards(state, player, 1);
    },
  }),
  surveys: Object.freeze({
    type: 'surveys',
    name: 'Surveys',
    cost: 3,
    kind: 'spell',
    resolve(state, player) {
      const opponent = getOpponent(player);
      const nextState = cloneState(state);
      nextState.boards[opponent] = nextState.boards[opponent].map((minion) => ({
        ...minion,
        hp: minion.hp - 1,
      }));
      return cleanupDeadMinions(nextState);
    },
  }),
  heatmap: Object.freeze({
    type: 'heatmap',
    name: 'Heatmap',
    cost: 4,
    kind: 'spell',
    resolve(state, player, target) {
      const resolvedTarget = player === 'ai' ? 'hero' : target;
      return targetEnemyMinionOrHero(state, player, resolvedTarget, 3);
    },
  }),
  experiment: Object.freeze({
    type: 'experiment',
    name: 'Experiment',
    cost: 6,
    kind: 'minion',
    attack: 5,
    hp: 5,
    resolve(state, player) {
      return damageHero(state, getOpponent(player), 2);
    },
  }),
});

export function getCardDefinition(cardOrType) {
  const type = typeof cardOrType === 'string' ? cardOrType : cardOrType?.type;
  const definition = CARD_DEFINITIONS[type];
  if (!definition) throw new Error(`Unknown Insight Wars card type: ${type}`);
  return definition;
}
