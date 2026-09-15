// ── MEMBERSHIPS TAB ──
// Two plans: BASIC (free) and PRO ($5/mo — every alternate skin unlocked
// plus full book access). Subscription state lives server-side in the
// `memberships` table, kept in sync by the Polar subscription webhook (see
// api/polar-webhook.js) — window.nexusProActive is the single flag the rest
// of the app (js/rts/skin-shop.js, js/book/game.js) reads to decide whether
// alt skins and book chapters are unlocked.
window.nexusProActive = false;
let membershipBuyInFlight = false;

function renderMembershipStatus(active){
  const proCard=document.getElementById('membership-card-pro');
  const proBtn=document.getElementById('membership-btn-pro');
  const statusEl=document.getElementById('membership-status');
  if(!proCard || !proBtn) return;

  proCard.classList.toggle('membership-card-active', active);
  if(active){
    proBtn.textContent='CURRENT PLAN';
    proBtn.classList.add('membership-btn-current');
    proBtn.disabled=true;
  } else {
    proBtn.textContent='UPGRADE TO PRO';
    proBtn.classList.remove('membership-btn-current');
    proBtn.disabled=false;
  }
  if(statusEl) statusEl.textContent = active ? '★ NEXUS PRO ACTIVE — every alternate skin and the full book are unlocked.' : '';
}

async function loadMembershipStatus(){
  try{
    const res=await fetch('/api/membership-status',{credentials:'same-origin'});
    if(!res.ok) return;
    const body=await res.json();
    window.nexusProActive=!!body.active;
  } catch(e){ /* offline — treat as not active */ }
  renderMembershipStatus(window.nexusProActive);
  if(typeof refreshSkinOptionsUI==='function') refreshSkinOptionsUI();
  if(typeof renderBookCountdown==='function') renderBookCountdown();
  if(typeof renderBookList==='function') renderBookList();
  if(typeof renderBookReader==='function') renderBookReader();
}

async function buyMembership(){
  if(membershipBuyInFlight || window.nexusProActive) return;
  membershipBuyInFlight=true;
  const proBtn=document.getElementById('membership-btn-pro');
  const originalText=proBtn ? proBtn.textContent : '';
  if(proBtn) proBtn.textContent='OPENING CHECKOUT…';
  try{
    const res=await fetch('/api/membership-checkout',{
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json'},
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok || !body.url){
      alert(body.error==='sign_in_required'
        ? 'Sign in with an account (not guest) to subscribe to Nexus Pro.'
        : (body.message || "Couldn't start checkout — please try again."));
      if(proBtn) proBtn.textContent=originalText;
      return;
    }
    if(window.posthog) posthog.capture('membership_checkout_started');
    window.location.href=body.url;
  } catch(e){
    alert("Couldn't start checkout — please try again.");
    if(proBtn) proBtn.textContent=originalText;
  } finally {
    membershipBuyInFlight=false;
  }
}

// Runs once on page load — picks up `?membership_checkout_id=` on the
// success_url Polar redirects back to, confirms the subscription
// server-side (api/membership-checkout-confirm) so Pro activates without
// waiting on the webhook, then switches to the MEMBERSHIPS tab to show it.
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
      window.nexusProActive=true;
      if(window.posthog) posthog.capture('membership_purchase_confirmed');
      const tabBtn=document.getElementById('tab-btn-memberships');
      if(tabBtn) tabBtn.click();
    }
  } catch(e){ console.warn('membership confirm failed', e); }
  renderMembershipStatus(window.nexusProActive);
  if(typeof refreshSkinOptionsUI==='function') refreshSkinOptionsUI();
  if(typeof renderBookCountdown==='function') renderBookCountdown();
  if(typeof renderBookList==='function') renderBookList();
  if(typeof renderBookReader==='function') renderBookReader();
}

registerGame('memberships', {
  init(){ renderMembershipStatus(window.nexusProActive); },
  cleanup(){},
});

document.getElementById('membership-btn-pro').addEventListener('click', buyMembership);

// Load membership status up front (not just on tab open) so the SKINS and
// THE BOOK tabs reflect Pro entitlement even if the player never opens
// MEMBERSHIPS.
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ loadMembershipStatus(); handleMembershipCheckoutReturn(); });
} else {
  loadMembershipStatus(); handleMembershipCheckoutReturn();
}

//# sourceMappingURL=memberships.js.map
