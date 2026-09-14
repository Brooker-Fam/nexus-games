// ── MEMBERSHIPS TAB ──
// Two plans: BASIC (free) and PRO ($20/mo — every alternate skin unlocked
// plus full book access). Subscription state lives server-side in the
// `memberships` table, kept in sync by the Polar subscription webhook (see
// api/polar-webhook.js) — window.nexusProActive is the single flag the rest
// of the app (skins.js) reads to decide whether alt skins are free.
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
    const res=await fetch('/api/membership-status',{credentials:'include'});
    if(!res.ok) return;
    const body=await res.json();
    window.nexusProActive=!!body.active;
  } catch(e){ /* offline — treat as not active */ }
  renderMembershipStatus(window.nexusProActive);
  if(typeof refreshSkinOptionsUI==='function') refreshSkinOptionsUI();
}

async function buyMembership(){
  if(membershipBuyInFlight || window.nexusProActive) return;
  membershipBuyInFlight=true;
  try{
    const res=await fetch('/api/membership-checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok || !body.checkoutUrl){
      alert(body.error==='sign_in_required'
        ? 'Sign in with an account (not guest) to subscribe to Nexus Pro.'
        : (body.message || "Couldn't start checkout — please try again."));
      return;
    }
    window.location.href=body.checkoutUrl;
  } catch(e){
    alert("Couldn't start checkout — please try again.");
  } finally {
    membershipBuyInFlight=false;
  }
}

// Polar redirects back here after a successful subscription payment with
// ?membership_checkout_id=... — same "webhook may land a moment late" poll
// pattern as the skin checkout return handler in skins.js.
(function handleMembershipCheckoutReturn(){
  const params=new URLSearchParams(location.search);
  const checkoutId=params.get('membership_checkout_id');
  if(!checkoutId) return;
  params.delete('membership_checkout_id');
  const qs=params.toString();
  history.replaceState(null,'',location.pathname+(qs?`?${qs}`:'')+location.hash);
  let attempts=0;
  const poll=()=>{ attempts++; loadMembershipStatus(); if(attempts<5 && !window.nexusProActive) setTimeout(poll,1500); };
  poll();
})();

registerGame('memberships', {
  init(){ loadMembershipStatus(); },
  cleanup(){},
});

document.getElementById('membership-btn-pro').addEventListener('click', buyMembership);

// Load membership status up front (not just on tab open) so the SKINS tab
// reflects Pro entitlement even if the player never opens MEMBERSHIPS.
loadMembershipStatus();

//# sourceMappingURL=memberships.js.map
