// ── MEMBERSHIPS TAB ──
// Three plans: BASIC (free), PRO ($1/mo — every alternate skin unlocked
// and full book access), and MAX ($2/mo — everything in PRO, plus the
// Neon Dojo camera taekwondo game and first access to new games). Subscription
// state lives server-side in the `memberships` table, kept in sync by the
// Polar subscription webhook (see api/polar-webhook.js) — window.nexusProActive
// and window.nexusMaxActive are the flags the rest of the app
// (js/rts/skin-shop.js, js/book/game.js, js/taekwondo/game.js) reads to
// decide what's unlocked. MAX includes every PRO perk, so nexusProActive is
// true for both tiers.
window.nexusProActive = false;
window.nexusMaxActive = false;
let membershipBuyInFlight = false;

// ── BETA ACCESS ──
// Testers enter BETA_CODE on the BETA tab to unlock everything a MAX member
// gets, without paying. Client-side only (remembered in localStorage): it
// grants no server-side entitlement, so nothing is written to the
// memberships or unlocks tables.
const BETA_CODE = '12345';
const BETA_KEY = 'nexus-beta-unlocked';
function betaUnlocked(){
  try { return localStorage.getItem(BETA_KEY) === '1'; } catch(e){ return false; }
}
// Called after every membership-status update so a server response can't
// re-lock a beta tester mid-session.
function applyBetaOverride(){
  if(!betaUnlocked()) return;
  window.nexusProActive = true;
  window.nexusMaxActive = true;
}
applyBetaOverride();

function renderBetaPanel(){
  const on = betaUnlocked();
  const msg=document.getElementById('beta-msg');
  const lock=document.getElementById('beta-lock');
  const tab=document.getElementById('tab-btn-beta');
  if(msg && !msg.dataset.error){
    msg.textContent = on ? '✓ BETA ACCESS ACTIVE — every skin, the full book and the Neon Dojo are unlocked.' : '';
    msg.className = 'beta-msg' + (on ? ' beta-msg-ok' : '');
  }
  if(lock) lock.hidden = !on;
  if(tab) tab.classList.toggle('tab-beta-on', on);
}

function submitBetaCode(code){
  const msg=document.getElementById('beta-msg');
  if(String(code).trim() !== BETA_CODE){
    if(msg){ msg.dataset.error='1'; msg.textContent='✕ That code is not valid.'; msg.className='beta-msg beta-msg-err'; }
    return false;
  }
  try { localStorage.setItem(BETA_KEY, '1'); } catch(e){}
  if(msg) delete msg.dataset.error;
  applyBetaOverride();
  refreshDependentUI();
  if(window.posthog) posthog.capture('beta_access_unlocked');
  return true;
}

function clearBetaAccess(){
  try { localStorage.removeItem(BETA_KEY); } catch(e){}
  window.nexusProActive = false;
  window.nexusMaxActive = false;
  // Re-check the real subscription so paying members keep their tier.
  loadMembershipStatus();
}

function renderMembershipStatus(tier){
  const proCard=document.getElementById('membership-card-pro');
  const proBtn=document.getElementById('membership-btn-pro');
  const maxCard=document.getElementById('membership-card-max');
  const maxBtn=document.getElementById('membership-btn-max');
  const statusEl=document.getElementById('membership-status');
  if(!proCard || !proBtn || !maxCard || !maxBtn) return;

  const isPro = tier === 'pro' || tier === 'max';
  const isMax = tier === 'max';

  proCard.classList.toggle('membership-card-active', isPro && !isMax);
  if(isMax){
    proBtn.textContent='INCLUDED IN MAX';
    proBtn.classList.remove('membership-btn-current');
    proBtn.disabled=true;
  } else if(isPro){
    proBtn.textContent='CURRENT PLAN';
    proBtn.classList.add('membership-btn-current');
    proBtn.disabled=true;
  } else {
    proBtn.textContent='UPGRADE TO PRO';
    proBtn.classList.remove('membership-btn-current');
    proBtn.disabled=false;
  }

  maxCard.classList.toggle('membership-card-active', isMax);
  if(isMax){
    maxBtn.textContent='CURRENT PLAN';
    maxBtn.classList.add('membership-btn-current');
    maxBtn.disabled=true;
  } else {
    maxBtn.textContent='UPGRADE TO MAX';
    maxBtn.classList.remove('membership-btn-current');
    maxBtn.disabled=false;
  }

  if(statusEl){
    statusEl.textContent = isMax
      ? '★ NEXUS MAX ACTIVE — every alternate skin, the full book, and the Neon Dojo are unlocked.'
      : isPro
        ? '★ NEXUS PRO ACTIVE — every alternate skin and the full book are unlocked.'
        : '';
  }
}

function refreshDependentUI(){
  renderMembershipStatus(window.nexusMaxActive ? 'max' : window.nexusProActive ? 'pro' : null);
  if(typeof refreshSkinOptionsUI==='function') refreshSkinOptionsUI();
  if(typeof renderBookCountdown==='function') renderBookCountdown();
  if(typeof renderBookList==='function') renderBookList();
  if(typeof renderBookReader==='function') renderBookReader();
  if(typeof window.renderTkdLock==='function') window.renderTkdLock();
  renderBetaPanel();
}

async function loadMembershipStatus(){
  try{
    const res=await fetch('/api/membership-status',{credentials:'same-origin'});
    if(!res.ok) return;
    const body=await res.json();
    window.nexusProActive = !!body.active && (body.tier==='pro' || body.tier==='max');
    window.nexusMaxActive = !!body.active && body.tier==='max';
  } catch(e){ /* offline — treat as not active */ }
  applyBetaOverride();
  refreshDependentUI();
}

async function buyMembership(tier){
  if(membershipBuyInFlight) return;
  if(tier==='max' ? window.nexusMaxActive : window.nexusProActive) return;
  membershipBuyInFlight=true;
  const btn=document.getElementById(tier==='max' ? 'membership-btn-max' : 'membership-btn-pro');
  const originalText=btn ? btn.textContent : '';
  if(btn) btn.textContent='OPENING CHECKOUT…';
  try{
    const res=await fetch('/api/membership-checkout',{
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ tier }),
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok || !body.url){
      alert(body.error==='sign_in_required'
        ? `Sign in with an account (not guest) to subscribe to Nexus ${tier.toUpperCase()}.`
        : (body.message || "Couldn't start checkout — please try again."));
      if(btn) btn.textContent=originalText;
      return;
    }
    if(window.posthog) posthog.capture('membership_checkout_started', { tier });
    window.location.href=body.url;
  } catch(e){
    alert("Couldn't start checkout — please try again.");
    if(btn) btn.textContent=originalText;
  } finally {
    membershipBuyInFlight=false;
  }
}

// Runs once on page load — picks up `?membership_checkout_id=` on the
// success_url Polar redirects back to, confirms the subscription
// server-side (api/membership-checkout-confirm) so the tier activates
// without waiting on the webhook, then switches to the MEMBERSHIPS tab to
// show it.
async function handleMembershipCheckoutReturn(){
  const params=new URLSearchParams(location.search);
  const checkoutId=params.get('membership_checkout_id');
  if(!checkoutId) return;

  const cleanUrl=new URL(location.href);
  cleanUrl.searchParams.delete('membership_checkout_id');
  history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);

  try {
    const res=await fetch('/api/membership-checkout-confirm', {
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ checkoutId }),
    });
    const body=await res.json().catch(()=>({}));
    if(res.ok && body.active){
      window.nexusProActive = body.tier==='pro' || body.tier==='max';
      window.nexusMaxActive = body.tier==='max';
      if(window.posthog) posthog.capture('membership_purchase_confirmed', { tier: body.tier });
      const tabBtn=document.getElementById('tab-btn-memberships');
      if(tabBtn) tabBtn.click();
    }
  } catch(e){ console.warn('membership confirm failed', e); }
  applyBetaOverride();
  refreshDependentUI();
}

registerGame('memberships', {
  init(){ refreshDependentUI(); },
  cleanup(){},
});

registerGame('beta', {
  init(){ renderBetaPanel(); const input=document.getElementById('beta-code'); if(input && !betaUnlocked()) input.focus(); },
  cleanup(){},
});

document.getElementById('beta-form').addEventListener('submit', e=>{
  e.preventDefault();
  const input=document.getElementById('beta-code');
  if(submitBetaCode(input.value)) input.value='';
});
document.getElementById('beta-code').addEventListener('input', ()=>{
  const msg=document.getElementById('beta-msg');
  if(msg && msg.dataset.error){ delete msg.dataset.error; renderBetaPanel(); }
});
document.getElementById('beta-lock').addEventListener('click', clearBetaAccess);

document.getElementById('membership-btn-pro').addEventListener('click', ()=>buyMembership('pro'));
document.getElementById('membership-btn-max').addEventListener('click', ()=>buyMembership('max'));

// Load membership status up front (not just on tab open) so the SKINS,
// THE BOOK, and TAEKWONDO tabs reflect entitlement even if the player never
// opens MEMBERSHIPS.
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ loadMembershipStatus(); handleMembershipCheckoutReturn(); });
} else {
  loadMembershipStatus(); handleMembershipCheckoutReturn();
}

//# sourceMappingURL=memberships.js.map
