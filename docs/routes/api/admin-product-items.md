# `/api/admin/product-items` — Product recipe ("Isi Paket") API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/product-items/route.ts` |

## POST — create (upsert)

Body: `{ product_id, item_variant_id, quantity }`. 400 when product/variant missing or `quantity` is not a positive integer.
Upserts on `(product_id, item_variant_id)` (unique index `uniq_product_items_product_variant`) — adding a variant that's already in the recipe updates its quantity instead of duplicating.
→ `{ product_item }` 201.

## PATCH — update

Body: `{ id, quantity }` — quantity re-validated (positive integer); 400 without `id`.
→ `{ product_item }`.

## DELETE — delete

Query: `?id=` (400 when missing). Errors surface as 500 with the Postgres message (e.g. RESTRICT from the underlying variant chain).
→ `{ ok: true }`.
