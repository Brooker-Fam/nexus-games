import { createInitialState, endTurn, playCard } from '../engine/index.js';
import { renderHeroPanel } from './HeroPanel.js';
import { renderManaBar } from './ManaBar.js';
import { renderEndTurnButton } from './EndTurnButton.js';
import { renderHandView } from './HandView.js';
import { renderBoardView } from './BoardView.js';

export function mountInsightWarsGame(root){
  let state = createInitialState();

  function setState(nextState){
    state = nextState;
    render();
  }

  function newGame(){
    setState(createInitialState());
  }

  function endCurrentTurn(){
    setState(endTurn(state));
  }

  function playPlayerCard(cardId){
    setState(playCard(state, 'player', cardId));
  }

  function render(){
    const activeLabel = state.status === 'ended'
      ? `${state.winner === 'draw' ? 'Draw' : `${state.winner === 'player' ? 'Player' : 'AI'} wins`}`
      : (state.activePlayer === 'player' ? 'Player turn' : 'AI turn');
    root.innerHTML = `
      <div class="iw-shell">
        <div class="iw-title-wrap">
          <div class="iw-pre">SINGLE PLAYER CARD DUEL</div>
          <div class="game-title">INSIGHT <span>WARS</span></div>
          <div class="iw-sub">Duel the greedy Dark Funnel PM before the roadmap consumes all events.</div>
        </div>

        <div class="iw-topbar">
          <button class="overlay-btn iw-new-game" id="iw-new-game">⟳ New Game</button>
          <div class="iw-status">${activeLabel} · Turn ${state.turnNumber}</div>
          ${renderEndTurnButton(state.activePlayer !== 'player' || state.status === 'ended')}
        </div>

        <div class="iw-hero-grid">
          ${renderHeroPanel('AI Hero', state.players.ai.hero, 'iw-ai')}
          <div class="iw-center-panel">
            ${renderManaBar(state.players.player)}
            <div class="iw-ai-note">Dark Funnel PM greedily plays the priciest affordable cards, then sends every ready minion face.</div>
          </div>
          ${renderHeroPanel('Player Hero', state.players.player.hero, 'iw-player')}
        </div>

        ${renderBoardView(state)}
        <div id="iw-hand-slot"></div>

        <section class="panel iw-log-panel">
          <div class="panel-title">▸ Battle Log</div>
          <div class="iw-log">${state.log.slice(-5).map((line) => `<div>${line}</div>`).join('')}</div>
        </section>
      </div>
    `;

    root.querySelector('#iw-new-game').addEventListener('click', newGame);
    root.querySelector('#iw-end-turn').addEventListener('click', endCurrentTurn);
    root.querySelector('#iw-hand-slot').appendChild(renderHandView({ state, onPlayCard: playPlayerCard }));
  }

  render();

  return function cleanup(){
    state = null;
  };
}
