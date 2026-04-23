// Renders a small SIGN IN / avatar chip into #auth-slot in the header.

(function(){
  function el(tag, props, ...kids){
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    for (const k of kids) {
      if (k == null) continue;
      n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    }
    return n;
  }

  function render(user){
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    slot.innerHTML = '';

    if (!user || user.isAnonymous) {
      const google = el('button', { className: 'auth-btn auth-signin' }, 'SIGN IN');
      google.addEventListener('click', () => window.NexusAuth.signInWithGoogle());
      slot.appendChild(google);
      if (window.NexusAuth.passkeysSupported()) {
        const passkey = el('button', { className: 'auth-btn auth-passkey', title: 'Sign in with passkey' }, '🔑');
        passkey.addEventListener('click', async () => {
          try { await window.NexusAuth.signInWithPasskey(); }
          catch (err) { console.error('passkey sign-in failed', err); alert('Passkey sign-in failed. Try SIGN IN with Google first, then add a passkey.'); }
        });
        slot.appendChild(passkey);
      }
      return;
    }

    const wrap = el('div', { className: 'auth-chip' });
    if (user.image) {
      const img = el('img', { src: user.image, alt: '', className: 'auth-avatar' });
      wrap.appendChild(img);
    }
    wrap.appendChild(el('span', { className: 'auth-name' }, user.name || user.email || 'PLAYER'));

    if (window.NexusAuth.passkeysSupported()) {
      const addPk = el('button', { className: 'auth-btn auth-passkey', title: 'Add a passkey for fast sign-in' }, '+🔑');
      addPk.addEventListener('click', async () => {
        try {
          await window.NexusAuth.registerPasskey('This device');
          alert('Passkey saved. Next time, click 🔑 to sign in.');
        } catch (err) {
          console.error('passkey register failed', err);
          alert('Could not register passkey: ' + (err?.message || 'unknown error'));
        }
      });
      wrap.appendChild(addPk);
    }

    const out = el('button', { className: 'auth-btn auth-signout', title: 'Sign out' }, 'SIGN OUT');
    out.addEventListener('click', () => window.NexusAuth.signOut());
    wrap.appendChild(out);
    slot.appendChild(wrap);
  }

  function init(){
    if (!window.NexusAuth) return;
    window.NexusAuth.onChange(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
