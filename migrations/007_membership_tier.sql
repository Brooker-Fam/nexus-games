-- Nexus MAX — a second, higher subscription tier on top of PRO. `tier`
-- records which plan a membership row belongs to; `status`/lifecycle
-- columns keep the same meaning as before (see 006_memberships.sql).
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'pro';
