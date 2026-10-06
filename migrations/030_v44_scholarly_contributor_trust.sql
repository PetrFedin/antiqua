-- ANTIQUA v0.44 Scholarly Contributor Trust Graph.
-- Factual scholarly participation only. No popularity score, no universal expert rank.

CREATE TABLE IF NOT EXISTS scholarly_contributions (
  id text PRIMARY KEY,
  contributor_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  contributor_organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
  expertise_claim_id text REFERENCES expertise_claims(id) ON DELETE SET NULL,
  contribution_type text NOT NULL CHECK(contribution_type IN(
    'PROVENANCE_REVIEW','SOURCE_REVIEW','ATTRIBUTION_OPINION','CATALOGUE_REVIEW',
    'EXHIBITION_RESEARCH','BIBLIOGRAPHY_REVIEW','CONDITION_RESEARCH','OTHER'
  )),
  subject_type text NOT NULL CHECK(subject_type IN('OBJECT','PROVENANCE_EVENT','SOURCE','CREATOR','EXHIBITION','PUBLICATION_REVISION')),
  subject_id text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  disclosure jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SUBMITTED','REVIEWED','PUBLISHED','REJECTED','WITHDRAWN')),
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(contributor_account_id IS NOT NULL OR contributor_organization_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS scholarly_contributions_subject_idx ON scholarly_contributions(subject_type,subject_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS scholarly_contributions_contributor_idx ON scholarly_contributions(contributor_account_id,contributor_organization_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS scholarly_contribution_evidence_links (
  contribution_id text NOT NULL REFERENCES scholarly_contributions(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK(evidence_type IN('PROVENANCE_ENTRY','PASSPORT_REVISION','DOCUMENT','BIBLIOGRAPHY','EXHIBITION','MEDIA','OTHER')),
  evidence_id text NOT NULL,
  relation_type text NOT NULL DEFAULT 'SUPPORTS' CHECK(relation_type IN('SUPPORTS','CONTRADICTS','REVIEWS','CITES','REQUESTS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(contribution_id,evidence_type,evidence_id,relation_type)
);

CREATE TABLE IF NOT EXISTS scholarly_affiliations (
  id text PRIMARY KEY,
  account_id text REFERENCES accounts(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_label text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'EVIDENCE_SUBMITTED' CHECK(status IN('EVIDENCE_SUBMITTED','VERIFIED','REJECTED','EXPIRED')),
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version) VALUES('030_v44_scholarly_contributor_trust') ON CONFLICT DO NOTHING;
