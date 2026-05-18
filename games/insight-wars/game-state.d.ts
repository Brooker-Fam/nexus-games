export type InsightWarsCardType = 'minion' | 'spell';
export type InsightWarsPlayerId = 'player' | 'ai';
export type InsightWarsGameOver = 'win' | 'lose' | null;

export interface Card {
  id: string;
  name: string;
  cost: number;
  type: InsightWarsCardType;
  attack?: number;
  hp?: number;
  effectText: string;
  emoji: string;
}

export interface Minion {
  id: string;
  name: string;
  attack: number;
  hp: number;
  hasSummoningSickness: boolean;
  emoji: string;
}

export interface InsightWarsHero {
  id: InsightWarsPlayerId;
  name: string;
  emoji: string;
  hp: number;
  mana?: {
    current: number;
    max: number;
  };
}

export interface GameState {
  turn: number;
  activePlayer: InsightWarsPlayerId;
  gameOver: InsightWarsGameOver;
  player: InsightWarsHero;
  ai: InsightWarsHero;
  playerHand: Card[];
  playerBoard: Minion[];
  aiBoard: Minion[];
}

export const INSIGHT_WARS_CARD_SET: readonly Card[];
export function createInitialGameState(): GameState;
export function playCard(state: GameState, cardId: string, target?: string): GameState;
export function attack(state: GameState, attackerId: string, targetId: string): GameState;
export function endTurn(state: GameState): GameState;
