import { auth } from "../lib/auth.js";

export default async function handler(req, res) {
  try {
    const apiKeys = auth?.api ? Object.keys(auth.api).sort() : [];
    const passkeyKeys = apiKeys.filter((k) => k.toLowerCase().includes("passkey"));
    res.status(200).json({
      version: {
        betterAuth: (await import("better-auth/package.json", { with: { type: "json" } })).default.version,
        passkey: (await import("@better-auth/passkey/package.json", { with: { type: "json" } })).default.version,
      },
      apiCount: apiKeys.length,
      passkeyKeys,
      allKeys: apiKeys,
      env: {
        VERCEL_ENV: process.env.VERCEL_ENV,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err?.message, stack: err?.stack });
  }
}
