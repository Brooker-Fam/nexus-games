export function renderEndTurnButton(disabled = false){
  return `
    <button class="iw-end-turn" id="iw-end-turn" ${disabled ? 'disabled' : ''}>
      End Turn ▸
    </button>
  `;
}
