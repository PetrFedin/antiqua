-- ANTIQUA v0.45 Scoped Scholarly Credentials.
-- Credential proves a bounded role/scope, never correctness of a scholarly conclusion.

CREATE TABLE IF NOT EXISTS scholarly_credentials (
  id text PRIMARY KEY,
  issuer_organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  subject_organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
  credential_type text NOT NULL CHECK(credential_type IN(
    'CATALOGUE_COMMITTEE_MEMBER','INSTITUTIONAL_CONTRIBUTOR','PROVENANCE_REVIEW_PARTICIPANT',
    'CATALOGUE_RAISONNE_RESEARCHER','IIIF_LINKED_ART_INTEGRATION_PARTNER','OTHER'
  )),
  project_ref text NOT NULL,
  role_label text NOT NULL,
  scope jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE','REVOKED','SUPERSEDED','EXPIRED')),
  valid_from timestamptz,
  valid_until timestamptz,
  supersedes_credential_id text REFERENCES scholarly_credentials(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revocation_reason text,
  issued_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(subject_account_id IS NOT NULL OR subject_organization_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS scholarly_credentials_subject_idx ON scholarly_credentials(subject_account_id,subject_organization_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS scholarly_credentials_issuer_idx ON scholarly_credentials(issuer_organization_id,status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('031_v45_scoped_scholarly_credentials') ON CONFLICT DO NOTHING;
