CREATE TABLE IF NOT EXISTS skin_unlocks (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  skin TEXT NOT NULL,
  order_id TEXT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, unit, skin)
);

CREATE INDEX IF NOT EXISTS idx_skin_unlocks_user ON skin_unlocks(user_id);
