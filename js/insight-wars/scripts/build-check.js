import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  CARD_DEFINITIONS,
  createInitialState,
  getDeckComposition,
} from '../engine/index.js';
import '../ui/BoardView.js';
import '../ui/EndTurnButton.js';
import '../ui/HandView.js';
import '../ui/HeroPanel.js';
import '../ui/InsightWarsGame.js';
import '../ui/ManaBar.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const indexHtml = await readFile(resolve(repoRoot, 'index.html'), 'utf8');

const deck = getDeckComposition();
const uniqueCards = new Set(deck.map((card) => card.key));
const totalCards = deck.reduce((sum, card) => sum + card.count, 0);
const missingEffectText = CARD_DEFINITIONS.filter((card) => !card.effectText);
const state = createInitialState({ seed: 1 });

if(deck.length !== 9 || uniqueCards.size !== 9){
  throw new Error(`Expected 9 unique Insight Wars cards, found ${deck.length} entries and ${uniqueCards.size} keys.`);
}

if(totalCards !== 21){
  throw new Error(`Expected 21 cards per deck, found ${totalCards}.`);
}

if(missingEffectText.length > 0){
  throw new Error(`Missing effect text for: ${missingEffectText.map((card) => card.name).join(', ')}`);
}

if(state.players.player.hero.hp !== 20 || state.players.ai.hero.hp !== 20){
  throw new Error('Initial hero HP check failed.');
}

if(!indexHtml.includes('tab-insight-wars') || !indexHtml.includes('js/insight-wars/index.js')){
  throw new Error('Insight Wars route/tab entry is missing from index.html.');
}

console.log('Insight Wars build check passed: route, engine, UI modules, deck, and initial state are valid.');
