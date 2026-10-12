// Deprecated legacy migration entrypoint. Intentionally fail before any DB access.
// Use scripts/migrate-v14.mjs ONLY after dedicated Antiqua project identity,
// read-only schema lineage and reviewer fingerprint have been independently approved.
throw new Error('ANTIQUA_DB_GATE: LEGACY_MIGRATION_ENTRYPOINT_DISABLED');
