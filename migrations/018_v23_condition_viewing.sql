-- ANTIQUA v0.23 Condition Report & Viewing Requests.
-- Structured commercial service workflows; messaging remains contextual but is not authority.

CREATE TABLE IF NOT EXISTS condition_report_requests (
  id text PRIMARY KEY,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  buyer_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','FULFILLED','CANCELLED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  current_report_version integer,
  note text,
  create_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_account_id,create_idempotency_key)
);
CREATE INDEX IF NOT EXISTS condition_report_buyer_idx ON condition_report_requests(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS condition_report_seller_idx ON condition_report_requests(seller_id,status,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS condition_report_open_idx
  ON condition_report_requests(buyer_account_id,listing_id)
  WHERE status='REQUESTED';

CREATE TABLE IF NOT EXISTS condition_report_versions (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES condition_report_requests(id) ON DELETE RESTRICT,
  version_no integer NOT NULL CHECK(version_no>0),
  media_id text NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  summary text,
  condition_grade text,
  restoration_notes text,
  created_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,version_no),
  UNIQUE(request_id,media_id)
);
CREATE INDEX IF NOT EXISTS condition_report_versions_idx ON condition_report_versions(request_id,version_no DESC);

CREATE TABLE IF NOT EXISTS condition_report_events (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES condition_report_requests(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  event_type text NOT NULL CHECK(event_type IN('REQUESTED','PUBLISHED','CANCELLED')),
  actor_account_id text REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_role text NOT NULL CHECK(actor_role IN('BUYER','SELLER','SYSTEM')),
  client_action_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS condition_report_event_action_idx
  ON condition_report_events(actor_account_id,client_action_id)
  WHERE actor_account_id IS NOT NULL AND client_action_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS viewing_requests (
  id text PRIMARY KEY,
  listing_id text NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  buyer_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  seller_id text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','SLOTS_PROPOSED','CONFIRMED','RESCHEDULE_REQUESTED','CANCELLED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  proposal_version integer NOT NULL DEFAULT 0 CHECK(proposal_version>=0),
  selected_slot_id text,
  note text,
  create_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_account_id,create_idempotency_key)
);
CREATE INDEX IF NOT EXISTS viewing_buyer_idx ON viewing_requests(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS viewing_seller_idx ON viewing_requests(seller_id,status,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS viewing_open_idx
  ON viewing_requests(buyer_account_id,listing_id)
  WHERE status IN('REQUESTED','SLOTS_PROPOSED','CONFIRMED');

CREATE TABLE IF NOT EXISTS viewing_slots (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES viewing_requests(id) ON DELETE RESTRICT,
  proposal_version integer NOT NULL CHECK(proposal_version>0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  created_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS viewing_slots_request_idx ON viewing_slots(request_id,proposal_version,starts_at);
DO $v23$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='viewing_selected_slot_fk') THEN
    ALTER TABLE viewing_requests
      ADD CONSTRAINT viewing_selected_slot_fk
      FOREIGN KEY(selected_slot_id) REFERENCES viewing_slots(id) ON DELETE RESTRICT;
  END IF;
END $v23$;

CREATE TABLE IF NOT EXISTS viewing_calendar_events (
  id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE REFERENCES viewing_requests(id) ON DELETE RESTRICT,
  event_uid text NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN('CONFIRMED','CANCELLED')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  sequence integer NOT NULL DEFAULT 0 CHECK(sequence>=0),
  title jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at>starts_at)
);

CREATE TABLE IF NOT EXISTS viewing_request_events (
  id text PRIMARY KEY,
  request_id text NOT NULL REFERENCES viewing_requests(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  event_type text NOT NULL CHECK(event_type IN('REQUESTED','SLOTS_PROPOSED','CONFIRMED','CANCELLED','RESCHEDULE_REQUESTED')),
  actor_account_id text REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_role text NOT NULL CHECK(actor_role IN('BUYER','SELLER','SYSTEM')),
  client_action_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS viewing_event_action_idx
  ON viewing_request_events(actor_account_id,client_action_id)
  WHERE actor_account_id IS NOT NULL AND client_action_id IS NOT NULL;

CREATE OR REPLACE FUNCTION antiqua_v23_listing_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE li listings%ROWTYPE;
BEGIN
  SELECT * INTO li FROM listings WHERE id=NEW.listing_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.object_id IS DISTINCT FROM li.object_id OR NEW.seller_id IS DISTINCT FROM li.seller_id THEN
    RAISE EXCEPTION 'Service request does not match listing object/seller' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS condition_report_listing_consistency_trg ON condition_report_requests;
CREATE TRIGGER condition_report_listing_consistency_trg
BEFORE INSERT OR UPDATE OF listing_id,object_id,seller_id ON condition_report_requests
FOR EACH ROW EXECUTE FUNCTION antiqua_v23_listing_consistency();

DROP TRIGGER IF EXISTS viewing_listing_consistency_trg ON viewing_requests;
CREATE TRIGGER viewing_listing_consistency_trg
BEFORE INSERT OR UPDATE OF listing_id,object_id,seller_id ON viewing_requests
FOR EACH ROW EXECUTE FUNCTION antiqua_v23_listing_consistency();

CREATE OR REPLACE FUNCTION antiqua_condition_report_media_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE req condition_report_requests%ROWTYPE; media media_assets%ROWTYPE;
BEGIN
  SELECT * INTO req FROM condition_report_requests WHERE id=NEW.request_id;
  SELECT * INTO media FROM media_assets WHERE id=NEW.media_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Condition report media does not exist' USING ERRCODE='23503';
  END IF;
  IF media.entity_type<>'OBJECT' OR media.entity_id<>req.object_id OR media.role<>'CONDITION' OR media.status<>'READY' THEN
    RAISE EXCEPTION 'Condition report media must be READY CONDITION media for the same object' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS condition_report_media_guard_trg ON condition_report_versions;
CREATE TRIGGER condition_report_media_guard_trg
BEFORE INSERT ON condition_report_versions
FOR EACH ROW EXECUTE FUNCTION antiqua_condition_report_media_guard();

CREATE OR REPLACE FUNCTION antiqua_v23_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'v0.23 history is immutable' USING ERRCODE='55000';
END $$;

DROP TRIGGER IF EXISTS condition_report_versions_immutable_trg ON condition_report_versions;
CREATE TRIGGER condition_report_versions_immutable_trg
BEFORE UPDATE OR DELETE ON condition_report_versions
FOR EACH ROW EXECUTE FUNCTION antiqua_v23_immutable();

DROP TRIGGER IF EXISTS condition_report_events_immutable_trg ON condition_report_events;
CREATE TRIGGER condition_report_events_immutable_trg
BEFORE UPDATE OR DELETE ON condition_report_events
FOR EACH ROW EXECUTE FUNCTION antiqua_v23_immutable();

DROP TRIGGER IF EXISTS viewing_slots_immutable_trg ON viewing_slots;
CREATE TRIGGER viewing_slots_immutable_trg
BEFORE UPDATE OR DELETE ON viewing_slots
FOR EACH ROW EXECUTE FUNCTION antiqua_v23_immutable();

DROP TRIGGER IF EXISTS viewing_events_immutable_trg ON viewing_request_events;
CREATE TRIGGER viewing_events_immutable_trg
BEFORE UPDATE OR DELETE ON viewing_request_events
FOR EACH ROW EXECUTE FUNCTION antiqua_v23_immutable();

INSERT INTO schema_migrations(version) VALUES('018_v23_condition_viewing') ON CONFLICT DO NOTHING;
