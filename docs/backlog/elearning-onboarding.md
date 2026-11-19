# eLearning onboarding — Jira tickets

Epic for first-login onboarding that points users to an in-app eLearning catalog.
Cards open external learning URLs (SharePoint / LMS). Onboarding completion is
persisted server-side so the modal shows once.

Paste tickets into Jira as written. Adjust keys (`EL-*`) to your project prefix
if needed.

---

## Epic

**Title:** eLearning onboarding (modal → catalog → external courses)

**Goal**

Ship an end-to-end flow so new users discover learning content once, can browse
an in-app catalog, and open external courses — without needing a frontend deploy
to change tabs, cards, or URLs.

**Success metrics**

- Modal shows **once** per user (skip or continue both count as done)
- Deep link from modal lands on the correct learning tab
- Cards open the correct external URLs (`noopener` / new tab)
- Content changeable without an FE redeploy (config DB, admin UI, or documented ops path)

**Out of scope (unless product asks later)**

- Hosting videos inside the app
- Tracking course completion inside SharePoint
- Building a full LMS
- Deep SharePoint API integration (URLs only)

---

## Idea (product intent)

1. New user lands in the product → short welcome / onboarding prompt pointing to eLearning.
2. eLearning is a simple in-app area: tabs (e.g. All, Category A, Category B) + cards.
3. Each card opens an external learning page (SharePoint / LMS) in a **new tab**.
4. After dismiss (“Not now”) or continue (“eLearnings”), mark onboarding **done** so the prompt never shows again.

---

## Target architecture (modular monolith)

| Module | Responsibility |
| --- | --- |
| Web (SPA) | Modal, eLearning page (tabs + cards), routing, i18n |
| API / BFF | Serve eLearning catalog; complete onboarding for current user |
| User / Identity | Persist `onboardingCompleted` (per user; optionally per product/tenant) |
| Content / Catalog | Store tabs + cards + external URLs (or proxy a content system) |
| Auth | Session/JWT so APIs know who completes onboarding |

**External dependency:** SharePoint / LMS URLs only. No SharePoint API unless progress tracking is added later.

### Data model (minimal)

```
User
  - id
  - onboardingCompleted: boolean   // default false

LearningTab
  - id, key (e.g. "all" | "promotion" | "price")
  - title, sortOrder

LearningCard
  - id
  - tabId (or null = show in All only — document chosen rule)
  - title, description
  - externalUrl                    // SharePoint / LMS
  - sortOrder, isActive
```

**All tab:** either a virtual tab (union of all active cards) **or** a real tab
with its own cards. Pick one in EL-1 / EL-2 and document it. Do not leave both
behaviours ambiguous in the API.

### UX flow (for developers)

```
Login → load user
  if !onboardingCompleted → open modal
    [Not now]     → API mark completed → close
    [eLearnings]  → API mark completed → navigate /learning?...
/learning
  tabs → filter cards → click card → window.open(externalUrl)
```

### Dependencies checklist

**Must have**

- Auth (who is the user?)
- User profile flag: `onboardingCompleted: boolean`
- Catalog: tabs → cards → `{ title, description, externalUrl }`
- Web route (e.g. `/learning` or `/support/learning`)
- Deep link query (e.g. `?tab=promotion`) so modal can land on the right place
- Env/config for default deep-link path
- i18n for modal copy
- CORS / cookie / auth headers for web → API

**Nice to have**

- Admin UI to edit tabs/cards without code
- Analytics (modal shown / completed / card clicked)
- Role-based catalog (internal vs external users)
- Feature flag to turn modal on/off

---

## Implementation order

```
EL-1 → EL-2
     → EL-3 + EL-4 (parallel)
     → EL-5 → EL-6 → EL-7
     → EL-8 + EL-9
     → EL-10 → EL-11
```

---

## Tickets

### EL-1 — Product & UX spec

**Type:** Story / Spike  
**Priority:** High  
**Labels:** elearning, onboarding, ux, product  
**Blocks:** EL-2, EL-5, EL-6

#### Goal

Lock copy, layout, tab names, card layout, skip vs continue behaviour, and who
is allowed to edit catalog content — before engineering builds the wrong UI.

#### Work

- Define modal wireframe + final copy (welcome text, CTA labels).
- Fix tab list (names + keys used in deep links).
- Agree card layout (title, description, CTA).
- Document skip vs continue: both mark onboarding complete.
- Decide content editors (admin UI vs ops/seed process → feeds EL-8).
- Agree external URL strategy (SharePoint / LMS links only).

#### Acceptance

- [ ] Wireframe + copy approved
- [ ] Tab list and deep-link keys fixed
- [ ] External URL strategy agreed (https SharePoint/LMS links)
- [ ] “All” tab rule chosen and written down (virtual union vs real tab)

#### Out of scope

Implementing UI or APIs.

---

### EL-2 — Domain & API design

**Type:** Task  
**Priority:** High  
**Labels:** elearning, api, design  
**Depends on:** EL-1  
**Blocks:** EL-3, EL-4

#### Goal

Agree schema and endpoints so FE and BE implement the same contract, with clear
auth rules and no ambiguous “All” tab behaviour.

#### Suggested APIs

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/me` | Include `onboardingCompleted` |
| POST | `/api/me/onboarding/complete` | Mark onboarding done (idempotent) |
| GET | `/api/learning/tabs` | List tabs (sorted) |
| GET | `/api/learning/cards?tab=` | List cards for a tab (inactive hidden) |

Adjust paths to match existing API conventions in this repo when sketching OpenAPI.

#### Work

- Sketch OpenAPI (or equivalent) for the four endpoints above.
- Document DB schema for User flag + LearningTab + LearningCard.
- Document auth: who can read catalog, who can complete onboarding.
- Document “All” tab behaviour (must match EL-1 decision).

#### Acceptance

- [ ] OpenAPI / sketch reviewed
- [ ] Auth rules clear
- [ ] Schema matches minimal data model above
- [ ] Deep-link `tab` key mapping documented

#### Out of scope

Implementing persistence or UI.

---

### EL-3 — Persistence: onboarding flag

**Type:** Story  
**Priority:** High  
**Labels:** elearning, onboarding, backend, user  
**Depends on:** EL-2  
**Parallel with:** EL-4

#### Goal

Persist onboarding completion **server-side** so the modal cannot reappear after
dismiss or continue (including other devices / browsers for the same user).

#### Work

- Add `onboardingCompleted` on user (default `false`).
- Implement `POST …/onboarding/complete` (authenticated, **idempotent**).
- Ensure profile / `GET /api/me` (or equivalent) returns the flag.

#### Acceptance

- [ ] Authenticated user can complete onboarding
- [ ] Second complete call is a no-op (still 2xx)
- [ ] Flag returned on profile / me endpoint
- [ ] Unauthenticated callers rejected

#### Out of scope

Catalog storage; modal UI.

---

### EL-4 — Persistence: learning catalog

**Type:** Story  
**Priority:** High  
**Labels:** elearning, catalog, backend  
**Depends on:** EL-2  
**Parallel with:** EL-3

#### Goal

Store and serve tabs + cards from the backend so content can change without a
frontend deploy.

#### Work

- Implement LearningTab + LearningCard storage.
- Implement read APIs (`tabs`, `cards?tab=`).
- Seed starter content: All / Promotion / Price (or product-agreed names) with placeholder cards.
- Hide inactive cards from public read APIs.
- Implement “All” exactly as specified in EL-1 / EL-2.

#### Acceptance

- [ ] API returns tabs + cards
- [ ] Inactive cards are hidden
- [ ] All tab works as specified
- [ ] Seed data loadable in local / staging

#### Out of scope

Admin write UI (EL-8); web page (EL-5).

---

### EL-5 — Web: eLearning page

**Type:** Story  
**Priority:** High  
**Labels:** elearning, frontend  
**Depends on:** EL-4 (can stub with fixtures briefly, then switch to API)  
**Blocks:** EL-6 deep-link landing

#### Goal

Give users a browsable in-app learning area: filter by tab, open external courses
safely in a new tab, and support deep links from the onboarding modal.

#### Work

- Route e.g. `/learning` (or product-agreed path).
- Tabs + card list UI.
- Card CTA: `window.open(externalUrl)` / anchor with `target="_blank"` and
  `rel="noopener noreferrer"`.
- Support `?tab=` deep link to select the correct tab.
- Friendly empty state when a tab has no cards.

#### Acceptance

- [ ] Agreed tabs usable
- [ ] Cards render title / description / CTA
- [ ] Deep link selects the correct tab
- [ ] Empty tab shows friendly empty state
- [ ] External links open in a new tab with `noopener noreferrer`

#### Out of scope

Onboarding modal (EL-6); content admin (EL-8).

---

### EL-6 — Web: onboarding modal

**Type:** Story  
**Priority:** High  
**Labels:** elearning, onboarding, frontend  
**Depends on:** EL-3, EL-5

#### Goal

Show a one-time welcome prompt that either dismisses cleanly or sends the user
into eLearning — both paths mark onboarding complete so the prompt never returns.

#### Work

- After login / user load: if `onboardingCompleted === false`, open modal.
- Actions:
  - **Not now** → call complete API → close
  - **eLearnings** → call complete API → navigate to learning with configured query
- Do not show modal again when flag is true (including hard refresh).

#### Acceptance

- [ ] First login shows modal when flag is false
- [ ] After complete (either action), modal never shows again
- [ ] “eLearnings” lands on learning page with correct query
- [ ] API failure handling defined (do not silently leave user stuck in a loop — document chosen behaviour)

#### Out of scope

Editing catalog content; analytics events (nice-to-have).

---

### EL-7 — Config & i18n

**Type:** Task  
**Priority:** Medium  
**Labels:** elearning, i18n, config  
**Depends on:** EL-5, EL-6 (can start copy keys earlier)

#### Goal

Make the default learning deep-link path environment-configurable and ship
user-facing strings through i18n (no English-only hardcoding if the product is multi-locale).

#### Work

- Env/config for default learning path + default `?tab=` (if any).
- Translate modal + eLearning page strings via existing i18n pattern.

#### Acceptance

- [ ] Path configurable per env
- [ ] No hardcoded user-facing English-only strings (when multi-locale applies)
- [ ] Modal + page use the same translation keys product approved in EL-1

#### Out of scope

Translating external SharePoint page content.

---

### EL-8 — Content admin path (choose one)

**Type:** Story  
**Priority:** Medium  
**Labels:** elearning, catalog, admin, ops  
**Depends on:** EL-4  
**Parallel with:** EL-9

#### Goal

Let non-devs (or ops) add/edit a card URL **without** a full frontend release
process — either via a small admin UI or a documented DB/seed/config workflow.

#### Options (pick one in EL-1; implement here)

| Option | What to build |
| --- | --- |
| **A** | Simple admin UI to CRUD tabs/cards |
| **B** | Documented DB / seed / config process for editors |

#### Acceptance

- [ ] Non-dev can add/edit a card URL without a full FE release **or**
- [ ] Ops path documented and usable on staging (if B)
- [ ] Changes visible on `/learning` without redeploying the SPA

#### Out of scope

Full CMS; SharePoint sync; role-based catalog (nice-to-have unless product requires it).

---

### EL-9 — Security & access

**Type:** Story  
**Priority:** High  
**Labels:** elearning, security, auth  
**Depends on:** EL-3, EL-4  
**Parallel with:** EL-8

#### Goal

Ensure only authenticated users complete onboarding / read private catalog data,
external URLs cannot become an XSS or open-redirect footgun, and titles/descriptions
render safely.

#### Work

- Auth on all related APIs.
- Validate stored / returned URLs (**https only**; reject `javascript:` etc.).
- Open external links safely (`noopener noreferrer`).
- XSS-safe rendering of titles/descriptions (no unsanitized HTML).
- Optional: role filtering of catalog (only if product requires it).

#### Acceptance

- [ ] Unauthenticated cannot complete onboarding
- [ ] Unauthenticated cannot read private catalog (if catalog is auth-gated)
- [ ] Non-https / dangerous URLs rejected or never rendered as links
- [ ] Titles/descriptions XSS-safe

#### Out of scope

Full LMS permissions; SharePoint auth.

---

### EL-10 — QA / E2E

**Type:** Test  
**Priority:** Medium  
**Labels:** elearning, qa, e2e  
**Depends on:** EL-5, EL-6, EL-7, EL-9

#### Goal

Prove the full flow on staging: first visit, dismiss, return visit, tabs, cards,
and bad/missing URL behaviour.

#### Cases

1. First visit → modal → eLearnings → learning page (correct tab)
2. First visit → Not now → modal closed; refresh → no modal
3. Returning user with `onboardingCompleted=true` → no modal
4. Tab switch filters cards
5. Card opens correct external URL in new tab
6. Bad / missing URL handling (no crash; safe empty or disabled CTA)

#### Acceptance

- [ ] Checklist passed on staging
- [ ] Failures filed or fixed before calling the epic done

#### Out of scope

Automating SharePoint login / course completion.

---

### EL-11 — Handover doc

**Type:** Task  
**Priority:** Medium  
**Labels:** elearning, docs  
**Depends on:** EL-8, EL-10 (can draft earlier)

#### Goal

Leave the next developer / QA a short runbook so content updates and QA resets
do not require tribal knowledge.

#### Work

- How to add a tab / card
- How deep links work (`?tab=` keys)
- How to reset `onboardingCompleted` for QA (endpoint or script)
- Link from repo docs (README or `docs/reference/`) and/or Confluence

#### Acceptance

- [ ] Doc in repo and/or Confluence
- [ ] QA reset endpoint or script documented
- [ ] Content update path matches what EL-8 actually shipped (A or B)

#### Out of scope

Rewriting product marketing copy.

---

## Definition of done (whole epic)

- [ ] New user sees modal **once**
- [ ] eLearning page has tabs + cards
- [ ] Cards open external learning pages
- [ ] Onboarding state stored **server-side**
- [ ] Content updatable without FE code change (or clear ops process from EL-8)
- [ ] Documented for next developers (EL-11)

---

## Nice-to-have (backlog later — not required for epic DoD)

| Idea | Notes |
| --- | --- |
| Analytics | Modal shown / completed / card clicked |
| Role-based catalog | Internal vs external users |
| Feature flag | Turn modal on/off without code |
| Progress tracking | Would need SharePoint / LMS API — explicitly out of scope for v1 |
