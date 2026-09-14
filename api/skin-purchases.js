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
      res.status(200).json({ purchases: [] });
      return;
    }
    const sql = getSql();
    const rows = await sql`SELECT unit, skin FROM skin_purchases WHERE user_id = ${session.user.id}`;
    res.status(200).json({ purchases: rows });
  } catch (err) {
    console.error("skin-purchases error:", err);
    res.status(500).json({ error: "purchases_failed", message: err?.message });
  }
}
