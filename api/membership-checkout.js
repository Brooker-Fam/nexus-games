import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getPolar, getMembershipProductId } from "../lib/polar.js";

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
    if (session.user.isAnonymous) {
      res.status(400).json({ error: "sign_in_required" });
      return;
    }

    const productId = getMembershipProductId();
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const successUrl = `${origin}/index.html?membership_checkout_id={CHECKOUT_ID}#memberships`;

    const polar = getPolar();
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl,
      customerEmail: session.user.email,
      metadata: { userId: session.user.id },
    });

    res.status(200).json({ checkoutUrl: checkout.url });
  } catch (err) {
    console.error("membership-checkout error:", err);
    res.status(500).json({ error: "checkout_failed", message: err?.message });
  }
}
