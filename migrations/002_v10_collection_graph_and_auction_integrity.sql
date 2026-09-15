BEGIN;

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS baseline_bid bigint;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reserve_price bigint;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS increment bigint;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_count integer NOT NULL DEFAULT 0;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS leader_account_id text REFERENCES accounts(id);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS extension_window_seconds integer NOT NULL DEFAULT 180;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS extension_seconds integer NOT NULL DEFAULT 180;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS extension_count integer NOT NULL DEFAULT 0;

UPDATE auctions
SET baseline_bid = COALESCE(baseline_bid, NULLIF(state->>'baselineBid','')::bigint, current_bid),
    reserve_price = COALESCE(reserve_price, NULLIF(state->>'reservePrice','')::bigint, 0),
    increment = COALESCE(increment, NULLIF(state->>'increment','')::bigint, 1),
    bid_count = GREATEST(bid_count, COALESCE(NULLIF(state->>'bidCount','')::integer, 0)),
    starts_at = COALESCE(starts_at, NULLIF(state->>'startsAt','')::timestamptz, now())
WHERE baseline_bid IS NULL OR reserve_price IS NULL OR increment IS NULL OR starts_at IS NULL;

CREATE TABLE IF NOT EXISTS auction_registrations(
  sale_id text NOT NULL,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'APPROVED' CHECK(status IN('PENDING','APPROVED','BLOCKED','REVOKED')),
  terms_version text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(sale_id, account_id)
);

CREATE TABLE IF NOT EXISTS auction_proxy_positions(
  auction_id text NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  max_amount bigint NOT NULL CHECK(max_amount>0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(auction_id, account_id)
);
CREATE INDEX IF NOT EXISTS auction_proxy_rank_idx ON auction_proxy_positions(auction_id, max_amount DESC, accepted_at ASC);

CREATE TABLE IF NOT EXISTS auction_events(
  id bigserial PRIMARY KEY,
  auction_id text NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  sequence_no bigint NOT NULL,
  event_type text NOT NULL,
  actor_account_id text REFERENCES accounts(id),
  visible_amount bigint,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auction_id, sequence_no)
);
CREATE INDEX IF NOT EXISTS auction_events_timeline_idx ON auction_events(auction_id, sequence_no);

ALTER TABLE auction_bids DROP CONSTRAINT IF EXISTS auction_bids_account_id_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS auction_bid_idempotency_idx ON auction_bids(auction_id, account_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS collections(
  id text PRIMARY KEY,
  owner_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  title jsonb NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  story jsonb NOT NULL DEFAULT '{}'::jsonb,
  collection_type text NOT NULL CHECK(collection_type IN('PERSONAL','CURATED','DISTRIBUTED','INSTITUTIONAL')),
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  cover_object_id text REFERENCES objects(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collections_owner_idx ON collections(owner_account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS collection_collaborators(
  collection_id text NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN('OWNER','CURATOR','EDITOR','VIEWER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collection_id, account_id)
);

CREATE TABLE IF NOT EXISTS collection_objects(
  collection_id text NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  section text,
  owner_display_mode text NOT NULL DEFAULT 'ANONYMOUS' CHECK(owner_display_mode IN('ANONYMOUS','PSEUDONYM','PUBLIC')),
  location_display_mode text NOT NULL DEFAULT 'HIDDEN' CHECK(location_display_mode IN('HIDDEN','COUNTRY','CITY','FULL')),
  note jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(collection_id, object_id)
);

CREATE TABLE IF NOT EXISTS ensembles(
  id text PRIMARY KEY,
  title jsonb NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_count integer,
  visibility text NOT NULL DEFAULT 'PUBLIC' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('DRAFT','ACTIVE','ARCHIVED')),
  curator_account_id text REFERENCES accounts(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ensemble_slots(
  id text PRIMARY KEY,
  ensemble_id text NOT NULL REFERENCES ensembles(id) ON DELETE CASCADE,
  label jsonb NOT NULL,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  slot_status text NOT NULL DEFAULT 'MISSING' CHECK(slot_status IN('VERIFIED','CANDIDATE','KNOWN_PRIVATE','INSTITUTIONAL','MISSING','UNKNOWN_LOCATION')),
  object_id text REFERENCES objects(id),
  external_uri text,
  owner_display_mode text NOT NULL DEFAULT 'ANONYMOUS' CHECK(owner_display_mode IN('ANONYMOUS','PSEUDONYM','PUBLIC')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(ensemble_id, sort_order)
);
CREATE INDEX IF NOT EXISTS ensemble_slots_ensemble_idx ON ensemble_slots(ensemble_id, sort_order);

CREATE TABLE IF NOT EXISTS ensemble_claims(
  id text PRIMARY KEY,
  ensemble_id text NOT NULL REFERENCES ensembles(id) ON DELETE CASCADE,
  slot_id text REFERENCES ensemble_slots(id) ON DELETE SET NULL,
  claimant_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  object_id text REFERENCES objects(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','NEEDS_EVIDENCE','VERIFIED','REJECTED','WITHDRAWN')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS object_relations(
  id text PRIMARY KEY,
  source_object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  target_object_id text REFERENCES objects(id) ON DELETE CASCADE,
  external_target_uri text,
  relation_type text NOT NULL CHECK(relation_type IN('PART_OF','PAIR_WITH','SAME_SET','FRAGMENT_OF','RECONSTRUCTS','SAME_SERIES','SAME_PROVENANCE','RELATED')),
  status text NOT NULL DEFAULT 'ASSERTED' CHECK(status IN('ASSERTED','REVIEWED','VERIFIED','DISPUTED')),
  confidence numeric(5,4),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(target_object_id IS NOT NULL OR external_target_uri IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS object_relations_source_idx ON object_relations(source_object_id, relation_type);

CREATE TABLE IF NOT EXISTS object_external_refs(
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  ref_type text NOT NULL CHECK(ref_type IN('IIIF_MANIFEST','LINKED_ART','MUSEUM_RECORD','AUTHORITY','CATALOGUE_RAISONNE','OTHER')),
  uri text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(object_id, ref_type, uri)
);

CREATE TABLE IF NOT EXISTS exhibitions(
  id text PRIMARY KEY,
  owner_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
  title jsonb NOT NULL,
  subtitle jsonb NOT NULL DEFAULT '{}'::jsonb,
  curatorial_statement jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','UNLISTED','PUBLIC')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SCHEDULED','LIVE','CLOSED','ARCHIVED')),
  starts_at timestamptz,
  ends_at timestamptz,
  cover_object_id text REFERENCES objects(id),
  access_token_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exhibition_sections(
  id text PRIMARY KEY,
  exhibition_id text NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  title jsonb NOT NULL,
  narrative jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  layout text NOT NULL DEFAULT 'EDITORIAL',
  UNIQUE(exhibition_id, sort_order)
);

CREATE TABLE IF NOT EXISTS exhibition_items(
  id text PRIMARY KEY,
  exhibition_id text NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  section_id text REFERENCES exhibition_sections(id) ON DELETE SET NULL,
  object_id text REFERENCES objects(id),
  ensemble_id text REFERENCES ensembles(id),
  sort_order integer NOT NULL DEFAULT 0,
  caption jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_consent_required boolean NOT NULL DEFAULT true,
  owner_consent_status text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK(owner_consent_status IN('NOT_REQUIRED','PENDING','GRANTED','REVOKED')),
  CHECK(object_id IS NOT NULL OR ensemble_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS wanted_requests(
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ensemble_id text REFERENCES ensembles(id) ON DELETE SET NULL,
  slot_id text REFERENCES ensemble_slots(id) ON DELETE SET NULL,
  query jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','MATCHED','PAUSED','CLOSED')),
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN('PRIVATE','DEALERS','PUBLIC')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_provider_events(
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  case_id text REFERENCES verification_cases(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload_hash text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS ledger_accounts(
  id text PRIMARY KEY,
  owner_type text NOT NULL CHECK(owner_type IN('PLATFORM','BUYER','SELLER','TAX','PAYMENT_PROVIDER','SUSPENSE')),
  owner_id text,
  currency char(3) NOT NULL,
  account_type text NOT NULL CHECK(account_type IN('ASSET','LIABILITY','REVENUE','EXPENSE','EQUITY')),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, currency, name)
);

CREATE TABLE IF NOT EXISTS ledger_transactions(
  id text PRIMARY KEY,
  transaction_type text NOT NULL,
  external_reference text,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'POSTED' CHECK(status IN('PENDING','POSTED','REVERSED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries(
  id bigserial PRIMARY KEY,
  transaction_id text NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  ledger_account_id text NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  side text NOT NULL CHECK(side IN('DEBIT','CREDIT')),
  amount_minor bigint NOT NULL CHECK(amount_minor>0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_transaction_idx ON ledger_entries(transaction_id);

CREATE TABLE IF NOT EXISTS payment_intents(
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider text,
  provider_reference text,
  amount_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  status text NOT NULL CHECK(status IN('CREATED','REQUIRES_ACTION','AUTHORIZED','CAPTURED','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payouts(
  id text PRIMARY KEY,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  seller_id text NOT NULL,
  provider text,
  provider_reference text,
  amount_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  status text NOT NULL CHECK(status IN('ON_HOLD','READY','SUBMITTED','PAID','FAILED','REVERSED')),
  hold_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reconciliation_runs(
  id text PRIMARY KEY,
  provider text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  status text NOT NULL CHECK(status IN('RUNNING','COMPLETED','COMPLETED_WITH_EXCEPTIONS','FAILED')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS reconciliation_items(
  id bigserial PRIMARY KEY,
  run_id text NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  external_reference text,
  internal_reference text,
  status text NOT NULL CHECK(status IN('MATCHED','MISSING_INTERNAL','MISSING_EXTERNAL','AMOUNT_MISMATCH','STATUS_MISMATCH')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO schema_migrations(version) VALUES('002_v10_collection_graph_and_auction_integrity') ON CONFLICT DO NOTHING;
COMMIT;
