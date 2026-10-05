-- ANTIQUA v0.43 Art Week / Fair Programme authority.
-- Programmes group canonical Cultural Events and Exhibitions without duplicating them.

CREATE TABLE IF NOT EXISTS cultural_programmes (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  programme_type text NOT NULL CHECK(programme_type IN('ART_WEEK','ART_FAIR','BIENNALE','FESTIVAL','GALLERY_WEEKEND','CITY_PROGRAMME','INSTITUTIONAL_PROGRAMME','OTHER')),
  title jsonb NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  organizer_organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'UTC',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  official_source_url text,
  cover_object_id text REFERENCES objects(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','REVIEW_PENDING','PUBLISHED','CANCELLED','ARCHIVED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS cultural_programmes_public_idx ON cultural_programmes(status,visibility,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS cultural_programmes_organizer_idx ON cultural_programmes(organizer_organization_id,status,starts_at);

CREATE TABLE IF NOT EXISTS cultural_programme_entries (
  programme_id text NOT NULL REFERENCES cultural_programmes(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK(entity_type IN('EVENT','EXHIBITION')),
  entity_id text NOT NULL,
  day_label jsonb NOT NULL DEFAULT '{}'::jsonb,
  neighbourhood jsonb NOT NULL DEFAULT '{}'::jsonb,
  zone jsonb NOT NULL DEFAULT '{}'::jsonb,
  featured boolean NOT NULL DEFAULT false,
  official boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(programme_id,entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS cultural_programme_entries_target_idx ON cultural_programme_entries(entity_type,entity_id);

CREATE OR REPLACE FUNCTION antiqua_validate_programme_entry_target()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_type='EVENT' THEN
    IF NOT EXISTS(SELECT 1 FROM cultural_events WHERE id=NEW.entity_id) THEN
      RAISE EXCEPTION 'programme event target does not exist' USING ERRCODE='23503';
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM exhibitions WHERE id=NEW.entity_id) THEN
      RAISE EXCEPTION 'programme exhibition target does not exist' USING ERRCODE='23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cultural_programme_entry_target_guard ON cultural_programme_entries;
CREATE TRIGGER cultural_programme_entry_target_guard
BEFORE INSERT OR UPDATE OF entity_type,entity_id ON cultural_programme_entries
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_programme_entry_target();

CREATE TABLE IF NOT EXISTS cultural_programme_day_plan_items (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  programme_id text NOT NULL REFERENCES cultural_programmes(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK(entity_type IN('EVENT','EXHIBITION')),
  entity_id text NOT NULL,
  local_date date NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  private_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,programme_id,entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS cultural_programme_day_plan_account_idx ON cultural_programme_day_plan_items(account_id,programme_id,local_date,sort_order);

CREATE OR REPLACE FUNCTION antiqua_validate_programme_day_plan_item()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM cultural_programme_entries e
    WHERE e.programme_id=NEW.programme_id AND e.entity_type=NEW.entity_type AND e.entity_id=NEW.entity_id
  ) THEN
    RAISE EXCEPTION 'day plan target is not in programme' USING ERRCODE='23503';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM cultural_calendar_participation p
    WHERE p.account_id=NEW.account_id AND p.entity_type=NEW.entity_type AND p.entity_id=NEW.entity_id AND p.state='PLANNED'
  ) THEN
    RAISE EXCEPTION 'day plan target must already be PLANNED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cultural_programme_day_plan_guard ON cultural_programme_day_plan_items;
CREATE TRIGGER cultural_programme_day_plan_guard
BEFORE INSERT OR UPDATE OF account_id,programme_id,entity_type,entity_id ON cultural_programme_day_plan_items
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_programme_day_plan_item();

INSERT INTO schema_migrations(version) VALUES('029_v43_art_week_programme') ON CONFLICT DO NOTHING;
