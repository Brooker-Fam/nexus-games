// Resolves the auth base URL, trusted origins, and passkey relying-party ID
// from the environment.
//
// The site moved from nexusgames.space to kittygames.space. Better-auth rejects
// any sign-in POST whose Origin or callbackURL is not a trusted origin, so the
// new domain must be listed here or every sign-in control fails silently.
//
// This module has no side effects (no database, no better-auth import) so the
// config can be unit tested on its own.

// Origins the site is served from. Both brands stay trusted so old links and
// in-flight sessions keep working during the domain change.
const PRODUCTION_ORIGINS = [
  "https://www.kittygames.space",
  "https://kittygames.space",
  "https://www.nexusgames.space",
  "https://nexusgames.space",
];

// Canonical domain the app runs on now. Used for OAuth callbacks and passkeys.
const DEFAULT_BASE_URL = "https://www.kittygames.space";
const DEFAULT_RP_ID = "kittygames.space";

export function resolveBaseURL(env = process.env) {
  return (
    env.BETTER_AUTH_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined) ||
    DEFAULT_BASE_URL
  );
}

export function resolveTrustedOrigins(env = process.env) {
  const origins = new Set(PRODUCTION_ORIGINS);

  try {
    origins.add(new URL(resolveBaseURL(env)).origin);
  } catch {
    // Ignore a malformed baseURL — the production origins still apply.
  }

  // Preview deploys and local dev can add origins via a comma-separated list.
  if (env.AUTH_TRUSTED_ORIGINS) {
    for (const origin of env.AUTH_TRUSTED_ORIGINS.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return [...origins];
}

export function resolveRpID(env = process.env) {
  if (env.VERCEL_ENV !== "production") return "localhost";
  return env.AUTH_RP_ID || DEFAULT_RP_ID;
}
