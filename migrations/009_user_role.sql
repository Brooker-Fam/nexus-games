-- Kitty Games role picked on the login screen. NULL = not chosen yet.
-- Students are locked out of the general (non-educational) games; see
-- middleware.js and api/role.js.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_check') THEN
    ALTER TABLE "user" ADD CONSTRAINT user_role_check
      CHECK (role IS NULL OR role IN ('student', 'educator', 'player'));
  END IF;
END $$;
