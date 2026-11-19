# Newsroom — Product News Feed & Release Notes

Backlog only. No implementation on this branch.

Source: large Jira epic split into small, shippable tickets.

Related:

- Older “Release / what’s-new popup” note in [`product.md`](product.md) §6 is
  **superseded** by this epic (in-app Newsroom replaces one-shot login popup).
- Access / Super Admin patterns already live in TopBar + Super Admin layout;
  reuse them — do not invent a second auth model.
- No Newsroom-specific feature flag. Access = registered user + ACL + active
  tenant. Management = Super Admin only.

**Product decision:** Initial Newsroom ships **Release Notes only**. News,
Welcome Page, and eLearning stay in the nav as disabled placeholders. No
audience targeting. Published content is available to all eligible users.

Constraints that apply to every ticket:

- Server-side access checks (never frontend-only hide)
- Direct URLs enforce the same rules as the feed
- Pin / unread / lastVisited are **per user**
- Draft / unpublished / future-dated are hidden from non–Super Admin users
- Search and filters run **server-side**
- No email / Slack / Teams notifications
- No role-based or per-change audience selection
- No Newsroom ON/OFF feature flag

---

## Epic hierarchy (Jira-style)

```text
EPIC: Newsroom — Product News Feed & Release Notes

├── Foundation
│   ├── NEWS-001 Data models
│   ├── NEWS-002 Access control (API)
│   └── NEWS-003 Nav shell (disabled sections)
│
├── Topics (Settings)
│   ├── NEWS-004 Topics API
│   └── NEWS-005 Topics Settings UI
│
├── Release Notes management (Super Admin)
│   ├── NEWS-006 Release Notes CRUD API
│   ├── NEWS-007 Release Notes list UI
│   ├── NEWS-008 Release Note editor
│   ├── NEWS-009 Publish lifecycle actions
│   └── NEWS-010 Preview (card + full content)
│
├── User Newsroom
│   ├── NEWS-011 Public feed API
│   ├── NEWS-012 User state API (pin / lastVisited / unread)
│   ├── NEWS-013 Top-bar entry + unread badge
│   ├── NEWS-014 Feed UI (search / filters / cards)
│   ├── NEWS-015 Detail view
│   └── NEWS-016 Pin + unread wiring
│
└── Hardening
    ├── NEWS-017 i18n (en / de / ar)
    └── NEWS-018 Access + visibility regression checks
```

---

## Release strategy

| Release | Ships |
| --- | --- |
| 1 | Data models + API access guards + nav shell (disabled News / Welcome) |
| 2 | Topics Settings (API + Super Admin UI) |
| 3 | Release Notes admin list + editor (draft only) |
| 4 | Publish / unpublish / delete / duplicate + preview |
| 5 | Public feed API + Top-bar icon + feed/detail UI (read-only) |
| 6 | Pins + unread indicator + lastVisited |

Rhythm: each release is usable by itself. Super Admins can author before users
see anything. Users never see drafts or future-dated notes.

---

## Out of scope (initial implementation)

- Email / Teams / Slack / chat notifications
- Role-based audience targeting
- Audience selection on create (or per-change)
- News content management
- Welcome Page management
- eLearning
- Newsroom-specific feature / route / UI flags
- Product-specific homepage widgets
- CMS beyond Release Note requirements
- Required-read / acknowledgement flows (schema may reserve the field; no UI)

---

## Phase 1 — Foundation

### NEWS-001 — Newsroom data models

**Type:** Technical Story · **Priority:** Highest

**Goal:** Persist Release Notes, changes, topics, and per-user Newsroom state.

**Minimum fields**

| Entity | Fields |
| --- | --- |
| Release Note | id, title, description, version, contentType, status (`draft` / `published` / `unpublished`), releaseDateTime, createdBy, createdAt, updatedBy, updatedAt |
| Change | id, releaseNoteId, title, type (`feature` / `change` / `bug_fix`), description, image (URL or Base64), topicId, sortOrder |
| Topic | id, name, createdAt, updatedAt |
| User Newsroom State | userId, newsroomItemId, pinned, lastVisitedAt, read/ack (reserved) |

**Acceptance criteria**

- Models exist and are tenant-/product-safe per existing multi-tenant patterns
- Status enum matches Draft / Published / Unpublished
- Change type enum matches Feature / Change / Bug Fix
- At least one change required is enforceable at write time (API ticket), not only UI
- Pin and visit state are keyed by user + item

**Do not**

- Build UI
- Add audience / targeting fields

---

### NEWS-002 — Newsroom access control (API)

**Type:** Story · **Priority:** Highest · **Depends on:** NEWS-001

**Goal:** Enforce who can read vs manage Newsroom on every API route.

**Rules**

| Action | Who |
| --- | --- |
| Read published feed / detail | Registered + product ACL + active tenant |
| Manage Release Notes / Topics | Super Admin only |
| See drafts / unpublished / future-dated | Super Admin only (management APIs) |

**Acceptance criteria**

- Unauthenticated → denied
- Missing ACL → denied
- Inactive tenant → denied
- Non–Super Admin cannot call management endpoints
- Public read endpoints never return draft / unpublished / future-dated items
- Direct ID fetch applies the same visibility rules (no IDOR of drafts)

**Do not**

- Add a Newsroom feature flag
- Rely on frontend route hiding alone

---

### NEWS-003 — Newsroom navigation shell

**Type:** Story · **Priority:** High · **Depends on:** —

**Goal:** Add Newsroom to app navigation with initial enable/disable matrix.

```text
Newsroom
├── News              [Disabled]
├── Release Notes     [Enabled — admin routes gated to Super Admin]
├── Welcome Page      [Disabled]
└── Settings          [Enabled — Super Admin only]
```

**Acceptance criteria**

- Newsroom appears in navigation using existing product nav patterns
- Disabled sections are visible but not usable (or hidden-as-disabled consistently with other disabled nav)
- Non–Super Admin never reaches management routes
- No eLearning entry in v1
- Empty/placeholder pages OK for enabled admin routes until later tickets fill them

---

## Phase 2 — Topics (Settings)

### NEWS-004 — Topics API

**Type:** Story · **Priority:** High · **Depends on:** NEWS-001, NEWS-002

**Goal:** Super Admin CRUD for Newsroom topics.

**Endpoints (conceptual)**

- List topics
- Create topic
- Update topic
- Delete topic (block or reassign if in use — pick one; document choice)

**Acceptance criteria**

- Super Admin only
- Topic name available for change-editor dropdowns and feed filters
- Delete of an in-use topic is either rejected with a clear error **or** offers reassignment — no orphan topicIds

---

### NEWS-005 — Topics Settings UI

**Type:** Story · **Priority:** High · **Depends on:** NEWS-003, NEWS-004

**Goal:** Super Admin Settings page to list / add / edit / delete topics.

**Acceptance criteria**

- Page under Newsroom → Settings
- List shows topic name + Edit / Delete
- Add topic flow works
- Edit renames topic
- Delete respects NEWS-004 in-use rule
- Non–Super Admin cannot open the page

---

## Phase 3 — Release Notes management (authoring)

### NEWS-006 — Release Notes CRUD API

**Type:** Story · **Priority:** Highest · **Depends on:** NEWS-001, NEWS-002, NEWS-004

**Goal:** Super Admin can create, read, update, and list Release Notes with nested changes.

**Write rules**

- All Release Note fields required: title, publication date/time, version, description, ≥1 change
- Each change required: title, type, description, image (URL or Base64), topicId
- Default status on create: `draft`
- List for Super Admins returns all statuses
- Server-side filters: title search, status, release date, topic (combined)

**Acceptance criteria**

- CRUD works for Super Admin
- Invalid / incomplete payloads rejected with field-level errors
- Topic must exist
- Sort/order on changes preserved
- Non–Super Admin denied

**Do not**

- Implement public feed here (NEWS-011)
- Implement publish side-effects beyond storing status (NEWS-009)

---

### NEWS-007 — Release Notes list UI

**Type:** Story · **Priority:** High · **Depends on:** NEWS-003, NEWS-006

**Goal:** Super Admin table of Release Notes with search/filters and Create New.

**Columns:** Title · Status · Release Date · Topic

**Filters:** free-text title · status · release date · topic (combinable)

**Acceptance criteria**

- Table matches columns above
- Filters work against API
- Create New navigates to editor (can land on empty shell until NEWS-008)
- Row open leads to edit/actions surface (actions filled in NEWS-009)

---

### NEWS-008 — Release Note editor

**Type:** Story · **Priority:** Highest · **Depends on:** NEWS-005, NEWS-006, NEWS-007

**Goal:** Structured editor for basic info + Changes section.

**Basic info:** title, publication date/time, version, description

**Changes section**

- Add change (plus-circle)
- Per change: title, type radios (Feature / Change / Bug Fix + helper text), description (+ helper), image URL/Base64, topic dropdown from Settings
- Multiple changes supported; at least one required

**Acceptance criteria**

- Draft can be saved when Super Admin chooses save-as-draft (incomplete OK for draft if product allows; **publish** must be blocked — see NEWS-009)
- Field validation errors shown next to fields
- Topics come from Settings API
- Image accepts URL or Base64
- Matches existing form patterns (Chakra / shared inputs) — no new form library

---

## Phase 4 — Publish lifecycle + preview

### NEWS-009 — Publish / unpublish / delete / duplicate

**Type:** Story · **Priority:** Highest · **Depends on:** NEWS-006, NEWS-008

**Goal:** Status actions with validation and scheduling rules.

| Status | Visible to users | Notes |
| --- | --- | --- |
| Draft | No | Admin only |
| Published | Yes, if `releaseDateTime ≤ now` | Future-dated stays hidden until time |
| Unpublished | No | Admin can edit / republish |

**Actions by status:** Edit · Publish · Unpublish · Delete · Duplicate · Review/Preview (preview UI in NEWS-010)

**Acceptance criteria**

- Publish blocked until all required fields valid
- Publish sets status `published`; items with future `releaseDateTime` stay hidden from public APIs until that time
- Unpublish hides from users; remains in admin list
- Delete removes (or soft-deletes consistently with product norms)
- Duplicate creates a new draft copy (changes included)
- Non–Super Admin cannot invoke any of these

---

### NEWS-010 — Release Note preview (card + full content)

**Type:** Story · **Priority:** High · **Depends on:** NEWS-008

**Goal:** Super Admin can review card view and full-content view before publish.

**Acceptance criteria**

- Card preview matches feed card layout (image, topic badge, pin affordance decorative, title, date/time, ~30-word / ~3-line description, Read more)
- Full-content preview matches detail layout (title, date/time, image, description, changes with type/title/body)
- Preview uses editor data (draft OK); does not require publish
- Preview presentation must match what NEWS-014 / NEWS-015 will ship (shared components preferred)

---

## Phase 5 — User Newsroom (read path)

### NEWS-011 — Public feed + detail API

**Type:** Story · **Priority:** Highest · **Depends on:** NEWS-002, NEWS-006, NEWS-009

**Goal:** Eligible users list and fetch published, due Release Notes.

**Visibility:** `status === published` AND `releaseDateTime ≤ now`

**List:** newest first; server-side search (title / searchable fields); topic filter; pinned-only filter (needs NEWS-012 for pin data — can stub pinned filter until then)

**Acceptance criteria**

- Only eligible users (NEWS-002)
- Never returns draft / unpublished / future-dated
- Search + topic filter server-side
- Detail by id enforces same visibility (404/403, not leak)
- Ordered by publication date/time descending

---

### NEWS-012 — User Newsroom state API

**Type:** Story · **Priority:** High · **Depends on:** NEWS-001, NEWS-002

**Goal:** Per-user pin and visit/unread state.

**Operations**

- Pin item
- Unpin item
- Get / update `lastVisitedAt` for Newsroom
- Unread count: published items with `releaseDateTime` after user’s lastVisited (define precisely; document)

**Acceptance criteria**

- Pin state is user-specific (A pins ≠ B pinned)
- Opening feed updates lastVisited (called from NEWS-016)
- Unread count endpoint for TopBar badge
- Cannot pin items the user cannot see

---

### NEWS-013 — Top-bar Newsroom icon + unread badge

**Type:** Story · **Priority:** High · **Depends on:** NEWS-012 (count), NEWS-014 (open target can be stub)

**Goal:** TopBar Newsroom icon with unread count; click opens Newsroom feed.

**Acceptance criteria**

- Icon in TopBar near existing notification entry
- Badge shows unread count when > 0; hidden when 0
- Click opens full-screen Newsroom (modal/page from NEWS-014)
- Eligible users only; others do not see the control
- Reuse existing badge styling patterns from TopBar notifications where practical

---

### NEWS-014 — Newsroom feed UI

**Type:** Story · **Priority:** Highest · **Depends on:** NEWS-011, NEWS-013

**Goal:** Full-screen feed with header controls and cards.

**Header:** breadcrumb · close · title · search · topic dropdown · pinned-only toggle

**Card:** image · topic badge · pin icon · title · publication date · time · short description (~30 words / ~3 lines) · Read more →

**Acceptance criteria**

- Opens from TopBar icon
- Search / topic / pinned-only work against API
- Newest first
- Cards match content requirements
- Read more opens detail (NEWS-015)
- Pin control can be wired in NEWS-016 if needed; placeholder OK only if clearly non-functional is avoided — prefer wiring with NEWS-016 in same release

---

### NEWS-015 — Newsroom detail view

**Type:** Story · **Priority:** High · **Depends on:** NEWS-011, NEWS-014

**Goal:** Full-screen article/release detail.

**Header:** breadcrumb · close · title · publication date · time

**Body:** full content (description + changes with images/types/topics as designed)

**Acceptance criteria**

- Opens from Read more
- Shows complete published content
- Close returns to feed
- Access denied / missing item handled without leaking drafts
- Pin control from detail in NEWS-016

---

## Phase 6 — Pins + unread

### NEWS-016 — Pin + unread end-to-end

**Type:** Story · **Priority:** High · **Depends on:** NEWS-012, NEWS-013, NEWS-014, NEWS-015

**Goal:** Wire pin/unpin and unread clear behavior.

**Acceptance criteria**

- Pin / unpin from feed card
- Pin / unpin from detail
- Pinned-only filter shows only current user’s pins
- New published (and due) content increments unread for users who have not visited since
- Opening feed updates lastVisited and clears unread badge
- No email notifications

---

## Phase 7 — Hardening

### NEWS-017 — Newsroom i18n

**Type:** Story · **Priority:** Medium · **Depends on:** UI tickets it covers

**Goal:** All Newsroom strings in `en` / `de` / `ar` translation files.

**Acceptance criteria**

- No hardcoded user-facing English in Newsroom UI
- RTL still works for ar
- Keys follow existing i18n nesting conventions

---

### NEWS-018 — Access + visibility regression checks

**Type:** Technical Story · **Priority:** High · **Depends on:** NEWS-002, NEWS-009, NEWS-011, NEWS-016

**Goal:** One small automated check set (or assert-based demo) covering the dangerous cases.

**Must cover**

- Eligible user sees published due content
- Non-ACL / inactive tenant denied
- Non–Super Admin denied on management
- Draft / unpublished / future-dated hidden from public API
- Future-dated becomes visible after release time (or clock-controlled test)
- Pin is user-specific
- Unread clears after visit
- Direct URL / id fetch same rules as list

Keep it the smallest runnable suite that fails if visibility breaks — no giant fixture framework.

---

## Suggested Jira titles (copy-paste)

1. NEWS-001 Newsroom data models (Release Note, Change, Topic, UserState)
2. NEWS-002 Newsroom API access control (ACL + tenant + Super Admin)
3. NEWS-003 Newsroom navigation shell (Release Notes + Settings enabled)
4. NEWS-004 Topics CRUD API
5. NEWS-005 Newsroom Settings — topics UI
6. NEWS-006 Release Notes CRUD API (+ nested changes)
7. NEWS-007 Super Admin Release Notes list + filters
8. NEWS-008 Release Note editor (basic info + changes)
9. NEWS-009 Publish / unpublish / delete / duplicate + schedule rules
10. NEWS-010 Release Note preview (card + full content)
11. NEWS-011 Public Newsroom feed + detail API
12. NEWS-012 User pin / lastVisited / unread API
13. NEWS-013 TopBar Newsroom icon + unread badge
14. NEWS-014 Newsroom feed UI (search, topic, pinned, cards)
15. NEWS-015 Newsroom detail full-screen view
16. NEWS-016 Pin + unread end-to-end wiring
17. NEWS-017 Newsroom i18n (en/de/ar)
18. NEWS-018 Visibility + access regression checks

---

## Implementation principle (from epic)

Super Admin creates Release Note → adds changes + topics → publishes → published
(and due) content available to all eligible users → users browse / search /
filter → pin → unread/visit state tracked per user.

No audience targeting. No Newsroom-specific feature flag.
Access = Registered User + Valid ACL + Active Tenant.
