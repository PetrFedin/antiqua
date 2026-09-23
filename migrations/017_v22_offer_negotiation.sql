-- ANTIQUA v0.22 Offer & Negotiation Authority.
-- Upgrades the legacy offer payload into a versioned commercial aggregate with immutable events.

ALTER TABLE offers ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS current_amount_minor bigint;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS current_proposer_role text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS awaiting_role text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS create_idempotency_key text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_order_id text;

-- Preserve the original legacy status while reconstructing the authoritative current proposal.
UPDATE offers
SET version=COALESCE(version,1),
    expires_at=COALESCE(expires_at,updated_at + interval '7 days'),
    currency=COALESCE(currency,NULLIF(payload->>'currency',''),'EUR'),
    current_amount_minor=COALESCE(
      current_amount_minor,
      GREATEST(
        1,
        round(
          CASE
            WHEN status='COUNTERED_BY_SELLER' THEN COALESCE(NULLIF(payload->>'sellerAmount',''),NULLIF(payload->>'buyerAmount',''),'0')::numeric
            WHEN status='COUNTERED_BY_BUYER' THEN COALESCE(NULLIF(payload->>'buyerAmount',''),NULLIF(payload->>'sellerAmount',''),'0')::numeric
            ELSE COALESCE(NULLIF(payload->>'buyerAmount',''),NULLIF(payload->>'sellerAmount',''),'0')::numeric
          END * 100
        )::bigint
      )
    ),
    current_proposer_role=COALESCE(
      current_proposer_role,
      CASE
        WHEN status='COUNTERED_BY_SELLER' THEN 'SELLER'
        ELSE 'BUYER'
      END
    ),
    awaiting_role=COALESCE(
      awaiting_role,
      CASE
        WHEN status IN ('ACCEPTED','DECLINED','REJECTED','WITHDRAWN','EXPIRED') THEN NULL
        WHEN status='COUNTERED_BY_SELLER' THEN 'BUYER'
        ELSE 'SELLER'
      END
    )
WHERE version IS NULL
   OR expires_at IS NULL
   OR currency IS NULL
   OR current_amount_minor IS NULL
   OR current_proposer_role IS NULL;

UPDATE offers
SET status=CASE status
  WHEN 'PENDING' THEN 'OPEN'
  WHEN 'COUNTERED_BY_SELLER' THEN 'COUNTERED'
  WHEN 'COUNTERED_BY_BUYER' THEN 'COUNTERED'
  WHEN 'DECLINED' THEN 'REJECTED'
  ELSE status
END
WHERE status IN ('PENDING','COUNTERED_BY_SELLER','COUNTERED_BY_BUYER','DECLINED');

ALTER TABLE offers ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE offers ALTER COLUMN version SET NOT NULL;
ALTER TABLE offers ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE offers ALTER COLUMN current_amount_minor SET NOT NULL;
ALTER TABLE offers ALTER COLUMN currency SET NOT NULL;
ALTER TABLE offers ALTER COLUMN current_proposer_role SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS offers_create_idempotency_idx
  ON offers(buyer_account_id,create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS offers_buyer_status_idx
  ON offers(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS offers_seller_status_idx
  ON offers(seller_id,status,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS offers_accepted_order_idx
  ON offers(accepted_order_id)
  WHERE accepted_order_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_status_v22_check') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_status_v22_check
      CHECK(status IN ('OPEN','COUNTERED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_version_v22_check') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_version_v22_check CHECK(version>0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_amount_v22_check') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_amount_v22_check CHECK(current_amount_minor>0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_roles_v22_check') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_roles_v22_check
      CHECK(
        current_proposer_role IN ('BUYER','SELLER')
        AND (awaiting_role IS NULL OR awaiting_role IN ('BUYER','SELLER'))
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_accepted_order_fk') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_accepted_order_fk
      FOREIGN KEY(accepted_order_id) REFERENCES orders(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS offer_events (
  id text PRIMARY KEY,
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  event_type text NOT NULL,
  actor_account_id text REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_role text NOT NULL CHECK(actor_role IN ('BUYER','SELLER','OPERATOR','SYSTEM')),
  from_status text,
  to_status text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>0),
  currency text NOT NULL,
  comment text,
  client_action_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(offer_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS offer_events_actor_action_idx
  ON offer_events(actor_account_id,client_action_id)
  WHERE actor_account_id IS NOT NULL AND client_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS offer_events_offer_idx
  ON offer_events(offer_id,version,created_at);

INSERT INTO offer_events(
  id,offer_id,version,event_type,actor_account_id,actor_role,from_status,to_status,
  amount_minor,currency,comment,client_action_id,metadata,created_at
)
SELECT
  'oev-legacy-'||id,id,version,'LEGACY_IMPORTED',NULL,'SYSTEM',NULL,status,
  current_amount_minor,currency,'Imported from pre-v0.22 offer payload',NULL,
  jsonb_build_object('legacy',true),created_at
FROM offers
ON CONFLICT(offer_id,version) DO NOTHING;

CREATE OR REPLACE FUNCTION antiqua_offer_event_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'offer_events are immutable' USING ERRCODE='55000';
END $$;

DROP TRIGGER IF EXISTS offer_events_immutable_trg ON offer_events;
CREATE TRIGGER offer_events_immutable_trg
BEFORE UPDATE OR DELETE ON offer_events
FOR EACH ROW EXECUTE FUNCTION antiqua_offer_event_immutable();

INSERT INTO schema_migrations(version) VALUES('017_v22_offer_negotiation') ON CONFLICT DO NOTHING;
