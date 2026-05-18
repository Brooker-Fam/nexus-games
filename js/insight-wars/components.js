import {
  AI_SIDE,
  PLAYER_SIDE,
  canAffordCard,
  canMinionAttack,
  cardDescription,
  cardEmoji,
  getActiveSide,
  getBoard,
  getEvents,
  getHand,
  getHeroHp,
  getHeroMaxHp,
  getMaxEvents,
  getMinionEmoji,
  getMinionId,
  getMinionName,
  isMinionDisabled,
  isMinionSick,
  isTerminalPhase,
  makeHeroTarget,
  makeMinionTarget,
  normalizeCardId,
  phaseBody,
  phaseTitle,
} from './view-model.js';

export function GameBoard({
  state,
  targetMode,
  message,
  isAiThinking,
  onNewGame,
  onEndTurn,
  onHandCard,
  onHeroTarget,
  onMinionClick,
  isTargetHighlighted,
}){
  const shell = element('section', 'iw-game-board');
  shell.appendChild(GameHeader({ state, message, isAiThinking }));

  if(!state){
    const start = element('div', 'iw-start-panel');
    start.append(
      element('div', 'iw-start-portraits', '🦔  VS  🕴️'),
      element('h2', '', 'Insight Wars'),
      element('p', '', 'A single-player turn-based card duel about shipping sharper product insights.'),
      button('iw-primary-button', 'New Game', onNewGame)
    );
    shell.appendChild(start);
    return shell;
  }

  const activeSide = getActiveSide(state);
  const player = PLAYER_SIDE;
  const ai = AI_SIDE;

  shell.appendChild(HeroPanel({
    state,
    side: ai,
    name: 'Dark Funnel PM',
    portrait: '🕴️',
    accent: 'muted',
    targetMode,
    highlighted: isTargetHighlighted(makeHeroTarget(ai)),
    onTarget: () => onHeroTarget(ai),
  }));

  shell.appendChild(BoardLane({
    state,
    side: ai,
    label: 'AI Board',
    targetMode,
    onMinionClick,
    isTargetHighlighted,
  }));

  shell.appendChild(StatusBar({ state, activeSide, isAiThinking, onEndTurn }));

  shell.appendChild(BoardLane({
    state,
    side: player,
    label: 'Your Board',
    targetMode,
    onMinionClick,
    isTargetHighlighted,
  }));

  shell.appendChild(HeroPanel({
    state,
    side: player,
    name: 'Max the Hedgehog',
    portrait: '🦔',
    accent: 'player',
    targetMode,
    highlighted: isTargetHighlighted(makeHeroTarget(player)),
    onTarget: () => onHeroTarget(player),
  }));

  shell.appendChild(HandZone({ state, targetMode, onHandCard }));

  if(isTerminalPhase(state)){
    shell.appendChild(WinLoseScreen({ state, onNewGame }));
  }

  return shell;
}

function GameHeader({ state, message, isAiThinking }){
  const header = element('header', 'iw-header');
  const title = element('div', 'iw-title');
  title.innerHTML = '<span>INSIGHT</span> WARS';
  const meta = element('div', 'iw-meta');
  meta.append(
    element('span', 'iw-pill', state ? `Turn ${state.turn ?? 1}` : 'Ready'),
    element('span', `iw-pill ${isAiThinking ? 'iw-thinking' : ''}`, isAiThinking ? 'AI thinking…' : (state ? `${labelForSide(getActiveSide(state))} turn` : 'New match'))
  );
  header.append(title, meta, element('div', 'iw-message', message || 'Click New Game to begin.'));
  return header;
}

export function HeroPanel({ state, side, name, portrait, accent, highlighted, onTarget }){
  const hp = getHeroHp(state, side);
  const maxHp = getHeroMaxHp(state, side);
  const hero = button(`iw-hero-panel iw-${accent} ${highlighted ? 'is-target' : ''}`, '', onTarget);
  hero.setAttribute('aria-label', `${name}, ${hp} of ${maxHp} HP`);
  hero.disabled = !highlighted;
  hero.append(
    element('div', 'iw-portrait', portrait),
    element('div', 'iw-hero-copy', ''),
    element('div', 'iw-hp', `${hp} / ${maxHp}`)
  );
  hero.querySelector('.iw-hero-copy').append(
    element('strong', '', name),
    element('span', '', side === PLAYER_SIDE ? 'Player hero' : 'AI hero')
  );
  return hero;
}

function BoardLane({ state, side, label, targetMode, onMinionClick, isTargetHighlighted }){
  const lane = element('section', `iw-board-lane iw-${side}`);
  lane.appendChild(element('div', 'iw-lane-label', label));
  const row = element('div', 'iw-minion-row');
  const board = getBoard(state, side);
  if(board.length === 0){
    row.appendChild(element('div', 'iw-empty-slot', side === AI_SIDE ? 'No blockers in the funnel.' : 'No teammates shipped yet.'));
  } else {
    board.forEach((minion) => {
      row.appendChild(MinionCard({
        state,
        side,
        minion,
        targetMode,
        highlighted: isTargetHighlighted(makeMinionTarget(side, minion)),
        canAttack: canMinionAttack(state, side, minion),
        onClick: () => onMinionClick(side, minion),
      }));
    });
  }
  lane.appendChild(row);
  return lane;
}

export function MinionCard({ minion, highlighted, canAttack, onClick }){
  const classes = [
    'iw-minion-card',
    highlighted ? 'is-target' : '',
    canAttack ? 'can-attack' : '',
    isMinionSick(minion) ? 'is-muted' : '',
    isMinionDisabled(minion) ? 'is-disabled' : '',
  ].filter(Boolean).join(' ');
  const card = button(classes, '', onClick);
  card.disabled = !(highlighted || canAttack);
  card.setAttribute('aria-label', `${getMinionName(minion)} ${minion.attack}/${minion.hp}`);
  card.append(
    element('div', 'iw-minion-emoji', getMinionEmoji(minion)),
    element('div', 'iw-minion-name', getMinionName(minion)),
    element('div', 'iw-minion-stats', `${minion.attack ?? 0} / ${minion.hp ?? 0}`)
  );
  const tags = element('div', 'iw-minion-tags');
  if(isMinionSick(minion)) tags.appendChild(element('span', '', 'Sick'));
  if(isMinionDisabled(minion)) tags.appendChild(element('span', '', 'Disabled'));
  if(tags.childNodes.length) card.appendChild(tags);
  card.dataset.minionId = getMinionId(minion);
  return card;
}

function StatusBar({ state, activeSide, isAiThinking, onEndTurn }){
  const bar = element('section', 'iw-status-bar');
  bar.append(
    ManaCounter({ state, side: activeSide }),
    element('div', 'iw-active-copy', activeSide === PLAYER_SIDE ? 'Plan your launch.' : 'The Dark Funnel PM responds.'),
    EndTurnButton({ state, isAiThinking, onEndTurn })
  );
  return bar;
}

export function ManaCounter({ state, side }){
  const counter = element('div', `iw-mana-counter iw-${side}`);
  counter.append(
    element('span', 'iw-mana-label', side === PLAYER_SIDE ? 'Your Events' : 'AI Events'),
    element('strong', '', `${getEvents(state, side)} / ${getMaxEvents(state, side)}`)
  );
  return counter;
}

export function EndTurnButton({ state, isAiThinking, onEndTurn }){
  const enabled = getActiveSide(state) === PLAYER_SIDE && !isTerminalPhase(state) && !isAiThinking;
  const end = button(`iw-end-turn ${enabled ? 'is-enabled' : ''}`, 'End Turn', onEndTurn);
  end.disabled = !enabled;
  return end;
}

function HandZone({ state, targetMode, onHandCard }){
  const zone = element('section', 'iw-hand-zone');
  const top = element('div', 'iw-hand-top');
  top.append(
    element('h3', '', 'Your Hand'),
    element('span', '', `${getHand(state, PLAYER_SIDE).length} cards`)
  );
  zone.appendChild(top);
  const hand = element('div', 'iw-hand-row');
  getHand(state, PLAYER_SIDE).forEach((card, index) => {
    hand.appendChild(HandCard({
      state,
      side: PLAYER_SIDE,
      card,
      index,
      targeting: targetMode?.type === 'card' && targetMode.handIndex === index,
      onClick: () => onHandCard(index, card),
    }));
  });
  if(getHand(state, PLAYER_SIDE).length === 0){
    hand.appendChild(element('div', 'iw-empty-slot', 'No cards in hand.'));
  }
  zone.appendChild(hand);

  const aiHand = element('div', 'iw-ai-hand');
  aiHand.appendChild(element('span', 'iw-ai-hand-label', 'AI hand'));
  const revealed = Boolean(state.aiHandRevealed || state.aiHandRevealedUntilEndOfTurn);
  getHand(state, AI_SIDE).forEach((card) => {
    aiHand.appendChild(revealed ? MiniHandCard(card) : element('div', 'iw-card-back', '🂠'));
  });
  if(getHand(state, AI_SIDE).length === 0) aiHand.appendChild(element('span', 'iw-ai-empty', 'empty'));
  zone.appendChild(aiHand);
  return zone;
}

export function HandCard({ state, side, card, index, targeting, onClick }){
  const affordable = canAffordCard(state, side, card);
  const classes = [
    'iw-hand-card',
    affordable ? 'is-playable' : 'is-unaffordable',
    targeting ? 'is-targeting' : '',
  ].filter(Boolean).join(' ');
  const handCard = button(classes, '', onClick);
  handCard.disabled = !affordable && !targeting;
  handCard.dataset.cardId = normalizeCardId(card.id);
  handCard.dataset.handIndex = String(index);
  handCard.append(
    element('div', 'iw-card-cost', String(card.cost ?? 0)),
    element('div', 'iw-card-emoji', cardEmoji(card)),
    element('strong', 'iw-card-name', card.name || normalizeCardId(card.id)),
    element('p', 'iw-card-text', cardDescription(card))
  );
  return handCard;
}

function MiniHandCard(card){
  const mini = element('div', 'iw-mini-hand-card');
  mini.append(element('span', '', cardEmoji(card)), element('strong', '', card.name || normalizeCardId(card.id)));
  return mini;
}

export function WinLoseScreen({ state, onNewGame }){
  const overlay = element('div', 'iw-end-overlay');
  const modal = element('div', 'iw-end-modal');
  modal.append(
    element('div', 'iw-end-icon', phaseTitle(state) === 'Victory!' ? '🏆' : '💥'),
    element('h2', '', phaseTitle(state)),
    element('p', '', phaseBody(state)),
    button('iw-primary-button', 'New Game', onNewGame)
  );
  overlay.appendChild(modal);
  return overlay;
}

function labelForSide(side){
  return side === PLAYER_SIDE ? 'Player' : 'AI';
}

function element(tag, className = '', text = ''){
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text) node.textContent = text;
  return node;
}

function button(className, text, onClick){
  const node = element('button', className, text);
  node.type = 'button';
  if(onClick) node.addEventListener('click', onClick);
  return node;
}

//# sourceMappingURL=components.js.map
