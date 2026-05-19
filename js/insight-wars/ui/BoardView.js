function renderMinions(minions, selectedAttackerId){
  if(minions.length === 0) return '<div class="iw-empty">Empty board</div>';
  return minions.map((minion) => `
    <button class="iw-minion${selectedAttackerId === minion.id ? ' selected' : ''}" data-iw-minion-id="${minion.id}" data-iw-owner="${minion.owner}">
      <strong>🛡️ ${minion.name}</strong>
      <span>${minion.attack}/${minion.hp}</span>
      ${minion.disabled ? '<em>Disabled</em>' : minion.summoningSick ? '<em>Summoning sick</em>' : minion.hasAttacked ? '<em>Attacked</em>' : '<em>Ready</em>'}
    </button>
  `).join('');
}

export function renderBoardView(state, options = {}){
  const { selectedAttackerId = null } = options;
  return `
    <section class="iw-board-grid">
      <div class="panel iw-board-panel">
        <div class="panel-title">▸ AI Board</div>
        <div class="iw-board-row">${renderMinions(state.players.ai.board, selectedAttackerId)}</div>
      </div>
      <div class="panel iw-board-panel">
        <div class="panel-title">▸ Player Board</div>
        <div class="iw-board-row">${renderMinions(state.players.player.board, selectedAttackerId)}</div>
      </div>
    </section>
  `;
}
