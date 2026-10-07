-- ANTIQUA v0.46 Independent Passport Verification.
-- Public verification only; no private owner/dealer evidence is exposed.

CREATE TABLE IF NOT EXISTS provenance_verification_records (
  id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  revision_id text REFERENCES object_passport_revisions(id) ON DELETE SET NULL,
  evidence_package_sha256 text NOT NULL,
  bundle_sha256 text,
  verification_status text NOT NULL CHECK(verification_status IN('MATCH','MISMATCH','SUPERSEDED','NOT_FOUND')),
  requested_hash text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  public_projection jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS provenance_verification_records_object_idx ON provenance_verification_records(object_id,verified_at DESC);

INSERT INTO schema_migrations(version) VALUES('033_v46_independent_passport_verification') ON CONFLICT DO NOTHING;
