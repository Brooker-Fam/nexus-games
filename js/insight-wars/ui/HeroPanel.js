export function renderHeroPanel(label, hero, extraClass = '', owner = '', disabled = false){
  return `
    <button class="iw-hero ${extraClass}" ${owner ? `data-iw-hero-owner="${owner}"` : ''} ${disabled ? 'disabled' : ''}>
      <div class="iw-panel-label">${label}</div>
      <div class="iw-hero-row"><span>❤️ HP</span><strong>${hero.hp}/${hero.maxHp}</strong></div>
    </button>
  `;
}
