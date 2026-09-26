-- ANTIQUA v0.30 Creator & Gallery Graph.
-- Creator identity is separate from free-text catalogue attribution.
-- Primary-market authority follows explicit representation; secondary market remains independent.

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_organization_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_organization_type_check
  CHECK(organization_type IN('DEALER','GALLERY','AUCTION_HOUSE','PRIVATE_SELLER','DESIGN_STUDIO','CRAFT_STUDIO','FAIR','FOUNDATION','INSTITUTION','OTHER'));

CREATE TABLE IF NOT EXISTS creators (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  creator_type text NOT NULL CHECK(creator_type IN('ARTIST','DESIGNER','MAKER','CRAFTSPERSON','WORKSHOP','COLLECTIVE','ESTATE')),
  display_name jsonb NOT NULL,
  biography jsonb NOT NULL DEFAULT '{}'::jsonb,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  disciplines jsonb NOT NULL DEFAULT '[]'::jsonb,
  sales_model text NOT NULL DEFAULT 'UNSPECIFIED' CHECK(sales_model IN('UNSPECIFIED','INDEPENDENT','REPRESENTED','ESTATE')),
  profile_status text NOT NULL DEFAULT 'DRAFT' CHECK(profile_status IN('DRAFT','PUBLISHED','ARCHIVED')),
  evidence_status text NOT NULL DEFAULT 'SELF_DECLARED' CHECK(evidence_status IN('SELF_DECLARED','ORGANIZATION_CONFIRMED','PLATFORM_REVIEWED')),
  managed_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creators_public_idx ON creators(profile_status,updated_at DESC);

CREATE TABLE IF NOT EXISTS creator_representations (
  id text PRIMARY KEY,
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK(relationship_type IN('EXCLUSIVE','NON_EXCLUSIVE','PROJECT','ESTATE','MANAGEMENT')),
  primary_sales_authorized boolean NOT NULL DEFAULT true,
  direct_sales_allowed boolean NOT NULL DEFAULT false,
  territory text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK(status IN('PROPOSED','ACTIVE','ENDED')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id,organization_id,relationship_type,status)
);
CREATE INDEX IF NOT EXISTS creator_representations_active_idx ON creator_representations(creator_id,status,organization_id);

CREATE TABLE IF NOT EXISTS creator_object_links (
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  creator_role text NOT NULL CHECK(creator_role IN('ARTIST','DESIGNER','MAKER','WORKSHOP','AUTHOR','MANUFACTURER')),
  attribution_status text NOT NULL DEFAULT 'CATALOGUED' CHECK(attribution_status IN('SELF_DECLARED','CATALOGUED','DOCUMENTED','PLATFORM_REVIEWED')),
  market_context text NOT NULL DEFAULT 'UNKNOWN' CHECK(market_context IN('PRIMARY','SECONDARY','ARCHIVAL','UNKNOWN')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(creator_id,object_id,creator_role)
);
CREATE INDEX IF NOT EXISTS creator_object_links_object_idx ON creator_object_links(object_id,creator_id);

CREATE TABLE IF NOT EXISTS creator_follows (
  creator_id text NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(creator_id,account_id)
);
CREATE INDEX IF NOT EXISTS creator_follows_account_idx ON creator_follows(account_id,status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('021_v30_creator_gallery_graph') ON CONFLICT DO NOTHING;
