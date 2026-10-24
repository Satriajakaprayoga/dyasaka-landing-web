# `/admin/items/new` — Create item

| | |
| --- | --- |
| **URL** | `/admin/items/new` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/items/new/page.tsx`, `components/admin/ItemForm.tsx` |

## Purpose

Create an inventory item (consumable, rentable, or vendor service).

## Data

- `items.item_category` values (browser client), aggregated into `{ name, count }[]` sorted with `localeCompare` — powers the category autocomplete.
- `vendors(id, name, is_active)` (browser client, ordered by name) — powers the vendor select.

## Form (`ItemForm`, create mode)

- **Nama Item** (required).
- **Kategori Item** — `CategoryCombobox`: opens on focus, filters existing categories (max 8) with per-category usage counts and match highlighting; keyboard nav (↑/↓/Enter/Escape); shows **Buat baru: "X"** when the typed value has no exact match. Free text is allowed — item categories are a taxonomy separate from product categories.
- **Tipe** — 3-way toggle **Habis Pakai** / **Sewa** / **Jasa** with hint text. Rentable shows a required **Quantity Owned** field; the others always store `quantity_owned = 0`. Services skip stock/rental lifecycle (no pickup/return checklist rows; the DP trigger still gives them a stock_check row that reads as "book the vendor").
- **Vendor (opsional)** — select over vendors; inactive ones suffixed "(nonaktif)"; `''` → null (`— Tanpa vendor (barang sendiri) —`).
- **Pieces per Unit** (optional, informational).
- Submits `POST /api/admin/items` → `/admin/items`.

## Navigation

- Breadcrumbs: `Dashboard / Inventori / Tambah Item` + **Kembali** → `/admin/items`.
