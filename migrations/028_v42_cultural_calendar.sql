-- ANTIQUA v0.42 Cultural Calendar authority.
-- Extends canonical Exhibition authority and introduces scheduled cultural events.
-- No duplicate gallery/creator/artwork masters.

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS organization_location_id text REFERENCES organization_locations(id) ON DELETE SET NULL;
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS public_source_url text;
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'DRAFT';
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS review_note text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='exhibitions_publication_status_check') THEN
    ALTER TABLE exhibitions ADD CONSTRAINT exhibitions_publication_status_check
      CHECK(publication_status IN('DRAFT','REVIEW_PENDING','PUBLISHED','REJECTED'));
  END IF;
END $$;

UPDATE exhibitions
SET publication_status='PUBLISHED'
WHERE visibility='PUBLIC'
  AND status IN('SCHEDULED','LIVE','CLOSED','ARCHIVED')
  AND publication_status='DRAFT';

CREATE INDEX IF NOT EXISTS exhibitions_calendar_idx
  ON exhibitions(publication_status,visibility,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS exhibitions_organization_idx
  ON exhibitions(organization_id,publication_status,starts_at);

CREATE TABLE IF NOT EXISTS cultural_events (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  event_type text NOT NULL CHECK(event_type IN(
    'OPENING','ARTIST_TALK','CURATOR_TOUR','LECTURE','WORKSHOP',
    'AUCTION_PREVIEW','AUCTION','FAIR_DAY','PRIVATE_VIEW','BOOK_LAUNCH',
    'RESEARCH_SESSION','SCREENING','PERFORMANCE','OTHER'
  )),
  title jsonb NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
  organization_location_id text REFERENCES organization_locations(id) ON DELETE SET NULL,
  exhibition_id text REFERENCES exhibitions(id) ON DELETE SET NULL,
  venue_mode text NOT NULL DEFAULT 'PHYSICAL' CHECK(venue_mode IN('PHYSICAL','ONLINE','HYBRID')),
  venue_name jsonb NOT NULL DEFAULT '{}'::jsonb,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  address_line text,
  timezone text NOT NULL DEFAULT 'UTC',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  capacity integer CHECK(capacity IS NULL OR capacity>0),
  booking_url text,
  public_source_url text,
  admission_note jsonb NOT NULL DEFAULT '{}'::jsonb,
  accessibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_object_id text REFERENCES objects(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','REVIEW_PENDING','PUBLISHED','CANCELLED','ARCHIVED')),
  created_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at IS NULL OR ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS cultural_events_public_idx
  ON cultural_events(status,visibility,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS cultural_events_org_idx
  ON cultural_events(organization_id,status,starts_at);
CREATE INDEX IF NOT EXISTS cultural_events_exhibition_idx
  ON cultural_events(exhibition_id,status,starts_at);

CREATE TABLE IF NOT EXISTS cultural_event_creators (
  event_id text NOT NULL REFERENCES cultural_events(id) ON DELETE CASCADE,
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN('FEATURED_ARTIST','SPEAKER','CURATOR','MODERATOR','TEACHER','PERFORMER','OTHER')),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(event_id,creator_id,role)
);
CREATE INDEX IF NOT EXISTS cultural_event_creators_creator_idx
  ON cultural_event_creators(creator_id,event_id);

CREATE TABLE IF NOT EXISTS cultural_event_objects (
  event_id text NOT NULL REFERENCES cultural_events(id) ON DELETE CASCADE,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'FEATURED' CHECK(role IN('FEATURED','RELATED','REFERENCE')),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(event_id,object_id,role)
);

CREATE TABLE IF NOT EXISTS cultural_calendar_participation (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK(entity_type IN('EVENT','EXHIBITION')),
  entity_id text NOT NULL,
  state text NOT NULL CHECK(state IN('SAVED','PLANNED','VISITED')),
  private_note text,
  saved_at timestamptz,
  planned_at timestamptz,
  visited_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS cultural_calendar_participation_account_idx
  ON cultural_calendar_participation(account_id,state,updated_at DESC);

CREATE OR REPLACE FUNCTION antiqua_validate_calendar_participation_target()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_type='EVENT' THEN
    IF NOT EXISTS(SELECT 1 FROM cultural_events WHERE id=NEW.entity_id) THEN
      RAISE EXCEPTION 'calendar event target does not exist' USING ERRCODE='23503';
    END IF;
  ELSIF NEW.entity_type='EXHIBITION' THEN
    IF NOT EXISTS(SELECT 1 FROM exhibitions WHERE id=NEW.entity_id) THEN
      RAISE EXCEPTION 'calendar exhibition target does not exist' USING ERRCODE='23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cultural_calendar_participation_target_guard ON cultural_calendar_participation;
CREATE TRIGGER cultural_calendar_participation_target_guard
BEFORE INSERT OR UPDATE OF entity_type,entity_id ON cultural_calendar_participation
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_calendar_participation_target();

INSERT INTO schema_migrations(version) VALUES('028_v42_cultural_calendar') ON CONFLICT DO NOTHING;
