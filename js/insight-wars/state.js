import { buildDeck } from './cards.js';

export const PLAYERS = Object.freeze({
  PLAYER: 'player',
  AI: 'ai',
});

export const MAX_EVENTS = 10;
export const MAX_HERO_HP = 20;
export const STARTING_HAND_SIZE = 3;

let nextMinionInstance = 1;
let aiTurnRunner = null;

export function createHero(){
  return { hp: MAX_HERO_HP, maxHp: MAX_HERO_HP };
}

export function createPlayer(id, deck = buildDeck()){
  return {
    id,
    hero: createHero(),
    deck,
    hand: [],
    board: [],
    events: 0,
    maxEvents: 0,
  };
}

export function createMinion({ name = 'Minion', attack, hp, owner, summoningSickness = true, disabled = false }){
  return {
    id: `minion-${nextMinionInstance++}`,
    name,
    attack,
    hp,
    maxHp: hp,
    owner,
    summoningSickness,
    disabled,
  };
}

export function opponentOf(player){
  if(player === PLAYERS.PLAYER) return PLAYERS.AI;
  if(player === PLAYERS.AI) return PLAYERS.PLAYER;
  throw new Error(`Unknown Insight Wars player: ${String(player)}`);
}

export function newGame({
  playerDeck = buildDeck(),
  aiDeck = buildDeck(),
  startingHandSize = STARTING_HAND_SIZE,
} = {}){
  const state = {
    players: {
      [PLAYERS.PLAYER]: createPlayer(PLAYERS.PLAYER, [...playerDeck]),
      [PLAYERS.AI]: createPlayer(PLAYERS.AI, [...aiDeck]),
    },
    activePlayer: PLAYERS.PLAYER,
    turn: 1,
    gameOver: false,
    winner: null,
    aiHandRevealedUntilEndOfTurn: false,
    history: [],
  };

  drawCards(state, PLAYERS.PLAYER, startingHandSize);
  drawCards(state, PLAYERS.AI, startingHandSize);

  // Player starts with one event available. Later turns ramp to a maximum of 10.
  state.players[PLAYERS.PLAYER].maxEvents = 1;
  state.players[PLAYERS.PLAYER].events = 1;
  return state;
}

export function registerAiTurnRunner(runner){
  aiTurnRunner = runner;
}

export function drawCards(state, player, count = 1){
  const p = state.players[player];
  if(!p) throw new Error(`Unknown Insight Wars player: ${String(player)}`);
  for(let i = 0; i < count; i++){
    if(p.deck.length === 0) break;
    p.hand.push(p.deck.shift());
  }
  return state;
}

export function startTurn(state, player = state.activePlayer, { draw = true } = {}){
  if(state.gameOver) return state;
  const p = state.players[player];
  if(!p) throw new Error(`Unknown Insight Wars player: ${String(player)}`);

  state.activePlayer = player;
  p.maxEvents = Math.min(MAX_EVENTS, p.maxEvents + 1);
  p.events = p.maxEvents;

  for(const minion of p.board){
    minion.summoningSickness = false;
  }

  if(draw) drawCards(state, player, 1);
  state.history.push({ type: 'turn-started', player, turn: state.turn, events: p.events });
  return state;
}

export function endTurn(state, { runAi = true } = {}){
  if(state.gameOver) return state;

  const endingPlayer = state.activePlayer;
  expireDisabledMinionsForPlayer(state, endingPlayer);
  state.aiHandRevealedUntilEndOfTurn = false;
  state.history.push({ type: 'turn-ended', player: endingPlayer, turn: state.turn });

  const nextPlayer = opponentOf(endingPlayer);
  if(nextPlayer === PLAYERS.PLAYER) state.turn += 1;
  startTurn(state, nextPlayer);

  if(runAi && nextPlayer === PLAYERS.AI && typeof aiTurnRunner === 'function'){
    aiTurnRunner(state);
  }

  return state;
}

export function expireDisabledMinionsForPlayer(state, player){
  const p = state.players[player];
  if(!p) return state;
  for(const minion of p.board){
    if(minion.disabled){
      minion.disabled = false;
      state.history.push({ type: 'minion-disable-expired', player, minionId: minion.id });
    }
  }
  return state;
}

export function removeDeadMinions(state){
  for(const player of Object.values(PLAYERS)){
    const board = state.players[player].board;
    state.players[player].board = board.filter((minion) => minion.hp > 0);
  }
  return state;
}

export function damageHero(state, player, amount){
  const hero = state.players[player].hero;
  hero.hp = Math.max(0, hero.hp - Math.max(0, amount));
  return checkWinCondition(state);
}

export function healHero(state, player, amount){
  const hero = state.players[player].hero;
  hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(0, amount));
  return state;
}

export function checkWinCondition(state){
  if(state.gameOver) return state;
  const playerHp = state.players[PLAYERS.PLAYER].hero.hp;
  const aiHp = state.players[PLAYERS.AI].hero.hp;
  if(playerHp <= 0 || aiHp <= 0){
    state.gameOver = true;
    if(playerHp <= 0 && aiHp <= 0) state.winner = 'draw';
    else state.winner = playerHp <= 0 ? PLAYERS.AI : PLAYERS.PLAYER;
    state.history.push({ type: 'game-over', winner: state.winner });
  }
  return state;
}
