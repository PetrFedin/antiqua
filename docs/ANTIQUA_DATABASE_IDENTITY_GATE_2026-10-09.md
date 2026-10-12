# Antiqua — Dedicated Database Identity Gate

**Status:** ACTIVE · BLOCKING PRODUCTION ADMISSION  
**Date:** 2026-10-09  
**Canonical for database identity:** `docs/ANTIQUA_DATABASE_IDENTITY_GATE_2026-10-09.md`

## Purpose

Prevent Antiqua migrations, runtime binding, or production writes from being applied to another project's PostgreSQL database.

This document supersedes every earlier Antiqua note that assigns a concrete Supabase project ref without a fresh primary-source identity proof.

## Critical correction

The Supabase project ref `yutrntnncubcssqbohco` must **not** be used for Antiqua.

Prior project evidence associates this ref with the Fintech Debt Assistant contour. The later Antiqua association was not supported by a primary Supabase project response, database host, pooler username, dashboard metadata, or verified creation receipt.

Therefore the earlier Antiqua association of `yutrntnncubcssqbohco` is **SUPERSEDED AND NON-AUTHORITATIVE**.

No Antiqua DDL, migration, test query, runtime binding, backup, or restore operation may target this ref.

## Current verified state

- Latest observed repository head at this checkpoint: `main@f9525eab308e4915526f59cfa0000690edd80d97`. This SHA is observational only; production admission must capture and deploy the exact `main` that is current at binding time.
- Render service: `antiqua-preview` / `srv-dakjr0ad0e5s73e7ijp0`.
- Render live commit: `e509caf7ea70274913a57f5b47766aba960a290a`.
- Render runtime persistence: `MEMORY_FALLBACK`.
- Correct Antiqua Supabase project ref: **UNCONFIRMED**.
- Current Supabase connector sees only `ethylfresh-87's Org`, `marco-pescarolo-commercial-os`, and `mfw-postgres`.
- No verified Antiqua `DATABASE_URL` exists in Render history.
- No migration operation has been run against a newly selected database during this recovery.

## Non-negotiable boundaries

1. Do not create a replacement database merely to unblock deployment.
2. Do not reuse another project's database.
3. Do not infer database identity from an old chat summary, filename, organization label, or remembered dashboard state.
4. Do not expose passwords, PATs, DSNs, service-role keys, or certificates in GitHub, issues, logs, screenshots, or chat.
5. Do not set `ANTIQUA_MIGRATE_ON_START=true` before database identity is proven.
6. Do not set `PREVIEW_MODE=false` before migrations are exact and the same database identity is reverified.
7. Do not start Institutional Contributors before the full production-admission gate is GREEN.

## Required Identity Recovery

The next operation is discovery-only and must not execute DDL.

1. Restore the prior Supabase OAuth/account contour used when the dedicated Antiqua database was created.
2. Run `list_organizations`.
3. Run `list_projects`.
4. Identify the project by primary metadata:
   - project name;
   - project ref;
   - organization id/name;
   - region;
   - creation timestamp;
   - database host.
5. Confirm that the project is dedicated to Antiqua.
6. Confirm that the project ref is not `yutrntnncubcssqbohco`.
7. Record only non-secret identity metadata in the admission evidence.

Historical labels such as `mercury-moda` and `antiqua-postgres` are discovery hints only until returned by fresh Supabase metadata.

## Database Identity Proof

Before any migration, all checks below must pass.

### Project proof

- Supabase returns the project directly in `list_projects` or `get_project`.
- Project name is the dedicated Antiqua database name.
- Project ref is captured from the same response.
- Organization metadata comes from the same authenticated contour.
- Region, creation time, and database host are recorded.

### Connection proof

- Session-pooler hostname belongs to the confirmed project ref.
- Session-pooler username contains the confirmed project ref.
- Port is `5432` for persistent Render application traffic.
- Database name and role are consistent with the same project.
- Password remains secret.

### Schema-lineage proof

Using read-only SQL first, determine whether the database is:

- an existing Antiqua database with the expected migration lineage; or
- an empty dedicated Antiqua database suitable for the canonical migration manifest.

Reject the database if it contains another project's domain schema or migration lineage.

At minimum inspect:

- existence and contents of `schema_migrations`;
- representative Antiqua tables;
- unexpected project-specific tables;
- current database/user identity;
- active schema/search path.

No migration may be used as a discovery mechanism.

## Canonical Antiqua migration contract

The repository manifest owns exactly 33 migrations:

`001_v09_foundation`
→ …
→ `033_v46_independent_passport_verification`

Expected count: `33`.  
Expected head: `033_v46_independent_passport_verification`.

Production admission requires:

- `missing=[]`;
- `unexpected=[]`;
- applied count `33`;
- applied head exact;
- no parallel migration authority.

## Strict production-admission sequence

Only after Identity Recovery and Database Identity Proof are GREEN:

1. Obtain the confirmed project's Supavisor Session pooler `DATABASE_URL` on port `5432`.
2. Bind the secret only to Render service `antiqua-preview`.
3. Keep `PREVIEW_MODE=true`.
4. Set `ANTIQUA_EXTERNAL_MANAGED_SCHEMA=true`.
5. Set `ANTIQUA_MIGRATE_ON_START=true`.
6. Capture the current `main` SHA immediately before deployment and deploy that exact SHA; if `main` advances before final admission, restart exact-head qualification from the new head.
7. Verify startup migration logs and exact commit.
8. Query `schema_migrations` and prove `001–033 exact`.
9. Verify no missing or unexpected versions.
10. Set `ANTIQUA_MIGRATE_ON_START=false`.
11. Reverify the bound database identity.
12. Set `PREVIEW_MODE=false`.
13. Final deploy of the exact same captured SHA. Do not silently advance to a newer `main` between migration proof and final READY proof.
14. Prove `persistence=POSTGRES`.
15. Prove `GET /api/ready` returns `200` with `status=READY` and no blockers.
16. Perform restart durability proof using a controlled authoritative write.

## Post-admission research trust smoke

After `READY` and restart durability:

1. Synthetic Reference Catalogue.
2. Independent Passport Verification.
3. Research Interchange.
4. Only then Institutional Contributors.

## Current stop condition

Production admission remains blocked until the correct Antiqua Supabase project is rediscovered and proven through fresh primary metadata.

Safe current state:

`MEMORY_FALLBACK + PREVIEW_MODE=true + no database mutation`


## v0.55 fail-closed software enforcement — proposed, pending CI and review (2026-10-13)

**This appendix supersedes the older procedural migration instructions once PR hardening/db-identity-gate-v55 is reviewed and merged.** The identity itself is still UNKNOWN; the presence of new guards is not database admission.

**Verified code-release state at proposal:** GitHub main and Render live deploy both point to `4f3e396ce6052ae8924235eab3ed4ad11cac470c`; runtime log remains `MEMORY_FALLBACK`. The correct Antiqua Supabase project is not visible in the current authenticated organization. No database was created or migrated.

A production Supabase migration is not authorized merely because a connection string is present. To run migration with the v0.55 candidate:
1. Restore Supabase access and independently collect management API metadata (organization, project ref, name, creation time, region, database host). Record non-secret evidence and assert exclusive Antiqua ownership. Never accept an old guessed ref.
2. In a protected environment, set `ANTIQUA_CONFIRMED_SUPABASE_REF` to the freshly verified 20-character ref, `ANTIQUA_DB_IDENTITY_APPROVED=true` only after an accountable human review, `PREVIEW_MODE=true`, and `ANTIQUA_EXTERNAL_MANAGED_SCHEMA=true`. These flags are procedural attestations, not substitutes for primary-source proof.
3. Provide the verified project's secret `DATABASE_URL` via protected credential storage. The guard permits only `postgres.<ref>` on the project's Supavisor session-pooler host, port `5432`, database `postgres`, with verified TLS. Do not paste the secret in PRs, logs or chat.
4. Run `node scripts/audit-db-readonly-v55.mjs` from an authorized secure client. It **only inspects**, producing a source-table inventory, current database/user, expected migration prefix and SHA-256 inventory fingerprint without printing a DSN or password.
5. Independently review the inventory; reject foreign tables, unexpected or gapped migrations, and empty/spoofed lineage. Set `ANTIQUA_REVIEWED_DB_FINGERPRINT` only to the exact reviewed fingerprint.
6. Only after steps 1–5 and a verified backup/rollback plan, run the managed `001–033` runner in preview mode. It skips applied canonical versions and stops on wrong identity, schema drift or a changed fingerprint. Each migration plus its history marker is enclosed in one transaction.
7. Immediately verify the completed migration set and capture the **new** read-only fingerprint. Disable `ANTIQUA_MIGRATE_ON_START` and update `ANTIQUA_REVIEWED_DB_FINGERPRINT` to the reviewed completed schema fingerprint for subsequent startups. A first-boot in-process fingerprint refresh never grants permission for future deployments.
8. Only then consider `PREVIEW_MODE=false`, `/api/ready=200`, exact deployed SHA, controlled write/restart durability and restore from backup. No room/decision dossier schema until all P0 gates pass.

**Isolated CI:** PostgreSQL test containers may set `ANTIQUA_ISOLATED_TEST_DB=true` together with `PREVIEW_MODE=true`, username `antiqua` and the specific `antiqua_test` / `antiqua_storage_test` local DB names. Never set this test bypass on Render or on any Supabase project.

**Safety stop:** missing project identity, mismatched schema or failed TLS must prevent *all* external DB reads/writes used by the app, not merely the migration job. Code deployed in `main` remains unchanged until GitHub checks and independent review approve this proposal.

**Post-P0 product priority:** Decision Dossier + Private Rooms as a rights-scoped projection of the existing painting/passport/provenance and inquiry/offer authorities. See `docs/ANTIQUA_DECISION_DOSSIER_PRIVATE_ROOMS_EPIC_2026-10-13.md`; no ARCOO-like homepage or additional filters before it.

## Authentication-key and schema-drift safeguards (proposed v0.55)

- When binding any externally managed PostgreSQL, supply a **unique secret** `APP_SECRET` (minimum 32 characters, generated with a cryptographically secure source) through private Render configuration. The known preview string `antiqua-preview-secret-not-for-production` and short values are rejected. The secret protects application session/CSRF and encrypted sensitive information; rotation requires a deliberate compatibility/reencryption plan, not an uncoordinated edit.
- In managed preview mode, **do not seed demo buyer/seller/operator accounts or pretend KYC/KYB is verified**. Preview demo seeds are restricted to memory-only preview or explicitly isolated CI databases.
- If `DATABASE_URL` is provided and PostgreSQL connection fails, runtime must stop; it must **not** silently fall back to `MEMORY_FALLBACK` and accept new non-durable data.
- Reviewed schema fingerprint includes not only public table names and migration history, but also column definitions, indexes, check/FK/other constraints, RLS flags, policies and the active database/search path. The digest is printed without credentials or raw confidential field defaults. A changed fingerprint invalidates prior approval.
- Keep TLS certificate validation; do not use `rejectUnauthorized:false` on the managed connection. Any custom trusted CA must be handled securely and tested prior to release.

These safeguards are staged in [Draft PR #136](https://github.com/PetrFedin/antiqua/pull/136); their presence is NOT proof of managed PostgreSQL admission. Exact-head CI and independent review remain mandatory.
