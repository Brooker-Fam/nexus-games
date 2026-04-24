import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getSql } from "../lib/db.js";

const ALLOWED_GAMES = new Set(["rts", "td"]);

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    const userId = session.user.id;
    const sql = getSql();

    if (req.method === "GET") {
      const game = req.query?.game;
      if (game && !ALLOWED_GAMES.has(game)) {
        res.status(400).json({ error: "unknown_game" });
        return;
      }
      const rows = game
        ? await sql`SELECT game_id, data, updated_at FROM game_stats WHERE user_id = ${userId} AND game_id = ${game}`
        : await sql`SELECT game_id, data, updated_at FROM game_stats WHERE user_id = ${userId}`;
      res.status(200).json({ stats: rows });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const { game, data, clientUpdatedAt } = body ?? {};
      if (!game || !ALLOWED_GAMES.has(game)) {
        res.status(400).json({ error: "unknown_game" });
        return;
      }
      if (data == null || typeof data !== "object") {
        res.status(400).json({ error: "missing_data" });
        return;
      }
      const clientTs = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date();
      const rows = await sql`
        INSERT INTO game_stats (user_id, game_id, data, updated_at)
        VALUES (${userId}, ${game}, ${JSON.stringify(data)}::jsonb, ${clientTs.toISOString()})
        ON CONFLICT (user_id, game_id) DO UPDATE SET
          data = CASE WHEN game_stats.updated_at > EXCLUDED.updated_at THEN game_stats.data ELSE EXCLUDED.data END,
          updated_at = GREATEST(game_stats.updated_at, EXCLUDED.updated_at)
        RETURNING game_id, data, updated_at
      `;
      res.status(200).json({ stats: rows[0] });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("stats error:", err);
    res.status(500).json({ error: "stats_failed", message: err?.message });
  }
}
