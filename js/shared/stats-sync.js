// Stats sync: mirrors localStorage saves to /api/stats, prefers server on load.
// Currently wraps the RTS difficulty data (DIFF_STORAGE_KEY='nexus_rts_difficulty').

(function(){
  const GAME_ID = 'rts';
  const KEY = 'nexus_rts_difficulty';
  const TIMESTAMP_KEY = 'nexus_rts_difficulty_ts';

  function readLocal(){
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function localTs(){
    const raw = localStorage.getItem(TIMESTAMP_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function writeLocal(data, ts){
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      localStorage.setItem(TIMESTAMP_KEY, String(ts || Date.now()));
    } catch (e) {}
  }

  async function fetchServer(){
    try {
      const res = await fetch('/api/stats?game=' + GAME_ID, { credentials: 'same-origin' });
      if (!res.ok) return null;
      const body = await res.json();
      const row = (body?.stats || []).find((r) => r.game_id === GAME_ID);
      if (!row) return null;
      return {
        data: row.data,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
      };
    } catch (e) { return null; }
  }

  async function pushServer(data, ts){
    try {
      const res = await fetch('/api/stats', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: GAME_ID, data, clientUpdatedAt: new Date(ts || Date.now()).toISOString() }),
      });
      return res.ok;
    } catch (e) { return false; }
  }

  async function reconcile(){
    const server = await fetchServer();
    const localData = readLocal();
    const localTsMs = localTs();

    if (!server && !localData) return;

    if (server && (!localData || server.updatedAt >= localTsMs)) {
      // Prefer server (tie goes to server per user pref).
      writeLocal(server.data, server.updatedAt);
      if (typeof window.onStatsReplaced === 'function') {
        try { window.onStatsReplaced(server.data); } catch (e) {}
      }
      return;
    }

    if (localData && (!server || localTsMs > server.updatedAt)) {
      await pushServer(localData, localTsMs);
    }
  }

  // Wrap localStorage.setItem for our key so every game save also pushes to server.
  // Keeps existing difficulty.js untouched.
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k, v){
    origSet(k, v);
    if (k === KEY) {
      const ts = Date.now();
      origSet(TIMESTAMP_KEY, String(ts));
      try {
        const parsed = JSON.parse(v);
        // Fire-and-forget; failure is OK — localStorage already has it.
        pushServer(parsed, ts);
      } catch (e) {}
    }
  };

  window.NexusStatsSync = { reconcile, GAME_ID, KEY };

  function init(){
    if (window.NexusAuth) {
      window.NexusAuth.onChange(() => { reconcile(); });
    } else {
      reconcile();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

//# sourceMappingURL=stats-sync.js.map
