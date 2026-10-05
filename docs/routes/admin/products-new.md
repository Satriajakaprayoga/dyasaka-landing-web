# `/admin/products/new` — Create product

| | |
| --- | --- |
| **URL** | `/admin/products/new` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/products/new/page.tsx`, `components/admin/ProductForm.tsx` |

## Purpose

Create a product and upload its photos in one pass.

## Data

- `categories` (browser client) for the category select.

## Form (`ProductForm`, create mode)

- Name (required), category (select), price (number, Rp), description (textarea).
- Photo picker: previews via `FilePreview`, upload happens client-side to Supabase Storage bucket `product-images` after the product row is created.
- Submits `POST /api/admin/products` → then uploads images → `router.push('/admin/products')` + refresh.

## Navigation

- Breadcrumbs: `Dashboard / Produk / Tambah Produk` + **Kembali** → `/admin/products`.
- **Batal** in the form → `/admin/products`.
