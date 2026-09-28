-- ANTIQUA v0.32 Collector Profile.
-- Public collector identity is opt-in and never exposes saved objects, purchases or inferred Taste Graph by default.

CREATE TABLE IF NOT EXISTS collector_profiles (
  account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  display_name jsonb NOT NULL,
  bio jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_label jsonb NOT NULL DEFAULT '{}'::jsonb,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  avatar_url text,
  cover_url text,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  featured_collection_id text REFERENCES collections(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collector_profiles_public_idx
  ON collector_profiles(visibility,updated_at DESC);

CREATE TABLE IF NOT EXISTS collector_follows (
  collector_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  follower_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collector_account_id,follower_account_id),
  CHECK(collector_account_id<>follower_account_id)
);
CREATE INDEX IF NOT EXISTS collector_follows_follower_idx
  ON collector_follows(follower_account_id,status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('023_v32_collector_profile') ON CONFLICT DO NOTHING;
