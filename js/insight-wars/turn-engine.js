import { CARD_EFFECTS } from './cards.js';
import { buildStarterDeck } from './deck.js';
import { createSeededRng } from './rng.js';
import { MAX_MANA, OPENING_HAND_SIZE, STARTING_HP, cloneSide, createSide, otherOwner } from './state.js';

/**
 * @typedef {'player' | 'ai'} Owner
 * @typedef {import('./state.js').GameState} GameState
 * @typedef {import('./state.js').SideState} SideState
 * @typedef {import('./state.js').Minion} Minion
 * @typedef {import('./cards.js').Card} Card
 *
 * @typedef {object} TargetSpec
 * @property {'hero' | 'minion'} type
 * @property {Owner} [owner]
 * @property {string} [id]
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
    nextMinionId: 1,
    revealedAiHand: false,
    rng,
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
      board: withDraw.board.map((minion) => {
        // Feature Flag stun is consumed on the owner's next startTurn only.
        // The minion stays exhausted for that whole turn, then readies normally
        // on the following owner startTurn. New minions have canAttack=false
        // until this lifecycle readies them for the first time.
        if(minion.stunnedNextTurn){
          return { ...minion, stunnedNextTurn: false, canAttack: false };
        }
        return { ...minion, canAttack: true };
      }),
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
    revealedAiHand: state.activePlayer === 'player' ? false : state.revealedAiHand,
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
 * Plays a card from the active side's hand. `cardIndexOrId` accepts a numeric
 * hand index for UI callers or a card id for tests and simple scripted play.
 * Insufficient mana is rejected as a no-op: the card stays in hand and mana is
 * not deducted.
 *
 * @param {GameState} state
 * @param {number | string} cardIndexOrId
 * @param {TargetSpec | string} [targetSpec]
 * @returns {GameState}
 */
export function playCard(state, cardIndexOrId, targetSpec){
  assertPlaying(state);
  const owner = state.activePlayer;
  const side = cloneSide(state[owner]);
  const cardIndex = typeof cardIndexOrId === 'number'
    ? cardIndexOrId
    : side.hand.findIndex((card) => card.id === cardIndexOrId);
  if(cardIndex === -1){
    throw new Error(`${ownerLabel(owner)} does not have ${cardIndexOrId} in hand.`);
  }

  const cardToPlay = side.hand[cardIndex];
  if(!cardToPlay){
    throw new Error(`${ownerLabel(owner)} does not have a card at hand index ${cardIndex}.`);
  }
  if(side.currentMana < cardToPlay.cost){
    return {
      ...state,
      log: [
        ...state.log,
        `${ownerLabel(owner)} could not afford ${cardToPlay.emoji} ${cardToPlay.name}.`,
      ],
    };
  }

  const [card] = side.hand.splice(cardIndex, 1);
  side.currentMana -= card.cost;

  const paidState = {
    ...state,
    [owner]: side,
    log: [...state.log, `${ownerLabel(owner)} played ${card.emoji} ${card.name}.`],
  };

  return checkWinCondition(resolveCard(paidState, card, owner, targetSpec));
}

/**
 * Attacks with one ready minion controlled by the active side. Targets default
 * to the enemy hero, or can be an enemy minion id / target spec.
 *
 * @param {GameState} state
 * @param {string} attackerId
 * @param {TargetSpec | string} [targetSpec]
 * @returns {GameState}
 */
export function attackWithMinion(state, attackerId, targetSpec){
  assertPlaying(state);
  const owner = state.activePlayer;
  const enemy = otherOwner(owner);
  const attackingSide = cloneSide(state[owner]);
  const defendingSide = cloneSide(state[enemy]);
  const attackerIndex = attackingSide.board.findIndex((minion) => minion.id === attackerId);
  const attacker = attackingSide.board[attackerIndex];

  if(!attacker){
    throw new Error(`${ownerLabel(owner)} does not control minion ${attackerId}.`);
  }
  if(!attacker.canAttack){
    return {
      ...state,
      log: [...state.log, `${attacker.name} is not ready to attack.`],
    };
  }

  attacker.canAttack = false;
  const target = resolveTarget(enemy, targetSpec);
  let logEntry = `${ownerLabel(owner)} attacked ${ownerLabel(enemy)} hero with ${attacker.name}.`;

  if(target.type === 'hero'){
    defendingSide.hp -= attacker.attack;
  }else{
    const defenderIndex = defendingSide.board.findIndex((minion) => minion.id === target.id);
    const defender = defendingSide.board[defenderIndex];
    if(!defender){
      return {
        ...state,
        [owner]: attackingSide,
        [enemy]: defendingSide,
        log: [...state.log, `${attacker.name} swung at a missing minion.`],
      };
    }

    defender.hp -= attacker.attack;
    attacker.hp -= defender.attack;
    logEntry = `${ownerLabel(owner)} attacked ${defender.name} with ${attacker.name}.`;
    attackingSide.board = attackingSide.board.filter((minion) => minion.hp > 0);
    defendingSide.board = defendingSide.board.filter((minion) => minion.hp > 0);
  }

  return checkWinCondition({
    ...state,
    [owner]: attackingSide,
    [enemy]: defendingSide,
    log: [...state.log, logEntry],
  });
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {Owner} owner
 * @param {TargetSpec | string | undefined} targetSpec
 * @returns {GameState}
 */
function resolveCard(state, card, owner, targetSpec){
  switch(card.id){
    case 'feature-flag':
      return resolveFeatureFlag(state, owner, targetSpec);
    case 'session-replay':
      return resolveSessionReplay(state, owner);
    case 'ab-test':
      return resolveAbTest(state, owner);
    case 'funnel':
      return resolveFunnel(state, owner);
    case 'cohort':
    case 'experiment':
    case 'dashboard':
      return resolveMinionCard(state, card, owner);
    case 'insight':
      return resolveInsight(state, owner);
    case 'heatmap':
      return resolveHeatmap(state, owner, targetSpec);
    default:
      throw new Error(`No resolver implemented for ${card.id}.`);
  }
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @param {TargetSpec | string | undefined} targetSpec
 * @returns {GameState}
 */
function resolveFeatureFlag(state, owner, targetSpec){
  const enemy = otherOwner(owner);
  const defendingSide = cloneSide(state[enemy]);
  const target = resolveTarget(enemy, targetSpec ?? firstEnemyMinionTarget(defendingSide));

  if(target.type !== 'minion'){
    return {
      ...state,
      log: [...state.log, 'Feature Flag had no enemy minion to stun.'],
    };
  }

  const minion = defendingSide.board.find((candidate) => candidate.id === target.id);
  if(!minion){
    return {
      ...state,
      [enemy]: defendingSide,
      log: [...state.log, 'Feature Flag target was missing.'],
    };
  }

  minion.stunnedNextTurn = true;
  return {
    ...state,
    [enemy]: defendingSide,
    log: [...state.log, `${minion.name} was stunned for its next turn.`],
  };
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @returns {GameState}
 */
function resolveSessionReplay(state, owner){
  if(owner === 'ai'){
    return {
      ...state,
      log: [...state.log, 'AI reviewed a Session Replay, but learned nothing.'],
    };
  }

  return {
    ...state,
    revealedAiHand: true,
    log: [...state.log, 'AI hand is revealed for this turn.'],
  };
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @returns {GameState}
 */
function resolveAbTest(state, owner){
  const rng = state.rng ?? Math.random;
  const effect = CARD_EFFECTS['ab-test'];
  const roll = rng();

  if(roll < 0.5){
    const enemy = otherOwner(owner);
    const defendingSide = cloneSide(state[enemy]);
    defendingSide.hp -= effect.heroDamage;
    return {
      ...state,
      [enemy]: defendingSide,
      log: [...state.log, `A/B Test shipped damage for ${effect.heroDamage}.`],
    };
  }

  const side = cloneSide(state[owner]);
  side.hp = Math.min(STARTING_HP, side.hp + effect.heroHeal);
  return {
    ...state,
    [owner]: side,
    log: [...state.log, `A/B Test shipped healing for ${effect.heroHeal}.`],
  };
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @returns {GameState}
 */
function resolveFunnel(state, owner){
  const enemy = otherOwner(owner);
  const effect = CARD_EFFECTS.funnel;
  const defendingSide = cloneSide(state[enemy]);
  defendingSide.board = defendingSide.board
    .map((minion) => ({ ...minion, hp: minion.hp - effect.enemyBoardDamage }))
    .filter((minion) => minion.hp > 0);

  return {
    ...state,
    [enemy]: defendingSide,
    log: [...state.log, `Funnel dealt ${effect.enemyBoardDamage} damage to each enemy minion.`],
  };
}

/**
 * @param {GameState} state
 * @param {Card} card
 * @param {Owner} owner
 * @returns {GameState}
 */
function resolveMinionCard(state, card, owner){
  const side = cloneSide(state[owner]);
  const stats = CARD_EFFECTS[card.id];
  const minionId = `${owner}-minion-${state.nextMinionId ?? 1}`;
  side.board.push({
    id: minionId,
    name: card.name,
    attack: stats.attack,
    hp: stats.hp,
    maxHp: stats.hp,
    // Summoning sickness: new minions never attack on the turn they are played.
    // startTurn readies them on their owner's next turn unless Feature Flag stun
    // is waiting to consume that ready step.
    canAttack: false,
    sourceCardId: card.id,
  });

  return {
    ...state,
    [owner]: side,
    nextMinionId: (state.nextMinionId ?? 1) + 1,
    log: [...state.log, `${ownerLabel(owner)} summoned ${card.name}.`],
  };
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @returns {GameState}
 */
function resolveInsight(state, owner){
  const side = drawCards(cloneSide(state[owner]), CARD_EFFECTS.insight.drawCards);
  return {
    ...state,
    [owner]: side,
    log: [...state.log, `${ownerLabel(owner)} drew ${CARD_EFFECTS.insight.drawCards} cards.`],
  };
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @param {TargetSpec | string | undefined} targetSpec
 * @returns {GameState}
 */
function resolveHeatmap(state, owner, targetSpec){
  const enemy = otherOwner(owner);
  const target = resolveTarget(enemy, targetSpec);
  return damageTarget(state, owner, target, CARD_EFFECTS.heatmap.damage, 'Heatmap');
}

/**
 * @param {GameState} state
 * @param {Owner} owner
 * @param {{type: 'hero'} | {type: 'minion', id: string}} target
 * @param {number} damage
 * @param {string} sourceName
 * @returns {GameState}
 */
function damageTarget(state, owner, target, damage, sourceName){
  const enemy = otherOwner(owner);
  const defendingSide = cloneSide(state[enemy]);

  if(target.type === 'hero'){
    defendingSide.hp -= damage;
    return {
      ...state,
      [enemy]: defendingSide,
      log: [...state.log, `${sourceName} dealt ${damage} damage to ${ownerLabel(enemy)} hero.`],
    };
  }

  const minion = defendingSide.board.find((candidate) => candidate.id === target.id);
  if(!minion){
    return {
      ...state,
      [enemy]: defendingSide,
      log: [...state.log, `${sourceName} target was missing.`],
    };
  }

  minion.hp -= damage;
  defendingSide.board = defendingSide.board.filter((candidate) => candidate.hp > 0);
  return {
    ...state,
    [enemy]: defendingSide,
    log: [...state.log, `${sourceName} dealt ${damage} damage to ${minion.name}.`],
  };
}

/**
 * @param {SideState} defendingSide
 * @returns {{type: 'minion', id: string} | undefined}
 */
function firstEnemyMinionTarget(defendingSide){
  const [firstMinion] = defendingSide.board;
  return firstMinion ? { type: 'minion', id: firstMinion.id } : undefined;
}

/**
 * @param {Owner} defaultOwner
 * @param {TargetSpec | string | undefined} targetSpec
 * @returns {{type: 'hero'} | {type: 'minion', id: string}}
 */
function resolveTarget(defaultOwner, targetSpec){
  void defaultOwner;
  if(!targetSpec || targetSpec === 'hero'){
    return { type: 'hero' };
  }
  if(typeof targetSpec === 'string'){
    return { type: 'minion', id: targetSpec };
  }
  if(targetSpec.type === 'minion' && targetSpec.id){
    return { type: 'minion', id: targetSpec.id };
  }
  return { type: 'hero' };
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
