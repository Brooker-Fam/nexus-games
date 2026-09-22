const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");

function setup(t) {
  const values = {
    VERCEL_ENV: "production",
    CHECKOUT_ALERT_EMAIL: "owner@example.com",
    RESEND_API_KEY: "test-private-key",
    AUTH_EMAIL_FROM: "Nexus Games <alerts@example.com>",
  };
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(Date, "now", () => Date.parse("2026-09-22T14:15:00.000Z"));
  const fetch = t.mock.method(globalThis, "fetch", async () => ({ ok: true }));
  const errors = t.mock.method(console, "error", () => {});
  return { fetch, errors };
}

test("checkout alerts send a fixed plain-text email to the configured owner", async (t) => {
  const { fetch } = setup(t);
  const { sendCheckoutAlert } = await import("../lib/checkout-alerts.js");

  assert.equal(await sendCheckoutAlert("polar-webhook"), true);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, "Bearer test-private-key");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.ok(options.signal instanceof AbortSignal);
  const email = JSON.parse(options.body);
  assert.equal(email.from, "Nexus Games <alerts@example.com>");
  assert.deepEqual(email.to, ["owner@example.com"]);
  assert.match(email.subject, /polar-webhook/);
  assert.match(email.text, /polar-webhook/);
  assert.match(email.text, /https:\/\/vercel.com\/guava-tri\/nexus-games\/logs/);
  assert.match(email.text, /https:\/\/polar.sh\/dashboard\/kitty-co\/settings\/webhooks/);
  assert.equal(email.html, undefined);
  assert.ok(!options.body.includes("test-private-key"));
});

test("duplicate alerts share an hourly provider idempotency key and identical payload", async (t) => {
  const { fetch } = setup(t);
  const { sendCheckoutAlert } = await import("../lib/checkout-alerts.js");
  await sendCheckoutAlert("checkout");
  Date.now.mock.mockImplementation(() => Date.parse("2026-09-22T14:59:59.000Z"));
  await sendCheckoutAlert("checkout");
  Date.now.mock.mockImplementation(() => Date.parse("2026-09-22T15:00:00.000Z"));
  await sendCheckoutAlert("checkout");
  await sendCheckoutAlert("checkout-confirm");
  const requests = fetch.mock.calls.map(({ arguments: [, options] }) => options);
  const expectedKey = createHash("sha256")
    .update(JSON.stringify(["owner@example.com", "checkout", "2026-09-22T14"]))
    .digest("hex");
  assert.equal(requests[0].headers["Idempotency-Key"], expectedKey);
  assert.equal(requests[0].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  assert.equal(requests[0].body, requests[1].body);
  assert.notEqual(requests[1].headers["Idempotency-Key"], requests[2].headers["Idempotency-Key"]);
  assert.notEqual(requests[2].headers["Idempotency-Key"], requests[3].headers["Idempotency-Key"]);
});

test("alerts never send outside production or with missing configuration", async (t) => {
  const { fetch, errors } = setup(t);
  const { sendCheckoutAlert } = await import("../lib/checkout-alerts.js");
  for (const environment of ["preview", "development", ""]) {
    process.env.VERCEL_ENV = environment;
    assert.equal(await sendCheckoutAlert("checkout"), false);
  }
  process.env.VERCEL_ENV = "production";
  for (const key of ["CHECKOUT_ALERT_EMAIL", "RESEND_API_KEY", "AUTH_EMAIL_FROM"]) {
    const value = process.env[key];
    process.env[key] = "  ";
    assert.equal(await sendCheckoutAlert("checkout"), false);
    process.env[key] = value;
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(errors.mock.callCount(), 3);
});

test("provider and transport failures return false without exposing response or exception details", async (t) => {
  const { fetch, errors } = setup(t);
  const { sendCheckoutAlert } = await import("../lib/checkout-alerts.js");
  fetch.mock.mockImplementation(async () => ({ ok: false, status: 429, text: async () => "private-response" }));
  assert.equal(await sendCheckoutAlert("checkout"), false);
  fetch.mock.mockImplementation(async () => { throw new Error("private-error"); });
  assert.equal(await sendCheckoutAlert("checkout"), false);
  assert.equal(errors.mock.callCount(), 2);
  const logs = JSON.stringify(errors.mock.calls.map(({ arguments: args }) => args));
  assert.ok(!/private-response|private-error|test-private-key|owner@example.com/.test(logs));
});

test("unknown operations cannot trigger an email or enter error logs", async (t) => {
  const { fetch, errors } = setup(t);
  const { sendCheckoutAlert } = await import("../lib/checkout-alerts.js");
  assert.equal(await sendCheckoutAlert("untrusted-customer-data"), false);
  assert.equal(await sendCheckoutAlert({ toString() { throw new Error("private-error"); } }), false);
  assert.equal(fetch.mock.callCount(), 0);
  assert.ok(!JSON.stringify(errors.mock.calls).includes("untrusted-customer-data"));
});

test("each supported payment failure operation can send an alert", async (t) => {
  const { fetch } = setup(t);
  const { sendCheckoutAlert } = await import("../lib/checkout-alerts.js");
  for (const operation of ["checkout", "checkout-confirm", "membership-checkout", "membership-checkout-confirm", "polar-webhook", "polar-webhook-configuration", "membership-checkout-configuration"]) {
    assert.equal(await sendCheckoutAlert(operation), true);
  }
  assert.equal(fetch.mock.callCount(), 7);
});
