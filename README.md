# ANTIQUA

Painting-first digital platform for discovering, researching, presenting, collecting and (when permitted) buying or auctioning artworks. Current public scope is paintings in oil, acrylic, tempera, watercolor, gouache and pastel, not generic antiques or real estate.

## Current state

This repository is the dedicated ANTIQUA project. It is independent from SYNTHA.

The current `main` contains a deployable preview runtime used to validate product direction and core interaction flows:

- public catalogue;
- object presentation;
- personal collection preview;
- timed auction preview with server-side bid validation;
- responsive web interface;
- `/api/health` endpoint.

## Preview limitations

The preview is intentionally not represented as production-ready commerce. The exact main commit is deployed to Render, but the dedicated Antiqua PostgreSQL admission is BLOCKED until primary Supabase project identity, migrations 001–033, READY and restart/restore are verified. It currently does **not** provide real payments, escrow, KYC/KYB, expert authentication, durable database persistence, production-grade identity, or settlement.

## Run

```bash
npm start
```

The server listens on `PORT` or `10000` by default.

## Product direction

Target end-to-end chain:

`object passport -> collection -> provenance/authentication workflow -> listing -> sale/auction -> payment/settlement -> delivery -> ownership/passport transfer`

All further ANTIQUA development should be committed to this repository only.

## Planned integration roadmap

Canonical implementation plan:

- [docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md](./docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md)

This file is a **planned implementation source**, not evidence that all listed capabilities are already live. Future full-roadmap implementation should cite this filename explicitly and follow its phases, authority boundaries, dependencies and acceptance gates.

## Current priority (2026-10-13)

1. **P0:** identity-verified dedicated PostgreSQL, canonical migrations 001–033, `/api/ready=200`, restart durability and backup/restore. Tracked in [Issue #135](https://github.com/PetrFedin/antiqua/issues/135). Draft hardening changes in [PR #136](https://github.com/PetrFedin/antiqua/pull/136) are NOT yet deployed.
2. **P1, only after P0:** [Decision Dossier + Private Rooms](https://github.com/PetrFedin/antiqua/issues/137) built as permissioned projections of existing Artwork and evidence, not parallel authorities. Existing [Private Rooms #103](https://github.com/PetrFedin/antiqua/issues/103) is the related implementation workstream.

Do not prioritize a marketplace homepage imitation or additional filters ahead of these gates.
