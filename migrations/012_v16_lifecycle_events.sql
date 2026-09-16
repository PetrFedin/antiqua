CREATE TABLE IF NOT EXISTS lifecycle_events (
  id text PRIMARY KEY,
  contract_version text NOT NULL,
  domain text NOT NULL CHECK(domain IN('ORDER','SETTLEMENT','SHIPMENT','PAYOUT','DISPUTE','VERIFICATION','PUBLICATION','MEDIA')),
  aggregate_id text NOT NULL,
  action text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  authority text NOT NULL CHECK(authority IN('BUYER','SELLER','OPERATOR','PROVIDER','SYSTEM')),
  audit_action text NOT NULL,
  outbox_topic text NOT NULL,
  source_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_events_source_idx
  ON lifecycle_events(domain,aggregate_id,source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS lifecycle_events_aggregate_idx
  ON lifecycle_events(domain,aggregate_id,created_at,id);

CREATE INDEX IF NOT EXISTS lifecycle_events_created_idx
  ON lifecycle_events(created_at,id);
