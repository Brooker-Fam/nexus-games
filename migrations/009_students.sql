-- Educator-managed student accounts (lib/students.js plugin).
-- Students are "user" rows with a username and no email; each login needs
-- approval from the educator who added them.

CREATE TABLE IF NOT EXISTS student (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  "educatorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_educator ON student("educatorId");

CREATE TABLE IF NOT EXISTS "studentLoginRequest" (
  id TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "educatorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_login_request_educator ON "studentLoginRequest"("educatorId", status);
CREATE INDEX IF NOT EXISTS idx_student_login_request_student ON "studentLoginRequest"("studentId", status);
