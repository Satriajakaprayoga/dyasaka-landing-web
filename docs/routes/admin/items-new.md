# `/admin/items/new` — Create item

| | |
| --- | --- |
| **URL** | `/admin/items/new` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/items/new/page.tsx`, `components/admin/ItemForm.tsx` |

## Purpose

Create an inventory item (consumable or rentable).

## Data

- `items.item_category` values (browser client), aggregated into `{ name, count }[]` sorted with `localeCompare` — powers the category autocomplete.

## Form (`ItemForm`, create mode)

- **Nama Item** (required).
- **Kategori Item** — `CategoryCombobox`: opens on focus, filters existing categories (max 8) with per-category usage counts and match highlighting; keyboard nav (↑/↓/Enter/Escape); shows **Buat baru: "X"** when the typed value has no exact match. Free text is allowed — item categories are a taxonomy separate from product categories.
- **Tipe** — toggle **Habis Pakai** / **Sewa** with hint text. Rentable shows a required **Quantity Owned** field; consumable always stores `quantity_owned = 0`.
- **Pieces per Unit** (optional, informational).
- Submits `POST /api/admin/items` → `/admin/items`.

## Navigation

- Breadcrumbs: `Dashboard / Inventori / Tambah Item` + **Kembali** → `/admin/items`.
