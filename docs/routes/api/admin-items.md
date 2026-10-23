# `/api/admin/items` — Inventory items API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/items/route.ts` |

## POST — create

Body: `{ item_category, name, type, pieces_per_unit?, quantity_owned?, vendor_id? }`.
400 unless `item_category` + `name` present and `type ∈ {consumable, rentable, service}` (service = vendor-provided services — photographer, clown; rental lifecycle unused).
`quantity_owned` stored only for `rentable` (others forced to `0`); `pieces_per_unit → null` and `vendor_id → null` when omitted (`''` → null too).
→ `{ item }` 201.

## PATCH — update

Body: `{ id, name?, item_category?, type?, pieces_per_unit?, quantity_owned?, vendor_id? }` — whitelist patch plus `updated_at`; 400 without `id`; `type` re-validated when present.
→ `{ item }`.

## DELETE — delete

Query: `?id=` (400 when missing). 500 when variants with stock/price history or product_items/booking_items references block the cascade (RESTRICT deeper in the chain).
→ `{ ok: true }`.
