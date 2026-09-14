// ── SKIN SHOP — Polar checkout for paid alt liveries ──
// The 22 "$2.00" alt-skin options in skins.js are real purchases: clicking
// one that isn't owned opens a Polar checkout instead of equipping it for
// free. Split out of skins.js to keep that file under the project's
// ~600-line guideline; relies on skins.js's setUnitSkin/getUnitSkin/
// refreshSkinOptionsUI/showSkinDetail globals (loaded after this file).

// Which alt liveries the current user has actually paid for. Populated on
// load and again right after a successful purchase.
let ownedSkins=new Set();
function skinKey(unit,skin){ return `${unit}:${skin}`; }

async function loadOwnedSkins(){
  try {
    const res=await fetch('/api/unlocks', { credentials:'same-origin' });
    if(!res.ok) return;
    const body=await res.json();
    ownedSkins=new Set((body.unlocks||[]).map(u=>skinKey(u.unit,u.skin)));
  } catch(e){ console.warn('failed to load skin unlocks', e); }
  refreshSkinOptionsUI();
}

let purchaseInFlight=false;
async function purchaseSkin(unit,skin,optEl){
  if(purchaseInFlight) return;
  purchaseInFlight=true;
  optEl.classList.add('skin-purchasing');
  const priceEl=optEl.querySelector('.skin-price');
  const originalText=priceEl ? priceEl.textContent : '';
  if(priceEl) priceEl.textContent='OPENING CHECKOUT…';
  try {
    const res=await fetch('/api/checkout', {
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ unit, skin }),
    });
    if(!res.ok) throw new Error(await res.text());
    const body=await res.json();
    if(!body.url) throw new Error('missing checkout url');
    if(window.posthog) posthog.capture('skin_checkout_started', { unit, skin });
    window.location.href=body.url;
  } catch(e){
    console.error('checkout failed', e);
    optEl.classList.remove('skin-purchasing');
    purchaseInFlight=false;
    if(priceEl){
      priceEl.textContent='CHECKOUT FAILED — TAP TO RETRY';
      setTimeout(()=>{ priceEl.textContent=originalText; }, 3000);
    }
  }
}

// Called from skins.js's click/keydown delegation on a .skin-option — a
// priced option that isn't owned yet routes to checkout instead of equipping,
// unless the player has an active Nexus Pro membership (js/shared/
// memberships.js), which unlocks every alt livery without a purchase.
function activateSkinOption(opt){
  if(!opt || !opt.dataset.skin || opt.classList.contains('skin-purchasing')) return;
  const unit=opt.dataset.unit || 'arkship';
  const skin=opt.dataset.skin;
  if(opt.querySelector('.skin-price') && !ownedSkins.has(skinKey(unit,skin)) && !window.nexusProActive){
    purchaseSkin(unit, skin, opt);
    return;
  }
  setUnitSkin(unit, skin);
}

// Runs once on page load — picks up `?checkout_id=` on the success_url Polar
// redirects back to, confirms the purchase server-side (api/checkout-confirm),
// and equips the newly-unlocked skin so paying doesn't require a second click.
async function handleCheckoutReturn(){
  const params=new URLSearchParams(location.search);
  const checkoutId=params.get('checkout_id');
  if(!checkoutId) return;

  const cleanUrl=new URL(location.href);
  cleanUrl.searchParams.delete('checkout_id');
  history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);

  try {
    const res=await fetch('/api/checkout-confirm', {
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ checkoutId }),
    });
    const body=await res.json().catch(()=>({}));
    if(res.ok && body.unlocked){
      ownedSkins.add(skinKey(body.unit, body.skin));
      setUnitSkin(body.unit, body.skin);
      if(window.posthog) posthog.capture('skin_purchase_confirmed', { unit: body.unit, skin: body.skin });
      const tabBtn=document.getElementById('tab-btn-skins');
      if(tabBtn) tabBtn.click();
      showSkinDetail(body.unit);
    }
  } catch(e){ console.warn('checkout confirm failed', e); }
  refreshSkinOptionsUI();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ loadOwnedSkins(); handleCheckoutReturn(); });
} else {
  loadOwnedSkins(); handleCheckoutReturn();
}

//# sourceMappingURL=skin-shop.js.map
