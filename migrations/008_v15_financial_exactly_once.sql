ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_transactions_idempotency_idx
  ON ledger_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_idempotency_idx
  ON payouts(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_source_hold_idx
  ON payouts(source_type,source_id,hold_reason)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES('008_v15_financial_exactly_once') ON CONFLICT DO NOTHING;
