export function renderHeroPanel(label, hero, extraClass = '', owner = ''){
  return `
    <button class="iw-hero ${extraClass}" ${owner ? `data-iw-hero-owner="${owner}"` : ''}>
      <div class="iw-panel-label">${label}</div>
      <div class="iw-hero-row"><span>❤️ HP</span><strong>${hero.hp}/${hero.maxHp}</strong></div>
    </button>
  `;
}
