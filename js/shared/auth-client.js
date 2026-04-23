// Tiny vanilla auth client — wraps fetch() against /api/auth/* and /api/session.
// Exposes window.NexusAuth.

(function(){
  const state = {
    user: null,       // { id, name, email, image, isAnonymous } or null
    ready: false,
    listeners: new Set(),
  };

  function notify(){
    for (const fn of state.listeners) {
      try { fn(state.user); } catch (e) { console.error('auth listener failed', e); }
    }
  }

  async function refresh(){
    try {
      const res = await fetch('/api/session', { credentials: 'same-origin' });
      if (!res.ok) { state.user = null; return; }
      const body = await res.json();
      state.user = body?.user ?? null;
    } catch (e) {
      console.warn('session refresh failed', e);
      state.user = null;
    } finally {
      state.ready = true;
      notify();
    }
  }

  function signInWithGoogle(){
    const callbackURL = window.location.origin + window.location.pathname;
    const u = '/api/auth/sign-in/social?provider=google&callbackURL=' + encodeURIComponent(callbackURL);
    window.location.href = u;
  }

  async function signOut(){
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    await refresh();
  }

  window.NexusAuth = {
    state,
    refresh,
    signInWithGoogle,
    signOut,
    onChange(fn){ state.listeners.add(fn); if (state.ready) fn(state.user); return () => state.listeners.delete(fn); },
    user(){ return state.user; },
    isLoggedIn(){ return !!state.user && !state.user.isAnonymous; },
  };

  // Kick off on load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
})();
