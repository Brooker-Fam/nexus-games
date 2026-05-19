function cardLabel(card){
  const typeIcon = card.type === 'minion' ? '🛡️' : '✨';
  const stats = card.minionStats ? ` · ${card.minionStats.attack}/${card.minionStats.hp}` : '';
  return `${typeIcon} ${card.name} · ${card.cost} event${card.cost === 1 ? '' : 's'}${stats}`;
}

export function renderHandView({ state, onPlayCard }){
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
    button.className = 'iw-card';
    button.textContent = cardLabel(card);
    button.disabled = state.activePlayer !== 'player' || playerState.mana < card.cost;
    button.title = state.activePlayer === 'player'
      ? 'Play this placeholder card'
      : 'Cards can only be played on the player turn';
    button.addEventListener('click', () => onPlayCard(card.id));
    list.appendChild(button);
  }

  return wrap;
}
