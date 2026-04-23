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
      const btn = el('button', { className: 'auth-btn auth-signin' }, 'SIGN IN');
      btn.addEventListener('click', () => window.NexusAuth.signInWithGoogle());
      slot.appendChild(btn);
      return;
    }

    const wrap = el('div', { className: 'auth-chip' });
    if (user.image) {
      const img = el('img', { src: user.image, alt: '', className: 'auth-avatar' });
      wrap.appendChild(img);
    }
    wrap.appendChild(el('span', { className: 'auth-name' }, user.name || user.email || 'PLAYER'));
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
