# ANTIQUA v0.46 — Commercial Evidence Authority

**Status:** IMPLEMENTED IN FEATURE BRANCH / VERIFYING  
**Purpose:** turn paid pilots into auditable commercial evidence without allowing pipeline, LOI, invoice or internal assumptions to masquerade as cash.

## 1. Authority chain

`Pilot Authority -> Counterparty Acceptance -> Governance -> Launch -> Commercial Evidence`

v0.46 does not replace the existing pilot authorities. It attaches an append-only financial/commercial evidence ledger to a real pilot.

## 2. Event model

Supported events:

- QUOTE_ISSUED;
- PRICE_VERBAL_ACCEPTED;
- PRICE_WRITTEN_ACCEPTED;
- INVOICE_ISSUED;
- PAYMENT_RECEIVED;
- REFUND_RECORDED;
- DIRECT_COST_RECORDED;
- RENEWAL_PROPOSED;
- RENEWAL_ACCEPTED;
- RENEWAL_REJECTED;
- EXPANSION_ACCEPTED;
- COMMERCIAL_EVENT_VOIDED.

Each event stores:
- pilot id;
- seller id;
- event type;
- revenue stream;
- amount in integer minor units;
- currency;
- evidence reference;
- idempotency/source key;
- payload;
- occurred-at timestamp;
- SHA-256 digest;
- HMAC signature;
- operator actor.

## 3. Accounting boundary

The MVP intentionally keeps commercial evidence separate from accounting software.

Rules:

- quote is not revenue;
- verbal acceptance is not revenue;
- written acceptance is not revenue;
- invoice is not cash;
- PAYMENT_RECEIVED creates verified cash;
- refund reduces net cash economics;
- direct pilot cost reduces gross contribution;
- renewal / expansion increases evidence maturity but is not automatically cash.

Gross contribution:

`verified cash - refunds - direct attributable pilot costs`

This is not GAAP/IFRS profit and must not be labelled as such.

## 4. Pricing evidence

Pricing confidence is evidence maturity, not a model forecast.

- UNPROVEN — no written accepted price;
- LOW — written accepted price;
- MEDIUM — verified payment received;
- HIGH — renewal or expansion accepted.

Additional derived metrics:
- realized price ratio = accepted price / latest quoted price;
- discount rate = 1 - realized price ratio.

These are shown only when quote and accepted price share the same currency.

## 5. Write authority

Commercial evidence writes are operator-controlled.

Seller:
- may read the commercial summary for its own pilot;
- may not create or rewrite ANTIQUA revenue evidence.

Operator:
- may append commercial events;
- POST requires CSRF;
- every append is audit-logged;
- durable PostgreSQL is mandatory.

## 6. Immutability and corrections

The ledger is append-only at application level.

Corrections do not rewrite history.

A bad event is corrected with:
`COMMERCIAL_EVENT_VOIDED -> voidsEventId`

The target must:
- exist;
- belong to the same pilot;
- not itself be a void event.

## 7. Idempotency

`(pilot_id, source_key)` is unique.

Replay with the same payload returns the existing event.

Reuse of the same source key with different payload returns:

`409 IDEMPOTENCY_CONFLICT`

This prevents silent financial mutation during retries.

## 8. Investor aggregation

Investor commercial aggregate can derive:
- total real pilots;
- active/completed pilots;
- paid pilots;
- cash received by currency;
- direct gross contribution by currency;
- renewed/expanded pilots;
- pricing-confidence distribution.

No cross-currency total is calculated without an explicit FX authority.

## 9. Privacy

Public verification receipts must never expose:
- counterparty email;
- buyer identity;
- private evidence documents;
- bank references;
- pricing details unless explicitly authorised.

Commercial aggregate is operator-protected.

## 10. Acceptance gate

v0.46 is PASS only when:

- migration 029 is present in the ordered manifest;
- unit accounting-boundary tests pass;
- PostgreSQL durability test passes;
- quote / acceptance / invoice cannot create cash;
- payment creates cash;
- refund + direct cost reduce gross contribution;
- same idempotency key + different body returns 409;
- invalid void target is rejected;
- browser capability test proves operator-only aggregate access;
- seller workspace remains read-only;
- investor dashboard never backfills missing evidence with invented values.
