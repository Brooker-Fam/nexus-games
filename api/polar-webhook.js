import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getSql } from "../lib/db.js";
import { isPaidSkin } from "../lib/skin-catalog.js";

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
    res.status(500).json({ error: "webhook_not_configured" });
    return;
  }

  const rawBody = await readRawBody(req);
  let event;
  try {
    event = validateEvent(rawBody, req.headers, secret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      res.status(403).json({ error: "invalid_signature" });
      return;
    }
    console.error("polar-webhook verification error:", err);
    res.status(400).json({ error: "bad_request" });
    return;
  }

  try {
    if (event.type === "order.paid") {
      const order = event.data;
      const meta = order.metadata || {};
      const userId = typeof meta.userId === "string" ? meta.userId : null;
      const unit = typeof meta.unit === "string" ? meta.unit : null;
      const skin = typeof meta.skin === "string" ? meta.skin : null;
      if (userId && unit && skin && isPaidSkin(unit, skin)) {
        const sql = getSql();
        await sql`
          INSERT INTO skin_purchases (user_id, unit, skin, polar_order_id)
          VALUES (${userId}, ${unit}, ${skin}, ${order.id})
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
      const sub = event.data;
      const meta = sub.metadata || {};
      const userId = typeof meta.userId === "string" ? meta.userId : null;
      if (userId) {
        const sql = getSql();
        await sql`
          INSERT INTO memberships (user_id, status, polar_subscription_id, polar_customer_id, current_period_end, updated_at)
          VALUES (${userId}, ${sub.status}, ${sub.id}, ${sub.customerId || null}, ${sub.currentPeriodEnd || null}, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            status = EXCLUDED.status,
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
    res.status(500).json({ error: "webhook_failed", message: err?.message });
  }
}
