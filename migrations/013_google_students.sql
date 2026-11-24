-- Students added by Google email sign in with Google only (lib/students.js).
-- "username" students keep the username + educator-approval flow.
ALTER TABLE student ADD COLUMN IF NOT EXISTS "loginMethod" TEXT NOT NULL DEFAULT 'username';
