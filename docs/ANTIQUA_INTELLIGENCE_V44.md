# ANTIQUA v0.44 — Shared Intelligence Authority

**Status:** IMPLEMENTED IN FEATURE BRANCH / VERIFYING  
**Principle:** one set of facts, multiple role-safe projections.

## Why v0.44 exists

ANTIQUA should become more intelligent without creating:
- opaque recommendation scores;
- unsupported authenticity verdicts;
- automated appraisals disguised as facts;
- seller access to private collector taste;
- a second source of truth beside artwork / provenance / commercial authorities.

Therefore v0.44 is a projection layer over existing authorities.

## 1. Collector Intelligence

Sources:
- Taste Graph v0.28;
- explicit saves / collections / follows;
- engaged dossier views;
- viewing / offer / purchase facts.

Outputs:
- maturity of the taste graph;
- artist / department / period / geography affinity directions;
- explainable recommendations;
- adjacent discovery / diversification.

Boundaries:
- affinity points are not purchase probability;
- passive interest is not commercial intent;
- price does not drive taste matching;
- the seller cannot read the collector's personal taste profile.

## 2. Professional Intelligence

Sources:
- Dealer Interest v0.32;
- Dealer Performance v0.34;
- Creator Graph v0.30.

Outputs:
- artist rollups;
- artwork demand depth;
- passive versus explicit intent;
- response SLA;
- viewing / negotiation / transaction stages;
- prior editorial/event evidence.

Boundaries:
- no passive viewer identity;
- signal counts are not summed into unique people;
- editorial exposure is not causal attribution;
- no hidden lead score.

## 3. Market & Scholarly Intelligence

Sources:
- Artwork Dossier;
- Creator Graph;
- Passport Revisions;
- Market Intelligence.

Outputs:
- attribution links;
- provenance coverage;
- bibliography coverage;
- exhibition-history coverage;
- revision/evidence coverage;
- platform market comparables;
- explicit open research questions.

Boundaries:
- NO_AUTHENTICITY_VERDICT;
- COMPARABLES_NOT_APPRAISAL;
- market price never determines attribution;
- private owner/location information is excluded;
- external auction databases are not claimed unless actually integrated.

## 4. Product placement

No new primary-navigation pillar is created.

- Collector Intelligence lives inside **My ANTIQUA**.
- Professional Intelligence lives inside the **dealer/professional workspace**.
- Market & Scholarly Intelligence lives inside **Artwork Dossier**.

This keeps the product artwork-first.

## 5. Moat effect

v0.44 strengthens three feedback loops while preserving authority boundaries:

`Collector actions -> explainable discovery -> deeper engagement -> better demand signals`

`Professional supply -> measured demand -> better selection / response -> better partner value`

`Artwork research -> revisions / evidence / comparables -> better trust -> more useful canonical record`

The moat hypothesis remains evidence-based: these loops become defensible only when retention, partner renewal and institutional reuse are measured.

## 6. Acceptance gate

v0.44 may be called PASS only when:
- CI is green;
- browser E2E is green;
- collector projection is authenticated and private;
- professional projection requires seller analytics permission;
- scholarly projection contains no private owner/location data;
- Dossier visibly states no authenticity verdict and no appraisal;
- mobile layouts remain usable.
