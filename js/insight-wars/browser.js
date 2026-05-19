import { runAiTurn } from './ai.js';
import { endTurn, newGame, playCard, attackWithMinion, checkWinCondition } from './turn-engine.js';

const STYLE_ID = 'insight-wars-ui-styles';
const PLAYER_OWNER = 'player';
const AI_OWNER = 'ai';
const TARGETED_CARD_IDS = new Set(['feature-flag', 'heatmap']);

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./cards.js').Card} Card */

let browserController = null;

/**
 * Mounts the Insight Wars browser UI into a root element.
 *
 * The controller intentionally keeps all browser state here and delegates rules
 * to the engine/resolver modules. It can also be imported safely in Node tests.
 *
 * @param {HTMLElement | {innerHTML: string, addEventListener?: Function, removeEventListener?: Function, querySelector?: Function, ownerDocument?: Document}} root
 * @param {{state?: GameState, seed?: string | number, aiDelayMs?: number}} [options]
 * @returns {{render: () => void, newGame: () => void, unmount: () => void, readonly state: GameState}}
 */
export function mount(root, options = {}){
  if(!root) throw new Error('Insight Wars mount requires a root element.');

  ensureStyles(root.ownerDocument ?? getBrowserDocument());

  let state = options.state ?? newGame(options.seed ?? 'insight-wars-browser');
  let selectedAttackerId = null;
  let pendingCardTarget = null;
  let notice = 'Play cards, summon minions, and reduce the AI to 0 HP.';
  let aiPending = false;
  const aiDelayMs = options.aiDelayMs ?? 180;

  const controller = {
    get state(){ return state; },
    render,
    newGame: resetGame,
    unmount,
  };

  function render(){
    root.innerHTML = renderGame(state, {
      notice,
      selectedAttackerId,
      pendingCardTarget,
      aiPending,
    });
    scrollLogToBottom(root);
  }

  function resetGame(){
    state = newGame(`browser-${Date.now()}`);
    selectedAttackerId = null;
    pendingCardTarget = null;
    aiPending = false;
    notice = 'New game started. Player begins.';
    render();
  }

  /** @param {Event & {target?: Element}} event */
  function handleClick(event){
    const target = event.target?.closest?.('[data-iw-action]');
    if(!target) return;

    const action = target.getAttribute('data-iw-action');
    if(action !== 'new-game' && state.phase !== 'playing'){
      notice = 'The match is over. Start a New Game to keep playing.';
      render();
      return;
    }

    switch(action){
      case 'new-game':
        resetGame();
        break;
      case 'cancel-target':
        selectedAttackerId = null;
        pendingCardTarget = null;
        notice = 'Targeting cancelled.';
        render();
        break;
      case 'play-card':
        handlePlayCard(Number(target.getAttribute('data-card-index')));
        break;
      case 'select-attacker':
        handleSelectAttacker(String(target.getAttribute('data-minion-id')));
        break;
      case 'target-hero':
        handleHeroTarget();
        break;
      case 'target-minion':
        handleMinionTarget(String(target.getAttribute('data-minion-id')));
        break;
      case 'end-turn':
        handleEndTurn();
        break;
      default:
        break;
    }
  }

  /** @param {number} cardIndex */
  function handlePlayCard(cardIndex){
    if(!isPlayerActionAllowed()) return;
    if(pendingCardTarget || selectedAttackerId){
      notice = 'Choose a target or cancel before playing another card.';
      render();
      return;
    }

    const card = state.player.hand[cardIndex];
    if(!card){
      notice = 'That card is no longer in your hand.';
      render();
      return;
    }
    if(state.player.currentMana < card.cost){
      notice = `Not enough mana for ${card.name}.`;
      render();
      return;
    }

    if(shouldAskForTarget(card, state)){
      pendingCardTarget = { cardIndex, cardId: card.id, cardName: card.name };
      notice = targetPromptForCard(card);
      render();
      return;
    }

    applyGameAction(() => playCard(state, cardIndex), `${card.name} played.`);
  }

  /** @param {string} minionId */
  function handleSelectAttacker(minionId){
    if(!isPlayerActionAllowed()) return;
    if(pendingCardTarget){
      notice = 'Choose a card target or cancel targeting first.';
      render();
      return;
    }

    const minion = state.player.board.find((candidate) => candidate.id === minionId);
    if(!minion){
      notice = 'That minion is no longer on your board.';
      render();
      return;
    }
    if(!minion.canAttack){
      notice = `${minion.name} cannot attack yet.`;
      render();
      return;
    }

    selectedAttackerId = minion.id;
    notice = `${minion.name} selected. Click the AI hero or an AI minion to attack.`;
    render();
  }

  function handleHeroTarget(){
    if(!isPlayerActionAllowed()) return;

    if(pendingCardTarget){
      if(pendingCardTarget.cardId === 'feature-flag'){
        notice = 'Feature Flag must target an enemy minion.';
        render();
        return;
      }
      const pending = pendingCardTarget;
      pendingCardTarget = null;
      applyGameAction(
        () => playCard(state, pending.cardIndex, { type: 'hero', owner: AI_OWNER }),
        `${pending.cardName} targeted the AI hero.`
      );
      return;
    }

    if(selectedAttackerId){
      const attackerId = selectedAttackerId;
      selectedAttackerId = null;
      applyGameAction(
        () => attackWithMinion(state, attackerId, { type: 'hero', owner: AI_OWNER }),
        'Minion attacked the AI hero.'
      );
      return;
    }

    notice = 'Select one of your ready minions or a targeted card first.';
    render();
  }

  /** @param {string} minionId */
  function handleMinionTarget(minionId){
    if(!isPlayerActionAllowed()) return;

    if(pendingCardTarget){
      const pending = pendingCardTarget;
      pendingCardTarget = null;
      applyGameAction(
        () => playCard(state, pending.cardIndex, { type: 'minion', owner: AI_OWNER, id: minionId }),
        `${pending.cardName} targeted an AI minion.`
      );
      return;
    }

    if(selectedAttackerId){
      const attackerId = selectedAttackerId;
      selectedAttackerId = null;
      applyGameAction(
        () => attackWithMinion(state, attackerId, { type: 'minion', owner: AI_OWNER, id: minionId }),
        'Minion attacked an AI minion.'
      );
      return;
    }

    notice = 'Select one of your ready minions or a targeted card first.';
    render();
  }

  function handleEndTurn(){
    if(!isPlayerActionAllowed()) return;

    selectedAttackerId = null;
    pendingCardTarget = null;
    applyGameAction(() => endTurn(state), 'Turn ended. AI is taking its turn.', { renderNow: false });

    if(state.phase !== 'playing'){
      render();
      return;
    }

    aiPending = true;
    notice = 'AI is taking its turn...';
    render();

    const run = () => {
      if(state.phase !== 'playing' || state.activePlayer !== AI_OWNER){
        aiPending = false;
        render();
        return;
      }
      applyGameAction(() => runAiTurn(state), 'AI turn complete. Your turn.', { renderNow: false });
      aiPending = false;
      render();
    };

    const win = getBrowserWindow();
    if(win?.setTimeout){
      win.setTimeout(run, aiDelayMs);
    }else{
      run();
    }
  }

  function isPlayerActionAllowed(){
    if(state.phase !== 'playing'){
      notice = 'The match is over. Start a New Game to keep playing.';
      render();
      return false;
    }
    if(aiPending || state.activePlayer !== PLAYER_OWNER){
      notice = 'Wait for the AI turn to finish.';
      render();
      return false;
    }
    return true;
  }

  /**
   * @param {() => GameState} updater
   * @param {string} successNotice
   * @param {{renderNow?: boolean}} [config]
   */
  function applyGameAction(updater, successNotice, config = {}){
    try{
      state = checkWinCondition(updater());
      notice = latestLogLine(state) ?? successNotice;
    }catch(error){
      notice = error instanceof Error ? error.message : String(error);
    }

    if(state.phase === 'won') notice = 'Victory! The AI has been defeated.';
    if(state.phase === 'lost') notice = 'Defeat. Your insights ran out of HP.';

    if(config.renderNow !== false) render();
  }

  root.addEventListener?.('click', handleClick);
  render();

  function unmount(){
    root.removeEventListener?.('click', handleClick);
  }

  return controller;
}

export { mount as mountInsightWars };

/**
 * @param {GameState} state
 * @param {{notice: string, selectedAttackerId: string | null, pendingCardTarget: {cardId: string, cardName: string} | null, aiPending: boolean}} ui
 * @returns {string}
 */
export function renderGame(state, ui){
  const activeSide = state[state.activePlayer];
  const opponentSide = state[state.activePlayer === PLAYER_OWNER ? AI_OWNER : PLAYER_OWNER];
  const playerCanAct = state.phase === 'playing' && state.activePlayer === PLAYER_OWNER && !ui.aiPending;
  const overlay = state.phase === 'playing' ? '' : renderOverlay(state.phase);

  return `
    <div class="iw-shell" data-insight-wars-ui>
      <div class="game-header iw-header">
        <div>
          <div class="game-title iw-title">INSIGHT <span>WARS</span></div>
          <div class="iw-subtitle">Turn-based product strategy cards</div>
        </div>
        <div class="game-stats iw-stats">
          <div class="stat-box"><div class="stat-label">TURN</div><div class="stat-val cyan">${state.turn}</div></div>
          <div class="stat-box"><div class="stat-label">ACTIVE</div><div class="stat-val ${state.activePlayer === PLAYER_OWNER ? 'gold' : 'purple'}">${ownerLabel(state.activePlayer)}</div></div>
          <div class="stat-box"><div class="stat-label">MANA</div><div class="stat-val gold">${activeSide.currentMana}/${activeSide.maxMana}</div></div>
          <div class="stat-box"><div class="stat-label">ENEMY HP</div><div class="stat-val pink">${state.ai.hp}</div></div>
          <button class="iw-top-button" type="button" data-iw-action="new-game">⟳ NEW GAME</button>
        </div>
      </div>

      <div class="iw-layout">
        <div class="iw-battlefield">
          <section class="iw-side iw-side-ai" aria-label="AI side">
            <button class="iw-hero iw-hero-ai ${targetClassForHero(ui)}" type="button" data-iw-action="target-hero" ${targetTitleForHero(ui)}>
              <span class="iw-hero-label">AI HERO</span>
              <strong class="iw-hp">${state.ai.hp} HP</strong>
              <span class="iw-mana">Mana ${state.ai.currentMana}/${state.ai.maxMana}</span>
            </button>
            <div class="iw-ai-hand">${renderAiHand(state)}</div>
            <div class="iw-board iw-board-ai" aria-label="AI minions">
              ${renderBoard(state.ai.board, AI_OWNER, ui)}
            </div>
          </section>

          <div class="iw-status ${ui.pendingCardTarget || ui.selectedAttackerId ? 'iw-status-targeting' : ''}">
            <span>${escapeHtml(ui.notice)}</span>
            ${ui.pendingCardTarget || ui.selectedAttackerId ? '<button type="button" data-iw-action="cancel-target">CANCEL</button>' : ''}
          </div>

          <section class="iw-side iw-side-player" aria-label="Player side">
            <div class="iw-board iw-board-player" aria-label="Player minions">
              ${renderBoard(state.player.board, PLAYER_OWNER, ui)}
            </div>
            <div class="iw-player-row">
              <div class="iw-hero iw-hero-player">
                <span class="iw-hero-label">PLAYER HERO</span>
                <strong class="iw-hp">${state.player.hp} HP</strong>
                <span class="iw-mana">Mana ${state.player.currentMana}/${state.player.maxMana}</span>
              </div>
              <button class="iw-end-turn" type="button" data-iw-action="end-turn" ${playerCanAct ? '' : 'disabled'}>END TURN</button>
            </div>
          </section>
          ${overlay}
        </div>

        <aside class="iw-sidebar">
          <div class="panel iw-hand-panel">
            <div class="panel-title">▸ PLAYER HAND</div>
            <div class="iw-hand" aria-label="Player hand">
              ${renderHand(state.player.hand, state.player.currentMana, playerCanAct)}
            </div>
          </div>
          <div class="panel iw-log-panel">
            <div class="panel-title">▸ BATTLE LOG</div>
            <div class="iw-log" aria-live="polite">
              ${renderLog(state.log)}
            </div>
          </div>
          <div class="panel iw-rules-panel">
            <div class="panel-title">▸ QUICK RULES</div>
            <div class="iw-help">
              Cards spend active mana. Minions have summoning sickness, then ready at the start of your next turn. Click a ready minion, then an AI target.
            </div>
            <div class="iw-deck-counts">Decks: Player ${state.player.deck.length} · AI ${state.ai.deck.length}</div>
            <div class="iw-active-mana">Active side mana: ${ownerLabel(state.activePlayer)} ${activeSide.currentMana}/${activeSide.maxMana}</div>
            <div class="iw-opponent-mana">Other side mana: ${opponentSide.currentMana}/${opponentSide.maxMana}</div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

/** @param {Card} card @param {GameState} state */
function shouldAskForTarget(card, state){
  if(!TARGETED_CARD_IDS.has(card.id)) return false;
  if(card.id === 'feature-flag' && state.ai.board.length === 0) return false;
  return true;
}

/** @param {Card} card */
function targetPromptForCard(card){
  if(card.id === 'feature-flag') return 'Feature Flag selected. Click an AI minion to stun it.';
  if(card.id === 'heatmap') return 'Heatmap selected. Click the AI hero or an AI minion to deal 4 damage.';
  return `${card.name} selected. Choose a target.`;
}

/** @param {GameState['phase']} phase */
function renderOverlay(phase){
  const won = phase === 'won';
  return `
    <div class="iw-overlay" role="dialog" aria-modal="true" aria-label="${won ? 'Win' : 'Lose'} screen">
      <div class="iw-overlay-card">
        <div class="overlay-title ${won ? 'win' : 'lose'}">${won ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="overlay-sub">${won ? 'YOUR INSIGHTS OUTPACED THE AI' : 'THE AI WON THIS MATCH'}</div>
        <button class="overlay-btn" type="button" data-iw-action="new-game">⟳ NEW GAME</button>
      </div>
    </div>
  `;
}

/** @param {Card[]} hand @param {number} mana @param {boolean} playerCanAct */
function renderHand(hand, mana, playerCanAct){
  if(hand.length === 0){
    return '<div class="iw-empty">No cards in hand.</div>';
  }
  return hand.map((card, index) => {
    const affordable = card.cost <= mana;
    const disabled = !playerCanAct || !affordable;
    return `
      <button class="iw-card ${affordable ? 'iw-card-affordable' : 'iw-card-locked'}" type="button" data-iw-action="play-card" data-card-index="${index}" ${disabled ? 'disabled' : ''}>
        <span class="iw-card-cost">${card.cost}</span>
        <span class="iw-card-emoji">${escapeHtml(card.emoji)}</span>
        <span class="iw-card-name">${escapeHtml(card.name)}</span>
        <span class="iw-card-type">${escapeHtml(card.type)}</span>
        <span class="iw-card-text">${escapeHtml(card.description)}</span>
      </button>
    `;
  }).join('');
}

/** @param {import('./state.js').Minion[]} board @param {'player' | 'ai'} owner @param {{selectedAttackerId: string | null, pendingCardTarget: {cardId: string, cardName: string} | null}} ui */
function renderBoard(board, owner, ui){
  if(board.length === 0){
    return '<div class="iw-empty iw-empty-board">No minions</div>';
  }

  return board.map((minion) => {
    const isPlayer = owner === PLAYER_OWNER;
    const action = isPlayer ? 'select-attacker' : 'target-minion';
    const selected = ui.selectedAttackerId === minion.id;
    const targetable = !isPlayer && (ui.selectedAttackerId || ui.pendingCardTarget);
    const exhausted = !minion.canAttack;
    const status = minion.stunnedNextTurn
      ? '🚩 Stunned next turn'
      : minion.canAttack
        ? '✅ Ready'
        : '🕒 Summoning sick';
    return `
      <button class="iw-minion iw-minion-${owner} ${selected ? 'iw-selected' : ''} ${targetable ? 'iw-targetable' : ''} ${exhausted ? 'iw-exhausted' : 'iw-ready'}" type="button" data-iw-action="${action}" data-minion-id="${escapeAttribute(minion.id)}">
        <span class="iw-minion-name">${escapeHtml(minion.name)}</span>
        <span class="iw-minion-stats"><b>${minion.attack}</b> ATK · <b>${minion.hp}</b>/${minion.maxHp} HP</span>
        <span class="iw-minion-status">${status}</span>
      </button>
    `;
  }).join('');
}

/** @param {GameState} state */
function renderAiHand(state){
  if(!state.revealedAiHand){
    return `<span class="iw-hidden-hand">AI hand hidden · ${state.ai.hand.length} cards</span>`;
  }
  if(state.ai.hand.length === 0){
    return '<span class="iw-hidden-hand">AI hand revealed · empty</span>';
  }
  return `
    <div class="iw-revealed-hand" aria-label="Revealed AI hand">
      <span>AI hand revealed:</span>
      ${state.ai.hand.map((card) => `<span class="iw-revealed-card">${escapeHtml(card.emoji)} ${escapeHtml(card.name)} <b>${card.cost}</b></span>`).join('')}
    </div>
  `;
}

/** @param {string[]} log */
function renderLog(log){
  const entries = log.slice(-12);
  if(entries.length === 0) return '<div class="iw-log-entry">No actions yet.</div>';
  return entries.map((entry) => `<div class="iw-log-entry">${escapeHtml(entry)}</div>`).join('');
}

/** @param {{pendingCardTarget: {cardId: string} | null, selectedAttackerId: string | null}} ui */
function targetClassForHero(ui){
  if(ui.selectedAttackerId) return 'iw-targetable';
  if(ui.pendingCardTarget?.cardId === 'heatmap') return 'iw-targetable';
  return '';
}

/** @param {{pendingCardTarget: {cardId: string} | null, selectedAttackerId: string | null}} ui */
function targetTitleForHero(ui){
  if(ui.selectedAttackerId || ui.pendingCardTarget?.cardId === 'heatmap'){
    return 'title="Click to target the AI hero"';
  }
  return 'title="AI hero"';
}

/** @param {'player' | 'ai'} owner */
function ownerLabel(owner){
  return owner === PLAYER_OWNER ? 'Player' : 'AI';
}

/** @param {GameState} state */
function latestLogLine(state){
  return state.log[state.log.length - 1];
}

/** @param {unknown} value */
function escapeHtml(value){
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** @param {unknown} value */
function escapeAttribute(value){
  return escapeHtml(value);
}

/** @param {unknown} root */
function scrollLogToBottom(root){
  const log = root?.querySelector?.('.iw-log');
  if(log) log.scrollTop = log.scrollHeight;
}

/** @param {Document | undefined | null} doc */
function ensureStyles(doc){
  if(!doc?.createElement || !doc.head || doc.getElementById?.(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = INSIGHT_WARS_CSS;
  doc.head.appendChild(style);
}

function getBrowserDocument(){
  return typeof document === 'undefined' ? undefined : document;
}

function getBrowserWindow(){
  return typeof window === 'undefined' ? undefined : window;
}

const INSIGHT_WARS_CSS = `
  .iw-shell { --iw-player:#ff8a00; --iw-player-2:#ffd23f; --iw-ai:#8a94a6; --iw-ai-bg:rgba(116,128,148,0.14); --iw-danger:#ff4d88; --iw-panel:rgba(0,20,40,0.85); }
  .iw-header { gap:16px; align-items:flex-start; }
  .iw-title span { color:var(--iw-player-2); }
  .iw-subtitle { color:var(--text-dim); font-size:12px; letter-spacing:2px; margin-top:4px; text-transform:uppercase; }
  .iw-stats { align-items:stretch; flex-wrap:wrap; justify-content:flex-end; }
  .iw-top-button, .iw-end-turn { background:linear-gradient(135deg, rgba(255,138,0,0.22), rgba(255,210,63,0.16)); border:1px solid var(--iw-player-2); color:var(--iw-player-2); font-family:'Orbitron', sans-serif; font-size:11px; letter-spacing:2px; padding:10px 14px; cursor:pointer; clip-path:polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
  .iw-top-button:hover, .iw-end-turn:hover:not(:disabled) { box-shadow:0 0 18px rgba(255,138,0,0.35); }
  .iw-end-turn:disabled { opacity:0.45; cursor:not-allowed; }
  .iw-layout { display:grid; grid-template-columns:minmax(0, 1fr) 300px; gap:16px; }
  .iw-battlefield { position:relative; min-height:640px; border:1px solid rgba(255,210,63,0.18); background:radial-gradient(circle at 50% 0%, rgba(255,138,0,0.12), transparent 35%), rgba(2,8,16,0.72); box-shadow:inset 0 0 45px rgba(0,0,0,0.38); padding:14px; display:grid; grid-template-rows:1fr auto 1fr; gap:12px; }
  .iw-side { display:flex; flex-direction:column; gap:10px; min-height:0; }
  .iw-side-ai { color:#d6dbe4; }
  .iw-side-player { color:#ffe7aa; justify-content:flex-end; }
  .iw-hero { border:1px solid rgba(255,255,255,0.16); background:rgba(0,0,0,0.22); min-height:70px; color:inherit; padding:12px 14px; display:grid; grid-template-columns:1fr auto; gap:4px 12px; align-items:center; text-align:left; font-family:inherit; }
  button.iw-hero { cursor:default; }
  .iw-hero-ai { border-color:rgba(148,163,184,0.38); background:var(--iw-ai-bg); }
  .iw-hero-player { border-color:rgba(255,210,63,0.45); background:linear-gradient(135deg, rgba(255,138,0,0.16), rgba(255,210,63,0.07)); }
  .iw-hero-label { font-family:'Orbitron', sans-serif; letter-spacing:2px; font-size:12px; }
  .iw-hp { font-family:'Orbitron', sans-serif; font-size:22px; color:var(--iw-danger); grid-row:1 / span 2; grid-column:2; }
  .iw-mana { color:var(--text-dim); font-size:12px; letter-spacing:1px; }
  .iw-ai-hand { min-height:30px; display:flex; align-items:center; color:rgba(214,219,228,0.72); font-size:12px; letter-spacing:1px; }
  .iw-revealed-hand { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .iw-revealed-card { border:1px solid rgba(148,163,184,0.3); background:rgba(148,163,184,0.08); padding:4px 7px; }
  .iw-board { display:grid; grid-template-columns:repeat(3, minmax(120px, 1fr)); gap:10px; align-content:start; min-height:138px; }
  .iw-minion { color:var(--text-bright); min-height:118px; padding:10px; border:1px solid rgba(255,255,255,0.14); background:rgba(0,20,40,0.62); display:flex; flex-direction:column; justify-content:space-between; gap:6px; text-align:left; font-family:inherit; cursor:pointer; clip-path:polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
  .iw-minion-player { border-color:rgba(255,210,63,0.46); background:linear-gradient(135deg, rgba(255,138,0,0.16), rgba(255,210,63,0.06)); }
  .iw-minion-ai { border-color:rgba(148,163,184,0.34); background:rgba(148,163,184,0.10); }
  .iw-minion-player.iw-ready { box-shadow:0 0 14px rgba(255,138,0,0.18); }
  .iw-minion.iw-exhausted { opacity:0.72; }
  .iw-minion-name { font-family:'Orbitron', sans-serif; font-size:12px; letter-spacing:1px; }
  .iw-minion-stats { font-size:14px; }
  .iw-minion-stats b { font-family:'Orbitron', sans-serif; color:var(--iw-player-2); }
  .iw-minion-ai .iw-minion-stats b { color:#d6dbe4; }
  .iw-minion-status { font-size:11px; color:var(--text-dim); }
  .iw-selected, .iw-targetable { outline:2px solid var(--neon-cyan); box-shadow:0 0 20px rgba(0,245,255,0.24); }
  button.iw-targetable { cursor:crosshair; }
  .iw-status { border:1px solid rgba(0,245,255,0.20); background:rgba(0,20,40,0.74); color:var(--text-bright); min-height:42px; display:flex; align-items:center; justify-content:center; gap:12px; padding:8px 12px; text-align:center; letter-spacing:1px; }
  .iw-status-targeting { border-color:var(--neon-cyan); color:var(--neon-cyan); }
  .iw-status button { background:transparent; border:1px solid var(--neon-cyan); color:var(--neon-cyan); padding:5px 9px; font-family:'Orbitron', sans-serif; font-size:9px; letter-spacing:1px; cursor:pointer; }
  .iw-player-row { display:grid; grid-template-columns:1fr 170px; gap:10px; align-items:stretch; }
  .iw-end-turn { font-size:13px; color:#020810; background:linear-gradient(135deg, var(--iw-player), var(--iw-player-2)); }
  .iw-sidebar { display:flex; flex-direction:column; gap:12px; min-width:0; }
  .iw-hand-panel { border-color:rgba(255,210,63,0.22); }
  .iw-hand { display:flex; flex-direction:column; gap:8px; max-height:430px; overflow:auto; padding-right:3px; }
  .iw-card { position:relative; width:100%; min-height:112px; border:1px solid rgba(255,210,63,0.28); color:var(--text-bright); background:linear-gradient(135deg, rgba(255,138,0,0.14), rgba(0,20,40,0.84)); padding:10px 10px 10px 48px; text-align:left; font-family:inherit; cursor:pointer; clip-path:polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
  .iw-card:hover:not(:disabled) { border-color:var(--iw-player-2); box-shadow:0 0 16px rgba(255,138,0,0.22); }
  .iw-card:disabled { cursor:not-allowed; opacity:0.55; }
  .iw-card-cost { position:absolute; top:10px; left:10px; width:28px; height:28px; border:1px solid var(--iw-player-2); color:var(--iw-player-2); border-radius:50%; display:grid; place-items:center; font-family:'Orbitron', sans-serif; font-weight:700; }
  .iw-card-emoji { font-size:24px; display:inline-block; margin-right:6px; }
  .iw-card-name { font-family:'Orbitron', sans-serif; font-size:12px; letter-spacing:1px; color:var(--iw-player-2); }
  .iw-card-type { display:block; color:rgba(255,231,170,0.62); font-size:10px; letter-spacing:2px; text-transform:uppercase; margin:2px 0 5px; }
  .iw-card-text { display:block; color:var(--text-dim); font-size:12px; line-height:1.25; }
  .iw-log { max-height:180px; overflow:auto; font-size:11px; line-height:1.55; color:var(--text-dim); }
  .iw-log-entry { border-bottom:1px solid rgba(255,255,255,0.05); padding:3px 0; }
  .iw-help, .iw-deck-counts, .iw-active-mana, .iw-opponent-mana { color:var(--text-dim); font-size:12px; line-height:1.35; margin-top:8px; }
  .iw-active-mana { color:var(--iw-player-2); }
  .iw-empty { border:1px dashed rgba(255,255,255,0.14); color:var(--text-dim); min-height:52px; display:grid; place-items:center; text-align:center; padding:10px; }
  .iw-empty-board { min-height:118px; grid-column:1 / -1; }
  .iw-overlay { position:absolute; inset:0; z-index:20; background:rgba(2,8,16,0.94); display:grid; place-items:center; border:1px solid var(--panel-border); }
  .iw-overlay-card { display:flex; flex-direction:column; align-items:center; gap:18px; padding:36px; text-align:center; }
  @media (max-width: 980px) { .iw-layout { grid-template-columns:1fr; } .iw-sidebar { display:grid; grid-template-columns:1fr 1fr; } .iw-rules-panel { grid-column:1 / -1; } }
  @media (max-width: 680px) { .iw-board { grid-template-columns:1fr; } .iw-player-row { grid-template-columns:1fr; } .iw-sidebar { display:flex; } .iw-battlefield { min-height:unset; } .iw-stats { justify-content:center; } }
`;

if(typeof window !== 'undefined'){
  window.InsightWars = Object.freeze({
    newGame,
    mount,
    get state(){ return browserController?.state ?? null; },
  });

  if(window.registerGame){
    window.registerGame('insight-wars', {
      init(){
        const root = document.getElementById('insight-wars-root');
        if(!root) return;
        if(!browserController){
          browserController = mount(root);
        }else{
          browserController.render();
        }
      },
      cleanup(){},
    });
  }

  const tabButton = document.getElementById('tab-btn-insight-wars');
  if(tabButton && window.switchTab){
    tabButton.addEventListener('click', function(){
      window.switchTab('insight-wars', this);
    });
  }
}
