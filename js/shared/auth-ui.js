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

      const mail = el('button', { className: 'auth-btn auth-mail', title: 'Sign in via email link' }, '✉');
      mail.addEventListener('click', async () => {
        const email = prompt('Enter your email for a sign-in link:');
        if (!email) return;
        try {
          await window.NexusAuth.signInWithMagicLink(email.trim());
          alert('Check your email for a sign-in link.');
        } catch (err) {
          console.error('magic link failed', err);
          alert('Could not send link: ' + (err?.message || 'unknown error'));
        }
      });
      slot.appendChild(mail);

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
    const nameEl = el('a', { className: 'auth-name', href: '/profile.html', title: 'View profile' }, user.name || user.email || 'PLAYER');
    nameEl.style.textDecoration = 'none';
    wrap.appendChild(nameEl);

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
