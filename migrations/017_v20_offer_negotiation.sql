-- ANTIQUA v0.20 durable offer negotiation authority.

ALTER TABLE offers ADD COLUMN IF NOT EXISTS version bigint;
UPDATE offers SET version=COALESCE(version,0) WHERE version IS NULL;
ALTER TABLE offers ALTER COLUMN version SET DEFAULT 0;
ALTER TABLE offers ALTER COLUMN version SET NOT NULL;

ALTER TABLE lifecycle_events DROP CONSTRAINT IF EXISTS lifecycle_events_domain_check;
ALTER TABLE lifecycle_events ADD CONSTRAINT lifecycle_events_domain_check
  CHECK(domain IN('ORDER','OFFER','SETTLEMENT','SHIPMENT','PAYOUT','DISPUTE','VERIFICATION','PUBLICATION','MEDIA'));

CREATE INDEX IF NOT EXISTS offers_listing_buyer_state_idx
  ON offers(listing_id,buyer_account_id,status,updated_at DESC);

INSERT INTO schema_migrations(version) VALUES('017_v20_offer_negotiation') ON CONFLICT DO NOTHING;
