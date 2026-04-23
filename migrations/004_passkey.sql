-- @better-auth/passkey plugin v1.6.x schema.

CREATE TABLE IF NOT EXISTS passkey (
  id TEXT PRIMARY KEY,
  name TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "credentialID" TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT FALSE,
  transports TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aaguid TEXT
);

CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON passkey("userId");
CREATE INDEX IF NOT EXISTS idx_passkey_credential_id ON passkey("credentialID");
