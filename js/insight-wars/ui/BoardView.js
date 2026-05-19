function minionStatus(minion){
  if(minion.disabled || minion.disabledUntilTurn) return 'Feature flagged';
  if(minion.summoningSick) return 'Summoning sick';
  if(minion.hasAttacked || minion.attackedThisTurn) return 'Attacked';
  return 'Ready';
}

function renderMinions(minions, selectedAttackerId, disabled = false){
  if(minions.length === 0) return '<div class="iw-empty">Empty board</div>';
  return minions.map((minion) => `
    <button class="iw-minion${selectedAttackerId === minion.id ? ' selected' : ''}" data-iw-minion-id="${minion.id}" data-iw-owner="${minion.owner}" ${disabled ? 'disabled' : ''}>
      <strong>🛡️ ${minion.name}</strong>
      <span>${minion.attack}/${minion.hp}</span>
      <em>${minionStatus(minion)}</em>
    </button>
  `).join('');
}

export function renderBoardView(state, options = {}){
  const { selectedAttackerId = null } = options;
  const disabled = state.status === 'ended' || Boolean(state.winner);
  return `
    <section class="iw-board-grid">
      <div class="panel iw-board-panel iw-ai-board-panel">
        <div class="panel-title">▸ AI Board</div>
        <div class="iw-board-row">${renderMinions(state.players.ai.board, selectedAttackerId, disabled)}</div>
      </div>
      <div class="panel iw-board-panel iw-player-board-panel">
        <div class="panel-title">▸ Player Board</div>
        <div class="iw-board-row">${renderMinions(state.players.player.board, selectedAttackerId, disabled)}</div>
      </div>
    </section>
  `;
}
