import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getCheckout } from "../lib/polar.js";
import { getSql } from "../lib/db.js";

// Confirms a Nexus Pro checkout right after the customer is redirected back
// from Polar, so membership activates immediately instead of waiting on the
// subscription.active webhook (which remains the source of truth — see
// api/polar-webhook.js — in case the browser never makes it back here, and
// which fills in current_period_end that the checkout object doesn't carry).
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
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      res.status(401).json({ error: "no_session" });
      return;
    }

    const { checkoutId } = (await readJsonBody(req)) ?? {};
    if (!checkoutId) {
      res.status(400).json({ error: "missing_checkout_id" });
      return;
    }

    const checkout = await getCheckout(checkoutId);
    const { userId, tier } = checkout?.metadata ?? {};
    if (checkout?.status !== "succeeded" || !userId || userId !== session.user.id) {
      res.status(200).json({ active: false, status: checkout?.status ?? "unknown" });
      return;
    }
    const plan = tier === "max" ? "max" : "pro";

    const sql = getSql();
    await sql`
      INSERT INTO memberships (user_id, status, tier, polar_subscription_id, polar_customer_id, updated_at)
      VALUES (${userId}, 'active', ${plan}, ${checkout.subscription_id ?? null}, ${checkout.customer_id ?? null}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        status = 'active',
        tier = EXCLUDED.tier,
        polar_subscription_id = COALESCE(EXCLUDED.polar_subscription_id, memberships.polar_subscription_id),
        polar_customer_id = COALESCE(EXCLUDED.polar_customer_id, memberships.polar_customer_id),
        updated_at = NOW()
    `;

    res.status(200).json({ active: true, tier: plan });
  } catch (err) {
    console.error("membership-checkout-confirm error:", err);
    res.status(500).json({ error: "confirm_failed", message: err?.message });
  }
}
