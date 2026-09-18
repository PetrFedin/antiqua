CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS objects_discovery_fts_idx
  ON objects USING gin (to_tsvector('simple', coalesce(passport::text,'')))
  WHERE publication_status='PUBLIC';

CREATE INDEX IF NOT EXISTS objects_discovery_trgm_idx
  ON objects USING gin ((lower(passport::text)) gin_trgm_ops)
  WHERE publication_status='PUBLIC';

CREATE INDEX IF NOT EXISTS discovery_subscriptions_active_idx
  ON discovery_subscriptions(updated_at,id)
  WHERE status='ACTIVE';

CREATE INDEX IF NOT EXISTS listings_discovery_active_idx
  ON listings(object_id,updated_at DESC)
  WHERE status='ACTIVE';

CREATE INDEX IF NOT EXISTS auctions_discovery_open_idx
  ON auctions(object_id,updated_at DESC)
  WHERE status<>'CLOSED';

INSERT INTO schema_migrations(version) VALUES('014_v16_discovery_postgres_matching') ON CONFLICT DO NOTHING;
