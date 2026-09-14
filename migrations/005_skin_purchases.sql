CREATE TABLE IF NOT EXISTS skin_purchases (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  skin TEXT NOT NULL,
  polar_order_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, unit, skin)
);

CREATE INDEX IF NOT EXISTS idx_skin_purchases_user ON skin_purchases(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skin_purchases_order ON skin_purchases(polar_order_id);
