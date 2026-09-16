# ANTIQUA Capability Map 0.13

Status vocabulary: **IMPLEMENTED** = working product/runtime path; **PARTIAL** = useful path exists but lifecycle is incomplete; **FOUNDATION** = schema/adapter/contract exists; **EXTERNAL** = requires contracted provider/legal setup; **NEXT** = product capability not yet implemented.

## 1. Identity, account, organisation
| Capability | Status | Next proof |
|---|---|---|
| Buyer account | IMPLEMENTED | dedicated PostgreSQL persistence |
| Seller account | IMPLEMENTED | dedicated PostgreSQL persistence |
| Dealer organisation | PARTIAL | organisation/member tables + invitations |
| Multi-role account | IMPLEMENTED | organisation-scoped permissions |
| Sessions / CSRF | IMPLEMENTED | production DB + session revocation tests |
| Password hashing | IMPLEMENTED | production auth monitoring |
| TOTP 2FA + recovery | IMPLEMENTED | email/security notification adapter |
| KYC person | FOUNDATION / EXTERNAL | provider connection |
| KYB organisation | FOUNDATION / EXTERNAL | provider connection |
| Team members / delegated roles | NEXT | org memberships and invite lifecycle |

## 2. Permanent Object Passport
| Capability | Status |
|---|---|
| Permanent object ID independent of sale | IMPLEMENTED |
| RU/EN cataloguing | IMPLEMENTED |
| Maker / workshop / period / origin | IMPLEMENTED |
| Material / technique / dimensions / marks | IMPLEMENTED |
| Condition grade/report | IMPLEMENTED |
| Restoration field/history | PARTIAL |
| Provenance timeline | IMPLEMENTED |
| Evidence state | PARTIAL |
| Documents | PARTIAL |
| Literature / exhibition history | IMPLEMENTED |
| Export/cultural property state | PARTIAL |
| Media roles | PARTIAL |
| Passport amendment/version history | NEXT |
| Ownership-event history | NEXT |
| External museum identifiers | NEXT |
| IIIF Manifest | IMPLEMENTED |
| Linked Art JSON-LD | IMPLEMENTED |

## 3. Discovery & intelligence
| Capability | Status |
|---|---|
| Full-text discovery | IMPLEMENTED |
| Category facet | IMPLEMENTED |
| Period facet | IMPLEMENTED |
| Country facet | IMPLEMENTED |
| Material facet | IMPLEMENTED |
| Technique facet | IMPLEMENTED |
| Condition facet | IMPLEMENTED |
| Price facet | IMPLEMENTED |
| Location facet | IMPLEMENTED |
| Purchase-method facet | IMPLEMENTED |
| Seller facet | IMPLEMENTED |
| Object comparison 2–4 | IMPLEMENTED |
| Saved objects | IMPLEMENTED |
| Recently viewed | NEXT |
| Saved searches | NEXT |
| Follow maker/category/dealer | NEXT |
| Wanted list | NEXT |
| Similar objects | NEXT |
| Sold archive / price semantics | NEXT |
| Market comparables | NEXT |

## 4. Collector workspace
| Capability | Status |
|---|---|
| Personal collection | IMPLEMENTED |
| Collection is independent of sale | IMPLEMENTED |
| Public/private/unlisted visibility model | IMPLEMENTED |
| Collection story | IMPLEMENTED |
| Reordering/presentation | PARTIAL |
| Nested collections/folders | NEXT |
| Tags/inventory numbers | NEXT |
| Acquisition price/date | NEXT |
| Current valuation | NEXT |
| Insurance value/policy | NEXT |
| Storage/location log | NEXT |
| Movement history | NEXT |
| Restoration events | NEXT |
| Loan workflow | NEXT |
| Documents/receipts | NEXT |
| Delegated advisor/family access | NEXT |
| Succession/emergency access | NEXT |
| Share link / QR / printable catalogue | NEXT |

## 5. Collection Graph / virtual reunification
| Capability | Status |
|---|---|
| Ensemble definition | IMPLEMENTED |
| Expected components/slots | IMPLEMENTED |
| VERIFIED/CANDIDATE/KNOWN_PRIVATE/INSTITUTIONAL/MISSING/UNKNOWN | IMPLEMENTED |
| Completeness percentage | IMPLEMENTED |
| Owner privacy separate from object visibility | IMPLEMENTED |
| Distributed owner claims | IMPLEMENTED |
| Evidence behind relationship | PARTIAL |
| Curator moderation | PARTIAL |
| Visual reconstruction/map | IMPLEMENTED |
| Institutional external object links | NEXT |
| Research discussion/history | NEXT |

## 6. Exhibitions & presentation
| Capability | Status |
|---|---|
| Online exhibition | IMPLEMENTED |
| Sections and curator narrative | IMPLEMENTED |
| Mixed objects + ensembles | IMPLEMENTED |
| Reordering/layout persistence | IMPLEMENTED |
| Owner-controlled identity/location | IMPLEMENTED |
| Private viewing room | NEXT |
| Password-protected presentation | NEXT |
| Scheduled opening/closing | PARTIAL |
| Guest curator collaboration | NEXT |
| Share analytics | NEXT |

## 7. Dealer / seller operations
| Capability | Status |
|---|---|
| Dealer storefront | IMPLEMENTED |
| Inventory/listings separation | PARTIAL |
| Object draft | IMPLEMENTED |
| Structured publication checklist | IMPLEMENTED |
| Media upload lifecycle | FOUNDATION |
| Catalogue review | IMPLEMENTED |
| Changes requested | IMPLEMENTED |
| Trust review | IMPLEMENTED |
| KYB publication gate | IMPLEMENTED contract / EXTERNAL provider |
| Shop route | IMPLEMENTED |
| Make-offer route | IMPLEMENTED |
| Auction route | IMPLEMENTED |
| Private-sale route | PARTIAL |
| Seller analytics | NEXT |
| Dealer team members | NEXT |
| Bulk import/export | NEXT |

## 8. Direct commerce / private sale
| Capability | Status |
|---|---|
| Buy now | IMPLEMENTED |
| Make offer | IMPLEMENTED |
| Seller counter | IMPLEMENTED |
| Buyer counter | IMPLEMENTED |
| Accept / decline | IMPLEMENTED |
| Offer expiry | PARTIAL |
| Offer withdrawal | NEXT |
| Listing reservation | IMPLEMENTED |
| Private sale invitation | NEXT |
| Item-level conversation | PARTIAL |
| Total-cost calculator | NEXT |
| Tax/duty semantics | NEXT |

## 9. Auctions
| Capability | Status |
|---|---|
| Timed auction | IMPLEMENTED |
| Registration | IMPLEMENTED |
| Hidden proxy maximum | IMPLEMENTED |
| Server time | IMPLEMENTED |
| Idempotency | IMPLEMENTED |
| Deterministic tie rule | IMPLEMENTED |
| Anti-sniping | IMPLEMENTED |
| Concurrent serialization in preview | IMPLEMENTED memory mutex |
| PostgreSQL SELECT FOR UPDATE engine | IMPLEMENTED code / pending real DB proof |
| Append-like auction events | FOUNDATION |
| Reserve | IMPLEMENTED |
| Bid history masking | IMPLEMENTED |
| Outbid notifications | IMPLEMENTED |
| Close → winner → order | NEXT |
| Non-payment lifecycle | NEXT |
| Halt/amend/relist | NEXT |
| Live auction | NEXT |
| Hybrid auction | NEXT |
| Sealed bid | NEXT |

## 10. Order / fulfilment
| Capability | Status |
|---|---|
| Order object | IMPLEMENTED |
| Order timeline UI | IMPLEMENTED |
| Payment-due state | IMPLEMENTED |
| Shipping quote preview | IMPLEMENTED |
| Real shipping adapter | EXTERNAL / NEXT |
| Packing requirements | NEXT |
| Insured shipment | NEXT |
| Tracking | NEXT |
| Collection appointment | NEXT |
| Delivery proof | NEXT |
| Ownership transfer event | NEXT |

## 11. Payments / accounting
| Capability | Status |
|---|---|
| Provider-neutral payment model | FOUNDATION |
| Double-entry ledger | FOUNDATION |
| Payment intent model | FOUNDATION |
| Payout model | FOUNDATION |
| Payout holds | FOUNDATION |
| Reconciliation | FOUNDATION |
| Refund / partial refund representation | NEXT |
| Chargeback representation | NEXT |
| Seller statement | NEXT |
| Buyer premium / commissions | NEXT |
| VAT/tax posting | NEXT |
| Real PSP | EXTERNAL |

## 12. Trust, cultural property, compliance
| Capability | Status |
|---|---|
| Catalogue vs authenticity distinction | IMPLEMENTED |
| Risk flags | IMPLEMENTED |
| Publication gates | IMPLEMENTED |
| Audit log | IMPLEMENTED |
| Export flag | PARTIAL |
| Cultural-property state | PARTIAL |
| Authority-to-sell evidence | NEXT |
| Stolen-object check adapter | NEXT / EXTERNAL |
| Sanctions/PEP adapter | EXTERNAL |
| Country/category/payment rules engine | NEXT |

## 13. Disputes & buyer protection
| Capability | Status |
|---|---|
| Dispute domain | NEXT |
| Non-receipt | NEXT |
| Damage | NEXT |
| Mismatch | NEXT |
| Completeness | NEXT |
| Authenticity concern | NEXT |
| Evidence deadlines | NEXT |
| Operator adjudication | NEXT |
| Refund outcome | NEXT |

## 14. Notifications & messaging
| Capability | Status |
|---|---|
| Persistent notification model | IMPLEMENTED contract |
| In-app activity feed | IMPLEMENTED |
| Outbid | IMPLEMENTED |
| Offer/order events | IMPLEMENTED |
| Read/unread | IMPLEMENTED |
| Saved-search alerts | NEXT |
| Email | EXTERNAL / NEXT |
| Push | EXTERNAL / NEXT |
| Conversation threads | NEXT |
| Attachments | NEXT |
| Specialist/dealer messaging | PARTIAL |

## 15. Infrastructure / reliability
| Capability | Status |
|---|---|
| PostgreSQL schema/migrations | FOUNDATION |
| Migration advisory lock | IMPLEMENTED |
| Dedicated ANTIQUA PostgreSQL | BLOCKED external resource decision |
| Restart persistence proof | BLOCKED until DB connected |
| Backup/restore drill | BLOCKED until DB connected |
| Private object storage adapter | FOUNDATION |
| Real private storage | EXTERNAL configuration |
| Audit trail | IMPLEMENTED |
| CI security audit gate | IMPLEMENTED |
| High/critical npm vulnerability gate | IMPLEMENTED |
| Browser visual regression | NEXT |
| Multi-instance load/concurrency proof | NEXT after DB |
| Observability/alerts | NEXT |

## 16. Immediate completion sequence
1. Native 0.13 app: remove legacy runtime JS; native RU/EN; advanced facets; compare; production dossier/account.
2. Dedicated PostgreSQL and object storage.
3. Restart persistence + backup/restore + real row-lock load tests.
4. External KYC/KYB.
5. PSP + ledger posting + payouts + reconciliation.
6. Auction settlement/non-payment.
7. Shipping + disputes.
8. Saved searches/follows/wanted/similar objects.
9. Deep collection management: valuation, insurance, movement, loan, restoration, succession.
10. Messaging and dealer analytics.
