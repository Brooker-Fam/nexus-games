export function renderHeroPanel(label, hero, extraClass = ''){
  return `
    <section class="iw-hero ${extraClass}">
      <div class="iw-panel-label">${label}</div>
      <div class="iw-hero-row"><span>❤️ HP</span><strong>${hero.hp}/${hero.maxHp}</strong></div>
    </section>
  `;
}
