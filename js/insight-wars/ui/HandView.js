import { cardRequiresTarget } from '../engine/index.js';

function cardIcon(card){
  return card.type === 'minion' ? '🐹' : '✨';
}

function cardStats(card){
  return card.minionStats ? `<span class="iw-card-stats">${card.minionStats.attack}/${card.minionStats.hp}</span>` : '';
}

function cardMarkup(card){
  return `
    <span class="iw-card-header">
      <span class="iw-card-name">${cardIcon(card)} ${card.name}</span>
      <span class="iw-card-cost">${card.cost}⚡</span>
    </span>
    <span class="iw-card-meta">
      <span>${card.type === 'minion' ? 'Minion' : 'Spell'}</span>
      ${cardStats(card)}
    </span>
    <span class="iw-card-effect">${card.effectText || 'No effect text.'}</span>
  `;
}

export function renderHandView({ state, onPlayCard, pendingCardId }){
  const wrap = document.createElement('section');
  wrap.className = 'iw-hand panel';
  wrap.innerHTML = `
    <div class="panel-title">▸ Player Hand</div>
    <div class="iw-hand-list"></div>
  `;

  const list = wrap.querySelector('.iw-hand-list');
  const playerState = state.players.player;
  if(playerState.hand.length === 0){
    list.innerHTML = '<div class="iw-empty">No cards in hand.</div>';
    return wrap;
  }

  for(const card of playerState.hand){
    const button = document.createElement('button');
    button.className = `iw-card${pendingCardId === card.id ? ' selected' : ''}`;
    button.innerHTML = cardMarkup(card);
    button.disabled = state.status === 'ended' || Boolean(state.winner) || state.activePlayer !== 'player' || playerState.mana < card.cost;
    button.title = state.activePlayer === 'player' && state.status !== 'ended'
      ? cardRequiresTarget(card) ? 'Play this card, then choose a glowing target' : 'Play this card'
      : 'Cards can only be played on the player turn';
    button.addEventListener('click', () => onPlayCard(card.id));
    list.appendChild(button);
  }

  return wrap;
}
