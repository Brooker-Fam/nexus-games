import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { createCheckout } from "../lib/polar.js";
import { isValidPaidSkin } from "../lib/paid-skins.js";

// The single "Alternate Skin Unlock" product ($2.00, one-time) — which
// unit/skin the purchase is for travels in the checkout's metadata instead
// of needing one Polar product per skin.
const PRODUCT_ID = process.env.POLAR_SKIN_PRODUCT_ID || "8aa992b2-b28c-4ec1-a637-8533f64de1be";

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

    const body = await readJsonBody(req);
    const { unit, skin } = body ?? {};
    if (!isValidPaidSkin(unit, skin)) {
      res.status(400).json({ error: "unknown_skin" });
      return;
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const successUrl = `${origin}/?checkout_id={CHECKOUT_ID}`;

    const checkout = await createCheckout({
      productId: PRODUCT_ID,
      successUrl,
      customerEmail: session.user.email,
      customerExternalId: session.user.id,
      metadata: { userId: session.user.id, unit, skin },
    });

    res.status(200).json({ url: checkout.url });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ error: "checkout_failed", message: err?.message });
  }
}
