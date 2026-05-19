export function renderManaBar(playerState){
  const pips = Array.from({ length: playerState.maxMana }, (_, index) => (
    `<span class="iw-mana-pip${index < playerState.mana ? ' active' : ''}" aria-hidden="true"></span>`
  )).join('');

  return `
    <section class="iw-mana" aria-label="Events mana">
      <div class="iw-mana-top">
        <span>⚡ Events</span>
        <strong>${playerState.mana}/${playerState.maxMana}</strong>
      </div>
      <div class="iw-mana-pips">${pips}</div>
    </section>
  `;
}
