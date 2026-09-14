import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getSql } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

    const sql = getSql();
    const rows = await sql`SELECT unit, skin FROM skin_unlocks WHERE user_id = ${session.user.id}`;
    res.status(200).json({ unlocks: rows });
  } catch (err) {
    console.error("unlocks error:", err);
    res.status(500).json({ error: "unlocks_failed", message: err?.message });
  }
}
