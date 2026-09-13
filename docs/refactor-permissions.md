# Refactor: one allow / deny source (permissions + readonly)

**Not** warehouse / barcode work. Implement later.

How to read this:

- This is an **architecture** ticket, not a one-file bugfix.
- The app already has several allow/deny systems. They do not talk to each other. Screens AND them by hand (or forget a layer).
- Goal: **one backend file** computes the session answer; login/refresh returns it; the UI asks `can('…')` instead of five local `if`s.

---

## PERM-1 — Session capabilities: backend owns allow / deny, UI only renders

**Type:** Architecture / refactor  
**Priority:** High (debt) — do **not** mix into warehouse/barcode  
**Labels:** permissions, see, subscription, offline, warehouse, frontend, backend  
**Implement:** later, in phases (see below)

### Summary

Users are blocked from editing in many unrelated ways: role SEE, tenant package pages, expired subscription, offline work mode, warehouse combined view, warehouse ACL, invoice/transfer document state. Each screen invents its own hide / disable / readOnly mix.

There is **no** single “what may this user change right now?” payload. Login already returns `see` + `accessiblePages` + `offlineEnabled`. Everything else is a local `if`.

Expired subscription is the clearest hole: the API already rejects writes (`403 Subscription expired`), but buttons stay clickable.

### Symptom

Typical shop cases:

| Situation | What the user sees today | What actually blocks them |
|---|---|---|
| Cashier, no product edit | Some fields `isReadOnly`, some buttons hidden | `canSee(SEE.*)` per component |
| Tenant package without Daily | Nav item missing, route redirects | `accessiblePages` + `getTenantActions` + `useTenantRouteGuard` |
| Subscription ended | Banner only. Save still looks available | API `isWriteBlockedWhileExpired` → 403 after click |
| Offline | Settings dimmed; warehouse **Move** disabled | `workMode === 'offline'` / `!isOnline` in each screen |
| Combined warehouse view | Cannot post invoice / edit qty / transfer | `isOperational` (`selectedIds.length === 1`) |
| Staff warehouse ACL | Other warehouses missing from lists | `user.warehouseIds` + `ensureWarehouseAccess` |
| Invoice opened as view | Panel `isReadOnly` | local `mode === 'view'` |
| Transfer already claimed / wrong scope | Edit hidden | API `transfer.editable` |

Same action (e.g. “add selling invoice”) is gated in 3–5 places with different subsets of those rules.

### Expected

1. **Backend one file** (`services/api-store-platform/src/shared/capabilities.ts`) is the only place that *decides* session allow/deny for a user + tenant.
2. Login, refresh, and `GET users/me` (or a tiny `GET capabilities`) return that object. Frontend does not re-derive SEE ∩ pages ∩ subscription.
3. **Frontend one hook** (`useCapabilities`) ANDs that session object with **client-only context** (work mode, selected warehouse count). Screens call `can('invoices.selling.create')` / `can('inventory.transfer')`.
4. Backend **enforces the same keys** on write (authorize + controllers). UI hide and API 403 cannot drift.
5. Each deny has a **reason** the UI can show (`subscription_expired`, `offline_unsupported`, `warehouse_combined`, `see_missing`, `page_missing`).

### Current map (studied twice — FE + API)

Do not rediscover this. These are the lock **layers**. A capability is `AND` of the layers that apply.

#### Layer 1 — Role SEE (field / action flags)

Already the closest thing to a catalog.

| Side | Where |
|---|---|
| Catalog | `services/api-store-platform/src/shared/seeCatalog.ts` + FE `src/shared/seeFlags.ts` (must stay in sync) |
| Resolve | `seePermissions.ts` → `getSeeSet(tenantId, role)` from `TenantRolePermission` (owner = defaults) |
| Enforce | `ensureSeeIds`, `ensureProductPatchSee`, `ensureInvoiceEditFieldSee`, `ensureSeeForResource` |
| Login | `see: [...]` on login + refresh (`api.controller.ts`) |
| FE read | `useSee()` ← login `user.see`. `GET user/:id/frontend-resources` returns the same `see` but `frontendResources` is **always `[]`** — do not revive the old Role matrix |
| FE use | `canSee(SEE.productsEdit)` everywhere; `useAllowedActions()` is only a **product** subset; daily still has a leftover `useResources()` / `AllowedActions` map |

UI reaction: **hide** add/delete buttons, **readOnly** on product fields (`AddProductModal` `lock(SEE…)`), skip queries.

This layer is **not** broken. Do not replace SEE with a second flag list. Capabilities **compose** SEE.

#### Layer 2 — Tenant package pages

| Side | Where |
|---|---|
| Stored | `Tenant.accessiblePages` |
| API map | `tenantPageAccess.ts` → `getRequiredAccessiblePages` / `tenantHasRequiredPageAccess` |
| Login | `accessiblePages` |
| FE | `getTenantActions` + `useTenantRouteGuard` + `App.tsx` / `TenantLayout` nav |

UI reaction: **hide** nav, **redirect** off the route. Super-admin pages (`TENANTS_LIST`, …) are a special case of the same list.

#### Layer 3 — Build-time feature flags (frontend only)

`getEnabledActions()` / `config.tenantActions` in `web/store-platform-frontend/src/config.ts`.

AND with layer 2 before a route is allowed. Backend does not know this list. Either drop it (tenant pages are enough) or send the same list from the API. Do not keep a third silent AND.

#### Layer 4 — Subscription expired (writes off, reads on)

| Side | Where |
|---|---|
| Decide | `subscription/persist.ts` `toView().expired` + `syncTenantSubscription` |
| Enforce | `api.authorize.ts`: `isWriteBlockedWhileExpired` → **403** on POST/PUT/PATCH/DELETE except `subscription` + auth |
| Read still ok | `getTenantRequestAccess`: expired tenant stays readable so they can renew |
| FE | `SubscriptionRenewalBanner` / TopBar **warning only**. **No** `canSee` / `isDisabled` for expired |

Gap: user can press Save, then lose. Capabilities must expose `writeBlocked: true` + reason `subscription_expired`.

#### Layer 5 — Offline / work mode (client + header + local handler)

The API already receives `x-work-mode` (`storePlatformApi.ts`). Settings writes check it (`assertSettingsMutableWhileOnline` → 403). Transfers / AI / barcode do **not** use that header; they fail in `localHandlers` or because the route is not offline-capable.

Live “I am offline now” is still client `workMode`. Session capabilities return the **blocked-key catalog**, not a boolean the server guessed.

Blocked or unsupported today (`localHandlers.ts` / `isOfflineCapableEndpoint`):

| Action | What happens |
|---|---|
| Settings write (`user-settings`, `currency-settings`, `invoice-settings`, `label-templates`) | 403 `SETTINGS_LOCKED_OFFLINE`; Settings page dims tiles |
| Warehouse transfer POST/PATCH/DELETE | 503 “requires an online connection”; Move button `isDisabled={!isOnline}` |
| Invoice AI extract / confirm / usage | not offline-capable |
| Product barcode generate | not offline-capable |
| Reports chat / watch | not offline-capable |
| Tenants, subscription, users, employees | not offline-capable |
| Login / refresh / logout / sync endpoints | always network |

Allowed offline (outbox): selling/buying invoice create, products, daily actions, customers, suppliers, most catalog CRUD.

UI reaction: mix of **disable** (Move), **dim + toast** (settings), **silent 503** (AI).

#### Layer 6 — Warehouse operational scope (client header + API)

Exactly **one** selected warehouse = operational (post / qty edit / transfer). Two or more = combined view = read lists only.

| Side | Where |
|---|---|
| FE | `useWarehouseScope().isOperational`; `canPostInvoices`; product qty `isEditable={… && isOperational}` |
| API | `x-warehouse-scope` → `resolveWarehouseScope`; transfers `editable` if current scope can edit that move |

This cannot be a login boolean. Session capabilities can say `warehouse.canOperateWhenSingleScope: true`. Live `can('invoices.selling.create')` ANDs `isOperational`.

#### Layer 7 — Warehouse ACL

`User.warehouseIds`. Owner / `super_admin` = all. Others: empty ACL = see nothing.

`warehouseAccess.ts`: `ensureWarehouseAccess`, `filterByWarehouseAccess`. Login does **not** return `warehouseIds` today (only via `GET /users` for owners). Capabilities must include `warehouseIds: string[] | null`.

#### Layer 8 — Role hierarchy (not SEE)

`useUser()`: `isOwner`, `isAdmin`, `isOwnerOrAdmin`. Extra hide/disable on top of SEE:

- Daily add / bulk delete: **`isAdmin`** (owner without admin role does not see it)
- Product import, label-template CRUD: `isOwnerOrAdmin`
- Role-access editor, invite owner: `isOwner` only
- Self-delete / owner-delete blocked in `UsersLogIn` (API: `tenantUserActions.ts`)

Do not invent SEE flags for “only owner”. Put `role` + `isOwner` on the session object and let `can()` AND it.

#### Layer 9 — Document / row / quota (per resource, not session)

Do **not** put these in the session blob.

- Invoice panel `mode === 'view'` / `'edit'` — **UI only**. API does **not** lock posted/confirmed invoices; they stay patchable with stock reversal. Do not invent “posted = readonly”.
- Warehouse transfer `editable` (`isWarehouseTransferEditable`)
- Label template `isProtected` / `isDefault`
- Super-admin tenant: `getTenantPermissions` (cannot delete / toggle)
- Invoice AI monthly quota (`availableCount === 0`) — `GET buying-invoices/invoice-ai-usage`
- Referential delete 422s (product in use, customer has invoices, …) — toast after click is enough

Session capabilities answer “may this **role** edit invoices”. The row still answers “may **this** transfer be edited”.

#### Layer 10 — Auth / role routes

`ProtectedRoute` `allowedRoles`. JWT missing/expired. Tenant inactive (non-subscription) → cannot even sign in (`tenantMaySignIn`).

Not a button problem. Leave in authorize middleware.

---

### Why a new file (do not grow SEE)

SEE = “does this **role** see this **control**”.

It does not know: subscription, offline, warehouse scope, owner/admin extras, package pages.

Today each button does a homemade AND:

```
canMove = canEditStockQuantity && isOperational && hasMultipleAccessible && isOnline
canPostInvoices = isOperational && operationalWarehouseId
canAddSelling = canSee(SEE.sellingInvoicesSellingButton)
```

Subscription is missing from all of those.

`capabilities.ts` returns the **session** slice. The FE hook adds **context**. Controllers call `assertCan(ctx, 'inventory.transfer')` instead of a new ad-hoc 403.

### How to implement (do this, nothing extra)

**A. One backend module**

`services/api-store-platform/src/shared/capabilities.ts`

Input: request context (tenant, user, role, already-loaded `see`, `accessiblePages`, subscription view, `offlineEnabled`).

Output (shape, names can stay this tight):

```
{
  see: SeeId[]
  pages: TenantAccessiblePage[]
  writeBlocked: boolean
  writeBlockedReason: 'subscription_expired' | null
  offlineEnabled: boolean
  offlineBlocked: CapabilityKey[]   // catalog, not live workMode
  warehouseIds: string[] | null     // null = unrestricted
  can: Record<CapabilityKey, boolean>  // SEE ∩ pages ∩ !writeBlocked
}
```

`can[key]` at session time = SEE + page + subscription. It does **not** AND offline or combined-view (those are live).

Start with keys that already have a hide/disable in the UI. Map 1:1 to existing SEE ids where possible:

| CapabilityKey | Session AND |
|---|---|
| `products.create` | `SEE.productsAdd` + PRODUCTS page + !writeBlocked |
| `products.edit` | `SEE.productsEdit` + … |
| `products.delete` | `SEE.productsDelete` + … |
| `inventory.qty.edit` | `SEE.productsEditQuantity` + … |
| `inventory.transfer` | qty-edit SEE + PRODUCTS/INVENTORY page + !writeBlocked; **offlineBlocked** |
| `invoices.selling.create` | `SEE.sellingInvoicesSellingButton` + SELLING_INVOICES + !writeBlocked |
| `invoices.buying.create` | `SEE.sellingInvoicesBuyingButton` / `invoices.buying.add` + … |
| `invoices.entries.create` | `SEE.invoicesEntriesAdd` + … |
| `settings.update` | `SEE.settings*` + SETTINGS + !writeBlocked; **offlineBlocked** |
| `invoiceAi.extract` | INVOICE_AI page + !writeBlocked; **offlineBlocked** |
| …same for customers/suppliers/partners/categories/users/employees |

Reuse `SEE`, `resolveAccessiblePagesForTenant`, `toView().expired`. Do not copy those rules into the FE.

**B. Return it where the session is already built**

Attach the object on login + refresh (next to `see` / `accessiblePages`). Optional `GET capabilities` for a long-lived tab after an owner changes role SEE.

Keep returning `see` and `accessiblePages` for one release so old clients do not break. Then delete the duplicate reads.

**C. Enforce on write**

`api.authorize.ts` already blocks expired writes. After A, `assertCan(ctx, key)` from the same file:

- Missing SEE / page → same 403 as today (`Role cannot see…` / page access)
- `writeBlocked` → same expired message
- Offline is **not** enforceable here (request is online when it hits the API). Offline stays in `localHandlers` but the **blocked list** must be the same `offlineBlocked` catalog (copy the array into bootstrap, or hardcode once in `capabilities.ts` and import in the FE bundle if you share a tiny package; otherwise duplicate the **list of keys** in one FE constant generated from the API payload).

Warehouse transfer / settings offline checks in `localHandlers.ts` become “is this key in `offlineBlocked`”, not a second path set.

**D. Frontend one hook**

`useCapabilities()`:

```
can(key):
  if !session.can[key] → false (reason from session)
  if key in session.offlineBlocked && workMode === 'offline' → false
  if key needs operational warehouse && !isOperational → false
  return true
```

Migrate screens that already combine 2+ layers first:

1. `ProductTableActionBar` / `ProductTableItem` (Move + qty)
2. `SellingInvoicesPage` (add selling / buying / entries)
3. `SettingsPage` (offline lock)
4. `AddProductModal` field locks (SEE only today — still go through `can` so expired/offline apply)

Do **not** rewrite every `canSee()` on day one. `canSee` stays for “show this column” (buying price). `can()` is for **mutations**.

**E. Reasons**

UI: disable + tooltip from reason. Do not hide a Save button on expired subscription with no explanation — banner already exists; also disable writes.

Hide vs disable (pick once, use everywhere):

| Reason | UI |
|---|---|
| `see_missing` / `page_missing` | **Hide** (no tease) |
| `subscription_expired` | **Disable** + existing banner |
| `offline_unsupported` | **Disable** + tooltip (Move already does this) |
| `warehouse_combined` | **Disable** / hide add (same as today on invoices) |
| Document not editable | Keep current view-mode / `editable` flag |

### Files to change (later)

| Path | What |
|---|---|
| `services/api-store-platform/src/shared/capabilities.ts` | **new** — only decision file |
| `services/api-store-platform/src/apis/api.controller.ts` | login / refresh attach `capabilities` |
| `services/api-store-platform/src/apis/api.authorize.ts` | optional `assertCan` after session built |
| `services/api-store-platform/src/offline` or FE `localHandlers.ts` | offline block list from `offlineBlocked` |
| `web/store-platform-frontend/src/shared/hooks/useCapabilities.ts` | **new** |
| `web/store-platform-frontend/src/store/user/reducer.ts` | persist capabilities next to `see` |
| Invoice / product / settings screens | switch mutation buttons to `can()` |
| Tests | `capabilities.test.ts` — expired, cashier SEE, missing page, offlineBlocked list |

Do **not** add a new Mongo collection. Do **not** fork `seeCatalog.ts`.

### Phases (do not ship as one PR)

**P1 — Backend file + payload + tests**  
`capabilities.ts`, attach on login/refresh, unit tests for expired + cashier + page-missing. No UI change. Old `see` still works.

**P2 — FE hook + three surfaces**  
`useCapabilities` + Move button + invoice add buttons + settings lock. Subscription expiry finally disables writes.

**P3 — Rest of mutation buttons**  
Daily add, customers, suppliers, product modal save, users invite. Delete leftover homemade ANDs.

**P4 — Delete duplicates**  
Stop reading raw `accessiblePages` / `offlineEnabled` in screens that already use `can()`. Keep `canSee` for visibility-only.

### Concrete examples (use as fixtures)

**Example 1 — expired owner, online, operational warehouse**

- Session: `writeBlocked: true`, `can['invoices.selling.create'] === false`, reason `subscription_expired`.
- **Today:** Add Invoice works until 403.
- **Correct:** button disabled; banner still explains renew.

**Example 2 — cashier, no product edit, subscription ok**

- `see` lacks `products.edit`.
- `can['products.edit'] === false`, reason `see_missing`.
- Product name field readOnly / save hidden. Unchanged vs today.

**Example 3 — admin, offline, wants warehouse move**

- Session: `can['inventory.transfer'] === true` (role+page+subscription ok), key listed in `offlineBlocked`.
- Hook: `can('inventory.transfer') === false`, reason `offline_unsupported`.
- Move stays visible (they have SEE) but disabled. Same as `ProductTableActionBar` today.

**Example 4 — admin, online, combined warehouse view**

- Session `can['invoices.selling.create'] === true`.
- Hook ANDs `!isOperational` → false, reason `warehouse_combined`.
- No new invoice session. Same as `canPostInvoices` today.

**Example 5 — cashier, Daily page not in tenant package**

- `pages` lacks `DAILY`.
- `can['invoices.entries.create'] === false`, reason `page_missing`.
- Nav hidden (already). Do not show a disabled Daily add on Welcome.

### Acceptance

- [ ] One backend file owns session allow/deny. No second catalog.
- [ ] Login/refresh include `capabilities` (`can`, `writeBlocked`, `offlineBlocked`, `warehouseIds`).
- [ ] Expired subscription: all mutation `can[key] === false`; FE disables writes (P2 surfaces at least).
- [ ] Offline Move / settings use `offlineBlocked`, not a one-off path string.
- [ ] Combined warehouse view still blocks post / qty / transfer via the hook, not a new API round-trip.
- [ ] SEE catalog unchanged; capabilities only AND it.
- [ ] Per-invoice / per-transfer `editable` stays on the resource. Not in the session blob.
- [ ] Tests: examples 1–3 in `capabilities.test.ts`. No capabilities tests exist now.
- [ ] `en` / `ar` / `de` tooltips for the new reasons (P2).

### Out of scope

- Replacing SEE or the role-access settings UI (`RoleAccessPanel`).
- A capabilities collection in Mongo.
- Evaluating `workMode` on the server.
- Treating posted/confirmed invoices as readonly (the API does not; do not add that in this refactor).
- Redesigning subscription / renew flow.
- Offline review list (that is `FE-OFF-1` in `later-jira-ticket-implementation.md`).
- New permission types the shop does not already enforce.

### Test plan

1. Owner, expired: open Products / Invoices / Daily — add/save disabled; GET still works; renew request still works.
2. Cashier without `products.edit`: product fields readOnly; selling add still follows that cashier’s SEE.
3. Offline: Move disabled with tooltip; settings tiles locked; creating a selling invoice still works (not in `offlineBlocked`).
4. Combined warehouses: no new invoice; qty not inline-editable; go to one warehouse → both return.
5. Staff with one warehouse in ACL: cannot post to another (API still `ensureWarehouseAccess`).
6. Open an existing invoice in view mode: still read-only even if `can('invoices.selling.edit')` is true.

### Note until this ships

Every new button must keep AND-ing the layers it needs (at least SEE + `isOperational` + online when the action is online-only). Do not add a fourth homemade hook. Prefer waiting for `useCapabilities` over copying `canMove` again.

If a screen forgets subscription, the API still 403s — money is not corrupted; UX is. Offline transfer is already disabled on the product bar; settings are already locked in `SettingsPage`. The debt is **scatter**, not a missing server check for those two.
