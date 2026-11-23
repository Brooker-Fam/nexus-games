import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getSql } from "../lib/db.js";
import { effectiveRole } from "../lib/roles.js";

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
    let role = null;
    let student = null;
    if (user?.id) {
      try {
        const rows = await getSql()`
          SELECT u.role, s.username
          FROM "user" u LEFT JOIN student s ON s."userId" = u.id
          WHERE u.id = ${user.id}
        `;
        if (rows[0]?.username) student = { username: rows[0].username };
        role = effectiveRole({ stored: rows[0]?.role ?? null, isAnonymous: !!user.isAnonymous, isStudentAccount: !!student });
      } catch (err) {
        console.error("session role lookup failed:", err);
      }
    }
    res.status(200).json({
      user: user ? {
        id: user.id,
        name: user.name,
        email: student ? null : user.email,
        image: user.image,
        isAnonymous: !!user.isAnonymous,
        role,
        isStudent: !!student,
        username: student?.username ?? null,
      } : null,
    });
  } catch (err) {
    console.error("session error:", err);
    res.status(500).json({ error: "session_failed", message: err?.message });
  }
}
