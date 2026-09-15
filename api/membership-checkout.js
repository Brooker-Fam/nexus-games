import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { createCheckout } from "../lib/polar.js";

// Nexus Pro — $5/mo recurring subscription (every alternate skin unlocked
// + full book access). No hardcoded default: unlike the skin unlock product
// this one hasn't been created in the Polar dashboard yet, so it must be
// configured via POLAR_MEMBERSHIP_PRODUCT_ID before checkout can run.
const PRODUCT_ID = process.env.POLAR_MEMBERSHIP_PRODUCT_ID;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  if (!PRODUCT_ID) {
    console.error("POLAR_MEMBERSHIP_PRODUCT_ID is not set");
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
      metadata: { userId: session.user.id },
    });

    res.status(200).json({ url: checkout.url });
  } catch (err) {
    console.error("membership-checkout error:", err);
    res.status(500).json({ error: "checkout_failed", message: err?.message });
  }
}
