# `/api/admin/transactions` — Money ledger API (§12)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/transactions/route.ts` |

The ledger is **append-only**: there is deliberately no GET (pages read
via the browser Supabase client) and no DELETE. A mistake is fixed by a
reversal row (`PATCH action "reverse"`), never by editing or deleting.

## POST — record

Body: `{ direction, amount, category_id, transaction_date?, account?,
description?, …links, period_start?, period_end? }`.

- `direction` `in` | `out` (400 `'Arah transaksi harus masuk atau
  keluar'`); `amount` finite > 0 (400 `'Nominal harus lebih besar dari
  0'`); `category_id` required (400 `'Kategori wajib dipilih'`).
- The category is loaded and must exist (400 `'Kategori tidak
  ditemukan'`), be `is_active` (400 `'Kategori sudah tidak aktif'`) and
  match the direction (400 `'Kategori ini khusus transaksi masuk/keluar'`).
- `transaction_date` ISO `YYYY-MM-DD` or today. `period_start`/
  `period_end` (salary periods) are both required together (400
  `'Periode gaji harus diisi lengkap (mulai dan akhir)'`).
- Optional link columns accepted as-is (`''` → null): `booking_id`,
  `invoice_id`, `purchase_order_id`, `plan_line_id`, `staff_id`,
  `booking_staff_id`, `vendor_id` — at most the relevant ones arrive
  per row; a bad uuid lands as a 500 from PostgREST.

→ `{ transaction }` 201.

## PATCH — reverse (the only write)

Body: `{ id, action: "reverse" }` — anything else 400 `'Hanya aksi
pembalikan (reverse) yang tersedia'`. Original loaded (404 `'Transaksi
tidak ditemukan'`); already reversed (any row with
`reverses_transaction_id = id`) → 409 `'Transaksi ini sudah pernah
dibalikkan'`.

The reversing row flips the direction and must land in a category of
that direction — same name, mirrored (auto-created on the fly when the
admin never recorded one, inheriting the original's `sort_order`,
fallback name `'Lain-lain'`). It carries the same links as the original
so margin and cashflow reports neutralize the mistake everywhere at
once, is dated **today** (the money moved back now), and its
description is prefixed `Pembalikan: `. → `{ transaction }` 201.
