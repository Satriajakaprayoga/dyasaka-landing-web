# `/api/admin/bookings` — Bookings API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/bookings/route.ts` |

## POST — create

Body: `{ product_id, customer_name, phone, event_date, event_address, theme?, message?, status? }`.
400 when any of the five required fields is missing. `status` defaults to `confirmed` (admin records an already-agreed booking).
→ `{ booking }` 201. The DB trigger recalculates `date_capacity.booked_count` immediately.

## PATCH — update

Body: `{ id, …any booking column }` — spread as the update payload (whitelisted by the table's columns). 400 without `id`.
→ `{ booking }`. Changing `event_date` re-triggers the capacity trigger.

## DELETE — delete

Query: `?id=` (400 when missing). DB trigger recalculates `date_capacity.booked_count` after the delete.
→ `{ ok: true }`.
