# `/admin/items/[id]/edit` — Edit item

| | |
| --- | --- |
| **URL** | `/admin/items/[id]/edit` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client `ItemForm` |
| **Source** | `app/admin/(panel)/items/[id]/edit/page.tsx`, `components/admin/ItemForm.tsx` |

## Purpose

Edit item master data (variants/stock are managed on the detail page).

## Data

- `items` where `id = [id]` (`.single()`), all `items.item_category` values (aggregated `{ name, count }[]` for the autocomplete), and `vendors(id, name, is_active)` — parallel.
- Unknown id → `notFound()`.

## Form (`ItemForm`, edit mode)

- Same fields as create, prefilled; type toggle shows **Quantity Owned** only for `rentable`, vendor select lists inactive vendors suffixed "(nonaktif)". Submits `PATCH /api/admin/items` with `{ id, …payload }`.

## Navigation

- Breadcrumbs: `Dashboard / Inventori / {item name} (link) / Ubah` + **Kembali** → `/admin/items/[id]`.
