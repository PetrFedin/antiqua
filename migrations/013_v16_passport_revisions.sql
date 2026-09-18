CREATE TABLE IF NOT EXISTS object_passport_revisions(
  id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK(revision_no>0),
  passport jsonb NOT NULL,
  passport_hash text NOT NULL CHECK(passport_hash ~ '^[0-9a-f]{64}$'),
  previous_hash text CHECK(previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
  change_kind text NOT NULL CHECK(change_kind IN('INITIAL','CATALOGUE_CORRECTION','ATTRIBUTION_UPDATE','PROVENANCE_UPDATE','CONDITION_UPDATE','EVIDENCE_UPDATE','ADMINISTRATIVE_CORRECTION')),
  change_reason text NOT NULL CHECK(length(trim(change_reason))>0),
  public_summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(public_summary)='object'),
  actor_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  authority text NOT NULL CHECK(authority IN('SYSTEM','CATALOGUER','TRUST_REVIEWER','MIGRATION')),
  source_key text,
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(object_id,revision_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS object_passport_revision_source_unique
  ON object_passport_revisions(object_id,source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS object_passport_revision_object_created_idx
  ON object_passport_revisions(object_id,revision_no DESC);

CREATE TABLE IF NOT EXISTS object_passport_revision_evidence(
  revision_id text NOT NULL REFERENCES object_passport_revisions(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL CHECK(evidence_type IN('MEDIA','PROVENANCE','CATALOGUE_REVIEW')),
  evidence_id text NOT NULL,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PUBLIC','PRIVATE','INTERNAL')),
  evidence_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(revision_id,evidence_type,evidence_id)
);
CREATE INDEX IF NOT EXISTS object_passport_revision_evidence_lookup_idx
  ON object_passport_revision_evidence(evidence_type,evidence_id);

CREATE OR REPLACE FUNCTION antiqua_prevent_passport_revision_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'object passport revision history is immutable' USING ERRCODE='55000';
END $$;

DROP TRIGGER IF EXISTS object_passport_revisions_immutable_update ON object_passport_revisions;
CREATE TRIGGER object_passport_revisions_immutable_update
BEFORE UPDATE OR DELETE ON object_passport_revisions
FOR EACH ROW EXECUTE FUNCTION antiqua_prevent_passport_revision_update();

DROP TRIGGER IF EXISTS object_passport_revision_evidence_immutable_update ON object_passport_revision_evidence;
CREATE TRIGGER object_passport_revision_evidence_immutable_update
BEFORE UPDATE OR DELETE ON object_passport_revision_evidence
FOR EACH ROW EXECUTE FUNCTION antiqua_prevent_passport_revision_update();
