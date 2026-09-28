-- ANTIQUA v0.31 Editorial Commerce.
-- Structured editorial stories link culture/content directly to authoritative objects, creators and exhibitions.

CREATE TABLE IF NOT EXISTS editorial_stories (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  story_type text NOT NULL CHECK(story_type IN('STORY','GUIDE','STUDIO_VISIT','NEW_NAMES','MATERIAL_NOTE','COLLECTOR_NOTE','FAIR_NOTE')),
  title jsonb NOT NULL,
  dek jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb NOT NULL DEFAULT '[]'::jsonb,
  hero_image text,
  byline jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  created_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS editorial_stories_public_idx
  ON editorial_stories(status,published_at DESC,updated_at DESC);

CREATE TABLE IF NOT EXISTS editorial_story_links (
  id text PRIMARY KEY,
  story_id text NOT NULL REFERENCES editorial_stories(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK(link_type IN('OBJECT','CREATOR','EXHIBITION')),
  object_id text REFERENCES objects(id) ON DELETE CASCADE,
  creator_id text REFERENCES creators(id) ON DELETE CASCADE,
  exhibition_id text REFERENCES exhibitions(id) ON DELETE CASCADE,
  label jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (link_type='OBJECT' AND object_id IS NOT NULL AND creator_id IS NULL AND exhibition_id IS NULL) OR
    (link_type='CREATOR' AND creator_id IS NOT NULL AND object_id IS NULL AND exhibition_id IS NULL) OR
    (link_type='EXHIBITION' AND exhibition_id IS NOT NULL AND object_id IS NULL AND creator_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS editorial_story_links_object_uq
  ON editorial_story_links(story_id,object_id) WHERE object_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS editorial_story_links_creator_uq
  ON editorial_story_links(story_id,creator_id) WHERE creator_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS editorial_story_links_exhibition_uq
  ON editorial_story_links(story_id,exhibition_id) WHERE exhibition_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS editorial_events (
  id text PRIMARY KEY,
  story_id text NOT NULL REFERENCES editorial_stories(id) ON DELETE CASCADE,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  viewer_key_hash text NOT NULL,
  event_type text NOT NULL CHECK(event_type IN('STORY_OPEN','OBJECT_OPEN','CREATOR_OPEN','EXHIBITION_OPEN')),
  target_key text NOT NULL,
  object_id text REFERENCES objects(id) ON DELETE SET NULL,
  creator_id text REFERENCES creators(id) ON DELETE SET NULL,
  exhibition_id text REFERENCES exhibitions(id) ON DELETE SET NULL,
  window_started_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(story_id,event_type,target_key,viewer_key_hash,window_started_at)
);
CREATE INDEX IF NOT EXISTS editorial_events_story_idx
  ON editorial_events(story_id,event_type,occurred_at DESC);
CREATE INDEX IF NOT EXISTS editorial_events_account_idx
  ON editorial_events(account_id,occurred_at DESC) WHERE account_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES('022_v31_editorial_commerce') ON CONFLICT DO NOTHING;
