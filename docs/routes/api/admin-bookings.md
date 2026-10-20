# `/api/admin/bookings` — Bookings API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/bookings/route.ts` |

## POST — create

Body: `{ product_id?, customer_name, phone, event_date, event_address, theme?, message?, status?, transport_fee? }`.
400 when any of the four required fields is missing. `product_id` is optional — omit/null it for a **custom booking** with no package. `status` defaults to `confirmed` (admin records an already-agreed booking); `transport_fee` defaults to null.
→ `{ booking }` 201. The DB trigger recalculates `date_capacity.booked_count` immediately.

**Recipe seeding:** when `product_id` is set, its `product_items` recipe (with `item_variants(current_price, items(type))`) is snapshotted into `booking_items` — `unit_price` frozen at the variant's current price, rentables inserted as `rental_status='reserved'`, consumables with null. Custom bookings start with an empty item list.

## PATCH — update

Body: `{ id, …fields }` — **allow-list**: `customer_name, phone, event_date, event_address, theme, message, status, project_status, product_id, transport_fee, dp_received_at` (everything else is ignored, so clients can't touch timestamps). `product_id`/`transport_fee` accept `''` meaning "clear" (stored as null). 400 without `id`.
→ `{ booking }`. Changing `event_date` re-triggers the capacity trigger; setting `dp_received_at` fires `trg_bookings_generate_checklist` (exactly once — the trigger no-ops when checklist rows already exist).

## DELETE — delete

Query: `?id=` (400 when missing). DB trigger recalculates `date_capacity.booked_count` after the delete.
→ `{ ok: true }`.
