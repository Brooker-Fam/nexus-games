CREATE TABLE IF NOT EXISTS game_stats (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_stats_user ON game_stats(user_id);
