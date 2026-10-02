-- ANTIQUA v0.41 Art Network identity & trust foundation.
-- Public cultural identity is a reviewed projection over Account / Creator / Organization authorities.
-- It does not create a second authentication, creator, gallery or expertise authority.

ALTER TABLE organizations ALTER COLUMN seller_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS art_profiles (
  account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  display_name jsonb NOT NULL,
  biography jsonb NOT NULL DEFAULT '{}'::jsonb,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  participant_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','PSEUDONYMOUS','PUBLIC')),
  profile_status text NOT NULL DEFAULT 'DRAFT' CHECK(profile_status IN('DRAFT','REVIEW_PENDING','PUBLISHED','ARCHIVED')),
  avatar_url text,
  website text,
  collaboration_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS art_profiles_public_idx ON art_profiles(profile_status,visibility,updated_at DESC);

CREATE TABLE IF NOT EXISTS art_profile_creator_claims (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK(relationship_type IN('SELF','ESTATE_REPRESENTATIVE','STUDIO_REPRESENTATIVE','AUTHORIZED_REPRESENTATIVE')),
  status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(status IN('SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,creator_id,relationship_type)
);
CREATE INDEX IF NOT EXISTS art_profile_creator_claims_public_idx ON art_profile_creator_claims(account_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS expertise_claims (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expertise_type text NOT NULL CHECK(expertise_type IN('ARTIST','MOVEMENT','PERIOD','MEDIUM','PRINTMAKING','CONSERVATION','PROVENANCE','REGION','CATALOGUE_RAISONE','OTHER')),
  scope jsonb NOT NULL,
  status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(status IN('SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expertise_claims_public_idx ON expertise_claims(account_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS art_profile_organization_selections (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  publicly_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,organization_id)
);

CREATE TABLE IF NOT EXISTS organization_cultural_profiles (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  profile_status text NOT NULL DEFAULT 'DRAFT' CHECK(profile_status IN('DRAFT','REVIEW_PENDING','PUBLISHED','ARCHIVED')),
  cultural_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
  programming_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  collaboration_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  hero_image text,
  reviewed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_cultural_profiles_public_idx ON organization_cultural_profiles(profile_status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('027_v41_art_network_identity') ON CONFLICT DO NOTHING;
