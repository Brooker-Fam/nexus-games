import { createInitialState, endTurn, playCard } from '../engine/index.js';
import { renderHeroPanel } from './HeroPanel.js';
import { renderManaBar } from './ManaBar.js';
import { renderEndTurnButton } from './EndTurnButton.js';
import { renderHandView } from './HandView.js';
import { renderBoardView } from './BoardView.js';

export function mountInsightWarsGame(root){
  let state = createInitialState();
  let aiTimer = null;

  function setState(nextState){
    state = nextState;
    render();
  }

  function newGame(){
    if(aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    setState(createInitialState());
  }

  function endCurrentTurn(){
    setState(endTurn(state));
  }

  function playPlayerCard(cardId){
    setState(playCard(state, 'player', cardId));
  }

  function maybeRunAiPlaceholder(){
    if(aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if(state.activePlayer !== 'ai') return;

    // TODO(next-hoglet): Replace this one-line placeholder with a real AI controller.
    aiTimer = setTimeout(() => setState(endTurn(state)), 450);
  }

  function render(){
    const activeLabel = state.activePlayer === 'player' ? 'Player turn' : 'AI placeholder turn';
    root.innerHTML = `
      <div class="iw-shell">
        <div class="iw-title-wrap">
          <div class="iw-pre">SINGLE PLAYER CARD DUEL</div>
          <div class="game-title">INSIGHT <span>WARS</span></div>
          <div class="iw-sub">Foundation scaffold: engine, deck, turn flow, and route entry only.</div>
        </div>

        <div class="iw-topbar">
          <button class="overlay-btn iw-new-game" id="iw-new-game">⟳ New Game</button>
          <div class="iw-status">${activeLabel} · Turn ${state.turnNumber}</div>
          ${renderEndTurnButton(state.activePlayer !== 'player')}
        </div>

        <div class="iw-hero-grid">
          ${renderHeroPanel('AI Hero', state.players.ai.hero, 'iw-ai')}
          <div class="iw-center-panel">
            ${renderManaBar(state.players.player)}
            <div class="iw-ai-note">AI does nothing yet and auto-ends its turn. TODO(next-hoglet): implement AI.</div>
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

    maybeRunAiPlaceholder();
  }

  render();

  return function cleanup(){
    if(aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
  };
}
