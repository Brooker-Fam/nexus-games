import { buildStarterDeck } from './deck.js';
import { createSeededRng } from './rng.js';
import { MAX_MANA, OPENING_HAND_SIZE, cloneSide, createSide, otherOwner } from './state.js';

/**
 * @typedef {'player' | 'ai'} Owner
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./state.js').SideState} SideState
 */

/**
 * @param {string | number} [rngSeed]
 * @returns {GameState}
 */
export function newGame(rngSeed){
  const rng = createSeededRng(rngSeed ?? Date.now());
  const player = drawCards(createSide(buildStarterDeck({ rng })), OPENING_HAND_SIZE);
  const ai = drawCards(createSide(buildStarterDeck({ rng })), OPENING_HAND_SIZE);

  return {
    player: {
      ...player,
      maxMana: 1,
      currentMana: 1,
    },
    ai: {
      ...ai,
      maxMana: 1,
      currentMana: 0,
    },
    turn: 1,
    activePlayer: 'player',
    phase: 'playing',
    log: ['Game started. Player begins with 1 mana.'],
  };
}

/**
 * Starts the currently active player's turn: mana ramps to min(turn, 10), mana
 * refills, one card is drawn, and that side's minions become ready.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function startTurn(state){
  if(state.phase !== 'playing') return state;

  const owner = state.activePlayer;
  const side = cloneSide(state[owner]);
  const withDraw = drawCards(side, 1);
  const maxMana = Math.min(state.turn, MAX_MANA);

  return {
    ...state,
    [owner]: {
      ...withDraw,
      maxMana,
      currentMana: maxMana,
      board: withDraw.board.map((minion) => ({ ...minion, canAttack: true })),
    },
    log: [...state.log, `${ownerLabel(owner)} starts turn ${state.turn}.`],
  };
}

/**
 * Ends the current turn, switches active players, advances the shared turn
 * counter when play returns to the player, then starts the new active turn.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function endTurn(state){
  assertPlaying(state);
  const nextActivePlayer = otherOwner(state.activePlayer);
  const nextTurn = nextActivePlayer === 'player' ? state.turn + 1 : state.turn;
  return startTurn({
    ...state,
    activePlayer: nextActivePlayer,
    turn: nextTurn,
    log: [...state.log, `${ownerLabel(state.activePlayer)} ends turn.`],
  });
}

/**
 * Checks hero HP and resolves the game from the human player's POV.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function checkWinCondition(state){
  if(state.phase !== 'playing') return state;
  if(state.player.hp <= 0){
    return { ...state, phase: 'lost', log: [...state.log, 'Player was defeated.'] };
  }
  if(state.ai.hp <= 0){
    return { ...state, phase: 'won', log: [...state.log, 'AI was defeated.'] };
  }
  return state;
}

/**
 * Foundation-level action API. It handles card lookup/removal and delegates to
 * the card resolver, which is still a no-effect stub for this hoglet.
 *
 * @param {GameState} state
 * @param {string} cardId
 * @returns {GameState}
 */
export function playCard(state, cardId){
  assertPlaying(state);
  const owner = state.activePlayer;
  const side = cloneSide(state[owner]);
  const cardIndex = side.hand.findIndex((card) => card.id === cardId);
  if(cardIndex === -1){
    throw new Error(`${ownerLabel(owner)} does not have ${cardId} in hand.`);
  }

  const [card] = side.hand.splice(cardIndex, 1);
  const stateWithoutCard = {
    ...state,
    [owner]: side,
  };

  return checkWinCondition(card.resolve(stateWithoutCard, owner));
}

/**
 * Stubbed combat API for hoglet 2.
 *
 * @param {GameState} state
 * @param {string} attackerId
 * @param {string} targetId
 * @returns {GameState}
 */
export function attackWithMinion(state, attackerId, targetId){
  assertPlaying(state);
  void attackerId;
  void targetId;
  throw new Error('attackWithMinion is not implemented yet.');
}

/**
 * @param {GameState} state
 */
function assertPlaying(state){
  if(state.phase !== 'playing'){
    throw new Error(`Cannot act while game phase is ${state.phase}.`);
  }
}

/**
 * @param {SideState} side
 * @param {number} count
 * @returns {SideState}
 */
export function drawCards(side, count){
  const nextSide = cloneSide(side);
  for(let i = 0; i < count; i++){
    const card = nextSide.deck.shift();
    if(!card) break;
    nextSide.hand.push(card);
  }
  return nextSide;
}

/**
 * @param {Owner} owner
 */
function ownerLabel(owner){
  return owner === 'player' ? 'Player' : 'AI';
}
