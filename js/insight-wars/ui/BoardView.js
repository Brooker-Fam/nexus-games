function renderMinions(minions){
  if(minions.length === 0) return '<div class="iw-empty">Empty board</div>';
  return minions.map((minion) => `
    <div class="iw-minion">
      <strong>🛡️ ${minion.name}</strong>
      <span>${minion.attack}/${minion.hp}</span>
      ${minion.summoningSick ? '<em>Summoning sick</em>' : '<em>Ready</em>'}
    </div>
  `).join('');
}

export function renderBoardView(state){
  return `
    <section class="iw-board-grid">
      <div class="panel iw-board-panel">
        <div class="panel-title">▸ AI Board</div>
        <div class="iw-board-row">${renderMinions(state.players.ai.board)}</div>
      </div>
      <div class="panel iw-board-panel">
        <div class="panel-title">▸ Player Board</div>
        <div class="iw-board-row">${renderMinions(state.players.player.board)}</div>
      </div>
    </section>
  `;
}
