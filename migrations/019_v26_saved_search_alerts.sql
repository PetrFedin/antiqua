-- ANTIQUA v0.26 Saved Search & Market Alerts.
-- Extends the existing discovery subscription authority with deterministic delivery scheduling.

ALTER TABLE discovery_subscriptions
  ADD COLUMN IF NOT EXISTS delivery_mode text;
ALTER TABLE discovery_subscriptions
  ADD COLUMN IF NOT EXISTS digest_hour_utc smallint;
ALTER TABLE discovery_subscriptions
  ADD COLUMN IF NOT EXISTS next_digest_at timestamptz;
ALTER TABLE discovery_subscriptions
  ADD COLUMN IF NOT EXISTS last_digest_at timestamptz;

UPDATE discovery_subscriptions SET delivery_mode='IMMEDIATE' WHERE delivery_mode IS NULL;
UPDATE discovery_subscriptions SET digest_hour_utc=8 WHERE digest_hour_utc IS NULL;

ALTER TABLE discovery_subscriptions ALTER COLUMN delivery_mode SET DEFAULT 'IMMEDIATE';
ALTER TABLE discovery_subscriptions ALTER COLUMN delivery_mode SET NOT NULL;
ALTER TABLE discovery_subscriptions ALTER COLUMN digest_hour_utc SET DEFAULT 8;
ALTER TABLE discovery_subscriptions ALTER COLUMN digest_hour_utc SET NOT NULL;

DO $v26$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='discovery_subscriptions_delivery_mode_ck') THEN
    ALTER TABLE discovery_subscriptions
      ADD CONSTRAINT discovery_subscriptions_delivery_mode_ck
      CHECK(delivery_mode IN('IMMEDIATE','DAILY_DIGEST'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='discovery_subscriptions_digest_hour_ck') THEN
    ALTER TABLE discovery_subscriptions
      ADD CONSTRAINT discovery_subscriptions_digest_hour_ck
      CHECK(digest_hour_utc BETWEEN 0 AND 23);
  END IF;
END $v26$;

CREATE INDEX IF NOT EXISTS discovery_subscriptions_digest_due_idx
  ON discovery_subscriptions(next_digest_at,id)
  WHERE status='ACTIVE' AND delivery_mode='DAILY_DIGEST';

INSERT INTO schema_migrations(version) VALUES('019_v26_saved_search_alerts') ON CONFLICT DO NOTHING;
