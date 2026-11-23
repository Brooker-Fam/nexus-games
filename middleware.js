// Vercel Routing Middleware: students may not open the general games arcade.
// Looks up the role saved on the account behind the session cookie and
// redirects students to the Educational Games tab on the home page.
import { neon } from "@neondatabase/serverless";

export const config = {
  matcher: ["/nexus", "/nexus/", "/nexus/index.html"],
};

const COOKIE_NAMES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

function sessionToken(request) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!COOKIE_NAMES.includes(name)) continue;
    let value = part.slice(eq + 1).trim();
    try { value = decodeURIComponent(value); } catch { /* keep raw */ }
    // Signed cookie format is "<token>.<signature>".
    const dot = value.lastIndexOf(".");
    return dot > 0 ? value.slice(0, dot) : value;
  }
  return null;
}

export default async function middleware(request) {
  const token = sessionToken(request);
  if (!token || !process.env.DATABASE_URL) return;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT u.role FROM session s JOIN "user" u ON u.id = s."userId"
      WHERE s.token = ${token} AND s."expiresAt" > NOW()
    `;
    if (rows[0]?.role === "student") {
      return Response.redirect(new URL("/#educational", request.url), 302);
    }
  } catch (err) {
    // Fail open so a database hiccup doesn't take the arcade down for everyone.
    console.error("student gate failed:", err);
  }
}
