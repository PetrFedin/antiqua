-- ANTIQUA v0.29 Drops Engine.
-- Drop is a release/merchandising aggregate. Listing/auction/order remain sale and availability authority.

CREATE TABLE IF NOT EXISTS drops (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title jsonb NOT NULL,
  subtitle jsonb NOT NULL DEFAULT '{}'::jsonb,
  statement jsonb NOT NULL DEFAULT '{}'::jsonb,
  curator_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  curator_label jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_object_id text REFERENCES objects(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN('DRAFT','SCHEDULED','PREVIEW','LIVE','ARCHIVED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  preview_at timestamptz,
  release_at timestamptz,
  archive_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(release_at IS NULL OR preview_at IS NULL OR release_at>=preview_at),
  CHECK(archive_at IS NULL OR release_at IS NULL OR archive_at>release_at)
);
CREATE INDEX IF NOT EXISTS drops_public_idx
  ON drops(status,release_at DESC,updated_at DESC);

CREATE TABLE IF NOT EXISTS drop_items (
  drop_id text NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  release_limit integer NOT NULL DEFAULT 1 CHECK(release_limit>0),
  merchandising jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(drop_id,object_id),
  UNIQUE(drop_id,sort_order)
);
CREATE INDEX IF NOT EXISTS drop_items_object_idx ON drop_items(object_id,drop_id);

CREATE TABLE IF NOT EXISTS drop_follows (
  drop_id text NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(drop_id,account_id)
);
CREATE INDEX IF NOT EXISTS drop_follows_account_idx
  ON drop_follows(account_id,followed_at DESC);

CREATE TABLE IF NOT EXISTS drop_events (
  id text PRIMARY KEY,
  drop_id text NOT NULL REFERENCES drops(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  event_type text NOT NULL CHECK(event_type IN(
    'CREATED','UPDATED','ITEM_UPSERTED','ITEM_REMOVED',
    'SCHEDULED','PREVIEWED','RELEASED','ARCHIVED'
  )),
  actor_account_id text REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_role text NOT NULL CHECK(actor_role IN('OPERATOR','SYSTEM')),
  from_status text,
  to_status text NOT NULL,
  client_action_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(drop_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS drop_events_actor_action_idx
  ON drop_events(actor_account_id,client_action_id)
  WHERE actor_account_id IS NOT NULL AND client_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS drop_events_drop_idx
  ON drop_events(drop_id,version,created_at);

CREATE OR REPLACE FUNCTION antiqua_drop_event_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'drop_events are immutable' USING ERRCODE='55000';
END $$;

DROP TRIGGER IF EXISTS drop_events_immutable_trg ON drop_events;
CREATE TRIGGER drop_events_immutable_trg
BEFORE UPDATE OR DELETE ON drop_events
FOR EACH ROW EXECUTE FUNCTION antiqua_drop_event_immutable();

INSERT INTO schema_migrations(version) VALUES('020_v29_drops') ON CONFLICT DO NOTHING;
