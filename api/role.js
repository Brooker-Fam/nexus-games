import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getSql } from "../lib/db.js";
import { canChangeRole, effectiveRole, isValidRole } from "../lib/roles.js";

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2000) reject(new Error("body_too_large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// GET  /api/role            -> { role }
// POST /api/role { role }   -> { role }   (403 role_locked if not allowed)
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const user = session?.user;
    if (!user) {
      res.status(401).json({ error: "not_signed_in" });
      return;
    }
    const sql = getSql();
    const rows = await sql`
      SELECT u.role, (s."userId" IS NOT NULL) AS "isStudentAccount"
      FROM "user" u LEFT JOIN student s ON s."userId" = u.id
      WHERE u.id = ${user.id}
    `;
    const isAnonymous = !!user.isAnonymous;
    const isStudentAccount = !!rows[0]?.isStudentAccount;
    const current = effectiveRole({ stored: rows[0]?.role ?? null, isAnonymous, isStudentAccount });

    if (req.method === "GET") {
      res.status(200).json({ role: current });
      return;
    }

    let body;
    try { body = await readJsonBody(req); } catch {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const next = body?.role;
    if (!isValidRole(next)) {
      res.status(400).json({ error: "invalid_role" });
      return;
    }
    if (!canChangeRole({ next, isAnonymous, isStudentAccount })) {
      res.status(403).json({ error: "role_locked", role: current });
      return;
    }
    if (next !== rows[0]?.role) {
      await sql`UPDATE "user" SET role = ${next}, "updatedAt" = NOW() WHERE id = ${user.id}`;
    }
    res.status(200).json({ role: next });
  } catch (err) {
    console.error("role error:", err);
    res.status(500).json({ error: "role_failed", message: err?.message });
  }
}
