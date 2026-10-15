# ANTIQUA P0 combined security + museum UX v62 (15 October 2026)

This is an **unreviewed, preview-only two-parent integration candidate**. It is not merged into main or deployed to Render. No database, customer data, external storage or billing operation is authorized by this change.

## Exact source commits
- Security P0 candidate PR #145: `e82f402f02ef47708c5d0ec9a70cb03b03583518`.
- Museum UX v61 PR #146: `0a40c12844b8c85391150073c01a9378eb5ed667`.
- Unchanged production baseline: `4f3e396ce6052ae8924235eab3ed4ad11cac470c`.
- Combined merge commit has security and museum as its two parents; the source policy pins both commits.

## Resolution of the only changed-file overlap
Both PRs change `.github/workflows/browser-e2e.yml`. Preserve the security branch trigger `hardening/db-identity-gate-v55`, and adopt the museum branch's audited, exact Playwright 1.63.0 runner, all-spec syntax check and retained toolchain audit. The already-present source manifest's database file list is **re-scoped only for this explicitly resolved workflow**; source ancestry remains pinned. This exception is machine checked by `tests/p0-museum-security-v62.mjs`. All other security and privacy files retain their original source hashes. Original SQL migrations 001-033 remain byte-identical to main.

## Added tests
- v62 contract proves ancestry of both PR heads, unchanged museum and security source blobs, merged workflow gates, intact 33 canonical migrations and non-crashing preview provenance aggregation. It emits a machine-readable evidence receipt.
- v62 Playwright browser tests verify the actual public provenance overview HTTP endpoint and that the museum error-state source link remains on-screen while that API is healthy. All prior v59 and v61 suites remain in the repository.
- Run **all** existing PR workflows on the combined head; investigate, never dismiss, any new failures.

## Hard blockers
Independent security/UX and legal image-rights review, original Antiqua Supabase organization/project access, real 001-033 database admission plus backup/restore and restart checks, protected document storage and cross-role authorization, Render exact-SHA production proof and rollback. PR #139 Decision Dossier and #137/#103 Private Rooms remain gated.

**Important:** a green CI run is evidence about the synthetic preview and isolated CI containers, not about a real dedicated database, media rights, payments or the public production deployment.
