# `/api/admin/vendors` — Vendor API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/vendors/route.ts` |

Vendors are internal supplier data (admin-only RLS — no anon policy on
the table). Deleting a vendor is never blocked — `products.vendor_id`
(20261025100000) is `ON DELETE SET NULL`, so linked products just lose
their vendor reference.

## POST — create

Body: `{ name, phone?, note? }` — name trimmed non-empty ≤100 chars
(400 `'Nama vendor wajib diisi'` / `'…maksimal 100 karakter'`);
nullable fields `''` → null. `is_active` defaults true (not
client-settable on create). → `{ vendor }` 201.

## PATCH — update

Body: `{ id, name?, phone?, note?, is_active? }` — allow-list patch;
`''` → null for the text fields, `is_active` boolean-coerced. 400
without `id` or with an empty patch. → `{ vendor }`.

## DELETE — delete

Query: `?id=` (400 when missing). → `{ ok: true }`.
