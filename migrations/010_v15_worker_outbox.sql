CREATE TABLE IF NOT EXISTS outbox_events (
  id text PRIMARY KEY,
  topic text NOT NULL,
  aggregate_type text,
  aggregate_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PROCESSING','COMPLETED','DEAD')),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  max_attempts integer NOT NULL DEFAULT 12 CHECK(max_attempts>0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_idempotency_idx
  ON outbox_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS outbox_events_ready_idx
  ON outbox_events(status,available_at,created_at) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS outbox_events_processing_idx
  ON outbox_events(locked_at) WHERE status='PROCESSING';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_outbox_id text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_outbox_idx
  ON notifications(source_outbox_id) WHERE source_outbox_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES('010_v15_worker_outbox') ON CONFLICT DO NOTHING;
