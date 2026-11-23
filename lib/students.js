// Educator-managed student accounts.
//
// Educators add students by typing usernames. Each student becomes a real
// better-auth user (no email, no password). A student signs in by typing their
// username, which creates a login request; the request only turns into a
// session once the educator who added that student approves it.
//
// Endpoints (served under /api/auth):
//   GET  /students/list              educator: their students + pending requests
//   POST /students/add               educator: { usernames: string[] }
//   POST /students/remove            educator: { studentId }
//   POST /students/decide            educator: { requestId, approve: boolean }
//   POST /student-login/request      anyone:   { username } -> { token }
//   POST /sign-in/student            anyone:   { token } -> { status } (+ session once approved)

import { createHash, randomBytes } from "node:crypto";
import { APIError, createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
export const MAX_ADD_AT_ONCE = 50;
export const MAX_PENDING_PER_STUDENT = 3;
export const REQUEST_TTL_MS = 10 * 60 * 1000;

export function normalizeUsername(raw) {
  return typeof raw === "string" ? raw.trim().toLowerCase().replace(/^@/, "") : "";
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function bad(code, status = "BAD_REQUEST") {
  return new APIError(status, { code, message: code });
}

function body(ctx) {
  return ctx.body && typeof ctx.body === "object" ? ctx.body : {};
}

async function findStudentByUserId(adapter, userId) {
  return adapter.findOne({ model: "student", where: [{ field: "userId", value: userId }] });
}

// The signed-in user, provided they may act as an educator: a real account
// that is not itself a student.
async function requireEducator(ctx) {
  const user = ctx.context.session?.user;
  if (!user || user.isAnonymous) throw bad("sign_in_required", "UNAUTHORIZED");
  if (await findStudentByUserId(ctx.context.adapter, user.id)) throw bad("students_cannot_manage", "FORBIDDEN");
  return user;
}

export const studentSchema = {
  student: {
    fields: {
      userId: { type: "string", required: true, unique: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      educatorId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      username: { type: "string", required: true, unique: true },
      createdAt: { type: "date", required: true },
    },
  },
  studentLoginRequest: {
    fields: {
      studentId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      educatorId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      tokenHash: { type: "string", required: true, unique: true },
      status: { type: "string", required: true },
      userAgent: { type: "string", required: false },
      createdAt: { type: "date", required: true },
      expiresAt: { type: "date", required: true },
    },
  },
};

export function students() {
  return {
    id: "students",
    schema: studentSchema,
    endpoints: {
      listStudents: createAuthEndpoint("/students/list", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const adapter = ctx.context.adapter;
        const rows = await adapter.findMany({
          model: "student",
          where: [{ field: "educatorId", value: educator.id }],
          sortBy: { field: "username", direction: "asc" },
        });
        const now = new Date();
        const pending = await adapter.findMany({
          model: "studentLoginRequest",
          where: [
            { field: "educatorId", value: educator.id },
            { field: "status", value: "pending" },
            { field: "expiresAt", value: now, operator: "gt" },
          ],
          sortBy: { field: "createdAt", direction: "asc" },
        });
        const nameById = new Map(rows.map((s) => [s.userId, s.username]));
        return ctx.json({
          students: rows.map((s) => ({ id: s.userId, username: s.username, createdAt: s.createdAt })),
          requests: pending
            .filter((r) => nameById.has(r.studentId))
            .map((r) => ({ id: r.id, studentId: r.studentId, username: nameById.get(r.studentId), createdAt: r.createdAt })),
        });
      }),

      addStudents: createAuthEndpoint("/students/add", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const adapter = ctx.context.adapter;
        const input = body(ctx).usernames;
        if (!Array.isArray(input) || input.length === 0) throw bad("usernames_required");
        if (input.length > MAX_ADD_AT_ONCE) throw bad("too_many_usernames");

        const added = [];
        const errors = [];
        const seen = new Set();
        for (const raw of input) {
          const username = normalizeUsername(raw);
          if (!username || seen.has(username)) continue;
          seen.add(username);
          if (!USERNAME_RE.test(username)) { errors.push({ username, reason: "invalid" }); continue; }
          const existing = await adapter.findOne({ model: "student", where: [{ field: "username", value: username }] });
          if (existing) {
            errors.push({ username, reason: existing.educatorId === educator.id ? "already_yours" : "taken" });
            continue;
          }
          const now = new Date();
          const user = await ctx.context.internalAdapter.createUser({
            name: username,
            // Students have no email; this placeholder can never receive mail.
            email: `${randomBytes(9).toString("hex")}@students.invalid`,
            emailVerified: false,
            isAnonymous: false,
            createdAt: now,
            updatedAt: now,
          });
          try {
            await adapter.create({
              model: "student",
              data: { userId: user.id, educatorId: educator.id, username, createdAt: now },
            });
          } catch (err) {
            // Lost a race for the same username.
            await ctx.context.internalAdapter.deleteUser(user.id);
            errors.push({ username, reason: "taken" });
            continue;
          }
          added.push({ id: user.id, username, createdAt: now });
        }
        return ctx.json({ added, errors });
      }),

      removeStudent: createAuthEndpoint("/students/remove", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const adapter = ctx.context.adapter;
        const studentId = body(ctx).studentId;
        if (typeof studentId !== "string") throw bad("student_id_required");
        const row = await findStudentByUserId(adapter, studentId);
        if (!row || row.educatorId !== educator.id) throw bad("not_found", "NOT_FOUND");
        await adapter.deleteMany({ model: "studentLoginRequest", where: [{ field: "studentId", value: studentId }] });
        await adapter.delete({ model: "student", where: [{ field: "userId", value: studentId }] });
        await ctx.context.internalAdapter.deleteSessions(studentId);
        await ctx.context.internalAdapter.deleteUser(studentId);
        return ctx.json({ ok: true });
      }),

      decideLogin: createAuthEndpoint("/students/decide", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const adapter = ctx.context.adapter;
        const { requestId, approve } = body(ctx);
        if (typeof requestId !== "string") throw bad("request_id_required");
        const req = await adapter.findOne({ model: "studentLoginRequest", where: [{ field: "id", value: requestId }] });
        if (!req || req.educatorId !== educator.id) throw bad("not_found", "NOT_FOUND");
        if (req.status !== "pending" || new Date(req.expiresAt) <= new Date()) throw bad("request_expired");
        await adapter.update({
          model: "studentLoginRequest",
          where: [{ field: "id", value: requestId }],
          update: {
            status: approve === true ? "approved" : "denied",
            // Give the student's screen a fresh window to pick up the approval.
            expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
          },
        });
        return ctx.json({ ok: true });
      }),

      requestStudentLogin: createAuthEndpoint("/student-login/request", { method: "POST" }, async (ctx) => {
        const adapter = ctx.context.adapter;
        const username = normalizeUsername(body(ctx).username);
        if (!USERNAME_RE.test(username)) throw bad("unknown_username", "NOT_FOUND");
        const row = await adapter.findOne({ model: "student", where: [{ field: "username", value: username }] });
        if (!row) throw bad("unknown_username", "NOT_FOUND");

        const now = new Date();
        const pending = await adapter.count({
          model: "studentLoginRequest",
          where: [
            { field: "studentId", value: row.userId },
            { field: "status", value: "pending" },
            { field: "expiresAt", value: now, operator: "gt" },
          ],
        });
        if (pending >= MAX_PENDING_PER_STUDENT) throw bad("too_many_requests", "TOO_MANY_REQUESTS");

        const token = randomBytes(32).toString("hex");
        const ua = ctx.request?.headers?.get?.("user-agent") ?? ctx.headers?.get?.("user-agent") ?? null;
        await adapter.create({
          model: "studentLoginRequest",
          data: {
            studentId: row.userId,
            educatorId: row.educatorId,
            tokenHash: hashToken(token),
            status: "pending",
            userAgent: ua ? String(ua).slice(0, 300) : null,
            createdAt: now,
            expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
          },
        });
        return ctx.json({ token, username });
      }),

      // Polled by the student's screen. Named /sign-in/* so the anonymous plugin
      // carries a guest's game stats over to the student when the session starts.
      signInStudent: createAuthEndpoint("/sign-in/student", { method: "POST" }, async (ctx) => {
        const adapter = ctx.context.adapter;
        const token = body(ctx).token;
        if (typeof token !== "string" || token.length < 32) throw bad("token_required");
        const req = await adapter.findOne({ model: "studentLoginRequest", where: [{ field: "tokenHash", value: hashToken(token) }] });
        if (!req) return ctx.json({ status: "expired" });
        const expired = new Date(req.expiresAt) <= new Date();
        if (req.status === "pending") return ctx.json({ status: expired ? "expired" : "pending" });
        if (req.status === "denied") return ctx.json({ status: "denied" });
        if (req.status !== "approved" || expired) return ctx.json({ status: "expired" });

        // Single use: mark consumed before handing out the session.
        await adapter.update({ model: "studentLoginRequest", where: [{ field: "id", value: req.id }], update: { status: "used" } });
        const user = await ctx.context.internalAdapter.findUserById(req.studentId);
        if (!user) return ctx.json({ status: "expired" });

        // Sign out whoever was on this browser before (other than a guest, whose
        // stats the anonymous plugin hands over to the student).
        const current = await getSessionFromCtx(ctx, { disableRefresh: true }).catch(() => null);
        if (current && !current.user.isAnonymous) {
          await ctx.context.internalAdapter.deleteSession(current.session.token);
        }

        // dontRememberMe: the session ends when the browser closes, so the next
        // login on a shared classroom computer needs the educator's OK again.
        const session = await ctx.context.internalAdapter.createSession(user.id, true);
        await setSessionCookie(ctx, { session, user }, true);
        return ctx.json({ status: "approved", user: { id: user.id, name: user.name } });
      }),
    },
  };
}
