CREATE TABLE IF NOT EXISTS discovery_matches (
  subscription_id text NOT NULL REFERENCES discovery_subscriptions(id) ON DELETE CASCADE,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  matched_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY(subscription_id,object_id)
);
CREATE INDEX IF NOT EXISTS discovery_matches_object_idx ON discovery_matches(object_id,matched_at DESC);
