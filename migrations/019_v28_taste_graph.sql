-- ANTIQUA v0.28 Taste Graph Authority.
-- Adds only missing explicit taste signals; stronger commercial/collection facts remain authoritative in their existing domains.

ALTER TABLE discovery_subscriptions
  DROP CONSTRAINT IF EXISTS discovery_subscriptions_subscription_type_check;
ALTER TABLE discovery_subscriptions
  ADD CONSTRAINT discovery_subscriptions_subscription_type_check
  CHECK (subscription_type IN ('SAVED_SEARCH','FOLLOW_SELLER','FOLLOW_MAKER','FOLLOW_CATEGORY','WANTED'));

CREATE TABLE IF NOT EXISTS taste_signal_events (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE RESTRICT,
  signal_type text NOT NULL CHECK (signal_type IN ('ENGAGED_VIEW','DISMISSED')),
  source_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,source_key)
);
CREATE INDEX IF NOT EXISTS taste_signal_account_idx
  ON taste_signal_events(account_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS taste_signal_object_idx
  ON taste_signal_events(object_id,signal_type,occurred_at DESC);

CREATE OR REPLACE FUNCTION antiqua_taste_signal_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'taste_signal_events are immutable' USING ERRCODE='55000';
END $$;

DROP TRIGGER IF EXISTS taste_signal_immutable_trg ON taste_signal_events;
CREATE TRIGGER taste_signal_immutable_trg
BEFORE UPDATE OR DELETE ON taste_signal_events
FOR EACH ROW EXECUTE FUNCTION antiqua_taste_signal_immutable();

INSERT INTO schema_migrations(version) VALUES('019_v28_taste_graph') ON CONFLICT DO NOTHING;
