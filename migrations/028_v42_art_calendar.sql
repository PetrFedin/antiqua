-- ANTIQUA v0.42 Art Calendar.
-- Exhibition remains its own authority. art_events models discrete calendar events only.
-- Calendar is a read model that can combine reviewed events with canonical exhibitions.

CREATE TABLE IF NOT EXISTS art_events (
  id text PRIMARY KEY,
  owner_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
  exhibition_id text REFERENCES exhibitions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK(event_type IN(
    'OPENING','ARTIST_TALK','LECTURE','WORKSHOP','PERFORMANCE','SCREENING',
    'ART_FAIR','BIENNIAL','GALLERY_WEEKEND','AUCTION_PREVIEW','AUCTION',
    'VIEWING','STUDIO_VISIT','COURSE','ONLINE_EVENT','OTHER'
  )),
  title jsonb NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','REVIEW_PENDING','PUBLISHED','CANCELLED','ARCHIVED')),
  attendance_mode text NOT NULL DEFAULT 'IN_PERSON' CHECK(attendance_mode IN('IN_PERSON','ONLINE','HYBRID')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  venue_name jsonb NOT NULL DEFAULT '{}'::jsonb,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  latitude double precision,
  longitude double precision,
  booking_url text,
  ticket_url text,
  online_url text,
  cover_image text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at IS NULL OR ends_at >= starts_at),
  CHECK(latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CHECK(longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);
CREATE INDEX IF NOT EXISTS art_events_public_time_idx ON art_events(status,visibility,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS art_events_org_idx ON art_events(organization_id,status,starts_at);
CREATE INDEX IF NOT EXISTS art_events_exhibition_idx ON art_events(exhibition_id,status,starts_at);

CREATE TABLE IF NOT EXISTS art_event_creators (
  event_id text NOT NULL REFERENCES art_events(id) ON DELETE CASCADE,
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN('ARTIST','CURATOR','SPEAKER','HOST','PARTICIPANT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,creator_id,role)
);
CREATE INDEX IF NOT EXISTS art_event_creators_creator_idx ON art_event_creators(creator_id,event_id);

CREATE TABLE IF NOT EXISTS art_event_organizations (
  event_id text NOT NULL REFERENCES art_events(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN('HOST','VENUE','PARTNER','ORGANIZER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,organization_id,role)
);
CREATE INDEX IF NOT EXISTS art_event_organizations_org_idx ON art_event_organizations(organization_id,event_id);

CREATE TABLE IF NOT EXISTS art_event_participation (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES art_events(id) ON DELETE CASCADE,
  state text NOT NULL CHECK(state IN('SAVED','PLANNED','VISITED','DISMISSED')),
  planned_for timestamptz,
  visited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,event_id)
);
CREATE INDEX IF NOT EXISTS art_event_participation_account_idx ON art_event_participation(account_id,state,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('028_v42_art_calendar') ON CONFLICT DO NOTHING;
