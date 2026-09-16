CREATE TABLE IF NOT EXISTS account_object_flags (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('SAVED','WATCH','COLLECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,object_id,flag_type)
);
CREATE INDEX IF NOT EXISTS account_object_flags_account_idx ON account_object_flags(account_id,flag_type,updated_at DESC);
