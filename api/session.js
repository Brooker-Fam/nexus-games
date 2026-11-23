import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getSql } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    let session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      const signInRes = await auth.api.signInAnonymous({
        headers: fromNodeHeaders(req.headers),
        returnHeaders: true,
        asResponse: true,
      });
      const setCookie = signInRes.headers.getSetCookie?.() ??
        (signInRes.headers.get("set-cookie") ? [signInRes.headers.get("set-cookie")] : []);
      if (setCookie.length) res.setHeader("set-cookie", setCookie);
      const body = await signInRes.json();
      session = {
        user: body?.user,
        session: body?.session,
      };
    }

    const user = session?.user;
    let student = null;
    if (user && !user.isAnonymous) {
      try {
        const rows = await getSql()`SELECT username FROM student WHERE "userId" = ${user.id}`;
        if (rows[0]) student = { username: rows[0].username };
      } catch (e) {
        console.warn("student lookup failed:", e?.message);
      }
    }
    res.status(200).json({
      user: user ? {
        id: user.id,
        name: user.name,
        email: student ? null : user.email,
        image: user.image,
        isAnonymous: !!user.isAnonymous,
        isStudent: !!student,
        username: student?.username ?? null,
      } : null,
    });
  } catch (err) {
    console.error("session error:", err);
    res.status(500).json({ error: "session_failed", message: err?.message });
  }
}
