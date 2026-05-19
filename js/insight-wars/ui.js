import { CARDS } from './cards.js';
import {
  attackTarget,
  canMinionAttack,
  createInitialState,
  endTurn,
  manaFor,
  resolveCard,
  startTurn,
} from './gameState.js';

let state = null;
let selectedMinionId = null;
let toastTimer = null;

const rootId = 'insight-wars-root';

function byId(id){
  return document.getElementById(id);
}

function ensureState(){
  if(!state) state = createInitialState();
  return state;
}

function cardEmoji(card){
  return {
    'feature-flag': '🚩',
    'session-replay': '🎬',
    'ab-test': '🧪',
    funnel: '🪤',
    cohort: '👥',
    insight: '💡',
    surveys: '📋',
    heatmap: '🔥',
    experiment: '⚗️',
  }[card.id] || '🃏';
}

function minionName(minion){
  return CARDS[minion.cardId]?.effect?.summon?.name || CARDS[minion.cardId]?.name || 'Minion';
}

function showToast(message){
  const toast = byId('iw-toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function visibleAiHand(game){
  if(game.aiHandRevealedUntilTurn && game.aiHandRevealedUntilTurn >= game.turn){
    return game.hands.ai.map((card) => `${cardEmoji(card)} ${card.name}`).join(', ') || 'Empty';
  }
  return `${game.hands.ai.length} hidden card${game.hands.ai.length === 1 ? '' : 's'}`;
}

function clampHp(hero){
  return Math.max(0, Math.min(hero.maxHp, hero.hp));
}

function renderHpPill(owner){
  const game = ensureState();
  const hero = game.heroes[owner];
  const isAi = owner === 'ai';
  return `
    <div class="iw-hp-pill ${isAi ? 'ai' : 'player'}" aria-label="${isAi ? 'AI' : 'Player'} HP">
      <span>${isAi ? 'Dark Funnel PM' : 'Max'}</span>
      <strong>❤️ ${clampHp(hero)}/${hero.maxHp}</strong>
    </div>
  `;
}

function renderHero(owner){
  const game = ensureState();
  const hero = game.heroes[owner];
  const isAi = owner === 'ai';
  const attackable = isAi && selectedMinionId && game.phase === 'playing' && game.activePlayer === 'player';
  const hpPercent = Math.max(0, Math.min(100, (clampHp(hero) / hero.maxHp) * 100));
  return `
    <button class="iw-hero ${isAi ? 'ai' : 'player'} ${attackable ? 'targetable' : ''}" data-owner="${owner}" data-hero-target="${owner}" ${attackable ? '' : 'disabled'}>
      <span class="iw-hero-label">${isAi ? 'AI' : 'You'}</span>
      <strong>${hero.name}</strong>
      <span class="iw-hero-hp">❤️ ${clampHp(hero)}/${hero.maxHp}</span>
      <span class="iw-hp-meter" aria-hidden="true"><span style="width: ${hpPercent}%"></span></span>
    </button>
  `;
}

function renderBoard(owner){
  const game = ensureState();
  const isPlayer = owner === 'player';
  const minions = game.boards[owner];
  if(minions.length === 0){
    return `<div class="iw-empty-board">No ${isPlayer ? 'player' : 'AI'} minions</div>`;
  }

  return minions.map((minion) => {
    const canAttack = isPlayer && game.phase === 'playing' && game.activePlayer === 'player' && canMinionAttack(game, minion);
    const isSelected = selectedMinionId === minion.id;
    const targetable = !isPlayer && game.phase === 'playing' && selectedMinionId;
    const status = minion.disabledUntilTurn && minion.disabledUntilTurn >= game.turn ? '<span class="iw-status">disabled</span>' : '';
    const disabled = game.phase !== 'playing' || (isPlayer ? game.activePlayer !== 'player' : !targetable);
    return `
      <button class="iw-minion ${isPlayer ? 'player' : 'ai'} ${canAttack ? 'can-attack' : ''} ${isSelected ? 'selected' : ''} ${targetable ? 'targetable' : ''}"
        data-minion-id="${minion.id}" data-owner="${owner}" ${disabled ? 'disabled' : ''}>
        <span class="iw-minion-name">${minionName(minion)}</span>
        <span class="iw-minion-stats">⚔ ${minion.attack} · ❤️ ${minion.hp}</span>
        ${status}
      </button>
    `;
  }).join('');
}

function renderHand(){
  const game = ensureState();
  const mana = manaFor(game, 'player');
  return game.hands.player.map((card, index) => {
    const playable = game.phase === 'playing' && game.activePlayer === 'player' && mana.current >= card.cost;
    const disabled = game.phase !== 'playing' || game.activePlayer !== 'player';
    return `
      <button class="iw-card ${playable ? 'playable' : ''}" data-card-index="${index}" ${disabled ? 'disabled' : ''}>
        <span class="iw-card-cost">${card.cost}</span>
        <span class="iw-card-emoji">${cardEmoji(card)}</span>
        <strong>${card.name}</strong>
        <small>${card.text}</small>
      </button>
    `;
  }).join('') || '<div class="iw-empty-hand">No cards in hand</div>';
}

function renderOverlay(){
  const game = ensureState();
  if(game.phase === 'playing') return '';
  const won = game.phase === 'won';
  return `
    <div class="iw-overlay" role="dialog" aria-modal="true" aria-labelledby="iw-end-title">
      <div class="iw-overlay-card ${won ? 'won' : 'lost'}">
        <div id="iw-end-title" class="iw-overlay-title">${won ? 'You won! Max defeated Dark Funnel PM.' : 'You lost. Dark Funnel PM wins this funnel.'}</div>
        <button class="iw-primary" data-action="new-game">New Game</button>
      </div>
    </div>
  `;
}

export function renderInsightWars(){
  const root = byId(rootId);
  if(!root) return;
  const game = ensureState();
  const activeMana = manaFor(game, game.activePlayer);
  const isPlayerTurn = game.phase === 'playing' && game.activePlayer === 'player';
  root.innerHTML = `
    <section class="iw-shell ${game.phase !== 'playing' ? 'game-over' : ''}">
      <div class="iw-topline">
        <div>
          <div class="iw-kicker">Single-player card prototype</div>
          <h2>Insight <span>Wars</span></h2>
        </div>
        <div class="iw-actions">
          <button class="iw-secondary" data-action="new-game">New Game</button>
          <button class="iw-primary" data-action="end-turn" ${isPlayerTurn ? '' : 'disabled'}>End Turn</button>
        </div>
      </div>

      <div class="iw-statusbar">
        ${renderHpPill('player')}
        ${renderHpPill('ai')}
        <div class="iw-status-item">Turn <strong>${game.turn}</strong></div>
        <div class="iw-status-item">Active: <strong>${game.activePlayer === 'player' ? 'Player' : 'AI'}</strong></div>
        <div class="iw-status-item">Mana/events: <strong>${activeMana.current}/${activeMana.max}</strong></div>
        <div>AI hand: <strong>${visibleAiHand(game)}</strong></div>
      </div>

      <div class="iw-battlefield">
        <div class="iw-side iw-side-ai">
          ${renderHero('ai')}
          <div class="iw-board" data-board="ai">${renderBoard('ai')}</div>
        </div>

        <div class="iw-vs">VS</div>

        <div class="iw-side iw-side-player">
          <div class="iw-board" data-board="player">${renderBoard('player')}</div>
          ${renderHero('player')}
        </div>
      </div>

      <div class="iw-hand-wrap">
        <div class="iw-section-title">Your hand</div>
        <div class="iw-hand">${renderHand()}</div>
      </div>

      <details class="iw-log">
        <summary>Battle log</summary>
        <ol>${game.log.slice(-8).map((entry) => `<li>${entry}</li>`).join('')}</ol>
      </details>

      <div id="iw-toast" class="iw-toast" aria-live="polite"></div>
      ${renderOverlay()}
    </section>
  `;
}

function takeAiTurn(){
  if(!state || state.phase !== 'playing' || state.activePlayer !== 'ai') return;
  // Foundation-only AI: later hoglets will replace this with greedy card play and attacks.
  showToast('AI is thinking… and ends its turn.');
  endTurn(state);
  startTurn(state);
  selectedMinionId = null;
  renderInsightWars();
}

function handleEndTurn(){
  const game = ensureState();
  if(game.phase !== 'playing' || game.activePlayer !== 'player') return;
  selectedMinionId = null;
  endTurn(game);
  startTurn(game);
  renderInsightWars();
  if(game.phase === 'playing' && game.activePlayer === 'ai'){
    window.setTimeout(takeAiTurn, 350);
  }
}

function handleClick(event){
  const root = byId(rootId);
  if(!root || !root.contains(event.target)) return;
  const button = event.target.closest('button');
  if(!button) return;
  const game = ensureState();

  const action = button.dataset.action;
  if(action === 'new-game'){
    state = createInitialState();
    selectedMinionId = null;
    renderInsightWars();
    return;
  }

  if(game.phase !== 'playing'){
    return;
  }

  if(action === 'end-turn'){
    handleEndTurn();
    return;
  }

  if(button.dataset.cardIndex !== undefined){
    const card = game.hands.player[Number(button.dataset.cardIndex)];
    if(!card) return;
    const result = resolveCard(game, card, 'player');
    selectedMinionId = null;
    renderInsightWars();
    if(!result.ok) showToast(result.reason || 'Could not play card.');
    return;
  }

  const owner = button.dataset.owner;
  const minionId = button.dataset.minionId;
  if(minionId && owner === 'player'){
    const minion = game.boards.player.find((candidate) => candidate.id === minionId);
    if(!minion) return;
    if(!canMinionAttack(game, minion)){
      showToast('That minion cannot attack this turn.');
      return;
    }
    selectedMinionId = selectedMinionId === minionId ? null : minionId;
    renderInsightWars();
    return;
  }

  if(selectedMinionId && owner === 'ai'){
    const target = minionId
      ? { type: 'minion', owner: 'ai', minionId }
      : { type: 'hero', owner: 'ai' };
    const result = attackTarget(game, selectedMinionId, target);
    selectedMinionId = null;
    renderInsightWars();
    if(!result.ok) showToast(result.reason || 'Attack failed.');
  }
}

export function initInsightWars(){
  state = createInitialState();
  selectedMinionId = null;
  renderInsightWars();
}

export function cleanupInsightWars(){
  selectedMinionId = null;
}

function wireTab(){
  const tabButton = byId('tab-btn-insight-wars');
  if(tabButton){
    tabButton.addEventListener('click', function(){
      switchTab('insight-wars', this);
      window.location.hash = 'insight-wars';
    });
  }

  document.addEventListener('click', handleClick);

  if(window.registerGame){
    window.registerGame('insight-wars', {
      init: initInsightWars,
      cleanup: cleanupInsightWars,
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    if(window.location.hash === '#insight-wars' && tabButton){
      tabButton.click();
    }
  });
}

wireTab();
