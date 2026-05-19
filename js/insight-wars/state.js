/**
 * Core Insight Wars state types. This repository is plain JavaScript, so the
 * engine uses JSDoc typedefs instead of TypeScript interfaces.
 *
 * @typedef {'player' | 'ai'} Owner
 * @typedef {'playing' | 'won' | 'lost'} GamePhase
 * @typedef {import('./cards.js').Card} Card
 *
 * @typedef {object} Minion
 * @property {string} id
 * @property {string} name
 * @property {number} attack
 * @property {number} hp
 * @property {number} maxHp
 * @property {boolean} canAttack
 * @property {boolean} [stunnedNextTurn]
 * @property {string} sourceCardId
 *
 * @typedef {object} SideState
 * @property {number} hp
 * @property {number} maxMana
 * @property {number} currentMana
 * @property {Card[]} deck
 * @property {Card[]} hand
 * @property {Minion[]} board
 *
 * @typedef {object} GameState
 * @property {SideState} player
 * @property {SideState} ai
 * @property {number} turn
 * @property {Owner} activePlayer
 * @property {GamePhase} phase
 * @property {string[]} log
 * @property {number} nextMinionId
 * @property {boolean} revealedAiHand
 * @property {import('./rng.js').Rng} rng
 */

/** @type {20} */
export const STARTING_HP = 20;
export const OPENING_HAND_SIZE = 3;
export const MAX_MANA = 10;

/**
 * @param {import('./cards.js').Card[]} deck
 * @returns {SideState}
 */
export function createSide(deck){
  return {
    hp: STARTING_HP,
    maxMana: 0,
    currentMana: 0,
    deck,
    hand: [],
    board: [],
  };
}

/**
 * Creates a shallow immutable-style copy of a side. Card objects are catalog
 * values and intentionally shared; collections are copied for safe updates.
 *
 * @param {SideState} side
 * @returns {SideState}
 */
export function cloneSide(side){
  return {
    ...side,
    deck: [...side.deck],
    hand: [...side.hand],
    board: side.board.map((minion) => ({ ...minion })),
  };
}

/**
 * @param {Owner} owner
 * @returns {Owner}
 */
export function otherOwner(owner){
  return owner === 'player' ? 'ai' : 'player';
}
