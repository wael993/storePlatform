# Product Excel import

How the shipped initial product Excel import works. Constraints for cost /
inventory align with [`total-profit.md`](total-profit.md) and
[`../architecture/product-inventory-offline.md`](../architecture/product-inventory-offline.md).

Code: `services/api-store-platform/src/shared/productImport/`,
`apis/product-import/`, FE `components/productImport/`,
`shared/productImport.ts`.

---

## User flow

```text
Select currency + fields
  → upload .xlsx/.xlsm
  → map selected fields → Excel columns
  → master-data review (unit / category / supplier)
  → preview → batched commit
  → Products + Inventory; catalog refresh
```

**Online only.** Not in offline handlers / outbox.

**Auth:** JWT + tenant page access. Owner/admin only. Tenant from JWT.
Status on `Tenant.productImport`.

**Endpoints:**  
`GET/POST …/product-import/{status,skip,parse,preview,commit}`  
`POST …/product-import/master-data/{prepare,confirm}`

---

## Supported fields

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Max 100 |
| `retailPrice` | yes (header) | Empty → `0`; invalid non-empty → row error |
| `purchasePrice` | no | Empty → missing; invalid → row error (never silent `0`) |
| `wholesalePrice` | no | Same as purchase |
| `barcode` | no | `;`-separated → primary + `additionalBarcodes` |
| `quantity` | no | Opening stock; empty/unparseable → `0` |
| `category` | no | Match/create via master review; empty cell OK |
| `supplier` | no | Same |
| `unit` | no | Same; create uses **name as `internalCode`** |

Not in this set: latinName, internalCode, productFactoryCode, description,
warehouse column, expire date.

Limits: ≤5 files, ≤8 MB, ≤10 000 rows, session TTL 24 h, commit batch 100.

---

## Master data

1. After mapping, `prepare` collects unique Excel values for selected
   category/supplier/unit columns.
2. Normalize (trim + case-insensitive); match existing tenant rows.
3. Ambiguous (≥2 matches) → user must pick.
4. User confirms match / create / skip.
5. `confirm` creates missing rows and stores resolutions +
   `createdMasterData` ids on the session (for rollback).
6. Product rows resolve IDs from session resolutions; unresolved mapped values
   → row error.

**Warehouse:** unchanged — opening qty always goes to the caller’s
**operational warehouse** (`requireOperationalWarehouseId`). No Excel warehouse
column.

---

## Prices and currency

Wizard currency is authoritative. Excel `$` / `USD` text is stripped for
parsing only (see `parseImportNumber`). Non-empty invalid prices → row error.
Invalid/missing purchase must not invent `averageCost: 0`.

Opening cost: `catalogCostToPrimary(purchasePrice, wizardCurrency, rates)`.

---

## Rollback

Session stores `createdMasterData: { categoryIds, supplierIds, unitIds }`.

- Blocked import (existing products gate) → no creates.
- Failed product insert before any session products exist → delete session-created
  master rows by id (not by name).
- Successful import completion → clear rollback tags; keep created master rows.

---

## What’s done

| Area | Status |
| --- | --- |
| Field selection + narrowed field set + unit | Shipped |
| Master prepare/confirm + resolutions | Shipped |
| Currency price normalize / no silent 0 | Shipped |
| `;` barcodes + collisions | Shipped |
| Operational warehouse stock | Shipped |
| Session-tagged master rollback | Shipped |
| Preview shows resolved master names | Shipped |

## Follow-ups

- Multi-column barcodes; qty silent-`0` policy; tenant-driven currency tokens;
  Arabic digits; parse→commit integration test with real xlsx.
