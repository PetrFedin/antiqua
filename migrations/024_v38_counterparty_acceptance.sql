-- ANTIQUA v0.38 Pilot Operations & Counterparty Acceptance.
CREATE TABLE IF NOT EXISTS dealer_pilot_counterparties(
 id text PRIMARY KEY,pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 email text NOT NULL,display_name text NOT NULL,role_label text NOT NULL DEFAULT 'DEALER_REPRESENTATIVE',
 token_hash text UNIQUE NOT NULL,status text NOT NULL DEFAULT 'INVITED' CHECK(status IN('INVITED','ACCEPTED','REVOKED','EXPIRED')),
 expires_at timestamptz NOT NULL,accepted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pilot_id,email)
);
CREATE INDEX IF NOT EXISTS dealer_pilot_counterparties_pilot_idx ON dealer_pilot_counterparties(pilot_id,status);
CREATE TABLE IF NOT EXISTS dealer_pilot_reviews(
 id text PRIMARY KEY,pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 counterparty_id text NOT NULL REFERENCES dealer_pilot_counterparties(id) ON DELETE CASCADE,
 checkpoint_event_id text,review_type text NOT NULL CHECK(review_type IN('CONTRACT_ACCEPTED','CHECKPOINT_ACCEPTED','CHECKPOINT_OBJECTION','FINAL_ACCEPTED','FINAL_OBJECTION')),
 comment text,source_key text NOT NULL,payload jsonb NOT NULL DEFAULT '{}'::jsonb,digest text NOT NULL,signature text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(pilot_id,source_key)
);
CREATE INDEX IF NOT EXISTS dealer_pilot_reviews_timeline_idx ON dealer_pilot_reviews(pilot_id,created_at,id);
INSERT INTO schema_migrations(version) VALUES('024_v38_counterparty_acceptance') ON CONFLICT DO NOTHING;