ALTER TABLE organizations ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_organization_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_organization_type_check CHECK(
  organization_type IN('DEALER','GALLERY','AUCTION_HOUSE','PRIVATE_SELLER','MUSEUM','FOUNDATION','ARCHIVE','UNIVERSITY','ASSOCIATION','OTHER')
);

CREATE TABLE IF NOT EXISTS art_profiles (
  id text PRIMARY KEY,
  account_id text UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  headline jsonb NOT NULL DEFAULT '{}'::jsonb,
  about jsonb NOT NULL DEFAULT '{}'::jsonb,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','PSEUDONYMOUS','PUBLIC')),
  avatar_url text,
  collaboration_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS art_profiles_public_idx ON art_profiles(status,visibility,updated_at DESC);

CREATE TABLE IF NOT EXISTS art_profile_role_claims (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES art_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN(
    'ARTIST','GALLERY_REPRESENTATIVE','CURATOR','EXPERT','ART_HISTORIAN',
    'RESEARCHER','COLLECTOR','ENTHUSIAST','INSTITUTION_REPRESENTATIVE'
  )),
  status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(status IN(
    'SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED'
  )),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_note text,
  reviewed_by_account_id text REFERENCES accounts(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,role)
);
CREATE INDEX IF NOT EXISTS art_profile_role_claims_profile_idx ON art_profile_role_claims(profile_id,status,role);

CREATE TABLE IF NOT EXISTS art_expertise_claims (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES art_profiles(id) ON DELETE CASCADE,
  expertise_code text NOT NULL,
  label jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(status IN(
    'SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED'
  )),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflict_disclosure jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_note text,
  reviewed_by_account_id text REFERENCES accounts(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,expertise_code)
);
CREATE INDEX IF NOT EXISTS art_expertise_claims_profile_idx ON art_expertise_claims(profile_id,status,expertise_code);

CREATE TABLE IF NOT EXISTS art_profile_creator_links (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES art_profiles(id) ON DELETE CASCADE,
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK(relationship_type IN('SELF','REPRESENTATIVE','ESTATE','STUDIO_MEMBER')),
  status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(status IN(
    'SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED'
  )),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_note text,
  reviewed_by_account_id text REFERENCES accounts(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,creator_id,relationship_type)
);
CREATE INDEX IF NOT EXISTS art_profile_creator_links_creator_idx ON art_profile_creator_links(creator_id,status,profile_id);

CREATE TABLE IF NOT EXISTS art_profile_organization_links (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES art_profiles(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK(relationship_type IN('REPRESENTATIVE','FOUNDER','DIRECTOR','CURATOR','RESEARCHER','STAFF')),
  status text NOT NULL DEFAULT 'ORGANIZATION_CONFIRMED' CHECK(status IN(
    'SELF_DECLARED','ORGANIZATION_CONFIRMED','REVIEWED','VERIFIED','REJECTED','EXPIRED'
  )),
  public boolean NOT NULL DEFAULT false,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,organization_id,relationship_type)
);
CREATE INDEX IF NOT EXISTS art_profile_organization_links_org_idx ON art_profile_organization_links(organization_id,status,public);

CREATE TABLE IF NOT EXISTS organization_cultural_profiles (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  publication_status text NOT NULL DEFAULT 'DRAFT' CHECK(publication_status IN('DRAFT','PUBLISHED','SUSPENDED')),
  review_status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(review_status IN(
    'SELF_DECLARED','EVIDENCE_SUBMITTED','REVIEWED','VERIFIED','REJECTED','EXPIRED'
  )),
  cultural_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  collaboration_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_note text,
  reviewed_by_account_id text REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_cultural_profiles_public_idx ON organization_cultural_profiles(publication_status,review_status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('027_v41_art_network_identity') ON CONFLICT DO NOTHING;
