-- ANTIQUA v0.33 Partner Pilot Analytics.
-- Attribution evidence is separate from commercial authorities. It measures only partner-originated journeys.

CREATE TABLE IF NOT EXISTS partner_attribution_events (
  id text PRIMARY KEY,
  exhibition_id text NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  viewer_key_hash text NOT NULL,
  event_type text NOT NULL CHECK(event_type IN(
    'DROP_OPEN','OBJECT_OPEN','FOLLOW',
    'INQUIRY_CREATED','CONDITION_REQUESTED','VIEWING_REQUESTED',
    'OFFER_CREATED','ORDER_CREATED'
  )),
  target_key text NOT NULL,
  object_id text REFERENCES objects(id) ON DELETE SET NULL,
  source_entity_id text,
  window_started_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK(viewer_key_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_attribution_exposure_uq
  ON partner_attribution_events(exhibition_id,event_type,target_key,viewer_key_hash,window_started_at)
  WHERE source_entity_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS partner_attribution_explicit_uq
  ON partner_attribution_events(exhibition_id,event_type,source_entity_id)
  WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partner_attribution_exhibition_idx
  ON partner_attribution_events(exhibition_id,event_type,occurred_at DESC);

CREATE INDEX IF NOT EXISTS partner_attribution_account_idx
  ON partner_attribution_events(account_id,occurred_at DESC)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partner_attribution_object_idx
  ON partner_attribution_events(object_id,event_type,occurred_at DESC)
  WHERE object_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES('023_v33_partner_pilot_analytics') ON CONFLICT DO NOTHING;
