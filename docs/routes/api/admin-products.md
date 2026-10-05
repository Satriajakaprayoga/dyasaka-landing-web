# `/api/admin/products` — Products API

| | |
| --- | --- |
| **Access** | Admin — `createServerSupabase()` → `auth.getUser()`; 401 when absent. RLS is the write boundary (no service role). |
| **Source** | `app/api/admin/products/route.ts` |

## POST — create

Body: `{ category_id, name, description?, price }`. 400 when `category_id`/`name`/`price` missing.
Inserts into `products` (`description → null` when omitted) → `{ product }` 201; DB error → 500.

## PATCH — update

Body: `{ id, category_id?, name?, description?, price?, is_active? }` — whitelist patch plus `updated_at`; 400 without `id`.
→ `{ product }`; not found → 500 with PostgREST message.

## DELETE — delete

Query: `?id=` (400 when missing).
1. Reads `product_images.image_url` first (rows cascade, Storage objects don't).
2. `products.delete` — 500 when bookings still reference the product (RESTRICT).
3. Best-effort Storage cleanup: paths extracted via `image_url.split('/product-images/')[1]`, removed from the `product-images` bucket.

→ `{ ok: true }`.
