# `/api/admin/booking-staff` — Helper assignments API (§13)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/booking-staff/route.ts` |

Staff assignments per booking: the person, the role on this event and
the planned pay. Cancelling keeps the row (pay history / ledger links
survive); deleting is only for mistakes before any payment exists.

## POST — assign

Body: `{ booking_id, staff_id, role?, planned_pay?, note? }` — booking
and staff required (400 `'Booking dan staff wajib dipilih'`);
`planned_pay` defaults to 0 and must be finite ≥ 0 (400 `'Rencana bayar
tidak boleh negatif'`); nullable text fields `''` → null. Inserted with
`status 'planned'`. `23503` (bad FK) → 400 `'Staff atau booking tidak
ditemukan'`. → `{ assignment }` 201.

## PATCH — update

Body: `{ id, role?, planned_pay?, status?, note? }` — allow-list patch;
`status` must be `planned` | `confirmed` | `cancelled` (400 `'Status
penugasan tidak valid'`). 400 without `id` or with an empty patch. →
`{ assignment }`.

## DELETE — remove

Query: `?id=` (400 when missing). Unconditional — the UI only offers it
while no ledger payment references the assignment, but the API itself
does not enforce that. → `{ ok: true }`.
