# `/api/admin/booking-items` — Booking item snapshot API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/booking-items/route.ts` |

## POST — create

Body: `{ booking_id, item_variant_id, quantity, unit_price? }`. 400 when booking/variant missing or `quantity` is not a positive integer.
- `unit_price` defaults to the variant's `current_price` (frozen snapshot); rentable items insert with `rental_status='reserved'`, consumables with null.
- **Checklist catch-up:** when checklist rows already exist for the booking (DP already received), matching `stock_check` + `pickup` (+ `return` when rentable) rows are appended for the new item (`sort_order` = phase max + 1, same label shape as the DP trigger). Before DP, the trigger includes the item when it runs.
→ `{ booking_item }` 201.

## PATCH — update

Body: `{ id, quantity?, unit_price? }` — whitelist; quantity must be a positive integer, price ≥ 0; 400 without `id` or when nothing to update.
→ `{ booking_item }`.

## DELETE — delete

Query: `?id=` (400 when missing). Related checklist rows cascade via the `checklist_items.booking_item_id` FK.
→ `{ ok: true }`.
