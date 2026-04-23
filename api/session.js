import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

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
    res.status(200).json({
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        isAnonymous: !!user.isAnonymous,
      } : null,
    });
  } catch (err) {
    console.error("session error:", err);
    res.status(500).json({ error: "session_failed", message: err?.message });
  }
}
