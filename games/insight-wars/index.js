const INSIGHT_WARS_STYLE_ID = 'insight-wars-stylesheet';
const INSIGHT_WARS_STYLE_HREF = 'games/insight-wars/styles.css';

export function buildInsightWarsMarkup() {
  return `
    <section class="insight-wars-shell" aria-labelledby="insight-wars-title">
      <div class="insight-wars-hero">
        <p class="insight-wars-kicker">✦ SINGLE-PLAYER CARD DUEL · SCAFFOLD ✦</p>
        <h1 id="insight-wars-title" class="insight-wars-title">Insight Wars</h1>
        <p class="insight-wars-copy">
          Draft sharp insights, outmaneuver the muted AI front, and prepare for a turn-based card battle.
          Game rules, card resolution, and AI arrive in later stacked PRs.
        </p>
        <button class="insight-wars-new-game" type="button" data-insight-wars-new-game>
          New Game
        </button>
      </div>

      <div class="insight-wars-preview" aria-label="Placeholder battlefield preview">
        <div class="insight-wars-side insight-wars-side-player">
          <span class="insight-wars-side-label">Player</span>
          <strong>Orange / Yellow</strong>
          <span>Awaiting cards</span>
        </div>
        <div class="insight-wars-vs">VS</div>
        <div class="insight-wars-side insight-wars-side-ai">
          <span class="insight-wars-side-label">AI</span>
          <strong>Muted Grey</strong>
          <span>Logic TBD</span>
        </div>
      </div>
    </section>
  `;
}

export function ensureInsightWarsStyles(doc = document) {
  if (!doc || !doc.head || doc.getElementById(INSIGHT_WARS_STYLE_ID)) return;

  const link = doc.createElement('link');
  link.id = INSIGHT_WARS_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = INSIGHT_WARS_STYLE_HREF;
  doc.head.appendChild(link);
}

export function renderInsightWars(container, options = {}) {
  if (!container) {
    throw new Error('Insight Wars render target is required.');
  }

  const doc = options.document || container.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (doc) ensureInsightWarsStyles(doc);

  container.innerHTML = buildInsightWarsMarkup();

  const newGameButton = container.querySelector ? container.querySelector('[data-insight-wars-new-game]') : null;
  if (newGameButton && newGameButton.addEventListener) {
    newGameButton.addEventListener('click', () => {
      if (options.onNewGame) {
        options.onNewGame();
        return;
      }

      if (typeof console !== 'undefined' && console.info) {
        console.info('Insight Wars: New Game placeholder clicked.');
      }
    });
  }

  return container;
}

export function mountInsightWarsRoute(doc = document, win = window) {
  const container = doc.getElementById('tab-insight-wars');
  renderInsightWars(container, { document: doc });

  if (win.registerGame) {
    win.registerGame('insight-wars', {
      init() {},
      cleanup() {},
    });
  }

  const tabButton = doc.getElementById('tab-btn-insight-wars');
  if (tabButton && tabButton.addEventListener) {
    tabButton.addEventListener('click', function handleInsightWarsTabClick() {
      if (win.switchTab) {
        win.switchTab('insight-wars', this);
      }
    });
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  mountInsightWarsRoute(document, window);
}
