CREATE TABLE IF NOT EXISTS object_ownership (
  object_id text PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
  owner_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL CHECK (source_type IN ('ORDER','AUCTION','PRIVATE_TRANSFER','IMPORT','OTHER')),
  source_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS object_ownership_owner_idx ON object_ownership(owner_account_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS ownership_events (
  id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  previous_owner_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  new_owner_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type text NOT NULL DEFAULT 'TRANSFERRED' CHECK (event_type IN ('ACQUIRED','TRANSFERRED','INHERITED','DONATED','RETURNED')),
  source_type text NOT NULL CHECK (source_type IN ('ORDER','AUCTION','PRIVATE_TRANSFER','IMPORT','OTHER')),
  source_id text,
  public_note jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ownership_events_object_idx ON ownership_events(object_id,occurred_at DESC);
