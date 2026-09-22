import { createHash } from "node:crypto";

const operations = new Set([
  "checkout",
  "checkout-confirm",
  "membership-checkout",
  "membership-checkout-confirm",
  "polar-webhook",
  "polar-webhook-configuration",
  "membership-checkout-configuration",
]);

export async function sendCheckoutAlert(operation) {
  if (process.env.VERCEL_ENV !== "production") return false;

  try {
    if (!operations.has(operation)) {
      console.error("Checkout alert skipped: unsupported operation");
      return false;
    }

    const recipient = process.env.CHECKOUT_ALERT_EMAIL?.trim();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.AUTH_EMAIL_FROM?.trim();
    if (!recipient || !apiKey || !from) {
      console.error("Checkout alert skipped: missing email configuration");
      return false;
    }

    const hour = new Date(Date.now()).toISOString().slice(0, 13);
    const idempotencyKey = createHash("sha256")
      .update(JSON.stringify([recipient, operation, hour]))
      .digest("hex");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `Nexus Games payment failure: ${operation}`,
        text: [
          `The Nexus Games payment operation "${operation}" failed.`,
          `Alert window: ${hour}:00 UTC.`,
          "Repeated failures for this operation are grouped into one email per UTC hour.",
          "Check the application logs: https://vercel.com/guava-tri/nexus-games/logs",
          "Check Polar webhook deliveries: https://polar.sh/dashboard/kitty-co/settings/webhooks",
        ].join("\n\n"),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("Checkout alert delivery failed: email provider rejected request");
      return false;
    }
    return true;
  } catch {
    console.error("Checkout alert delivery failed");
    return false;
  }
}
