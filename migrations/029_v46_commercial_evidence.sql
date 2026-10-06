-- ANTIQUA v0.46 Commercial Evidence Authority.
-- Append-only commercial ledger for pilot pricing, invoices, cash, direct cost and renewal evidence.

CREATE TABLE IF NOT EXISTS dealer_pilot_commercial_events (
 id text PRIMARY KEY,
 pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 seller_id text NOT NULL,
 event_type text NOT NULL CHECK(event_type IN(
  'QUOTE_ISSUED',
  'PRICE_VERBAL_ACCEPTED',
  'PRICE_WRITTEN_ACCEPTED',
  'INVOICE_ISSUED',
  'PAYMENT_RECEIVED',
  'REFUND_RECORDED',
  'DIRECT_COST_RECORDED',
  'RENEWAL_PROPOSED',
  'RENEWAL_ACCEPTED',
  'RENEWAL_REJECTED',
  'EXPANSION_ACCEPTED',
  'COMMERCIAL_EVENT_VOIDED'
 )),
 revenue_stream text CHECK(revenue_stream IS NULL OR revenue_stream IN(
  'PROFESSIONAL_SAAS',
  'PARTNER_EDITION',
  'CULTURAL_PARTNERSHIP',
  'INSTITUTIONAL_RESEARCH',
  'TRANSACTION_REVENUE',
  'ESTATE_ARCHIVE'
 )),
 amount_minor bigint CHECK(amount_minor IS NULL OR amount_minor>=0),
 currency text CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$'),
 evidence_ref text,
 source_key text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 digest text NOT NULL,
 signature text NOT NULL,
 occurred_at timestamptz NOT NULL,
 created_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pilot_id,source_key)
);

CREATE INDEX IF NOT EXISTS dealer_pilot_commercial_events_pilot_idx
 ON dealer_pilot_commercial_events(pilot_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS dealer_pilot_commercial_events_seller_idx
 ON dealer_pilot_commercial_events(seller_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS dealer_pilot_commercial_events_type_idx
 ON dealer_pilot_commercial_events(event_type,occurred_at);

INSERT INTO schema_migrations(version) VALUES('029_v46_commercial_evidence') ON CONFLICT DO NOTHING;
