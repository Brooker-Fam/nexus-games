import { newGame } from './turn-engine.js';
import { CARD_CATALOG } from './cards.js';

let foundationState = null;

function renderInsightWarsFoundation(){
  const root = document.getElementById('insight-wars-root');
  if(!root) return;
  foundationState = foundationState || newGame('browser-preview');
  root.innerHTML = `
    <div class="game-header">
      <div>
        <div class="game-title">INSIGHT <span>WARS</span></div>
      </div>
      <div class="game-stats">
        <div class="stat-box"><div class="stat-label">TURN</div><div class="stat-val cyan">${foundationState.turn}</div></div>
        <div class="stat-box"><div class="stat-label">PLAYER HP</div><div class="stat-val pink">${foundationState.player.hp}</div></div>
        <div class="stat-box"><div class="stat-label">CARDS</div><div class="stat-val gold">${CARD_CATALOG.length}</div></div>
      </div>
    </div>
    <div class="game-area">
      <div class="panel" style="width:100%;min-height:240px;display:flex;flex-direction:column;gap:14px;">
        <div class="panel-title">▸ FOUNDATION READY</div>
        <div>Core state, deck builder, card registry, and turn engine are loaded. Full UI and card effects are intentionally deferred.</div>
        <div><strong>Opening hand:</strong> ${foundationState.player.hand.map((card) => `${card.emoji} ${card.name}`).join(' · ')}</div>
      </div>
    </div>
  `;
}

if(window.registerGame){
  window.registerGame('insight-wars', {
    init(){
      renderInsightWarsFoundation();
    },
    cleanup(){},
  });
}

const tabButton = document.getElementById('tab-btn-insight-wars');
if(tabButton && window.switchTab){
  tabButton.addEventListener('click', function(){
    window.switchTab('insight-wars', this);
  });
}

window.InsightWarsFoundation = Object.freeze({
  newGame,
  get state(){ return foundationState; },
});
