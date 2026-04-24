// ── GAME REGISTRY ──
// Each game registers init() and cleanup() functions.
// Tab switching calls cleanup() on the old game, init() on the new one.

const games = {};
let activeGame = null;

function registerGame(tabId, game){
  games[tabId] = game;
}

function activateGame(tabId){
  if(activeGame && games[activeGame] && games[activeGame].cleanup){
    games[activeGame].cleanup();
  }
  activeGame = tabId;
  if(games[tabId] && games[tabId].init){
    games[tabId].init();
  }
}

// Enhanced tab switch — integrates with game lifecycle
function switchTab(id, btn){
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
  activateGame(id);
}

//# sourceMappingURL=game-registry.js.map
