# `/admin/categories` — Product categories

| | |
| --- | --- |
| **URL** | `/admin/categories` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/categories/page.tsx` |

## Purpose

CRUD for **product** categories (used by the public catalog filter). Distinct from free-text item categories used by inventory.

## Data

- `categories` ordered `name asc`, loaded client-side and reloaded after each mutation.

## Pagination

Client-side, 8 categories per page (`components/admin/Pagination.tsx`) under the list. Local component state only — this page is statically prerendered and has no filter params to persist, so the page resets when navigating away.

## Interactions

- Create form on top → `POST /api/admin/categories` (server slugifies the name).
- **Ubah** → inline rename row (auto-focus input, Simpan/Batal) → `PATCH /api/admin/categories` `{ id, name }` (slug regenerated).
- **Hapus** → `confirm()` → `DELETE /api/admin/categories?id=`; blocked (RESTRICT) while products reference the category.

## Navigation

- Breadcrumbs: `Dashboard / Kategori`.
