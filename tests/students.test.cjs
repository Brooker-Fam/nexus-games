// End-to-end test of the educator/student login-permission flow, run against
// an in-memory better-auth instance with the students plugin.
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE = "http://localhost:3000";

async function setup() {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const { anonymous } = await import("better-auth/plugins");
  const { students } = await import("../lib/students.js");
  const created = [];
  const db = { user: [], session: [], account: [], verification: [], student: [], studentLoginRequest: [] };
  const auth = betterAuth({
    baseURL: BASE,
    secret: "test-secret-test-secret-test-secret-123",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [students({ onStudentCreated: async (id) => { created.push(id); } }), anonymous()],
  });

  async function call(path, { method = "POST", body, cookie } = {}) {
    const headers = { origin: BASE };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const res = await auth.handler(new Request(BASE + "/api/auth" + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const setCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, cookie: setCookie };
  }

  async function signUp(email) {
    const r = await call("/sign-up/email", { body: { email, password: "password1234", name: email } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.cookie;
  }

  return { auth, db, call, signUp, created };
}

test("educator adds students by username and approves their logins", async () => {
  const { call, signUp, db, created } = await setup();
  const teacher = await signUp("teacher@example.com");
  const other = await signUp("other@example.com");

  // Add students by typing usernames.
  let r = await call("/students/add", { cookie: teacher, body: { usernames: ["Alex.K", " sam_1 ", "x", "alex.k"] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.added.map((s) => s.username), ["alex.k", "sam_1"]);
  assert.deepEqual(r.json.errors, [{ username: "x", reason: "invalid" }]);

  // Usernames are unique across educators.
  r = await call("/students/add", { cookie: other, body: { usernames: ["alex.k"] } });
  assert.deepEqual(r.json.errors, [{ username: "alex.k", reason: "taken" }]);

  r = await call("/students/list", { method: "GET", cookie: teacher });
  assert.deepEqual(r.json.students.map((s) => s.username), ["alex.k", "sam_1"]);
  const alexId = r.json.students[0].id;
  assert.deepEqual(created, r.json.students.map((s) => s.id));

  // Unknown usernames are rejected.
  r = await call("/student-login/request", { body: { username: "nobody" } });
  assert.equal(r.status, 404);

  // Student asks to sign in; nothing happens until the educator approves.
  r = await call("/student-login/request", { body: { username: "ALEX.K" } });
  assert.equal(r.status, 200);
  const token = r.json.token;
  r = await call("/sign-in/student", { body: { token } });
  assert.equal(r.json.status, "pending");
  assert.equal(r.cookie.includes("session_token"), false);

  // The request shows up only for the educator who added the student.
  r = await call("/students/list", { method: "GET", cookie: other });
  assert.equal(r.json.requests.length, 0);
  r = await call("/students/list", { method: "GET", cookie: teacher });
  assert.equal(r.json.requests.length, 1);
  assert.equal(r.json.requests[0].username, "alex.k");
  const requestId = r.json.requests[0].id;

  // Another educator cannot approve it.
  r = await call("/students/decide", { cookie: other, body: { requestId, approve: true } });
  assert.equal(r.status, 404);

  r = await call("/students/decide", { cookie: teacher, body: { requestId, approve: true } });
  assert.equal(r.status, 200);

  // Now the student gets a session.
  r = await call("/sign-in/student", { body: { token } });
  assert.equal(r.json.status, "approved");
  assert.match(r.cookie, /session_token=/);
  const studentCookie = r.cookie;
  r = await call("/get-session", { method: "GET", cookie: studentCookie });
  assert.equal(r.json.user.id, alexId);

  // The approval is single use.
  r = await call("/sign-in/student", { body: { token } });
  assert.equal(r.json.status, "expired");

  // Students cannot manage students.
  r = await call("/students/add", { cookie: studentCookie, body: { usernames: ["friend"] } });
  assert.equal(r.status, 403);

  // Denied requests never sign in.
  r = await call("/student-login/request", { body: { username: "sam_1" } });
  const samToken = r.json.token;
  r = await call("/students/list", { method: "GET", cookie: teacher });
  await call("/students/decide", { cookie: teacher, body: { requestId: r.json.requests[0].id, approve: false } });
  r = await call("/sign-in/student", { body: { token: samToken } });
  assert.equal(r.json.status, "denied");
  assert.equal(r.cookie.includes("session_token"), false);

  // Removing a student deletes the account and signs them out.
  r = await call("/students/remove", { cookie: other, body: { studentId: alexId } });
  assert.equal(r.status, 404);
  r = await call("/students/remove", { cookie: teacher, body: { studentId: alexId } });
  assert.equal(r.status, 200);
  assert.equal(db.user.some((u) => u.id === alexId), false);
  r = await call("/get-session", { method: "GET", cookie: studentCookie });
  assert.equal(r.json, null);
});

test("pending login requests per student are capped", async () => {
  const { call, signUp } = await setup();
  const teacher = await signUp("t2@example.com");
  await call("/students/add", { cookie: teacher, body: { usernames: ["kid1"] } });
  for (let i = 0; i < 3; i++) {
    const r = await call("/student-login/request", { body: { username: "kid1" } });
    assert.equal(r.status, 200);
  }
  const r = await call("/student-login/request", { body: { username: "kid1" } });
  assert.equal(r.status, 429);
});

test("guests cannot manage students", async () => {
  const { call } = await setup();
  const r = await call("/students/list", { method: "GET" });
  assert.equal(r.status, 401);
});

test("a guest browser can sign in as an approved student", async () => {
  const { call, signUp, db } = await setup();
  const teacher = await signUp("t3@example.com");
  await call("/students/add", { cookie: teacher, body: { usernames: ["kid2"] } });
  const guest = (await call("/sign-in/anonymous", { body: {} })).cookie;
  const { token } = (await call("/student-login/request", { cookie: guest, body: { username: "kid2" } })).json;
  const reqId = (await call("/students/list", { method: "GET", cookie: teacher })).json.requests[0].id;
  await call("/students/decide", { cookie: teacher, body: { requestId: reqId, approve: true } });
  const r = await call("/sign-in/student", { cookie: guest, body: { token } });
  assert.equal(r.json.status, "approved");
  const s = await call("/get-session", { method: "GET", cookie: r.cookie });
  assert.equal(s.json.user.name, "kid2");
  assert.equal(db.user.filter((u) => u.isAnonymous).length, 0);
});

test("students added by Google email can only sign in with Google", async () => {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const { magicLink } = await import("better-auth/plugins");
  const { passkey } = await import("@better-auth/passkey");
  const { students } = await import("../lib/students.js");
  const db = { user: [], session: [], account: [], verification: [], student: [], studentLoginRequest: [], passkey: [] };
  const links = [];
  // Fake Google: the ID token is just the email address, always verified.
  const auth = betterAuth({
    baseURL: BASE,
    secret: "test-secret-test-secret-test-secret-123",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    socialProviders: {
      google: {
        clientId: "x", clientSecret: "y",
        verifyIdToken: async () => true,
        getUserInfo: async ({ idToken }) => ({
          user: { id: "g-" + idToken, email: idToken, name: "Kid", emailVerified: true },
          data: {},
        }),
      },
    },
    plugins: [students(), passkey({ rpID: "localhost", rpName: "t", origin: BASE }), magicLink({ sendMagicLink: async ({ email, url }) => { links.push({ email, url }); } })],
  });
  async function call(path, { method = "POST", body, cookie } = {}) {
    const headers = { origin: BASE };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const res = await auth.handler(new Request(BASE + "/api/auth" + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual",
    }));
    const setCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, cookie: setCookie, location: res.headers.get("location") };
  }
  const google = (email) => call("/sign-in/social", { body: { provider: "google", idToken: { token: email } } });

  const teacher = (await call("/sign-up/email", { body: { email: "t@example.com", password: "password1234", name: "T" } })).cookie;
  await call("/sign-up/email", { body: { email: "grownup@example.com", password: "password1234", name: "G" } });

  let r = await call("/students/add", { cookie: teacher, body: { usernames: ["Kid@Gmail.com", "grownup@example.com", "bad@x", "kid3"] } });
  assert.deepEqual(r.json.added.map((s) => [s.username, s.loginMethod]), [["kid@gmail.com", "google"], ["kid3", "username"]]);
  // Someone's existing account is never turned into a student account.
  assert.deepEqual(r.json.errors, [
    { username: "grownup@example.com", reason: "has_account" },
    { username: "bad@x", reason: "invalid" },
  ]);
  const kidId = r.json.added[0].id;

  // Signing in with Google claims the student account.
  r = await google("kid@gmail.com");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const kid = r.cookie;
  r = await call("/get-session", { method: "GET", cookie: kid });
  assert.equal(r.json.user.id, kidId);

  // No email sign-in link for that address.
  r = await call("/sign-in/magic-link", { body: { email: "KID@gmail.com", callbackURL: "/" } });
  assert.equal(r.status, 403);
  assert.equal(links.length, 0);
  // Other people's magic links still work.
  r = await call("/sign-in/magic-link", { body: { email: "someone@example.com", callbackURL: "/" } });
  assert.equal(r.status, 200);
  assert.equal(links.length, 1);

  // A magic link that was already sent before the address became a student
  // can't be used to get in either.
  await call("/sign-in/magic-link", { body: { email: "late@gmail.com", callbackURL: "/" } });
  await call("/students/add", { cookie: teacher, body: { usernames: ["late@gmail.com"] } });
  const lateLink = new URL(links.at(-1).url);
  r = await call("/magic-link/verify" + lateLink.search, { method: "GET" });
  assert.equal(r.cookie.includes("session_token"), false);

  // No username sign-in, and no passkeys.
  r = await call("/student-login/request", { body: { username: "kid@gmail.com" } });
  assert.notEqual(r.status, 200);
  r = await call("/passkey/generate-register-options", { method: "GET", cookie: kid });
  assert.equal(r.status, 403);
});
