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
