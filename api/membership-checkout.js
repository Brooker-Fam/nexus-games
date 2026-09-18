import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { createCheckout } from "../lib/polar.js";

// Nexus PRO — $1/mo (every alternate skin unlocked + full book access) and
// Nexus MAX — $2/mo (everything in PRO, plus the Neon Dojo taekwondo game).
// No hardcoded defaults: neither product has been created in the Polar
// dashboard yet, so each must be configured via its env var before checkout
// can run for that tier.
const PRODUCT_ID_ENV_VARS = {
  pro: "POLAR_MEMBERSHIP_PRODUCT_ID",
  max: "POLAR_MAX_PRODUCT_ID",
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const { tier } = (await readJsonBody(req).catch(() => ({}))) ?? {};
  const plan = tier === "max" ? "max" : "pro";
  const PRODUCT_ID = process.env[PRODUCT_ID_ENV_VARS[plan]];
  if (!PRODUCT_ID) {
    console.error(`${PRODUCT_ID_ENV_VARS[plan]} is not set`);
    res.status(500).json({ error: "membership_not_configured" });
    return;
  }
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    if (session.user.isAnonymous) {
      res.status(400).json({ error: "sign_in_required" });
      return;
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const successUrl = `${origin}/?membership_checkout_id={CHECKOUT_ID}`;

    const checkout = await createCheckout({
      productId: PRODUCT_ID,
      successUrl,
      customerEmail: session.user.email,
      customerExternalId: session.user.id,
      metadata: { userId: session.user.id, tier: plan },
    });

    res.status(200).json({ url: checkout.url });
  } catch (err) {
    console.error("membership-checkout error:", err);
    res.status(500).json({ error: "checkout_failed", message: err?.message });
  }
}
