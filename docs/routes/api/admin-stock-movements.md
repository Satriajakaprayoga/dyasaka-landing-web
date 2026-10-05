# `/api/admin/stock-movements` — Stock movement API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/stock-movements/route.ts` |

## POST — record movement

Body: `{ item_variant_id, type, quantity, note?, booking_id? }`.

Validation:

| Rule | Error |
| --- | --- |
| `type ∈ {restock, usage, damaged, lost, adjustment, purchased}` | 400 |
| `quantity` non-zero integer | 400 |
| restock/purchased ⇒ positive | 400 |
| usage/damaged/lost ⇒ negative | 400 |
| variant exists | 404 |
| `stock_quantity + quantity >= 0` | 400 "Stok tidak cukup" |

Write order: **ledger insert first** (`stock_movements`), then the cached `item_variants.stock_quantity` is synced to the new total — the ledger remains the source of truth.
→ `{ movement }` 201.

Only `POST` exists — movements are append-only and never updated or deleted.
