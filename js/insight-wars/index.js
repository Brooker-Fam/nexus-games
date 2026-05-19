import { mountInsightWarsGame } from './ui/InsightWarsGame.js';

let cleanupInsightWars = null;

export function initInsightWarsPage(){
  const root = document.getElementById('insight-wars-root');
  if(!root) return;
  if(cleanupInsightWars) cleanupInsightWars();
  cleanupInsightWars = mountInsightWarsGame(root);
}

window.registerGame('insight-wars', {
  init(){
    initInsightWarsPage();
  },
  cleanup(){
    if(cleanupInsightWars) cleanupInsightWars();
    cleanupInsightWars = null;
  },
});

const tabButton = document.getElementById('tab-btn-insight-wars');
if(tabButton){
  tabButton.addEventListener('click', () => {
    if(location.pathname !== '/insight-wars') history.pushState({ game: 'insight-wars' }, '', '/insight-wars');
    window.switchTab('insight-wars', tabButton);
  });
}

if(location.pathname === '/insight-wars'){
  window.switchTab('insight-wars', tabButton);
}

window.addEventListener('popstate', () => {
  if(location.pathname === '/insight-wars') window.switchTab('insight-wars', tabButton);
});
