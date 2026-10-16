# ANTIQUA v73 — Publication Authority Candidate (16 October 2026)

Only for isolated PostgreSQL. This is not a production authorization to publish.

Workflow: owner SUBMIT → catalogue reviewer APPROVE → distinct TRUST_REVIEWER PUBLISH after explicit artwork-by-artwork media rights references. REQUEST_CHANGES or REVOKE invalidates public review. Mutating a collection forces REVIEW_REQUIRED. Snapshot digest binds membership, privacy, artwork identity and image metadata. Public list and direct URLs validate approved digest, not just flags or PUBLIC visibility. Owner cannot review own collection. All transitions row-lock the collection and append chained event hashes, with idempotency keys in a transaction. No production permissions are granted in MEMORY_FALLBACK.

New migration 034 is added after 001–033, without modifying preceding migrations. Independent review of both role boundaries and rights evidence is required. References are opaque identifiers, not legal proof; external verification and protected storage are later gates.

CI includes PostgreSQL test for two-person approval, duplicate request, idempotency conflict, no rights evidence, later mutation revocation, and public isolation.

Known limitations: event hash is a tamper-evident local chain rather than externally anchored institutional attestation; reviewer evidence references need independent source validation. Current DB access remains blocked.