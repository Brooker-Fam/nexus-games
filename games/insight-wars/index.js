import {
  attack,
  createInitialGameState,
  endTurn,
  playCard,
} from './game-state.js';

const INSIGHT_WARS_STYLE_ID = 'insight-wars-stylesheet';
const INSIGHT_WARS_STYLE_HREF = 'games/insight-wars/styles.css';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssModifier(value) {
  return escapeHtml(String(value ?? '').replace(/[^a-z0-9-]/gi, '-').toLowerCase());
}

function getWinnerCopy(state) {
  if (state.gameOver === 'win' || state.ai.hp <= 0) {
    return {
      title: 'You Win!',
      subtitle: 'Max turned scattered product signals into one decisive insight.',
    };
  }

  if (state.gameOver === 'lose' || state.player.hp <= 0) {
    return {
      title: 'You Lose',
      subtitle: 'The Dark Funnel PM buried the roadmap in vanity metrics.',
    };
  }

  return {
    title: '',
    subtitle: '',
  };
}

function isGameOver(state) {
  return Boolean(state.gameOver) || state.player.hp <= 0 || state.ai.hp <= 0;
}

function renderHeroPanel(hero, side, state) {
  const isPlayer = side === 'player';
  const manaMarkup = isPlayer && hero.mana
    ? `<div class="insight-wars-counter insight-wars-mana" aria-label="Mana ${hero.mana.current} of ${hero.mana.max}">
        <span class="insight-wars-counter-label">Events</span>
        <strong>${hero.mana.current}/${hero.mana.max}</strong>
      </div>`
    : '';
  const active = state.activePlayer === side && !isGameOver(state);

  return `
    <article class="insight-wars-hero-panel insight-wars-hero-${side}${active ? ' is-active' : ''}" aria-label="${escapeHtml(hero.name)} hero panel">
      <div class="insight-wars-hero-avatar" aria-hidden="true">${escapeHtml(hero.emoji)}</div>
      <div class="insight-wars-hero-copy">
        <span class="insight-wars-side-label">${isPlayer ? 'Player' : 'AI'}</span>
        <h2>${escapeHtml(hero.name)}</h2>
      </div>
      <div class="insight-wars-hero-counters">
        <div class="insight-wars-counter insight-wars-hp" aria-label="Health ${hero.hp}">
          <span class="insight-wars-counter-label">HP</span>
          <strong>${hero.hp}</strong>
        </div>
        ${manaMarkup}
      </div>
    </article>
  `;
}

function renderMinion(minion, side, selectedMinionId) {
  const ready = !minion.hasSummoningSickness;
  const selected = selectedMinionId === minion.id;
  const classes = [
    'insight-wars-minion',
    `insight-wars-minion-${side}`,
    ready ? 'is-ready' : 'is-sleeping',
    selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');

  return `
    <button
      class="${classes}"
      type="button"
      data-insight-wars-action="select-minion"
      data-minion-id="${escapeHtml(minion.id)}"
      aria-pressed="${selected ? 'true' : 'false'}"
      aria-label="${escapeHtml(minion.name)}, ${minion.attack} attack, ${minion.hp} health${ready ? ', ready to attack' : ', summoning sickness'}"
    >
      <span class="insight-wars-minion-emoji" aria-hidden="true">${escapeHtml(minion.emoji)}</span>
      <strong>${escapeHtml(minion.name)}</strong>
      <span class="insight-wars-minion-status">${ready ? 'Ready' : '💤 Summoning'}</span>
      <span class="insight-wars-statline" aria-label="${minion.attack} attack ${minion.hp} health">
        <span>${minion.attack}</span><span>${minion.hp}</span>
      </span>
    </button>
  `;
}

function renderMinionRow(minions, side, selectedMinionId) {
  const label = side === 'ai' ? 'AI minions' : 'Player minions';
  const emptyCopy = side === 'ai' ? 'Dark Funnel PM has no minions deployed.' : 'Max has no insights on board yet.';

  return `
    <section class="insight-wars-minion-row insight-wars-minion-row-${side}" aria-label="${label}">
      ${minions.length
        ? minions.map((minion) => renderMinion(minion, side, selectedMinionId)).join('')
        : `<div class="insight-wars-empty-zone">${emptyCopy}</div>`}
    </section>
  `;
}

function renderCard(card, selectedCardId) {
  const selected = selectedCardId === card.id;
  const cardType = card.type === 'minion' ? 'Minion' : 'Spell';
  const statline = card.type === 'minion'
    ? `<span class="insight-wars-card-stats" aria-label="${card.attack} attack ${card.hp} health"><span>${card.attack}</span><span>${card.hp}</span></span>`
    : '';

  return `
    <button
      class="insight-wars-card insight-wars-card-${cssModifier(card.type)}${selected ? ' is-selected' : ''}"
      type="button"
      data-insight-wars-action="select-card"
      data-card-id="${escapeHtml(card.id)}"
      aria-pressed="${selected ? 'true' : 'false'}"
      aria-label="${escapeHtml(card.name)}, ${card.cost} event cost, ${cardType}"
    >
      <span class="insight-wars-card-cost" aria-label="Cost ${card.cost}">${card.cost}</span>
      <span class="insight-wars-card-emoji" aria-hidden="true">${escapeHtml(card.emoji)}</span>
      <strong class="insight-wars-card-name">${escapeHtml(card.name)}</strong>
      <span class="insight-wars-card-type">${cardType}</span>
      <span class="insight-wars-card-effect">${escapeHtml(card.effectText)}</span>
      ${statline}
    </button>
  `;
}

function renderHand(cards, selectedCardId) {
  return `
    <section class="insight-wars-hand" aria-label="Player hand">
      <div class="insight-wars-hand-label">Hand</div>
      <div class="insight-wars-hand-row">
        ${cards.map((card) => renderCard(card, selectedCardId)).join('')}
      </div>
    </section>
  `;
}

function renderOverlay(state) {
  const visible = isGameOver(state);
  const copy = getWinnerCopy(state);

  return `
    <div class="insight-wars-result-overlay${visible ? ' is-visible' : ''}" ${visible ? '' : 'hidden'} role="dialog" aria-modal="true" aria-labelledby="insight-wars-result-title">
      <div class="insight-wars-result-card">
        <p class="insight-wars-kicker">Battle Complete</p>
        <h2 id="insight-wars-result-title">${escapeHtml(copy.title)}</h2>
        <p>${escapeHtml(copy.subtitle)}</p>
        <button class="insight-wars-new-game" type="button" data-insight-wars-action="new-game">
          New Game
        </button>
      </div>
    </div>
  `;
}

/**
 * Builds the complete Insight Wars UI as a string for smoke tests and vanilla rendering.
 *
 * @param {import('./game-state.js').GameState=} state
 * @param {{ selectedCardId?: string | null, selectedMinionId?: string | null }=} uiState
 * @returns {string}
 */
export function buildInsightWarsMarkup(state = createInitialGameState(), uiState = {}) {
  const selectedCardId = uiState.selectedCardId || null;
  const selectedMinionId = uiState.selectedMinionId || null;
  const ended = isGameOver(state);
  const isPlayerTurn = state.activePlayer === 'player' && !ended;
  const turnCopy = state.activePlayer === 'player' ? 'Your Turn' : 'AI Turn';

  return `
    <section class="insight-wars-shell" aria-labelledby="insight-wars-title" data-insight-wars-root>
      <div class="insight-wars-topbar">
        <div>
          <p class="insight-wars-kicker">✦ SINGLE-PLAYER CARD DUEL ✦</p>
          <h1 id="insight-wars-title" class="insight-wars-title">Insight Wars</h1>
        </div>
        <div class="insight-wars-actions">
          <div class="insight-wars-turn-pill insight-wars-turn-${state.activePlayer}" aria-live="polite">
            <span>Turn ${state.turn}</span>
            <strong>${turnCopy}</strong>
          </div>
          <button class="insight-wars-new-game" type="button" data-insight-wars-action="new-game">
            New Game
          </button>
        </div>
      </div>

      <div class="insight-wars-board-wrap">
        ${renderHeroPanel(state.ai, 'ai', state)}
        <div class="insight-wars-board" aria-label="Insight Wars board">
          ${renderMinionRow(state.aiBoard, 'ai', selectedMinionId)}
          <div class="insight-wars-battleline" aria-hidden="true">
            <span></span>
            <strong>Signal Lane</strong>
            <span></span>
          </div>
          ${renderMinionRow(state.playerBoard, 'player', selectedMinionId)}
        </div>

        <div class="insight-wars-command-row">
          <div class="insight-wars-selected-card" aria-live="polite">
            ${selectedCardId
              ? `Selected: <strong>${escapeHtml(state.playerHand.find((card) => card.id === selectedCardId)?.name || selectedCardId)}</strong>`
              : 'Select a card to inspect it.'}
          </div>
          <button
            class="insight-wars-end-turn"
            type="button"
            data-insight-wars-action="end-turn"
            ${isPlayerTurn ? '' : 'disabled'}
          >
            End Turn
          </button>
        </div>

        ${renderHeroPanel(state.player, 'player', state)}
        ${renderHand(state.playerHand, selectedCardId)}
        ${renderOverlay(state)}
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

/**
 * Renders the Insight Wars route and returns a tiny controller for tests/devtools.
 *
 * @param {HTMLElement} container
 * @param {{ document?: Document, initialState?: import('./game-state.js').GameState, onNewGame?: Function, onStateChange?: Function }=} options
 */
export function renderInsightWars(container, options = {}) {
  if (!container) {
    throw new Error('Insight Wars render target is required.');
  }

  const doc = options.document || container.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (doc) ensureInsightWarsStyles(doc);

  let state = options.initialState || createInitialGameState();
  let selectedCardId = null;
  let selectedMinionId = null;

  const rerender = () => {
    container.innerHTML = buildInsightWarsMarkup(state, { selectedCardId, selectedMinionId });
  };

  const notifyStateChange = () => {
    if (options.onStateChange) options.onStateChange(state);
  };

  const controller = {
    getState() {
      return state;
    },
    setState(nextState) {
      state = nextState;
      selectedCardId = null;
      selectedMinionId = null;
      rerender();
      notifyStateChange();
      return state;
    },
    newGame() {
      state = createInitialGameState();
      selectedCardId = null;
      selectedMinionId = null;
      rerender();
      if (options.onNewGame) options.onNewGame(state);
      notifyStateChange();
      return state;
    },
    destroy() {
      if (container.removeEventListener) {
        container.removeEventListener('click', handleClick);
      }
    },
  };

  function handleClick(event) {
    const target = event.target && event.target.closest
      ? event.target.closest('[data-insight-wars-action]')
      : null;
    if (!target || !container.contains(target)) return;

    const action = target.dataset.insightWarsAction;

    if (action === 'new-game') {
      controller.newGame();
      return;
    }

    if (isGameOver(state)) return;

    if (action === 'select-card') {
      selectedCardId = target.dataset.cardId;
      selectedMinionId = null;
      state = playCard(state, selectedCardId);
      rerender();
      notifyStateChange();
      return;
    }

    if (action === 'select-minion') {
      selectedMinionId = target.dataset.minionId;
      selectedCardId = null;
      state = attack(state, selectedMinionId, state.ai.id);
      rerender();
      notifyStateChange();
      return;
    }

    if (action === 'end-turn' && state.activePlayer === 'player') {
      state = endTurn(state);
      selectedCardId = null;
      selectedMinionId = null;
      rerender();
      notifyStateChange();
    }
  }

  rerender();

  if (container.addEventListener) {
    container.addEventListener('click', handleClick);
  }

  return controller;
}

export function mountInsightWarsRoute(doc = document, win = window) {
  const container = doc.getElementById('tab-insight-wars');
  const controller = renderInsightWars(container, { document: doc });

  if (win) {
    win.insightWarsUi = controller;
  }

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

  return controller;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  mountInsightWarsRoute(document, window);
}
