import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInsightWarsMarkup, renderInsightWars } from './index.js';
import { createInitialGameState, endTurn, INSIGHT_WARS_CARD_SET } from './game-state.js';

test('Insight Wars entry markup includes full board UI and sample hand', () => {
  const markup = buildInsightWarsMarkup();

  assert.match(markup, /Insight Wars/);
  assert.match(markup, /Dark Funnel PM/);
  assert.match(markup, /Max the Hedgehog/);
  assert.match(markup, /End Turn/);
  assert.match(markup, /Feature Flag/);
  assert.match(markup, /Session Replay/);
  assert.match(markup, /A\/B Test/);
});

test('initial stub state matches the UI contract', () => {
  const state = createInitialGameState();

  assert.equal(state.player.hp, 20);
  assert.equal(state.ai.hp, 20);
  assert.deepEqual(state.player.mana, { current: 1, max: 1 });
  assert.equal(state.turn, 1);
  assert.equal(state.activePlayer, 'player');
  assert.equal(state.playerHand.length, 3);
  assert.equal(INSIGHT_WARS_CARD_SET.length, 9);
});

test('endTurn stub flips the visible turn indicator state', () => {
  const state = createInitialGameState();
  const aiTurn = endTurn(state);
  const playerTurn = endTurn(aiTurn);

  assert.equal(aiTurn.activePlayer, 'ai');
  assert.equal(aiTurn.turn, 1);
  assert.equal(playerTurn.activePlayer, 'player');
  assert.equal(playerTurn.turn, 2);
  assert.deepEqual(playerTurn.player.mana, { current: 2, max: 2 });
});

test('Insight Wars entry renders into a container and exposes resettable state', () => {
  let clicked = false;
  const listeners = new Map();
  const container = {
    ownerDocument: null,
    innerHTML: '',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener() {},
    contains() {
      return true;
    },
  };

  const controller = renderInsightWars(container, { onNewGame: () => { clicked = true; } });

  assert.match(container.innerHTML, /Insight Wars/);
  assert.equal(controller.getState().turn, 1);

  controller.setState({ ...controller.getState(), gameOver: 'win' });
  assert.match(container.innerHTML, /You Win!/);

  controller.newGame();
  assert.equal(clicked, true);
  assert.equal(controller.getState().gameOver, null);
  assert.match(container.innerHTML, /End Turn/);
  assert.equal(typeof listeners.get('click'), 'function');
});


test('card click highlights selection and End Turn updates turn copy', () => {
  const listeners = new Map();
  const container = {
    ownerDocument: null,
    innerHTML: '',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener() {},
    contains() {
      return true;
    },
  };
  renderInsightWars(container);
  const click = listeners.get('click');

  click({
    target: {
      closest() {
        return {
          dataset: { insightWarsAction: 'select-card', cardId: 'feature-flag' },
        };
      },
    },
  });
  assert.match(container.innerHTML, /data-card-id="feature-flag"[\s\S]*?aria-pressed="true"/);
  assert.match(container.innerHTML, /Selected: <strong>Feature Flag<\/strong>/);

  click({
    target: {
      closest() {
        return {
          dataset: { insightWarsAction: 'end-turn' },
        };
      },
    },
  });
  assert.match(container.innerHTML, /AI Turn/);
  assert.match(container.innerHTML, /data-insight-wars-action="end-turn"[\s\S]*?disabled/);
});
