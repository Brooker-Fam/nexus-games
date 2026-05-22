// Renders a small SIGN IN / avatar chip into #auth-slot in the header.
// Also manages the full-screen login overlay shown on first load.

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

  // ── Login overlay ──

  function dismissLoginScreen(){
    const screen = document.getElementById('login-screen');
    if (!screen) return;
    screen.classList.add('hidden');
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
  }

  function setLoginMsg(text, isError){
    const msg = document.getElementById('login-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'login-msg' + (isError ? ' error' : '');
  }

  function initLoginScreen(){
    const screen = document.getElementById('login-screen');
    if (!screen) return;

    // Show passkey button only if supported
    const passkeyBtn = document.getElementById('login-btn-passkey');
    if (passkeyBtn && window.NexusAuth.passkeysSupported()) {
      passkeyBtn.style.display = '';
    }

    document.getElementById('login-btn-google').addEventListener('click', () => {
      window.NexusAuth.signInWithGoogle();
    });

    document.getElementById('login-btn-mail').addEventListener('click', async () => {
      const email = prompt('Enter your email for a sign-in link:');
      if (!email) return;
      setLoginMsg('Sending link…', false);
      try {
        await window.NexusAuth.signInWithMagicLink(email.trim());
        setLoginMsg('Check your email for a sign-in link.', false);
      } catch (err) {
        console.error('magic link failed', err);
        setLoginMsg('Could not send link: ' + (err?.message || 'unknown error'), true);
      }
    });

    if (passkeyBtn) {
      passkeyBtn.addEventListener('click', async () => {
        setLoginMsg('Authenticating…', false);
        try {
          await window.NexusAuth.signInWithPasskey();
        } catch (err) {
          console.error('passkey sign-in failed', err);
          setLoginMsg('Passkey failed. Try Google or email instead.', true);
        }
      });
    }

    document.getElementById('btn-skip-login').addEventListener('click', dismissLoginScreen);
  }

  // ── Header auth chip ──

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

    // User is logged in — dismiss login screen if still visible
    dismissLoginScreen();

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
    initLoginScreen();
    window.NexusAuth.onChange(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
