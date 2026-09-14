import { createHmac, timingSafeEqual } from "node:crypto";

const POLAR_API_BASE =
  process.env.POLAR_SERVER === "sandbox"
    ? "https://sandbox-api.polar.sh/v1"
    : "https://api.polar.sh/v1";

async function polarFetch(path, options = {}) {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_ACCESS_TOKEN is not set");
  const res = await fetch(`${POLAR_API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Polar API ${path} -> ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

export function createCheckout({ productId, successUrl, customerEmail, customerExternalId, metadata }) {
  return polarFetch("/checkouts/", {
    method: "POST",
    body: JSON.stringify({
      products: [productId],
      success_url: successUrl,
      customer_email: customerEmail,
      customer_external_id: customerExternalId,
      metadata,
    }),
  });
}

export function getCheckout(checkoutId) {
  return polarFetch(`/checkouts/${checkoutId}`);
}

// Polar signs webhooks per the Standard Webhooks spec: `webhook-id`,
// `webhook-timestamp` and `webhook-signature` headers, HMAC-SHA256 over
// "<id>.<timestamp>.<rawBody>" with the base64 portion of the whsec_ secret.
export function verifyPolarWebhook(rawBody, { id, timestamp, signature }, secret) {
  if (!id || !timestamp || !signature || !secret) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");

  // Header can carry multiple space-separated "v1,<sig>" candidates.
  return signature.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    if (!sig) return false;
    try {
      const sigBuf = Buffer.from(sig, "base64");
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}
