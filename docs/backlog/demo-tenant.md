# Revo Demo Tenant System — Jira tickets

**Project:** Revo  
**Feature:** Self-Service Demo Accounts  
**Technology:** Node.js, Express.js, MongoDB  
**Priority:** High  
**Target duration:** 7 days per demo tenant

Epic for self-service demo accounts: prospect scans a QR code, picks a business
activity, gets an isolated tenant with sample data and login credentials, uses
Revo for seven days, then access expires and data is cleaned up safely.

Paste tickets into Jira as written. Adjust keys (`DEMO-*`) to your project
prefix if needed.

---

## Epic

### DEMO-EPIC-01 — Self-Service Demo Tenant Provisioning

**Title:** Self-service demo tenant provisioning (QR → activity → credentials → 7 days → cleanup)

**Goal**

Enable prospective customers to create an independent, fully populated Revo demo
account by scanning a QR code, selecting their business activity, and receiving
login credentials valid for seven days — without sales-team assistance and
without shared demo accounts.

**Business value**

- Let prospects experience Revo without assistance from the sales team
- Increase trust by allowing customers to explore the actual application
- Provide a business-specific demo with realistic sample data
- Eliminate shared demo accounts and daily manual data resets
- Convert demo users into paying customers

**Success metrics**

- Visitor selects a supported activity and creates a demo account
- Every demo tenant has a unique `tenantId` and isolated sample data
- Credentials work across supported devices
- Access expires after seven days (server-enforced)
- Cleanup removes only that demo tenant’s data
- No demo operation modifies real customer data

**Out of scope (unless product asks later)**

- Unlimited / paid trial extensions beyond seven days (unless product defines a separate flow)
- Cloning real customer tenants as templates
- Daily reset of a single shared demo account (replaced by per-visitor tenants + cleanup)
- Building a separate product UI beyond the demo landing + existing Revo app

---

## Idea (product intent)

1. Prospect scans a QR code → public demo landing page.
2. Selects a business activity (e.g. clothing, phones, grocery).
3. System creates a new demo tenant, clones template data, creates a demo user.
4. Credentials are shown once; prospect logs into Revo.
5. After seven days → access denied; scheduled job cleans up that tenant only.

**Target flow**

```
QR Code
  → Select Business Activity
  → Create Demo Tenant
  → Clone Template Data
  → Create Demo User
  → Display Credentials
  → Access Revo for 7 Days
  → Expire and Clean Up Demo Data
```

---

## Current state

- Revo uses Node.js, Express.js, and MongoDB.
- Separate `dev` and `production` databases.
- Multiple tenants share collections; logical isolation via `tenantId`.
- Relationships between documents use `ObjectId`.
- Relevant collections for tenant data are known.
- An automated or scripted data-reset mechanism exists.
- Self-service demo accounts (QR → activity → private tenant) are **not** implemented yet.

---

## Target architecture (fit to modular monolith)

| Piece | Responsibility |
| --- | --- |
| Public landing (Web) | QR entry, activity selection, loading / credentials / error UI |
| Demo provisioning API | Validate activity; create tenant; clone template; create user; return credentials |
| Tenant / Identity | Demo metadata (`isDemo`, status, `expiresAt`); demo user under new `tenantId` |
| Template inventory | Per-activity clean template tenants (source data, never mutated by clones) |
| Auth | Existing login; enforce demo expiration on login **and** authenticated APIs |
| Cleanup job | Find expired demos; delete tenant-owned docs by exact `tenantId`; mark deleted |
| Security | Rate-limit public create; never trust client `tenantId`; protect real tenants |

### Demo tenant metadata (minimal)

```
Tenant (or demo metadata side-doc)
  - tenantId
  - isDemo: true
  - demoActivity: string        // allowlisted key
  - status: provisioning | active | expired | cleanup_pending | deleted
  - createdAt
  - expiresAt                   // server-generated, +7 days on success
```

### Lifecycle (allowed shape)

```
provisioning → active → expired → cleanup_pending → deleted
                 ↘ (provisioning failure → deleted / never active)
```

Document exact transitions in DEMO-01. Real customer tenants must never enter
this lifecycle or cleanup selection.

---

## Implementation order

```
DEMO-01 → DEMO-02
       → DEMO-03 → DEMO-04
       → DEMO-06 + DEMO-08 (parallel after create works)
       → DEMO-07
       → DEMO-09
       → DEMO-05   (public landing last — after security + integrity pass)
```

| Order | Ticket | Priority |
| --- | --- | --- |
| 1 | DEMO-01 — Define environment and lifecycle | Highest |
| 2 | DEMO-02 — Prepare demo templates | High |
| 3 | DEMO-03 — Automated tenant creation | Highest |
| 4 | DEMO-04 — Demo user and credentials | High |
| 5 | DEMO-06 — Seven-day expiration | Highest |
| 6 | DEMO-08 — Tenant isolation and security | Highest |
| 7 | DEMO-07 — Expired tenant cleanup | High |
| 8 | DEMO-09 — Data integrity and testing | High |
| 9 | DEMO-05 — QR code and landing page | High |

**Note:** After DEMO-01 and DEMO-02, some work can run in parallel. **Do not**
enable public demo creation until DEMO-08 and DEMO-09 pass.

---

## Tickets

### DEMO-01 — Define demo environment and tenant lifecycle

**Type:** Story  
**Priority:** Highest  
**Labels:** demo, tenant, architecture, security  
**Blocks:** DEMO-02, DEMO-03, DEMO-07

#### Current state

Revo has separate `dev` and `production` databases. The target database for
public demo tenants is not yet finalized.

#### Goal

Establish a clear and safe lifecycle for demo tenants **before** automated
provisioning — so creation and cleanup cannot touch real customers.

#### Work

- Decide: dedicated demo environment **or** production DB with strict isolation.
- Define lifecycle statuses: `provisioning`, `active`, `expired`,
  `cleanup_pending`, `deleted` (+ allowed transitions).
- Store demo metadata: `isDemo`, `demoActivity`, `createdAt`, `expiresAt`, `status`.
- Document how demo tenants are distinguished from real customers.
- Reuse existing tenant architecture wherever possible.

#### Acceptance

- [ ] Demo environment / DB strategy documented and approved
- [ ] Demo tenants distinguishable from real customer tenants
- [ ] Lifecycle states and transitions defined
- [ ] Real customer tenants cannot be selected for demo cleanup
- [ ] Design reuses existing tenant model where possible

#### Out of scope

Implementing clone / cleanup jobs; landing page UI.

---

### DEMO-02 — Prepare business-specific demo templates

**Type:** Story  
**Priority:** High  
**Labels:** demo, templates, data  
**Depends on:** DEMO-01  
**Blocks:** DEMO-03

#### Current state

Multiple business tenants exist. Ready-to-use demo templates per activity are
not confirmed.

#### Goal

Give prospects an immediately useful, business-specific Revo experience with
no manual data entry — via stable templates that can be cloned repeatedly.

#### Work

- Prepare a clean template tenant per initial activity, e.g.:
  - Clothing stores
  - Mobile phones and accessories
  - Grocery stores
- Populate with realistic **fictional** data: products, customers, suppliers,
  invoices, inventory movements, cash transactions, and other app-required records.
- Ensure sample data yields meaningful sales, stock, and profit reports.
- Exclude real customer data, credentials, and confidential information.
- Document collections and dependencies required by each template.

#### Acceptance

- [ ] Each supported activity has a verified template
- [ ] All required collections are populated
- [ ] Sample invoices, inventory, balances, and reports are consistent
- [ ] Templates remain unchanged when new demo tenants are created
- [ ] Template data can be cloned repeatedly

#### Out of scope

Clone service implementation (DEMO-03); public landing UI.

---

### DEMO-03 — Implement automated demo tenant creation

**Type:** Story  
**Priority:** Highest  
**Labels:** demo, provisioning, backend, mongodb  
**Depends on:** DEMO-01, DEMO-02  
**Blocks:** DEMO-04, DEMO-05

#### Current state

Tenant data lives in shared MongoDB collections, isolated by `tenantId`. Related
documents use `ObjectId` references.

#### Goal

Automatically create an independent demo tenant with complete sample data using
the existing multi-tenant architecture — safely under concurrency and failure.

#### Work

- Central service, e.g. `createDemoTenant(activity)`.
- Validate activity against an allowlist.
- Generate unique `tenantId` on the server.
- Create demo tenant with `provisioning` status.
- Clone required documents from the selected template.
- Replace source `tenantId` with the new id.
- Preserve / remap `ObjectId` references to cloned docs.
- Handle unique indexes and tenant-specific identifiers correctly.
- Activate only after successful provisioning + validation.
- Partial failure must **not** leave an accessible incomplete tenant.
- Safe against duplicate requests and concurrent execution.

#### Acceptance

- [ ] Successful request creates a unique demo tenant
- [ ] All cloned tenant-owned documents use the new `tenantId`
- [ ] Internal references point to the correct cloned documents
- [ ] Source template is never modified by a clone
- [ ] A second creation produces an independent dataset
- [ ] Failed provisioning does not expose a partial tenant
- [ ] Duplicate requests do not unintentionally create multiple tenants
- [ ] Real customer data remains unchanged

#### Out of scope

Demo user credentials UI (DEMO-04 / DEMO-05); expiration enforcement (DEMO-06).

---

### DEMO-04 — Create demo user and generate login credentials

**Type:** Story  
**Priority:** High  
**Labels:** demo, auth, user  
**Depends on:** DEMO-03  
**Blocks:** DEMO-05

#### Current state

Revo supports tenant-specific users and passwords. Automated demo-user creation
and credential delivery for this flow are not implemented.

#### Goal

Give every prospect their own login into their demo tenant — no shared
credentials, no access to other tenants.

#### Work

- Create a dedicated demo user per demo tenant (`tenantId` bound correctly).
- Reuse existing authentication and approved password hashing.
- Never expose password hashes or system secrets.
- Return credentials only after successful provisioning.
- Avoid collisions on globally unique usernames / unique account fields.
- Ensure credentials cannot grant access to another tenant.

#### Acceptance

- [ ] Each successfully provisioned demo tenant has a valid demo user
- [ ] User is associated with the correct tenant
- [ ] Credentials work through the existing login flow
- [ ] Credentials are not returned when provisioning fails
- [ ] Passwords never stored in plaintext
- [ ] User cannot access another tenant’s data

#### Out of scope

QR landing page; expiration UX copy (DEMO-06).

---

### DEMO-05 — Implement QR code entry and business activity selection

**Type:** Story  
**Priority:** High  
**Labels:** demo, frontend, landing, ux  
**Depends on:** DEMO-03, DEMO-04, DEMO-08, DEMO-09  
**Note:** Ship publicly only after security + integrity tickets pass.

#### Current state

Proposed journey starts with a QR code. Self-service landing and automated
creation UX are not implemented.

#### Goal

Reduce friction so prospects start Revo with minimal effort and no sales-team help.

#### Work

- Public landing page reachable via QR code.
- Show supported business activities; submit selection to protected backend.
- Clear loading state during provisioning.
- Show login credentials + instructions on success.
- Helpful errors on failure (no internal stack traces / secrets).
- CTA to contact Revo or subscribe.
- Responsive: mobile, tablet, desktop.

#### Acceptance

- [ ] QR opens the demo landing page
- [ ] Visitors can select an available activity
- [ ] Success → credentials screen
- [ ] Failure → helpful message; no internal error leakage
- [ ] Works on supported screen sizes
- [ ] Does not expose template credentials or sensitive config

#### Out of scope

In-app onboarding tours inside Revo; sales CRM integration.

---

### DEMO-06 — Enforce demo expiration after seven days

**Type:** Story  
**Priority:** Highest  
**Labels:** demo, auth, expiration  
**Depends on:** DEMO-01, DEMO-03  
**Parallel with:** DEMO-08 (after create works)

#### Current state

Proposed duration is seven days. Centralized expiration enforcement is not
confirmed as implemented.

#### Goal

Automatically enforce the seven-day demo window without manual account management —
including blocking expired sessions on the API, not only in the UI.

#### Work

- Server-generated `expiresAt` = successful creation + 7 days.
- Validate expiration on login.
- Enforce on authenticated API requests (tokens/sessions cannot bypass).
- Clear expired-demo message + contact / subscribe CTA.
- Block expired demo users from protected functionality.
- Use a consistent server-side time source.

#### Acceptance

- [ ] Every demo tenant has a valid server-generated expiration timestamp
- [ ] Access denied after expiration
- [ ] Expired sessions cannot hit protected API endpoints
- [ ] Real customer tenants unaffected
- [ ] Frontend shows appropriate expired-demo message

#### Out of scope

Cleanup deletion of documents (DEMO-07); extending demos.

---

### DEMO-07 — Implement safe cleanup of expired demo tenants

**Type:** Story  
**Priority:** High  
**Labels:** demo, cleanup, ops, mongodb  
**Depends on:** DEMO-01, DEMO-03, DEMO-06  
**Blocks:** DEMO-09 (cleanup cases)

#### Current state

A scripted / automated data-reset mechanism exists. Design replaces shared-account
daily resets with cleanup of **expired per-visitor** demo tenants.

#### Goal

Automatically remove expired demo data while protecting production customers,
templates, and DB consistency.

#### Work

- Scheduled job for expired demo tenants.
- Select candidates via explicit demo status + expiration metadata only.
- Delete tenant-owned documents in every approved collection by exact `tenantId`.
- Never delete real customers or templates.
- Handle dependent / related collections safely.
- Idempotent retries; log results/failures without passwords/secrets.
- Mark `deleted` only after cleanup verified.
- Do **not** rely solely on MongoDB TTL indexes for related documents.

#### Acceptance

- [ ] Expired demos detected by the scheduled job
- [ ] All intended tenant-owned documents removed
- [ ] Templates and real customers unchanged
- [ ] Re-running cleanup does not cause unintended deletions
- [ ] Failed cleanup logged and retryable
- [ ] Cleanup covers every collection in the approved demo data inventory

#### Out of scope

Public landing; changing real-tenant backup policy.

---

### DEMO-08 — Verify tenant isolation and demo security

**Type:** Story  
**Priority:** Highest  
**Labels:** demo, security, tenant-isolation  
**Depends on:** DEMO-03, DEMO-04  
**Parallel with:** DEMO-06  
**Blocks:** public enablement of DEMO-05

#### Current state

Isolation is via `tenantId` on shared collections. Enforcement across all routes
must be verified before public demo rollout.

#### Goal

Let prospects explore freely inside their demo tenant while protecting customer
data and system integrity.

#### Work

- Verify tenant-scoped DB ops use the **authenticated** tenant id.
- Never trust client-supplied `tenantId` for access control.
- Prevent cross-tenant read/write/delete (invoices, details, products, inventory,
  cash, reports, and other tenant-owned collections).
- Block demo users from admin / system secrets.
- Rate-limit public demo creation.
- Validate activity input and other user-supplied values.
- Confirm demo ops cannot affect real customers.
- Review globally shared resources that do not follow the standard tenant model.

#### Acceptance

- [ ] Cross-tenant access tests pass
- [ ] Foreign tenant identifiers rejected
- [ ] Demo users cannot access privileged system operations
- [ ] Public create protected against basic abuse
- [ ] No demo request can modify a real customer tenant
- [ ] Security review covers relevant API routes and DB operations

#### Out of scope

Full pen-test of unrelated product areas; building a separate auth stack.

---

### DEMO-09 — Validate data integrity and end-to-end demo flow

**Type:** Story / Test  
**Priority:** High  
**Labels:** demo, qa, e2e, integrity  
**Depends on:** DEMO-03, DEMO-04, DEMO-06, DEMO-07, DEMO-08  
**Blocks:** public enablement of DEMO-05

#### Current state

Cloning spans many collections with `ObjectId` relationships. End-to-end
validation of the full process is not yet implemented.

#### Goal

Prove demo tenants are complete, internally consistent, independent, and safe
before public release.

#### Work

- Automated tests for template cloning and reference remapping.
- Validate invoice totals, stock quantities, cash balances, profit reports.
- Concurrent demo creation tests.
- Simulate mid-clone failures and verify recovery / no partial exposure.
- Test expiration enforcement and cleanup.
- Verify independence of two tenants from the same template.
- Full journey: QR → activity → credentials → login → expire.

#### Acceptance

- [ ] Cloned tenant passes data-integrity checks
- [ ] Business transactions work correctly in the demo
- [ ] Changes in one tenant do not affect another or the template
- [ ] Failed provisioning and cleanup handled safely
- [ ] Expired tenants cannot access protected functionality
- [ ] End-to-end flow passes on supported devices

#### Out of scope

Load testing at marketing-campaign scale (track separately if needed).

---

## Definition of done (whole epic)

The feature is complete when a prospect can:

1. Scan the QR code  
2. Choose a business activity  
3. Receive a dedicated demo tenant with realistic sample data  
4. Log in from a supported device  
5. Use Revo within that tenant for **seven days**  
6. Lose access after expiration  
7. Have cleanup run safely **without** affecting real customer data  

---

## Nice-to-have (later — not required for epic DoD)

| Idea | Notes |
| --- | --- |
| Demo extension / sales-granted extra days | Separate product decision |
| Analytics on create / login / convert | Funnel metrics |
| More business-activity templates | After initial three are stable |
| Admin UI to manage templates | Ops may start with seed/scripts |
| Captcha on public create | In addition to rate limits if abuse appears |
