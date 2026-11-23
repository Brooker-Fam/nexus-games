-- Player feedback submitted from the Feedback tab on the Kitty Games home page.
-- user_id is set when the sender is signed in; anonymous feedback is allowed.
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  contact TEXT,
  page TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
