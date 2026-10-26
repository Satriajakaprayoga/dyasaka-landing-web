# `/api/admin/products` — Products API

| | |
| --- | --- |
| **Access** | Admin — `createServerSupabase()` → `auth.getUser()`; 401 when absent. RLS is the write boundary (no service role). |
| **Source** | `app/api/admin/products/route.ts` |

## POST — create

Body: `{ category_id, name, description?, price, vendor_id?, vendor_price? }`. 400 when `category_id`/`name`/`price` missing.
Inserts into `products` (`description → null` when omitted; `vendor_id: '' | absent → null`; `vendor_price: '' | absent → null`, else `Number()`) → `{ product }` 201; DB error → 500.

## PATCH — update

Body: `{ id, category_id?, name?, description?, price?, is_active?, vendor_id?, vendor_price? }` — whitelist patch plus `updated_at`; 400 without `id`. `vendor_id: '' → null`; `vendor_price: '' | null → null`, else `Number()`.
→ `{ product }`; not found → 500 with PostgREST message.

## DELETE — delete

Query: `?id=` (400 when missing).
1. Reads `product_images.image_url` first (rows cascade, Storage objects don't).
2. `products.delete` — the `trg_products_cancel_bookings` trigger (20261020140000) fires first: active bookings (pending/confirmed) become `cancelled`, all linked bookings get `product_id = null`, so the RESTRICT FK passes. A 409 ("masih dipakai booking") is only the backstop for when the migration hasn't been applied.
3. Best-effort Storage cleanup: paths extracted via `image_url.split('/product-images/')[1]`, removed from the `product-images` bucket.

→ `{ ok: true }`.
