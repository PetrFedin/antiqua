-- ANTIQUA v0.37 Real Dealer Pilot Authority.
-- Durable pilot engagements, frozen contracts, immutable checkpoints/evidence and acknowledgements.

CREATE TABLE IF NOT EXISTS dealer_pilot_engagements (
 id text PRIMARY KEY,
 seller_id text NOT NULL,
 name text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 baseline jsonb,
 inventory_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
 kpi_contract jsonb NOT NULL DEFAULT '[]'::jsonb,
 contract_frozen_at timestamptz,
 contract_digest text,
 created_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS dealer_pilot_engagements_seller_idx ON dealer_pilot_engagements(seller_id,status,starts_at DESC);

CREATE TABLE IF NOT EXISTS dealer_pilot_events (
 id text PRIMARY KEY,
 pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 event_type text NOT NULL CHECK(event_type IN('CREATED','CONTRACT_FROZEN','ACTIVATED','CHECKPOINT_SIGNED','EVIDENCE_ATTACHED','DEALER_ACKNOWLEDGED','FINAL_PACK_SIGNED','COMPLETED','CANCELLED')),
 actor_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
 source_key text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 digest text NOT NULL,
 signature text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pilot_id,source_key)
);
CREATE INDEX IF NOT EXISTS dealer_pilot_events_timeline_idx ON dealer_pilot_events(pilot_id,created_at,id);

CREATE TABLE IF NOT EXISTS dealer_pilot_evidence (
 id text PRIMARY KEY,
 pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 checkpoint_label text,
 evidence_type text NOT NULL CHECK(evidence_type IN('URL','DOCUMENT_REF','NOTE','METRIC_SNAPSHOT')),
 reference text NOT NULL,
 sha256 text,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 added_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dealer_pilot_evidence_idx ON dealer_pilot_evidence(pilot_id,created_at,id);

INSERT INTO schema_migrations(version) VALUES('023_v37_real_dealer_pilot') ON CONFLICT DO NOTHING;
