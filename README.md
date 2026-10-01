# ANTIQUA

Digital platform for collecting, presenting, buying and auctioning antiques and collectible objects.

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

The preview is intentionally not represented as production-ready commerce. It currently does **not** provide real payments, escrow, KYC/KYB, expert authentication, durable database persistence, production-grade identity, or settlement.

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
