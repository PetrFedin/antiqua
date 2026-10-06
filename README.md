# ANTIQUA

ANTIQUA is an artwork-first digital platform for discovering, researching, collecting and, when relevant, acquiring works of art.

## Product focus

The active public scope is deliberately narrow:

- painting;
- drawing;
- graphics;
- engraving and etching;
- lithography, woodcut, linocut and other artist prints;
- watercolor, gouache, pastel and adjacent works on paper.

ANTIQUA is **not** positioned as a universal antiques or collectibles marketplace.

## Core public journey

`Gallery -> Artwork -> Artist -> Related works -> Research / provenance -> Save -> Collection -> Community / event -> Inquiry / bid when relevant`

Commerce is optional at artwork level. A work may be shown for discovery, research, exhibition or collection context without being for sale.

## Current product authorities retained

The existing technical foundation remains reusable:

- artwork/object identity and dossier;
- creator / artist graph;
- collections and ownership-related records;
- provenance, evidence and condition workflows;
- art-network profiles and relationships;
- shared Intelligence Authority: collector, professional and scholarly/market projections;
- exhibitions and Cultural Calendar;
- inquiry, offer/counteroffer, viewing and auction workflows;
- durable PostgreSQL contour and existing governance controls.

Operational/dealer tooling stays secondary and must not dominate the normal collector or art-lover experience.

## Active product source of truth

- [Artwork-first master plan](./docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md)

The master plan now contains the explicit keep / remove / defer boundary for the painting-and-works-on-paper concept.

## Runtime

```bash
npm start
```

The server listens on `PORT` or `10000` by default.

## Important limitation

Repository capabilities and migrations are not, by themselves, proof of a production-ready transaction stack. Live deployment, persistence, provider, payment/settlement and real-partner gates must be verified separately before they are represented as production-ready.
