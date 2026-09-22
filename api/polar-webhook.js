import { verifyPolarWebhook } from "../lib/polar.js";
import { isValidPaidSkin } from "../lib/paid-skins.js";
import { getSql } from "../lib/db.js";
import { sendCheckoutAlert } from "../lib/checkout-alerts.js";

// Source of truth for skin unlocks (api/checkout-confirm.js unlocks eagerly
// when the customer's browser makes it back from Polar, but this is what
// fires even if it doesn't — closed tab, network hiccup, etc) and for
// Nexus Pro membership status, kept in sync with the subscription's
// lifecycle (see api/membership-checkout.js).
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("POLAR_WEBHOOK_SECRET is not set");
    await sendCheckoutAlert("polar-webhook-configuration");
    res.status(500).json({ error: "webhook_not_configured" });
    return;
  }

  const rawBody = await readRawBody(req);
  const valid = verifyPolarWebhook(
    rawBody,
    {
      id: req.headers["webhook-id"],
      timestamp: req.headers["webhook-timestamp"],
      signature: req.headers["webhook-signature"],
    },
    secret,
  );
  if (!valid) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: "bad_json" });
    return;
  }

  try {
    if (event.type === "order.paid") {
      const order = event.data ?? {};
      const { userId, unit, skin } = order.metadata ?? {};
      if (userId && isValidPaidSkin(unit, skin)) {
        const sql = getSql();
        await sql`
          INSERT INTO skin_unlocks (user_id, unit, skin, order_id)
          VALUES (${userId}, ${unit}, ${skin}, ${order.id ?? null})
          ON CONFLICT (user_id, unit, skin) DO NOTHING
        `;
      }
    } else if (
      event.type === "subscription.created" ||
      event.type === "subscription.updated" ||
      event.type === "subscription.active" ||
      event.type === "subscription.canceled" ||
      event.type === "subscription.revoked"
    ) {
      const sub = event.data ?? {};
      const meta = sub.metadata || {};
      const userId = typeof meta.userId === "string" ? meta.userId : null;
      const tier = meta.tier === "max" ? "max" : "pro";
      if (userId) {
        const sql = getSql();
        await sql`
          INSERT INTO memberships (user_id, status, tier, polar_subscription_id, polar_customer_id, current_period_end, updated_at)
          VALUES (${userId}, ${sub.status}, ${tier}, ${sub.id ?? null}, ${sub.customer_id ?? null}, ${sub.current_period_end ?? null}, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            status = EXCLUDED.status,
            tier = EXCLUDED.tier,
            polar_subscription_id = EXCLUDED.polar_subscription_id,
            polar_customer_id = EXCLUDED.polar_customer_id,
            current_period_end = EXCLUDED.current_period_end,
            updated_at = NOW()
        `;
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("polar-webhook error:", err);
    await sendCheckoutAlert("polar-webhook");
    res.status(500).json({ error: "webhook_failed", message: err?.message });
  }
}
