-- v73: durable, owner-scoped, two-person collection publication decisions.
-- No existing collection acquires approval through this migration.
CREATE TABLE IF NOT EXISTS collection_publication_events(
 id text PRIMARY KEY,
 collection_id text NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
 sequence_no integer NOT NULL CHECK(sequence_no>0),
 actor_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN('SUBMIT','APPROVE','PUBLISH','REQUEST_CHANGES','REVOKE','CONTENT_CHANGED')),
 from_state text NOT NULL,
 to_state text NOT NULL,
 snapshot_hash char(64) NOT NULL CHECK(snapshot_hash~'^[a-f0-9]{64}$'),
 previous_event_hash char(64),
 event_hash char(64) NOT NULL CHECK(event_hash~'^[a-f0-9]{64}$'),
 idempotency_key text,
 request_hash char(64) NOT NULL CHECK(request_hash~'^[a-f0-9]{64}$'),
 note text NOT NULL DEFAULT '',
 media_evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(media_evidence)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(collection_id,sequence_no),
 UNIQUE(collection_id,actor_account_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS collection_publication_events_timeline_idx ON collection_publication_events(collection_id,sequence_no DESC);
