-- Educators grade and comment on assignments (lib/classwork.js /classwork/grade).
ALTER TABLE "classworkSubmission" ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE "classworkSubmission" ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE "classworkSubmission" ADD COLUMN IF NOT EXISTS "gradedAt" TIMESTAMPTZ;
