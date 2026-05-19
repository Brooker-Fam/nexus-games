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
 * @typedef {{ id: string, cardId: CardId, attack: number, hp: number, summonedOnTurn: number, disabledUntilTurn?: number }} Minion
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
      player: { name: 'Max', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP },
      ai: { name: 'Dark Funnel PM', hp: HERO_MAX_HP, maxHp: HERO_MAX_HP },
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
  const mana = manaFor(state, state.activePlayer);
  mana.max = Math.min(MAX_MANA, mana.max + 1);
  mana.current = mana.max;
  drawCard(state, state.activePlayer);
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
  };
  state.nextMinionId += 1;
  state.boards[owner].push(minion);
  return minion;
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
 * Data-driven resolver foundation. Effects marked TODO are playable now but need fuller target/UI behavior later.
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

  const opponent = opponentOf(caster);
  switch(card.effectType){
    case 'summon': {
      const summon = card.effect.summon;
      if(summon){
        summonMinion(state, caster, card.id, summon.attack, summon.hp);
        state.log.push(`${card.name} summoned a ${summon.attack}/${summon.hp}.`);
      }
      break;
    }
    case 'heal': {
      healHero(state, caster, card.effect.amount || 0);
      state.log.push(`${card.name} healed ${caster === 'player' ? 'you' : 'AI'} for ${card.effect.amount || 0}.`);
      break;
    }
    case 'draw': {
      drawCard(state, caster, card.effect.amount || 1);
      state.log.push(`${card.name} drew a card.`);
      break;
    }
    case 'aoeDamage': {
      damageHero(state, opponent, card.effect.heroDamage || 0);
      state.boards[opponent].forEach((minion) => { minion.hp -= card.effect.minionDamage || 0; });
      removeDeadMinions(state);
      state.log.push(`${card.name} pushed damage through the enemy funnel.`);
      break;
    }
    case 'coinFlip': {
      // TODO(insight-wars): expose the coin-flip result in polished UI and AI planning.
      if(randomFromState(state) < 0.5){
        damageHero(state, opponent, card.effect.amount || 0);
        state.log.push(`${card.name} variant A dealt ${card.effect.amount || 0} damage.`);
      } else {
        healHero(state, caster, card.effect.amount || 0);
        state.log.push(`${card.name} variant B healed ${card.effect.amount || 0}.`);
      }
      break;
    }
    case 'revealHand': {
      // TODO(insight-wars): the current skeleton reveals hand text only for the player; AI usage remains a no-op.
      if(caster === 'player'){
        state.aiHandRevealedUntilTurn = state.turn + (card.effect.amount || 1);
        state.log.push(`${card.name} revealed the AI hand.`);
      } else {
        state.log.push(`${card.name} has no AI effect yet.`);
      }
      break;
    }
    case 'disableMinion': {
      // TODO(insight-wars): add proper target selection UI. Without a target, disable the first enemy minion.
      const targetMinion = findTargetMinion(state, target) || state.boards[opponent][0];
      if(targetMinion){
        targetMinion.disabledUntilTurn = state.turn + 1;
        state.log.push(`${card.name} disabled an enemy minion next turn.`);
      } else {
        state.log.push(`${card.name} found no minion to disable.`);
      }
      break;
    }
    case 'damageTarget': {
      // TODO(insight-wars): player target picking is rudimentary; UI currently defaults to enemy hero unless a target is supplied.
      const actualTarget = target || { type: 'hero', owner: opponent };
      damageTarget(state, actualTarget, card.effect.amount || 0);
      state.log.push(`${card.name} dealt ${card.effect.amount || 0} damage.`);
      break;
    }
    default:
      state.log.push(`${card.name} resolved with no effect.`);
  }

  checkWin(state);
  return { ok: true };
}

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
    state.heroes.ai.hp = 0;
    state.phase = 'won';
  } else if(state.heroes.player.hp <= 0){
    state.heroes.player.hp = 0;
    state.phase = 'lost';
  }
  return state;
}
