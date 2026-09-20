-- ANTIQUA v0.17 measured object engagement authority.
-- One row represents one deduplicated passport-view session per viewer/object/30-minute window.

CREATE TABLE IF NOT EXISTS object_view_events (
  id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  viewer_key_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'PASSPORT' CHECK (source IN ('PASSPORT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (viewer_key_hash ~ '^[0-9a-f]{64}$'),
  CHECK (last_viewed_at >= first_viewed_at),
  UNIQUE(object_id,viewer_key_hash,window_started_at)
);

CREATE INDEX IF NOT EXISTS object_view_events_object_idx
  ON object_view_events(object_id,last_viewed_at DESC);

CREATE INDEX IF NOT EXISTS object_view_events_account_recent_idx
  ON object_view_events(account_id,last_viewed_at DESC)
  WHERE account_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES('016_v17_object_engagement') ON CONFLICT DO NOTHING;
