# `/api/admin/transaction-categories` — Ledger category API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/transaction-categories/route.ts` |

Categories classify ledger rows for the monthly report. A category's
`direction` is structural — reports group by it — so it is set once at
creation and never edited.

## POST — create

Body: `{ name, direction?, sort_order? }` — name trimmed non-empty ≤60
chars (400 `'Nama kategori wajib diisi'` / `'…maksimal 60 karakter'`);
`direction` defaults to `in` (only `'out'` is honored otherwise);
`sort_order` integer or 0. → `{ category }` 201.

## PATCH — update

Body: `{ id, name?, is_active?, sort_order? }` — allow-list patch
(`direction` intentionally absent); `is_active` boolean-coerced.
Deactivating only hides the category from pickers — existing ledger
rows keep it. 400 without `id` or with an empty patch. → `{ category }`.

No DELETE — categories with history must stay resolvable; deactivate
instead.
