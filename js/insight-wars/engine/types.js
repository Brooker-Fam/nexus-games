// ── INSIGHT WARS ENGINE TYPES ──
// Plain JavaScript project: these JSDoc typedefs are the source of truth for follow-up hoglets.

/** @typedef {'player' | 'ai'} Player */
/** @typedef {'spell' | 'minion'} CardType */

/**
 * @typedef {object} Hero
 * @property {number} hp
 * @property {number} maxHp
 */

/**
 * @typedef {object} MinionStats
 * @property {number} attack
 * @property {number} hp
 */

/**
 * @typedef {object} CardResolveContext
 * @property {Player} player
 * @property {Card} card
 * @property {unknown} [target]
 * @property {string} [minionId]
 */

/**
 * @typedef {object} CardDefinition
 * @property {string} key
 * @property {string} name
 * @property {number} cost
 * @property {CardType} type
 * @property {number} count
 * @property {MinionStats} [minionStats]
 * @property {(state: GameState, ctx: CardResolveContext) => GameState} resolve
 */

/**
 * @typedef {object} Card
 * @property {string} id
 * @property {string} definitionKey
 * @property {string} name
 * @property {number} cost
 * @property {CardType} type
 * @property {MinionStats} [minionStats]
 */

/**
 * @typedef {object} Minion
 * @property {string} id
 * @property {Player} owner
 * @property {string} name
 * @property {number} attack
 * @property {number} hp
 * @property {number} maxHp
 * @property {boolean} summoningSick
 */

/**
 * @typedef {object} PlayerState
 * @property {Hero} hero
 * @property {number} maxMana
 * @property {number} mana
 * @property {Card[]} deck
 * @property {Card[]} hand
 * @property {Minion[]} board
 * @property {Card[]} discard
 */

/**
 * @typedef {object} GameState
 * @property {number} turnNumber
 * @property {Player} activePlayer
 * @property {number} nextId
 * @property {{ player: PlayerState, ai: PlayerState }} players
 * @property {string[]} log
 */

export const HERO_MAX_HP = 20;
export const MAX_MANA = 10;
