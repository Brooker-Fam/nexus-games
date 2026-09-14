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
      res.status(200).json({ active: false });
      return;
    }
    const sql = getSql();
    const rows = await sql`
      SELECT status, current_period_end FROM memberships WHERE user_id = ${session.user.id}
    `;
    const row = rows[0];
    const active = !!row && row.status === "active";
    res.status(200).json({ active, currentPeriodEnd: row?.current_period_end || null });
  } catch (err) {
    console.error("membership-status error:", err);
    res.status(500).json({ error: "status_failed", message: err?.message });
  }
}
