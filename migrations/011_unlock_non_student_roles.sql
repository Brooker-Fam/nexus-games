-- Only educator-added student accounts are students. Real accounts (Google,
-- email link, passkey) that ended up with role 'student' — e.g. carried over
-- from a guest session — were locked out of picking Educator. Clear them so
-- they can choose again.
UPDATE "user" u SET role = NULL, "updatedAt" = NOW()
WHERE u.role = 'student'
  AND NOT COALESCE(u."isAnonymous", false)
  AND NOT EXISTS (SELECT 1 FROM student s WHERE s."userId" = u.id);
