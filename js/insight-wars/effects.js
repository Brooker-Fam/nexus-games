import { CARD_IDS, getCardDefinition } from './cards.js';
import {
  PLAYERS,
  checkWinCondition,
  createMinion,
  damageHero,
  drawCards,
  healHero,
  opponentOf,
  removeDeadMinions,
} from './state.js';

const FUNNEL_DAMAGE = 2; // Foundation branch was unavailable; defaulting Funnel AoE to 2 per task instructions.

export function resolveCard(state, player, cardId, target = undefined){
  if(state.gameOver) return reject(state, 'game-over');
  if(state.activePlayer !== player) return reject(state, 'not-active-player');

  const p = state.players[player];
  if(!p) return reject(state, 'unknown-player');

  const handIndex = findCardInHand(p.hand, cardId);
  if(handIndex === -1) return reject(state, 'card-not-in-hand');

  const handCard = p.hand[handIndex];
  const card = getCardDefinition(handCard);
  if(!card) return reject(state, 'unknown-card');

  if(p.events < card.cost) return reject(state, 'not-enough-events');

  const validation = validateCardPlay(state, player, card.id, target);
  if(!validation.ok) return validation;

  p.events -= card.cost;
  p.hand.splice(handIndex, 1);

  const opponent = opponentOf(player);
  let detail = {};

  switch(card.id){
    case CARD_IDS.FEATURE_FLAG: {
      const minion = findMinion(state, target).minion;
      minion.disabled = true;
      detail = { targetMinionId: minion.id };
      break;
    }
    case CARD_IDS.SESSION_REPLAY: {
      if(player === PLAYERS.AI){
        // FR-006: AI Session Replay has no effect. This branch is intentionally explicit.
        detail = { noOp: true };
      } else {
        state.aiHandRevealedUntilEndOfTurn = true;
        detail = { revealedPlayer: PLAYERS.AI };
      }
      break;
    }
    case CARD_IDS.AB_TEST: {
      const heads = Math.random() < 0.5;
      if(heads){
        damageHero(state, opponent, 5);
        detail = { branch: 'heads', damage: 5 };
      } else {
        healHero(state, player, 5);
        detail = { branch: 'tails', heal: 5 };
      }
      break;
    }
    case CARD_IDS.FUNNEL: {
      for(const minion of state.players[opponent].board){
        minion.hp -= FUNNEL_DAMAGE;
      }
      removeDeadMinions(state);
      detail = { damage: FUNNEL_DAMAGE };
      break;
    }
    case CARD_IDS.COHORT: {
      const minion = createMinion({ name: 'Cohort', attack: 2, hp: 3, owner: player, summoningSickness: true });
      p.board.push(minion);
      detail = { summonedMinionId: minion.id };
      break;
    }
    case CARD_IDS.INSIGHT: {
      const before = p.hand.length;
      drawCards(state, player, 1);
      detail = { drawn: p.hand.length - before };
      break;
    }
    case CARD_IDS.SURVEYS: {
      healHero(state, player, 4);
      detail = { heal: 4 };
      break;
    }
    case CARD_IDS.HEATMAP: {
      const normalized = normalizeTarget(state, target);
      if(normalized.type === 'hero'){
        damageHero(state, normalized.player, 4);
        detail = { target: 'hero', player: normalized.player, damage: 4 };
      } else {
        normalized.minion.hp -= 4;
        detail = { target: 'minion', minionId: normalized.minion.id, damage: 4 };
        removeDeadMinions(state);
      }
      break;
    }
    case CARD_IDS.EXPERIMENT: {
      const minion = createMinion({ name: 'Experiment', attack: 5, hp: 5, owner: player, summoningSickness: true });
      p.board.push(minion);
      detail = { summonedMinionId: minion.id };
      break;
    }
    default:
      // validateCardPlay and getCardDefinition should make this unreachable.
      p.events += card.cost;
      p.hand.splice(handIndex, 0, handCard);
      return reject(state, 'unknown-card');
  }

  checkWinCondition(state);
  state.history.push({ type: 'card-played', player, cardId: card.id, cost: card.cost, ...detail });
  return { ok: true, state, card, detail };
}

function validateCardPlay(state, player, cardId, target){
  const opponent = opponentOf(player);

  if(cardId === CARD_IDS.SESSION_REPLAY && player === PLAYERS.AI){
    return reject(state, 'ai-session-replay-no-op');
  }

  if(cardId === CARD_IDS.FEATURE_FLAG){
    if(state.players[opponent].board.length === 0) return reject(state, 'no-enemy-minions');
    const found = findMinion(state, target);
    if(!found.minion) return reject(state, 'invalid-target');
    if(found.owner !== opponent) return reject(state, 'target-not-enemy-minion');
  }

  if(cardId === CARD_IDS.HEATMAP){
    const normalized = normalizeTarget(state, target);
    if(!normalized) return reject(state, 'invalid-target');
    if(normalized.type === 'hero' && normalized.player === player){
      return reject(state, 'cannot-target-friendly-hero');
    }
  }

  return { ok: true, state };
}

export function attack(state, attackerMinionId, target){
  if(state.gameOver) return reject(state, 'game-over');

  const attackerRef = findMinion(state, attackerMinionId);
  if(!attackerRef.minion) return reject(state, 'attacker-not-found');
  const attacker = attackerRef.minion;

  if(attacker.owner !== state.activePlayer) return reject(state, 'not-active-player-minion');
  if(attacker.summoningSickness) return reject(state, 'summoning-sickness');
  if(attacker.disabled){
    attacker.disabled = false;
    state.history.push({ type: 'minion-disable-expired', player: attacker.owner, minionId: attacker.id });
    return reject(state, 'disabled');
  }

  const normalized = normalizeTarget(state, target);
  if(!normalized) return reject(state, 'invalid-target');
  if(normalized.type === 'minion' && normalized.minion.owner === attacker.owner){
    return reject(state, 'cannot-attack-friendly-minion');
  }
  if(normalized.type === 'hero' && normalized.player === attacker.owner){
    return reject(state, 'cannot-attack-friendly-hero');
  }

  if(normalized.type === 'hero'){
    damageHero(state, normalized.player, attacker.attack);
    state.history.push({
      type: 'minion-attacked-hero',
      attackerId: attacker.id,
      attackerOwner: attacker.owner,
      targetPlayer: normalized.player,
      damage: attacker.attack,
    });
  } else {
    const defender = normalized.minion;
    const attackerDamage = attacker.attack;
    const defenderDamage = defender.attack;
    attacker.hp -= defenderDamage;
    defender.hp -= attackerDamage;
    state.history.push({
      type: 'minion-combat',
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerDamage,
      defenderDamage,
    });
    removeDeadMinions(state);
  }

  checkWinCondition(state);
  return { ok: true, state };
}

export function normalizeTarget(state, target){
  if(!target) return null;

  if(typeof target === 'string'){
    const heroPlayer = parseHeroTarget(target);
    if(heroPlayer) return { type: 'hero', player: heroPlayer };
    const found = findMinion(state, target);
    return found.minion ? { type: 'minion', minion: found.minion, owner: found.owner } : null;
  }

  if(target.type === 'hero'){
    const player = target.player ?? target.owner;
    return state.players[player] ? { type: 'hero', player } : null;
  }

  if(target.type === 'minion'){
    const found = findMinion(state, target.id ?? target.minionId);
    return found.minion ? { type: 'minion', minion: found.minion, owner: found.owner } : null;
  }

  if(target.minionId || target.id){
    const found = findMinion(state, target.minionId ?? target.id);
    if(found.minion) return { type: 'minion', minion: found.minion, owner: found.owner };
  }

  return null;
}

export function heroTarget(player){
  return { type: 'hero', player };
}

export function findMinion(state, minionOrTarget){
  const minionId = typeof minionOrTarget === 'string'
    ? minionOrTarget
    : minionOrTarget?.id ?? minionOrTarget?.minionId;

  if(!minionId) return { minion: null, owner: null };

  for(const player of Object.values(PLAYERS)){
    const minion = state.players[player].board.find((candidate) => candidate.id === minionId);
    if(minion) return { minion, owner: player };
  }
  return { minion: null, owner: null };
}

function findCardInHand(hand, cardId){
  return hand.findIndex((card) => card.instanceId === cardId || card.id === cardId);
}

function parseHeroTarget(target){
  const normalized = target.toLowerCase();
  if(normalized === 'player' || normalized === 'player-hero' || normalized === 'playerhero' || normalized === 'hero:player'){
    return PLAYERS.PLAYER;
  }
  if(normalized === 'ai' || normalized === 'ai-hero' || normalized === 'aihero' || normalized === 'hero:ai'){
    return PLAYERS.AI;
  }
  return null;
}

function reject(state, reason){
  return { ok: false, state, reason };
}
