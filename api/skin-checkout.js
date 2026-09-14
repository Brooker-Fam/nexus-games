import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getPolar, DEFAULT_SKIN_UNLOCK_PRODUCT_ID } from "../lib/polar.js";
import { isPaidSkin } from "../lib/skin-catalog.js";

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
    const unit = typeof body?.unit === "string" ? body.unit : null;
    const skin = typeof body?.skin === "string" ? body.skin : null;
    if (!unit || !skin || !isPaidSkin(unit, skin)) {
      res.status(400).json({ error: "unknown_skin" });
      return;
    }

    const productId = process.env.POLAR_SKIN_PRODUCT_ID || DEFAULT_SKIN_UNLOCK_PRODUCT_ID;
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const successUrl = `${origin}/index.html?skin_checkout_id={CHECKOUT_ID}#skins`;

    const polar = getPolar();
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl,
      customerEmail: session.user.email && !session.user.isAnonymous ? session.user.email : undefined,
      metadata: { userId: session.user.id, unit, skin },
    });

    res.status(200).json({ checkoutUrl: checkout.url });
  } catch (err) {
    console.error("skin-checkout error:", err);
    res.status(500).json({ error: "checkout_failed", message: err?.message });
  }
}
