import { betterAuth } from "better-auth";
import { anonymous, magicLink } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { Pool } from "@neondatabase/serverless";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function renderMagicLinkEmail(url) {
  const safe = url.replace(/"/g, "&quot;");
  return `
<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#020810;color:#e8f4ff;padding:32px">
  <h1 style="font-family:'Orbitron',sans-serif;letter-spacing:2px;color:#00f5ff">NEXUS GAMES</h1>
  <p>Click to sign in:</p>
  <p><a href="${safe}" style="display:inline-block;padding:12px 20px;background:#00f5ff;color:#020810;text-decoration:none;font-weight:700;letter-spacing:1px">SIGN IN</a></p>
  <p style="color:#8aa">Expires in 5 minutes. If you didn't request this, ignore.</p>
</body></html>`;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "https://www.nexusgames.space";

export const auth = betterAuth({
  database: pool,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  session: {
    // 400 days = browser cookie max-age ceiling (Chromium spec).
    // updateAge extends the session on any request older than this threshold —
    // so an active user never effectively expires.
    expiresIn: 60 * 60 * 24 * 400,
    updateAge: 60 * 60 * 24 * 7,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    passkey({
      rpID: process.env.VERCEL_ENV === "production" ? "nexusgames.space" : "localhost",
      rpName: "Nexus Games",
      origin: baseURL,
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (!resend) {
          console.warn("RESEND_API_KEY not set — magic link not sent. URL:", url);
          return;
        }
        await resend.emails.send({
          from: process.env.AUTH_EMAIL_FROM || "onboarding@resend.dev",
          to: email,
          subject: "Sign in to Nexus Games",
          html: renderMagicLinkEmail(url),
        });
      },
    }),
    anonymous({
      emailDomainName: "anon.nexusgames.space",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const { getSql } = await import("./db.js");
        const sql = getSql();
        await sql`
          INSERT INTO game_stats (user_id, game_id, data, updated_at)
          SELECT ${newUser.user.id}, game_id, data, updated_at
          FROM game_stats
          WHERE user_id = ${anonymousUser.user.id}
          ON CONFLICT (user_id, game_id) DO UPDATE SET
            data = CASE
              WHEN game_stats.updated_at >= EXCLUDED.updated_at THEN game_stats.data
              ELSE EXCLUDED.data
            END,
            updated_at = GREATEST(game_stats.updated_at, EXCLUDED.updated_at)
        `;
        await sql`DELETE FROM game_stats WHERE user_id = ${anonymousUser.user.id}`;
      },
    }),
  ],
});
