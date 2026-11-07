# Implementation impact guide

For humans and AI agents, on any feature, bug fix, improvement or refactor.
Short rules live in the root `CLAUDE.md`; this file is the long form for larger work.
Done means every representation stays consistent, not "the UI looks right".

## A. Process

1. Name the user outcome and the non-goals.
2. Read the matching `reference/` and `architecture/` docs.
3. Trace one happy path end to end:
   UI → RTK / offline → route → SEE → controller → Mongo → response → UI.
4. List the layers you touch (B) and the impact areas that apply (C).
5. Write 3–7 failure scenarios for this change (D).
6. If API or offline changes: freeze the contract (request, response, idempotency id,
   snapshot fields, who trusts whom on sync).
7. Order: domain/API → offline → UI → History/i18n → docs.
8. Smallest correct diff; fix shared bugs once in the shared code.
9. One test that fails if the new invariant breaks, plus the commands in `CLAUDE.md`.
10. Update `reference/` when behavior ships. Backlog is intent; reference is truth.

## B. Layer map

```text
UI (React/Chakra)
  → RTK Query cache / local state
  → offline: Dexie + outbox + local snapshots        [if offline-capable]
  → HTTP (Bearer, x-warehouse-scope, x-work-mode)
  → authorize (JWT, accessiblePages, subscription)
  → SEE / validators
  → controller + domain (store-domain helpers when shared)
  → Mongo (withTenantScope) + Redis catalog invalidation when needed
  → sync replay (same controller, trusts create-time snapshots)
  → OpenAPI + docs/reference
  → i18n en/ar/de (+ RTL)
```

## C. Impact areas

**Always:** scope and non-goals · grep every caller · tenant isolation · SEE enforced
server-side · errors surfaced via `getApiErrorMessage` · no second rule beside the docs.

**When the change touches it:**

| Area | Check | Typical failure |
| --- | --- | --- |
| Offline / sync | outbox entity, `isOfflineCapableEndpoint`, `outboxIdempotencyKey`, sync replay branch, local snapshot chaining | Lost reply + retry double-posts; second pending op ignores the first; sync recalculates with live rates |
| Warehouse scope | operational vs combined, `requireOperationalWarehouseId`, ACL ∩ header | Posting in combined view |
| Money / FX / cash / profit | currency handed over, existing helpers, snapshots, correct movement type (Transfer ≠ Exchange ≠ DailyAction ≠ stock transfer) | Live rate rewrites history; wrong-currency balance check. See `cash-accounts.md`, `total-profit.md`, `party-activity.md` |
| Permissions | SEE ∩ accessiblePages ∩ subscription ∩ offline/work mode ∩ warehouse mode ∩ document state (PERM-1 debt) | Button works, API 403, or worse, API open |
| API contract | route, controller, OpenAPI, `apiStore`, sync payload | Old queued payloads fail after deploy |
| Deploy / stale shell | pending outbox vs new validation; `web-app-update.md` | Wedged outbox after deploy |
| Caching | RTK tags, Redis catalog (product master only) | Stale lists |
| Lists | server pagination vs load-all (WH-ARCH-10) | Slow pages |
| Numbers / dates | `parseNumberValue`, `formatNumberForDb`, date helpers (FE-NUM-1, FE-MONEY-1) | `4,000` → `4` |
| Deletes | `master-data-delete.md` block reasons | Orphan references, ghost ledger rows |
| Files | body limits: JSON 100kb, invoice settings 2mb, extract 12mb, product import 45mb (nginx 45m) | 413 on upload |
| AI / external | online-only, clear failure UX, no money writes without confirmation | Silent write |
| Transactions | replica set required | Works on Atlas, fails on the local CI stack |

Large epics only: PERM-1, backup/DR, rate limiting, real-time channels.

## D. Failure scenarios (pick what applies)

- Server commits, reply is lost, client retries → must be idempotent.
- Double-click or two devices → one business effect.
- Queued offline, then rates/settings change → sync keeps create-time values.
- Two cashiers race on cash or stock → the server check wins.
- Admin removes a currency, SEE or warehouse while a form is open → next save fails clearly, no partial write.
- Warehouse scope switched mid-draft.
- Subscription expired → API 403, no fake success.
- Partial sync batch → applied ids no-op, the rest continue.
- Deploy while the outbox is pending.
- Related party/product deleted.
- Language switch mid-form; RTL layout.
- Only one currency configured → hide FX features.
- Offline without a balance or catalog snapshot → block writes that need it.

## E. Patterns that work here

- Clone a shipped sibling instead of building a new stack.
- Shared math only in `currencyDisplay` / `store-domain`.
- Client idempotency ids live in form state, minted once.
- Sync trusts snapshots; live requests validate against today's settings.
- Multi-leg ledger writes in one transaction; check for an existing record before it.
- One small test that locks the new invariant.

## F. Ticket template

```markdown
## Summary
One sentence: user outcome.
## Type
Feature | Bug | Improvement | Refactor
## Docs read
- reference/… · architecture/…
## Current / expected behavior
## Non-goals
## Trace (happy path)
UI → … → API → … → DB → UI
## Layers touched
UI · apiStore · offline · API · domain · OpenAPI · reference doc · i18n
## Permissions
SEE: … | Pages: … | Warehouse: operational / any | Offline: yes / no
## Contract (API / offline only)
Request · Response · Idempotency id · Snapshot fields · Sync trust rule
## Failure scenarios
1. …
## Implementation order
## Test plan
- Invariant test · offline retry · permission/warehouse · sibling still works (name it)
## Acceptance criteria
```
