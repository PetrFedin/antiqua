-- v0.43 Provenance Evidence Passport foundation.
-- Evidence class is explicit and never inferred into a stronger status automatically.

ALTER TABLE provenance_entries
  ADD COLUMN IF NOT EXISTS evidence_class text NOT NULL DEFAULT 'UNSPECIFIED'
  CHECK (evidence_class IN (
    'PRIMARY_DOCUMENT',
    'INSTITUTIONAL_RECORD',
    'AUCTION_DEALER_RECORD',
    'SCHOLARLY_PUBLICATION',
    'OWNER_DEALER_STATEMENT',
    'EXPERT_INTERPRETATION',
    'MACHINE_CANDIDATE',
    'UNSPECIFIED'
  ));

CREATE INDEX IF NOT EXISTS provenance_entries_evidence_class_idx
  ON provenance_entries(object_id,evidence_class,sequence_no);

INSERT INTO schema_migrations(version)
VALUES('029_v43_provenance_evidence_passport')
ON CONFLICT DO NOTHING;
