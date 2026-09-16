ALTER TABLE ownership_events ADD COLUMN IF NOT EXISTS sequence_no bigint;
ALTER TABLE ownership_events ADD COLUMN IF NOT EXISTS idempotency_key text;

WITH ranked AS (
  SELECT id,row_number() OVER(PARTITION BY object_id ORDER BY occurred_at,created_at,id) AS rn
  FROM ownership_events
  WHERE sequence_no IS NULL
)
UPDATE ownership_events e SET sequence_no=ranked.rn FROM ranked WHERE e.id=ranked.id;

ALTER TABLE ownership_events ALTER COLUMN sequence_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ownership_events_object_sequence_idx
  ON ownership_events(object_id,sequence_no);

CREATE UNIQUE INDEX IF NOT EXISTS ownership_events_idempotency_idx
  ON ownership_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ownership_events_source_idx
  ON ownership_events(object_id,source_type,source_id,event_type)
  WHERE source_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES('009_v15_ownership_invariants') ON CONFLICT DO NOTHING;
