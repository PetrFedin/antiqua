# ANTIQUA 0.9 — Production Foundation

ANTIQUA 0.9 changes the technical class of the platform while preserving the antique-shop, dealer, collection and auction model of 0.8. The core invariant remains object-first: a permanent object/passport exists independently of its shop listing, auction, private sale, offer or order.

## Runtime modes

`PREVIEW_MODE=true` may run without external infrastructure. Health explicitly reports `MEMORY_FALLBACK`; demo accounts and catalogue data are allowed only here.

`PREVIEW_MODE=false` fails closed unless both `APP_SECRET` and `DATABASE_URL` are configured. Demo accounts and demo catalogue seeding are disabled. Production cookies use `Secure` when `NODE_ENV=production`.

## PostgreSQL

Migration `001_v09_foundation.sql` defines accounts/roles, hashed sessions, one-time 2FA recovery codes, KYC/KYB cases, permanent object passports, provenance, media assets, listings, auctions, hidden maximum bids, offers, orders, notifications, seller drafts, Catalogue & Trust reviews and audit events.

The runtime has two persistence adapters: PostgreSQL and an explicit preview-only memory fallback. With PostgreSQL configured, commercially material writes are persisted and domain state is hydrated after restart.

## Authentication and authorization

- passwords: scrypt + random salt; raw passwords are never stored;
- sessions: random 256-bit cookie token; only SHA-256 token hash is stored server-side;
- CSRF: session-bound double-submit token on authenticated mutations;
- 2FA: TOTP secret encrypted with AES-256-GCM using `APP_SECRET`;
- recovery codes: stored only as hashes and consumed once;
- server-side roles: BUYER, SELLER, DEALER, EXPERT, CATALOGUER, TRUST_REVIEWER, ADMIN;
- UI persona switching never grants permissions.

## KYC / KYB

Verification state is separate from object/catalogue trust:
`NOT_STARTED → PENDING → VERIFIED / REJECTED / EXPIRED`.

The foundation includes the state machine and operator decision route. No external identity provider is represented as connected until an adapter is configured.

## Catalogue & Trust Center

Catalogue review and trust review are separate gates. The operator can request changes, approve catalogue quality, make a trust decision and publish only when all gates pass.

Publication requires:
1. Catalogue `APPROVED`;
2. Trust `CLEARED` or `CONDITIONAL`;
3. seller KYB `VERIFIED`;
4. no blocking risk flag.

Risk flags cover provenance gaps, material condition, incomplete media, uncertain attribution, export review and cultural-property screening. Catalogue approval is not a guarantee of authenticity.

## Object storage

The media adapter targets Supabase Storage through its documented S3-compatible endpoint. Server-only S3 access keys are expected; they must never be sent to the browser.

Lifecycle: authorization → media record `UPLOADING` → short-lived AWS Signature V4 PUT URL → direct client upload → server-signed HEAD verification of existence/type/size → optional server checksum verification → media `READY` → attachment to draft/passport.

The preview accepts JPEG, PNG, WebP and PDF intents up to 25 MB. Without storage credentials the API returns `STORAGE_NOT_CONFIGURED` instead of simulating success.

## Auditability

Sensitive and commercial transitions produce audit events with actor, entity, request id, hashed network fingerprint and relevant before/after metadata. Audit data is intentionally separate from user notifications.

## Still P0 before real-money launch

- connect a dedicated ANTIQUA PostgreSQL database;
- connect a private object-storage bucket and run upload/download verification;
- external KYC/KYB provider;
- payment ledger, refunds, reconciliation and seller payouts;
- row-lock/transaction based auction concurrency for multi-instance deployment;
- rate limiting, credential-abuse protection and security monitoring;
- email/SMS delivery;
- backup/restore and disaster-recovery test;
- legal terms, tax/export rules and country × category compliance matrix.
