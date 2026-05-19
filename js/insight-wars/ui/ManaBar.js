export function renderManaBar(playerState){
  return `
    <section class="iw-mana" aria-label="Events mana">
      <span>⚡ Events</span>
      <strong>${playerState.mana}/${playerState.maxMana}</strong>
    </section>
  `;
}
