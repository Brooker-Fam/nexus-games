import {
  attackWithMinion,
  canMinionAttack,
  cardRequiresTarget,
  createInitialState,
  endTurn,
  isValidCardTarget,
  playCard,
} from '../engine/index.js';
import { renderHeroPanel } from './HeroPanel.js';
import { renderManaBar } from './ManaBar.js';
import { renderEndTurnButton } from './EndTurnButton.js';
import { renderHandView } from './HandView.js';
import { renderBoardView } from './BoardView.js';

export function mountInsightWarsGame(root){
  let state = createInitialState();
  let pendingCardId = null;
  let selectedAttackerId = null;

  function isGameOver(){
    return state.status === 'ended' || Boolean(state.winner);
  }

  function setState(nextState){
    state = nextState;
    render();
  }

  function newGame(){
    pendingCardId = null;
    selectedAttackerId = null;
    if(location.pathname !== '/insight-wars') history.pushState({ game: 'insight-wars' }, '', '/insight-wars');
    setState(createInitialState());
  }

  function endCurrentTurn(){
    if(isGameOver()) return;
    pendingCardId = null;
    selectedAttackerId = null;
    setState(endTurn(state));
  }

  function getPendingCard(){
    if(!pendingCardId) return null;
    return state.players.player.hand.find((card) => card.id === pendingCardId) || null;
  }

  function playPlayerCard(cardId){
    if(isGameOver()) return;

    const card = state.players.player.hand.find((handCard) => handCard.id === cardId);
    if(!card) return;

    selectedAttackerId = null;
    if(cardRequiresTarget(card)){
      pendingCardId = pendingCardId === cardId ? null : cardId;
      render();
      return;
    }

    pendingCardId = null;
    setState(playCard(state, 'player', cardId));
  }

  function chooseTarget(target){
    if(isGameOver()) return;

    const pendingCard = getPendingCard();
    if(pendingCard){
      if(!isValidCardTarget(state, 'player', pendingCard, target)) return;
      pendingCardId = null;
      selectedAttackerId = null;
      setState(playCard(state, 'player', pendingCard.id, target));
      return;
    }

    if(!selectedAttackerId) return;
    const nextState = attackWithMinion(state, 'player', selectedAttackerId, target);
    selectedAttackerId = null;
    setState(nextState);
  }

  function chooseAttacker(minionId){
    if(isGameOver()) return;
    if(state.activePlayer !== 'player') return;
    const minion = state.players.player.board.find((boardMinion) => boardMinion.id === minionId);
    if(!minion || !canMinionAttack(state, 'player', minion)) return;

    pendingCardId = null;
    selectedAttackerId = selectedAttackerId === minionId ? null : minionId;
    render();
  }

  function aiHandRevealMarkup(){
    if(!state.revealedHands?.ai) return '';
    const cards = state.players.ai.hand.length > 0
      ? state.players.ai.hand.map((card) => `<span class="iw-revealed-card">${card.name}</span>`).join('')
      : '<span class="iw-empty">AI hand is empty.</span>';
    return `<div class="iw-revealed-hand"><strong>Session Replay:</strong> ${cards}</div>`;
  }

  function attachTargetHandlers(){
    if(isGameOver()) return;

    root.querySelectorAll('[data-iw-hero-owner]').forEach((hero) => {
      hero.addEventListener('click', () => {
        chooseTarget({ type: 'hero', player: hero.dataset.iwHeroOwner });
      });
    });

    root.querySelectorAll('[data-iw-minion-id]').forEach((minionEl) => {
      minionEl.addEventListener('click', () => {
        const owner = minionEl.dataset.iwOwner;
        const minionId = minionEl.dataset.iwMinionId;
        if(owner === 'player' && !pendingCardId){
          chooseAttacker(minionId);
          return;
        }
        chooseTarget({ type: 'minion', player: owner, minionId });
      });
    });
  }

  function gameOverOverlayMarkup(){
    if(!isGameOver()) return '';

    const isPlayerWin = state.winner === 'player';
    const isDraw = state.winner === 'draw';
    return `
      <div class="iw-game-over" role="dialog" aria-modal="true" aria-labelledby="iw-game-over-title">
        <div class="iw-game-over-card">
          <div class="iw-pre">${isPlayerWin ? 'INSIGHTS LANDED' : isDraw ? 'STALEMATE' : 'FUNNEL COLLAPSED'}</div>
          <h2 id="iw-game-over-title" class="${isPlayerWin ? 'win' : 'lose'}">${isPlayerWin ? 'You Win!' : isDraw ? 'Draw' : 'You Lose'}</h2>
          <p>${isPlayerWin ? 'Your product intuition beat the Dark Funnel PM.' : isDraw ? 'Both roadmaps ran out of signal.' : 'The Dark Funnel PM out-optimized your roadmap.'}</p>
          <button class="overlay-btn iw-game-over-new-game" id="iw-game-over-new-game">⟳ New Game</button>
        </div>
      </div>
    `;
  }

  function render(){
    const gameOver = isGameOver();
    const activeLabel = gameOver
      ? state.winner === 'player' ? 'Game over · Player victory' : state.winner === 'draw' ? 'Game over · Draw' : 'Game over · AI victory'
      : state.activePlayer === 'player' ? 'Player turn' : 'AI turn';
    const pendingCard = getPendingCard();
    const prompt = gameOver
      ? 'Game over. Start a new game to play again.'
      : pendingCard
      ? `${pendingCard.name}: choose ${pendingCard.definitionKey === 'feature-flag' ? 'an enemy minion to disable' : 'a minion or hero to damage'}.`
      : selectedAttackerId
        ? 'Choose an enemy minion or the AI hero to attack.'
        : 'Click a ready player minion to attack, or play a card. Dark Funnel PM responds greedily when you end turn.';

    root.innerHTML = `
      <div class="iw-shell${gameOver ? ' is-game-over' : ''}">
        <div class="iw-title-wrap">
          <div class="iw-pre">SINGLE PLAYER CARD DUEL</div>
          <div class="game-title">INSIGHT <span>WARS</span></div>
          <div class="iw-sub">Duel the greedy Dark Funnel PM with PostHog-inspired spells and minions.</div>
        </div>

        <div class="iw-topbar">
          <button class="overlay-btn iw-new-game" id="iw-new-game">⟳ New Game</button>
          <div class="iw-status">${activeLabel} · Turn ${state.turnNumber}</div>
          ${renderEndTurnButton(gameOver || state.activePlayer !== 'player')}
        </div>

        <div class="iw-hero-grid">
          ${renderHeroPanel('AI Hero', state.players.ai.hero, 'iw-ai', 'ai', gameOver)}
          <div class="iw-center-panel">
            ${renderManaBar(state.players.player)}
            <div class="iw-ai-note">${prompt}</div>
            ${aiHandRevealMarkup()}
          </div>
          ${renderHeroPanel('Player Hero', state.players.player.hero, 'iw-player', 'player', gameOver)}
        </div>

        ${renderBoardView(state, { selectedAttackerId })}
        <div id="iw-hand-slot"></div>

        <section class="panel iw-log-panel">
          <div class="panel-title">▸ Battle Log</div>
          <div class="iw-log">${state.log.slice(-5).map((line) => `<div>${line}</div>`).join('')}</div>
        </section>
        ${gameOverOverlayMarkup()}
      </div>
    `;

    root.querySelector('#iw-new-game').addEventListener('click', newGame);
    root.querySelector('#iw-end-turn').addEventListener('click', endCurrentTurn);
    root.querySelector('#iw-game-over-new-game')?.addEventListener('click', newGame);
    root.querySelector('#iw-hand-slot').appendChild(renderHandView({ state, onPlayCard: playPlayerCard, pendingCardId }));
    attachTargetHandlers();
  }

  render();

  return function cleanup(){
    state = null;
  };
}
