CREATE TABLE IF NOT EXISTS discovery_subscriptions (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_type text NOT NULL CHECK (subscription_type IN ('SAVED_SEARCH','FOLLOW_SELLER','FOLLOW_MAKER','WANTED')),
  label jsonb NOT NULL DEFAULT '{}'::jsonb,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discovery_subscriptions_account_idx ON discovery_subscriptions(account_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  object_id text,
  listing_id text,
  buyer_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seller_id text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','BLOCKED')),
  subject jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_buyer_idx ON conversations(buyer_account_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_seller_idx ON conversations(seller_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS conversation_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_message_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id,sender_account_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS conversation_messages_thread_idx ON conversation_messages(conversation_id,created_at);

CREATE TABLE IF NOT EXISTS collection_records (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  object_id text NOT NULL,
  acquisition jsonb NOT NULL DEFAULT '{}'::jsonb,
  appraisal jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage jsonb NOT NULL DEFAULT '{}'::jsonb,
  insurance jsonb NOT NULL DEFAULT '{}'::jsonb,
  private_notes text,
  status text NOT NULL DEFAULT 'OWNED' CHECK (status IN ('WANTED','OWNED','ON_LOAN','CONSIGNED','SOLD','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,object_id)
);
CREATE INDEX IF NOT EXISTS collection_records_account_idx ON collection_records(account_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS collection_movements (
  id text PRIMARY KEY,
  record_id text NOT NULL REFERENCES collection_records(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('ACQUIRED','MOVED','LOANED','RETURNED','CONSIGNED','RESTORED','APPRAISED','INSURED','SOLD')),
  from_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  to_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collection_movements_record_idx ON collection_movements(record_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS insurance_policies (
  id text PRIMARY KEY,
  record_id text NOT NULL REFERENCES collection_records(id) ON DELETE CASCADE,
  provider text,
  policy_number_masked text,
  insured_value_minor bigint,
  currency text,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','EXPIRED','CANCELLED')),
  document_media_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insurance_policies_record_idx ON insurance_policies(record_id,status,expires_at);

CREATE TABLE IF NOT EXISTS auction_settlements (
  id text PRIMARY KEY,
  auction_id text NOT NULL UNIQUE,
  object_id text NOT NULL,
  buyer_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  seller_id text,
  winning_amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'PAYMENT_DUE' CHECK (status IN ('PAYMENT_DUE','PAYMENT_PROCESSING','PAID','NONPAYMENT','REOFFERED','VOID','FULFILLMENT','COMPLETED','DISPUTED')),
  payment_due_at timestamptz,
  nonpayment_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auction_settlements_buyer_idx ON auction_settlements(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS auction_settlements_seller_idx ON auction_settlements(seller_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS settlement_events (
  id text PRIMARY KEY,
  settlement_id text NOT NULL REFERENCES auction_settlements(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_account_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settlement_events_idx ON settlement_events(settlement_id,created_at);

CREATE TABLE IF NOT EXISTS shipments (
  id text PRIMARY KEY,
  order_id text,
  settlement_id text,
  object_id text NOT NULL,
  buyer_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  seller_id text,
  status text NOT NULL DEFAULT 'QUOTE_REQUIRED' CHECK (status IN ('QUOTE_REQUIRED','QUOTED','BOOKED','PACKING','IN_TRANSIT','COLLECTION_READY','DELIVERED','DELIVERY_FAILED','CANCELLED','DAMAGE_REPORTED')),
  provider text,
  service_level text,
  tracking_reference text,
  insured_value_minor bigint,
  currency text,
  quote jsonb NOT NULL DEFAULT '{}'::jsonb,
  package_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (order_id IS NOT NULL OR settlement_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS shipments_buyer_idx ON shipments(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS shipments_seller_idx ON shipments(seller_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS shipment_events (
  id text PRIMARY KEY,
  shipment_id text NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shipment_events_idx ON shipment_events(shipment_id,created_at);

CREATE TABLE IF NOT EXISTS disputes (
  id text PRIMARY KEY,
  order_id text,
  settlement_id text,
  shipment_id text,
  object_id text,
  opened_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  buyer_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  seller_id text,
  category text NOT NULL CHECK (category IN ('NONRECEIPT','DAMAGE','MISMATCH','COMPLETENESS','AUTHENTICITY','PAYMENT','OTHER')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','EVIDENCE_REQUIRED','UNDER_REVIEW','RESOLVED_BUYER','RESOLVED_SELLER','PARTIAL_REFUND','FULL_REFUND','CLOSED')),
  summary text NOT NULL,
  requested_resolution text,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS disputes_buyer_idx ON disputes(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS disputes_seller_idx ON disputes(seller_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id text PRIMARY KEY,
  dispute_id text NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL,
  note text,
  media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispute_evidence_idx ON dispute_evidence(dispute_id,created_at);

CREATE TABLE IF NOT EXISTS provider_events (
  id text PRIMARY KEY,
  provider_type text NOT NULL CHECK (provider_type IN ('KYC','KYB','PAYMENT','PAYOUT','SHIPPING')),
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,external_event_id)
);
CREATE INDEX IF NOT EXISTS provider_events_entity_idx ON provider_events(entity_type,entity_id,created_at DESC);
