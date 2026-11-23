-- Tests, quizzes and assignments (lib/classwork.js plugin).

CREATE TABLE IF NOT EXISTS "classworkItem" (
  id TEXT PRIMARY KEY,
  "educatorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  "dueDate" TEXT,
  notes TEXT,
  questions TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classwork_item_educator ON "classworkItem"("educatorId");

CREATE TABLE IF NOT EXISTS "classworkSubmission" (
  id TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL REFERENCES "classworkItem"(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "educatorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  answers TEXT,
  response TEXT,
  score INTEGER,
  total INTEGER,
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("itemId", "studentId")
);

CREATE INDEX IF NOT EXISTS idx_classwork_submission_educator ON "classworkSubmission"("educatorId");
CREATE INDEX IF NOT EXISTS idx_classwork_submission_student ON "classworkSubmission"("studentId");
