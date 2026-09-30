-- ANTIQUA v0.39 Pilot Governance & Independent Verification.
CREATE TABLE IF NOT EXISTS dealer_pilot_governance (
 pilot_id text PRIMARY KEY REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 quorum_required integer NOT NULL DEFAULT 1 CHECK(quorum_required>=1),
 final_quorum_required integer NOT NULL DEFAULT 1 CHECK(final_quorum_required>=1),
 public_receipt_enabled boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dealer_pilot_counterparty_versions (
 id text PRIMARY KEY,counterparty_id text NOT NULL REFERENCES dealer_pilot_counterparties(id) ON DELETE CASCADE,
 pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 version integer NOT NULL,email text NOT NULL,display_name text NOT NULL,role_label text NOT NULL,
 status text NOT NULL,token_hash text,expires_at timestamptz,reason text,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(counterparty_id,version)
);
CREATE TABLE IF NOT EXISTS dealer_pilot_resolutions (
 id text PRIMARY KEY,pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 objection_review_id text NOT NULL REFERENCES dealer_pilot_reviews(id) ON DELETE CASCADE,
 resolution_type text NOT NULL CHECK(resolution_type IN('ACCEPTED_AS_IS','SUPERSEDED','WITHDRAWN','REJECTED')),
 resolution_comment text,source_key text NOT NULL,payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 digest text NOT NULL,signature text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pilot_id,source_key)
);
CREATE TABLE IF NOT EXISTS dealer_pilot_checkpoint_supersessions (
 id text PRIMARY KEY,pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 superseded_event_id text NOT NULL,new_event_id text NOT NULL,reason text NOT NULL,
 source_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(pilot_id,source_key)
);
CREATE TABLE IF NOT EXISTS dealer_pilot_public_receipts (
 id text PRIMARY KEY,pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 receipt_code text UNIQUE NOT NULL,certificate_digest text NOT NULL,certificate_signature text NOT NULL,
 public_payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz
);
INSERT INTO schema_migrations(version) VALUES('025_v39_pilot_governance_verification') ON CONFLICT DO NOTHING;