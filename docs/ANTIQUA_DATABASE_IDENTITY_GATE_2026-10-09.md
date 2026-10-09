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

- Repository authority: `main@eb814863d310b106e600ff0aa85386dccb8c1c44`.
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
6. Deploy exact current `main`.
7. Verify startup migration logs and exact commit.
8. Query `schema_migrations` and prove `001–033 exact`.
9. Verify no missing or unexpected versions.
10. Set `ANTIQUA_MIGRATE_ON_START=false`.
11. Reverify the bound database identity.
12. Set `PREVIEW_MODE=false`.
13. Final deploy of the exact same current `main`.
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
