import test from 'node:test';
import assert from 'node:assert/strict';

import { mount, renderGame } from './browser.js';
import { newGame } from './turn-engine.js';

class FakeRoot {
  constructor(){
    this.innerHTML = '';
    this.listeners = new Map();
    this.ownerDocument = {
      head: { appendChild(){} },
      getElementById(){ return null; },
      createElement(){ return {}; },
    };
  }

  addEventListener(type, listener){
    this.listeners.set(type, listener);
  }

  removeEventListener(type){
    this.listeners.delete(type);
  }

  querySelector(){
    return null;
  }
}

test('Insight Wars browser module exports a mount function and renders the game shell', () => {
  const root = new FakeRoot();
  const controller = mount(root, { seed: 'ui-smoke-test' });

  assert.equal(typeof mount, 'function');
  assert.ok(root.innerHTML.includes('data-insight-wars-ui'));
  assert.ok(root.innerHTML.includes('ENEMY HP'));
  assert.ok(root.innerHTML.includes('PLAYER HAND'));
  assert.ok(root.innerHTML.includes('END TURN'));
  assert.ok(root.innerHTML.includes('NEW GAME'));
  assert.equal(typeof controller.state.player.hp, 'number');

  controller.unmount();
  assert.equal(root.listeners.has('click'), false);
});

test('renderGame includes player hand cards, board regions, mana, and both hero HP counters', () => {
  const state = newGame('ui-render-test');
  const html = renderGame(state, {
    notice: 'Smoke render',
    selectedAttackerId: null,
    pendingCardTarget: null,
    aiPending: false,
  });

  assert.match(html, /AI HERO/);
  assert.match(html, /PLAYER HERO/);
  assert.match(html, /Mana 1\/1/);
  assert.match(html, /iw-board-ai/);
  assert.match(html, /iw-board-player/);
  assert.match(html, /iw-card/);
});
