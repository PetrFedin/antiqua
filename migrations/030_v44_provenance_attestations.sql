-- v0.44 External provenance attestations and issuer registry.
-- Antiqua stores public issuer keys and signed assertions only. Private issuer
-- keys never enter the platform.

CREATE TABLE IF NOT EXISTS provenance_attestation_issuers (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  key_id text NOT NULL,
  algorithm text NOT NULL CHECK (algorithm IN ('Ed25519')),
  public_key_pem text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
  organization_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,key_id)
);

CREATE TABLE IF NOT EXISTS provenance_attestations (
  id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  passport_revision_id text NOT NULL REFERENCES object_passport_revisions(id) ON DELETE RESTRICT,
  issuer_id text NOT NULL REFERENCES provenance_attestation_issuers(id) ON DELETE RESTRICT,
  key_id text NOT NULL,
  assertion_type text NOT NULL CHECK (assertion_type IN ('SUPPORT','CONTRADICT','NOTE')),
  assertion_scope text NOT NULL CHECK (assertion_scope IN ('AUTHENTICITY','ATTRIBUTION','PROVENANCE','PROVENANCE_EVENT')),
  statement text NOT NULL,
  evidence_ref text,
  payload jsonb NOT NULL,
  signature_b64 text NOT NULL,
  credential_sha256 char(64) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REVOKED')),
  issued_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text,
  revocation_reason text
);

CREATE INDEX IF NOT EXISTS provenance_attestations_object_idx
  ON provenance_attestations(object_id,issued_at DESC);
CREATE INDEX IF NOT EXISTS provenance_attestations_revision_idx
  ON provenance_attestations(passport_revision_id,status,issued_at DESC);
CREATE INDEX IF NOT EXISTS provenance_attestations_issuer_idx
  ON provenance_attestations(issuer_id,status,issued_at DESC);

INSERT INTO schema_migrations(version)
VALUES('030_v44_provenance_attestations')
ON CONFLICT DO NOTHING;
