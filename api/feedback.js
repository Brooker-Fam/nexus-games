import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getSql } from "../lib/db.js";

const CATEGORIES = new Set(["idea", "bug", "praise", "other"]);
const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 20000) reject(new Error("body_too_large"));
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.status(400).json({ error: "bad_body" });
    return;
  }
  const { category, message, contact, page, website } = body ?? {};

  // Honeypot field: real users never fill it in.
  if (website) {
    res.status(200).json({ ok: true });
    return;
  }
  if (!CATEGORIES.has(category)) {
    res.status(400).json({ error: "bad_category" });
    return;
  }
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > MAX_MESSAGE) {
    res.status(400).json({ error: "bad_message" });
    return;
  }
  const contactText = typeof contact === "string" ? contact.trim().slice(0, MAX_CONTACT) : "";
  const pageText = typeof page === "string" ? page.slice(0, 200) : null;
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 300) || null;

  let userId = null;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    userId = session?.user?.id ?? null;
  } catch {
    // Signed-out or auth unavailable: feedback is still accepted anonymously.
  }

  try {
    const sql = getSql();
    await sql`
      INSERT INTO feedback (user_id, category, message, contact, page, user_agent)
      VALUES (${userId}, ${category}, ${text}, ${contactText || null}, ${pageText}, ${userAgent})
    `;
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("feedback error:", err);
    res.status(500).json({ error: "feedback_failed" });
  }
}
