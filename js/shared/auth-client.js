// Tiny vanilla auth client — wraps fetch() against /api/auth/* and /api/session.
// Exposes window.NexusAuth.
// Passkey support uses @simplewebauthn/browser via esm.sh (lazy-loaded).

(function(){
  const state = {
    user: null,       // { id, name, email, image, isAnonymous } or null
    ready: false,
    listeners: new Set(),
  };

  let _webauthn = null;
  async function getWebAuthn(){
    if (_webauthn) return _webauthn;
    _webauthn = await import('https://esm.sh/@simplewebauthn/browser@11');
    return _webauthn;
  }

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

  async function signInWithGoogle(){
    const callbackURL = window.location.origin + window.location.pathname;
    try {
      const res = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL }),
      });
      if (!res.ok) { console.error('sign-in failed', res.status, await res.text()); return; }
      const body = await res.json();
      if (body?.url) {
        window.location.href = body.url;
      } else if (body?.redirect === true && body?.url) {
        window.location.href = body.url;
      } else {
        console.error('unexpected sign-in response', body);
      }
    } catch (e) {
      console.error('sign-in error', e);
    }
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

  async function postJson(path, body){
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${path} -> ${res.status}: ${text}`);
    }
    return await res.json();
  }

  async function getJson(path){
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${path} -> ${res.status}: ${text}`);
    }
    return await res.json();
  }

  async function registerPasskey(name){
    if (!window.PublicKeyCredential) throw new Error('passkeys_unsupported');
    const { startRegistration } = await getWebAuthn();
    const qs = name ? `?name=${encodeURIComponent(name)}` : '';
    const options = await getJson('/api/auth/passkey/generate-register-options' + qs);
    const attestation = await startRegistration({ optionsJSON: options });
    await postJson('/api/auth/passkey/verify-registration', { response: attestation, name });
    await refresh();
  }

  async function signInWithMagicLink(email){
    if (!email) throw new Error('email_required');
    const callbackURL = window.location.origin + window.location.pathname;
    await postJson('/api/auth/sign-in/magic-link', { email, callbackURL });
    return true;
  }

  async function signInWithPasskey(){
    if (!window.PublicKeyCredential) throw new Error('passkeys_unsupported');
    const { startAuthentication } = await getWebAuthn();
    const options = await getJson('/api/auth/passkey/generate-authenticate-options');
    const assertion = await startAuthentication({ optionsJSON: options });
    await postJson('/api/auth/passkey/verify-authentication', { response: assertion });
    await refresh();
  }

  window.NexusAuth = {
    state,
    refresh,
    signInWithGoogle,
    signInWithMagicLink,
    signInWithPasskey,
    registerPasskey,
    signOut,
    onChange(fn){ state.listeners.add(fn); if (state.ready) fn(state.user); return () => state.listeners.delete(fn); },
    user(){ return state.user; },
    isLoggedIn(){ return !!state.user && !state.user.isAnonymous; },
    passkeysSupported(){ return typeof window.PublicKeyCredential !== 'undefined'; },
  };

  // Kick off on load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
})();

//# sourceMappingURL=auth-client.js.map
