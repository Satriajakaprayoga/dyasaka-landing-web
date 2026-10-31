# `/api/admin/suppliers` — Supplier API (§16)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/suppliers/route.ts` |

Suppliers are material shops for purchase plans / orders — separate
master data from event `vendors` (performers & rentals). Unlike vendors
there is no `is_active` column: a supplier exists or is deleted.

## POST — create

Body: `{ name, phone?, address?, notes? }` — name trimmed non-empty
≤100 chars (400 `'Nama supplier wajib diisi'` / `'…maksimal 100
karakter'`); nullable fields `''` → null. → `{ supplier }` 201.

## PATCH — update

Body: `{ id, name?, phone?, address?, notes? }` — allow-list patch. 400
without `id` or with an empty patch. → `{ supplier }`.

## DELETE — delete

Query: `?id=` (400 when missing). Blocked while referenced — `23503`
(purchase orders / plan lines still point at the supplier) → 409
`'Supplier masih dipakai oleh pesanan atau rencana pembelian'`. →
`{ ok: true }`.
