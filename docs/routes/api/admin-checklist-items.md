# `/api/admin/checklist-items` — Booking checklist API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/checklist-items/route.ts` |

## PATCH — update

Body: `{ id, status?, note? }`.
- `status` must be one of `pending / in_stock / need_order / done` (400 otherwise). When set, `completed_at` is stamped to now for `done` and cleared to null otherwise. Setting `done` on a pickup/return row also flips the linked `booking_items.rental_status` via the DB trigger `trg_checklist_items_done` (fires only on the transition TO done; un-marking does not rewind) — this side effect is intentionally not duplicated in application code.
- `note === ''` is stored as null.
- 400 without `id` or when nothing to update.
→ `{ checklist_item }`.

## POST — create free-text row

Body: `{ booking_id, label, phase }` — `phase ∈ {stock_check, pickup, return}`, label trimmed, required, ≤ 200 chars. Inserts with `booking_item_id = null` (the rental-sync trigger skips it) and `sort_order` = phase max + 10, so free-text rows sort after generated ones.
→ `{ checklist_item }` 201.

## DELETE — delete

Query: `?id=` (400 when missing).
→ `{ ok: true }`.
