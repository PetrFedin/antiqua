CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  seller_id text UNIQUE NOT NULL,
  organization_type text NOT NULL DEFAULT 'DEALER' CHECK(organization_type IN('DEALER','GALLERY','AUCTION_HOUSE','PRIVATE_SELLER','OTHER')),
  name text NOT NULL,
  legal_name text,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED','CLOSED')),
  verified boolean NOT NULL DEFAULT false,
  city jsonb NOT NULL DEFAULT '{}'::jsonb,
  country jsonb NOT NULL DEFAULT '{}'::jsonb,
  specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  about jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations(status,updated_at DESC);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN('OWNER','ADMIN','CATALOGUER','SALES','FINANCE','LOGISTICS','VIEWER')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED','REMOVED')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,account_id)
);
CREATE INDEX IF NOT EXISTS organization_members_account_idx ON organization_members(account_id,status,organization_id);

CREATE TABLE IF NOT EXISTS dealer_profiles (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  website text,
  public_email text,
  public_phone text,
  shipping_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  return_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  storefront_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_locations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  location_type text NOT NULL DEFAULT 'BUSINESS' CHECK(location_type IN('BUSINESS','SHOWROOM','WAREHOUSE','PICKUP','RETURN')),
  country_code text,
  city text,
  address_line text,
  postal_code text,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_locations_org_idx ON organization_locations(organization_id,location_type);

INSERT INTO organizations(id,seller_id,organization_type,name,slug,status,verified,city,country,specialties,about,public_policies,created_at,updated_at)
SELECT 'org-'||a.id,a.seller_id,'DEALER',a.display_name,a.seller_id,'ACTIVE',false,
       jsonb_build_object('en','Not set','ru','Не указано'),jsonb_build_object('en','Not set','ru','Не указано'),'[]'::jsonb,
       jsonb_build_object('en','ANTIQUA seller','ru','Продавец ANTIQUA'),jsonb_build_object('en','Not set','ru','Не указано'),a.created_at,now()
FROM accounts a
WHERE a.seller_id IS NOT NULL
ON CONFLICT(seller_id) DO NOTHING;

INSERT INTO organization_members(organization_id,account_id,role,status,joined_at,updated_at)
SELECT o.id,a.id,'OWNER','ACTIVE',a.created_at,now()
FROM accounts a JOIN organizations o ON o.seller_id=a.seller_id
WHERE a.seller_id IS NOT NULL
ON CONFLICT(organization_id,account_id) DO NOTHING;

INSERT INTO dealer_profiles(organization_id,updated_at)
SELECT id,now() FROM organizations
ON CONFLICT(organization_id) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES('011_v15_durable_organizations') ON CONFLICT DO NOTHING;
