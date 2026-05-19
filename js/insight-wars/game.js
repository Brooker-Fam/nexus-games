// Insight Wars placeholder entry.
// Stack binding for downstream hoglets: this repo is a vanilla JavaScript + HTML/CSS app served by Vercel.
// Existing games are mounted through the global tab registry in js/shared/game-registry.js.
(function(){
  const TAB_ID = 'insight-wars';
  const ROUTE_PATH = '/insight-wars';

  function root(){
    return document.getElementById('insight-wars-root');
  }

  function renderPlaceholder(){
    const el = root();
    if(!el) return;
    el.innerHTML = `
      <section style="padding:32px;border:1px solid rgba(0,245,255,0.25);background:rgba(2,8,16,0.72);box-shadow:0 0 30px rgba(0,245,255,0.08);">
        <div class="game-header" style="margin-bottom:20px;">
          <div>
            <div class="game-title">INSIGHT <span>WARS</span></div>
            <div class="logo-sub">FOUNDATION PLACEHOLDER · UI HOGLET NEXT</div>
          </div>
        </div>
        <p style="max-width:760px;line-height:1.6;color:#d8fbff;">
          Insight Wars foundation is mounted. Pure GameState, card definitions, and action APIs live in
          <code>js/insight-wars/</code>. The next hoglet can replace this placeholder with the card-game UI.
        </p>
      </section>
    `;
  }

  function setInsightWarsPath(){
    if(window.location.pathname !== ROUTE_PATH){
      history.pushState({ tab: TAB_ID }, '', ROUTE_PATH);
    }
  }

  function activateInsightWars({ pushPath } = { pushPath: true }){
    const btn = document.getElementById('tab-btn-insight-wars');
    if(typeof switchTab === 'function' && btn){
      switchTab(TAB_ID, btn);
      if(pushPath) setInsightWarsPath();
    }
  }

  function activateDefaultRoute(){
    const btn = document.getElementById('tab-btn-td');
    if(typeof switchTab === 'function' && btn){
      switchTab('td', btn);
    }
  }

  if(typeof registerGame === 'function'){
    registerGame(TAB_ID, {
      init: renderPlaceholder,
      cleanup(){},
    });
  }

  const btn = document.getElementById('tab-btn-insight-wars');
  if(btn){
    btn.onclick = function(){
      activateInsightWars({ pushPath: true });
      if(window.posthog) posthog.capture('game_tab_switched', { tab: 'insight_wars' });
    };
  }

  window.addEventListener('popstate', function(){
    if(window.location.pathname === ROUTE_PATH){
      activateInsightWars({ pushPath: false });
    } else if(window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')){
      activateDefaultRoute();
    }
  });

  if(window.location.pathname === ROUTE_PATH){
    activateInsightWars({ pushPath: false });
  }
})();
