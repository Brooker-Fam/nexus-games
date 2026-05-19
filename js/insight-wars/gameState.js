import { createDeck } from './cards.js';

export const BOARD_CAP = 7;
export const MAX_MANA = 10;
export const HERO_MAX_HP = 20;
export const OPENING_HAND_SIZE = 3;

/**
 * @typedef {import('./cards.js').Card} Card
 * @typedef {import('./cards.js').CardId} CardId
 * @typedef {'player'|'ai'} PlayerId
 * @typedef {'playing'|'won'|'lost'} GamePhase
 * @typedef {'hero'|'minion'} TargetType
 * @typedef {{ type: TargetType, owner: PlayerId, minionId?: string }} Target
 * @typedef {{ name: string, hp: number, maxHp: number }} Hero
 * @typedef {{ id: string, cardId: CardId, attack: number, hp: number, summonedOnTurn: number, summonedThisTurn: boolean, disabledUntilTurn?: number }} Minion
 * @typedef {{ current: number, max: number }} ManaPool
 * @typedef {{
 *   heroes: { player: Hero, ai: Hero },
 *   boards: { player: Minion[], ai: Minion[] },
 *   hands: { player: Card[], ai: Card[] },
 *   decks: { player: Card[], ai: Card[] },
 *   turn: number,
 *   activePlayer: PlayerId,
 *   playerMana: ManaPool,
 *   aiMana: ManaPool,
 *   phase: GamePhase,
 *   aiHandRevealedUntilTurn?: number,
 *   rngSeed: number,
 *   rngCalls: number,
 *   nextMinionId: number,
 *   log: string[],
 * }} GameState
 */

/**
 * Small seedable RNG for deterministic shuffles in tests.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed){
  let t = seed >>> 0;
  return function random(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} seed
 * @param {number} calls
 * @returns {number}
 */
function nextRandom(seed, calls){
  const rng = mulberry32(seed);
  let value = 0;
  for(let i = 0; i <= calls; i += 1) value = rng();
  return value;
}

/**
 * Fisher-Yates shuffle that returns a copy.
 * @template T
 * @param {T[]} items
 * @param {number} seed
 * @returns {T[]}
 */
export function shuffleWithSeed(items, seed){
  const rng = mulberry32(seed);
  const shuffled = [...items];
  for(let i = shuffled.length - 1; i > 0; i -= 1){
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * @param {GameState} state
 * @returns {number}
 */
export function randomFromState(state){
  const value = nextRandom(state.rngSeed, state.rngCalls);
  state.rngCalls += 1;
  return value;
}

/**
 * @param {PlayerId} player
 * @returns {PlayerId}
 */
export function opponentOf(player){
  return player === 'player' ? 'ai' : 'player';
}

/**
 * @param {GameState} state
 * @param {PlayerId} player
 * @returns {ManaPool}
 */
export function manaFor(state, player){
  return player === 'player' ? state.playerMana : state.aiMana;
}

/**
 * @param {number} seed defaults to Date.now() for ad-hoc play; pass a fixed seed in tests.
 * @returns {GameState}
 */
export function createInitialState(seed = Date.now()){
  const playerDeck = shuffleWithSeed(createDeck(), seed);
  const aiDeck = shuffleWithSeed(createDeck(), seed + 1);

  /** @type {GameState} */
  const state = {
    heroes: {
      player: { name: 'Analyst', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP },
      ai: { name: 'HogBot', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP },
    },
    boards: { player: [], ai: [] },
    hands: { player: [], ai: [] },
    decks: { player: playerDeck, ai: aiDeck },
    turn: 1,
    activePlayer: 'player',
    playerMana: { current: 1, max: 1 },
    aiMana: { current: 1, max: 1 },
    phase: 'playing',
    rngSeed: seed + 2,
    rngCalls: 0,
    nextMinionId: 1,
    log: ['Insight Wars begins.'],
  };

  for(let i = 0; i < OPENING_HAND_SIZE; i += 1){
    drawCard(state, 'player');
    drawCard(state, 'ai');
  }

  return state;
}

/**
 * @param {GameState} state
 * @param {PlayerId} player
 * @param {number} count
 * @returns {GameState}
 */
export function drawCard(state, player, count = 1){
  for(let i = 0; i < count; i += 1){
    const card = state.decks[player].shift();
    if(card) state.hands[player].push(card);
  }
  return state;
}

/**
 * Start the active player's turn: advance turn, ramp mana to max +1 (cap 10), refill, and draw one card.
 * @param {GameState} state
 * @returns {GameState}
 */
export function startTurn(state){
  if(state.phase !== 'playing') return state;
  state.turn += 1;
  clearStartOfTurnStatuses(state, state.activePlayer);
  const mana = manaFor(state, state.activePlayer);
  mana.max = Math.min(MAX_MANA, mana.max + 1);
  mana.current = mana.max;
  drawCard(state, state.activePlayer);
  if(state.activePlayer === 'player' && state.aiHandRevealedUntilTurn && state.aiHandRevealedUntilTurn < state.turn){
    delete state.aiHandRevealedUntilTurn;
  }
  checkWin(state);
  return state;
}

/**
 * End the active player's turn and pass priority. The next caller should invoke startTurn().
 * @param {GameState} state
 * @returns {GameState}
 */
export function endTurn(state){
  if(state.phase !== 'playing') return state;
  state.activePlayer = opponentOf(state.activePlayer);
  const mana = manaFor(state, state.activePlayer);
  if(mana.max < 1){
    mana.max = 1;
    mana.current = 1;
  }
  state.log.push(`${state.activePlayer === 'player' ? 'Player' : 'AI'} turn begins.`);
  checkWin(state);
  return state;
}

/**
 * @param {GameState} state
 * @param {PlayerId} owner
 * @param {CardId} cardId
 * @param {number} attack
 * @param {number} hp
 * @returns {Minion|null}
 */
export function summonMinion(state, owner, cardId, attack, hp){
  if(state.boards[owner].length >= BOARD_CAP){
    state.log.push(`${owner === 'player' ? 'Player' : 'AI'} board is full; summon fizzled.`);
    return null;
  }

  const minion = {
    id: `${owner}-m${state.nextMinionId}`,
    cardId,
    attack,
    hp,
    summonedOnTurn: state.turn,
    summonedThisTurn: true,
  };
  state.nextMinionId += 1;
  state.boards[owner].push(minion);
  return minion;
}

/**
 * Clear statuses that expire as a player's turn begins.
 * @param {GameState} state
 * @param {PlayerId} player
 */
export function clearStartOfTurnStatuses(state, player){
  state.boards[player].forEach((minion) => {
    minion.summonedThisTurn = false;
    if(minion.disabledUntilTurn && minion.disabledUntilTurn < state.turn){
      delete minion.disabledUntilTurn;
    }
  });
}

/**
 * @param {GameState} state
 * @param {PlayerId} player
 * @param {Card} card
 * @returns {boolean}
 */
function removeFirstCardFromHand(state, player, card){
  const hand = state.hands[player];
  const index = hand.indexOf(card);
  const fallbackIndex = hand.findIndex((candidate) => candidate.id === card.id);
  const removeIndex = index >= 0 ? index : fallbackIndex;
  if(removeIndex < 0) return false;
  hand.splice(removeIndex, 1);
  return true;
}

/**
 * Data-driven resolver for all Insight Wars cards.
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 * @param {Target=} target
 * @returns {{ ok: boolean, reason?: string }}
 */
export function resolveCard(state, card, caster, target){
  if(state.phase !== 'playing') return { ok: false, reason: 'Game is over.' };
  if(state.activePlayer !== caster) return { ok: false, reason: 'It is not your turn.' };

  const mana = manaFor(state, caster);
  if(mana.current < card.cost) return { ok: false, reason: 'Not enough mana.' };
  if(!state.hands[caster].includes(card) && !state.hands[caster].some((candidate) => candidate.id === card.id)){
    return { ok: false, reason: 'Card is not in hand.' };
  }

  mana.current -= card.cost;
  removeFirstCardFromHand(state, caster, card);

  const resolver = CARD_RESOLVERS[card.id];
  if(resolver) resolver(state, card, caster, target);
  else state.log.push(`${card.name} resolved with no effect.`);

  checkWin(state);
  return { ok: true };
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 * @param {Target=} target
 */
export function resolveFeatureFlag(state, card, caster, target){
  const opponent = opponentOf(caster);
  const targetedMinion = target?.type === 'minion' && target.owner === opponent ? findTargetMinion(state, target) : undefined;
  const targetMinion = targetedMinion || state.boards[opponent][0];
  if(targetMinion){
    targetMinion.disabledUntilTurn = state.turn + 1;
    state.log.push(`${card.name} disabled an enemy minion next turn.`);
  } else {
    state.log.push(`${card.name} found no enemy minion to disable.`);
  }
}

/**
 * Player-cast Session Replay reveals the AI hand until the start of the player's next turn.
 * AI-cast Session Replay intentionally spends mana and resolves as a no-op.
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveSessionReplay(state, card, caster){
  if(caster === 'player'){
    state.aiHandRevealedUntilTurn = state.turn + (card.effect.amount || 1);
    state.log.push(`${card.name} revealed the AI hand.`);
  } else {
    state.log.push(`${card.name} is an intentional no-op for AI.`);
  }
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveSummonCard(state, card, caster){
  const summon = card.effect.summon;
  if(!summon){
    state.log.push(`${card.name} had no minion to summon.`);
    return;
  }
  const minion = summonMinion(state, caster, card.id, summon.attack, summon.hp);
  if(minion) state.log.push(`${card.name} summoned a ${summon.attack}/${summon.hp}.`);
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveAbTest(state, card, caster){
  resolveSummonCard(state, card, caster);
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveFunnel(state, card, caster){
  resolveSummonCard(state, card, caster);
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveCohort(state, card, caster){
  resolveSummonCard(state, card, caster);
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveSurveys(state, card, caster){
  healHero(state, caster, card.effect.amount || 0);
  state.log.push(`${card.name} healed ${caster === 'player' ? 'you' : 'AI'} for ${card.effect.amount || 0}.`);
}

/**
 * Insight can only damage the enemy hero or an enemy minion; without a supplied target it defaults to the enemy hero.
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 * @param {Target=} target
 */
export function resolveInsight(state, card, caster, target){
  const opponent = opponentOf(caster);
  const actualTarget = target && target.owner === opponent ? target : { type: 'hero', owner: opponent };
  damageTarget(state, actualTarget, card.effect.amount || 0);
  state.log.push(`${card.name} dealt ${card.effect.amount || 0} damage.`);
}

/**
 * Heatmap damages any target; AI defaults to the player hero when no target is supplied.
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 * @param {Target=} target
 */
export function resolveHeatmap(state, card, caster, target){
  const actualTarget = target || { type: 'hero', owner: opponentOf(caster) };
  damageTarget(state, actualTarget, card.effect.amount || 0);
  state.log.push(`${card.name} dealt ${card.effect.amount || 0} damage.`);
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {PlayerId} caster
 */
export function resolveExperiment(state, card, caster){
  resolveSummonCard(state, card, caster);
}

/** @type {Record<CardId, (state: GameState, card: Card, caster: PlayerId, target?: Target) => void>} */
export const CARD_RESOLVERS = Object.freeze({
  'feature-flag': resolveFeatureFlag,
  'session-replay': resolveSessionReplay,
  'ab-test': resolveAbTest,
  funnel: resolveFunnel,
  cohort: resolveCohort,
  insight: resolveInsight,
  surveys: resolveSurveys,
  heatmap: resolveHeatmap,
  experiment: resolveExperiment,
});

/**
 * @param {GameState} state
 * @param {PlayerId} owner
 * @param {number} amount
 */
export function healHero(state, owner, amount){
  const hero = state.heroes[owner];
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
  checkWin(state);
}

/**
 * @param {GameState} state
 * @param {PlayerId} owner
 * @param {number} amount
 */
export function damageHero(state, owner, amount){
  state.heroes[owner].hp -= amount;
  checkWin(state);
}

/**
 * @param {GameState} state
 * @param {Target} target
 * @param {number} amount
 */
export function damageTarget(state, target, amount){
  if(target.type === 'hero'){
    damageHero(state, target.owner, amount);
    return;
  }

  const minion = findTargetMinion(state, target);
  if(minion){
    minion.hp -= amount;
    removeDeadMinions(state);
  }
  checkWin(state);
}

/**
 * @param {GameState} state
 * @param {Target|undefined} target
 * @returns {Minion|undefined}
 */
export function findTargetMinion(state, target){
  if(!target || target.type !== 'minion' || !target.minionId) return undefined;
  return state.boards[target.owner].find((minion) => minion.id === target.minionId);
}

/**
 * @param {GameState} state
 */
export function removeDeadMinions(state){
  state.boards.player = state.boards.player.filter((minion) => minion.hp > 0);
  state.boards.ai = state.boards.ai.filter((minion) => minion.hp > 0);
}

/**
 * @param {GameState} state
 * @param {Minion} minion
 * @returns {boolean}
 */
export function canMinionAttack(state, minion){
  if(state.phase !== 'playing') return false;
  if(minion.summonedThisTurn) return false;
  if(minion.summonedOnTurn >= state.turn) return false;
  if(minion.disabledUntilTurn && minion.disabledUntilTurn >= state.turn) return false;
  return true;
}

/**
 * @param {GameState} state
 * @param {string} attackerId
 * @param {Target} target
 * @returns {{ ok: boolean, reason?: string }}
 */
export function attackTarget(state, attackerId, target){
  if(state.phase !== 'playing') return { ok: false, reason: 'Game is over.' };
  const owner = state.activePlayer;
  const attacker = state.boards[owner].find((minion) => minion.id === attackerId);
  if(!attacker) return { ok: false, reason: 'Attacker not found.' };
  if(!canMinionAttack(state, attacker)) return { ok: false, reason: 'That minion cannot attack yet.' };

  if(target.type === 'hero'){
    damageHero(state, target.owner, attacker.attack);
    state.log.push(`${attacker.cardId} attacked the enemy hero.`);
  } else {
    const defender = findTargetMinion(state, target);
    if(!defender) return { ok: false, reason: 'Target minion not found.' };
    defender.hp -= attacker.attack;
    attacker.hp -= defender.attack;
    removeDeadMinions(state);
    state.log.push('Minions traded blows.');
  }

  checkWin(state);
  return { ok: true };
}

/**
 * @param {GameState} state
 * @returns {GameState}
 */
export function checkWin(state){
  if(state.heroes.ai.hp <= 0){
    state.heroes.ai.hp = Math.min(state.heroes.ai.hp, 0);
    state.phase = 'won';
  } else if(state.heroes.player.hp <= 0){
    state.heroes.player.hp = Math.min(state.heroes.player.hp, 0);
    state.phase = 'lost';
  }
  return state;
}
