import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInsightWarsMarkup, renderInsightWars } from './index.js';

test('Insight Wars entry markup includes the placeholder title and New Game button', () => {
  const markup = buildInsightWarsMarkup();

  assert.match(markup, /Insight Wars/);
  assert.match(markup, /New Game/);
});

test('Insight Wars entry renders into a container without throwing', () => {
  let clicked = false;
  const listeners = new Map();
  const button = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const container = {
    ownerDocument: null,
    innerHTML: '',
    querySelector(selector) {
      return selector === '[data-insight-wars-new-game]' ? button : null;
    },
  };

  assert.doesNotThrow(() => renderInsightWars(container, { onNewGame: () => { clicked = true; } }));
  assert.match(container.innerHTML, /Insight Wars/);

  listeners.get('click')();
  assert.equal(clicked, true);
});
