-- ANTIQUA v0.29 Partner Drops / Fair Edition Engine.
-- Exhibition follows are event subscriptions, intentionally separate from object discovery searches.

CREATE TABLE IF NOT EXISTS exhibition_follows (
  exhibition_id text NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(exhibition_id,account_id)
);
CREATE INDEX IF NOT EXISTS exhibition_follows_account_idx
  ON exhibition_follows(account_id,status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('020_v29_partner_drops') ON CONFLICT DO NOTHING;
