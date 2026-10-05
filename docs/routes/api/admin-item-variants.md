# `/api/admin/item-variants` — Item variants API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/item-variants/route.ts` |

## POST — create

Body: `{ item_id, color?, size?, sku?, stock_quantity?, current_price, reorder_point? }`.
400 unless `item_id` and `current_price` present. Empty strings → `null`.
Initial stock > 0 also inserts a `stock_movements` row (`type: 'restock'`, note "Stok awal") so the append-only ledger stays the source of truth.
→ `{ variant }` 201.

## PATCH — update

Body: `{ id, color?, size?, sku?, reorder_point?, current_price? }`.
**`stock_quantity` is deliberately not patchable** — stock changes only through stock_movements.
Price change detection: reads the existing `current_price`, compares numerically; when different, inserts `item_price_history` **before** updating (append-only; recoverable if the update fails).
→ `{ variant }`; unknown id → 404.

## DELETE — delete

Query: `?id=` (400 when missing). 500 when item_price_history / stock_movements / product_items / booking_items still reference the variant (RESTRICT).
→ `{ ok: true }`.
