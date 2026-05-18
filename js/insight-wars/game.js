// ── INSIGHT WARS PLACEHOLDER UI ──
// The real UI hoglet will replace this vanilla component. Keep this file thin;
// game rules live in game-state.js and stay independent from the DOM.

/**
 * Renders the foundation-only placeholder into the Insight Wars tab root.
 * @param {HTMLElement | null} [root]
 */
export function InsightWarsGame(root = document.getElementById('insight-wars-root')){
  if(!root) return;

  root.innerHTML = '';
  const placeholder = document.createElement('div');
  placeholder.textContent = 'Insight Wars (foundation only)';
  root.appendChild(placeholder);
}

if(typeof window !== 'undefined'){
  window.InsightWarsGame = InsightWarsGame;

  const tabButton = document.getElementById('tab-btn-insight-wars');
  if(tabButton){
    tabButton.addEventListener('click', function(){
      window.switchTab('insight-wars', this);
    });
  }

  if(typeof window.registerGame === 'function'){
    window.registerGame('insight-wars', {
      init(){
        InsightWarsGame();
      },
      cleanup(){},
    });
  }
}


