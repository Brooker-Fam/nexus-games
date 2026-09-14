import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getCheckout } from "../lib/polar.js";
import { isValidPaidSkin } from "../lib/paid-skins.js";
import { getSql } from "../lib/db.js";

// Confirms a checkout right after the customer is redirected back from
// Polar, so the skin unlocks immediately instead of waiting on the
// order.paid webhook (which remains the source of truth — see
// api/polar-webhook.js — in case the browser never makes it back here).
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
    const { userId, unit, skin } = checkout?.metadata ?? {};
    if (checkout?.status !== "succeeded" || !isValidPaidSkin(unit, skin) || !userId) {
      res.status(200).json({ unlocked: false, status: checkout?.status ?? "unknown" });
      return;
    }

    const sql = getSql();
    await sql`
      INSERT INTO skin_unlocks (user_id, unit, skin, order_id)
      VALUES (${userId}, ${unit}, ${skin}, ${checkout.order_id ?? null})
      ON CONFLICT (user_id, unit, skin) DO NOTHING
    `;

    res.status(200).json({ unlocked: true, unit, skin });
  } catch (err) {
    console.error("checkout-confirm error:", err);
    res.status(500).json({ error: "confirm_failed", message: err?.message });
  }
}
