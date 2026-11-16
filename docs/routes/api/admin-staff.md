# `/api/admin/staff` — Staff & helper master data API

| | |
| --- | --- |
| **Access** | Admin — `createServerSupabase()` → `auth.getUser()`; 401 when absent. RLS is the write boundary (no service role). |
| **Source** | `app/api/admin/staff/route.ts` |

## GET — paginated list

Query: `?page=` (default 1, min 1), `?limit=` (default 12, clamped 1–50), `?search=`.

`select('*', { count: 'exact' })`, ordered `name asc` then `id asc` (the id tiebreaker keeps same-name rows from shuffling between batches), `.range(from, from + limit - 1)`.

`search` → single `or=` across `name`, `phone`, `role`, `pay_basis`, `notes` with `ilike`; `,()%\` are stripped from the input first so user text cannot break the filter expression (plain columns only — no embeds).

→ `{ items, total, hasMore }` (`hasMore = from + items.length < total`); DB error → 500 `{ error }`.

## POST — create

Body: `{ name, phone?, role?, pay_basis?, notes? }`. `name` is required (`400 "Nama staff wajib diisi"`) and capped at 100 chars (`400 "Nama staff maksimal 100 karakter"`). Other fields are `clean()`ed: trimmed, empty string → `null`.

Insert omits mutable defaults, so new staff start `is_active = true` (no checkbox on create).

→ `{ staff }` 201; DB error → 500.

## PATCH — update

Body: `{ id, name?, phone?, role?, pay_basis?, notes?, is_active? }` — 400 `"Missing staff id"` without `id`. Allow-list only; each provided field is patched (name re-validated with the same required/100-char rules, `is_active` coerced with `Boolean()`), `updated_at` is not sent (DB trigger owns it). No writable field → 400 `"No changes"`.

→ `{ staff }`; DB error → 500.

## DELETE — delete

Query: `?id=` (400 `"Missing staff id"` when absent).

`staff.delete` — `booking_staff.staff_id` is `ON DELETE RESTRICT` so pay history stays intact. A Postgres `23503` is mapped to 409 `"Staff ini masih memiliki penugasan — nonaktifkan saja sebagai gantinya"`; deactivating via PATCH `is_active: false` is the intended alternative.

→ `{ ok: true }`.
