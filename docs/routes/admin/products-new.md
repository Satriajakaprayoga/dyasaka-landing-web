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
- Photo picker: multi-select with previews via `FilePreview`; upload happens client-side to Supabase Storage bucket `product-images` after the product row is created.

### Photo pipeline (`ProductForm.uploadImage`)

- **Validation** (on file add): only JPG/PNG/WebP, max 10 MB per file — rejected files are named in an error message.
- **Auto-compression** (before upload): files over 300 KB are downscaled to max 1600 px on the long edge and re-encoded as JPEG (quality 0.82) via canvas; transparency is flattened to white; the original is kept if compression doesn't shrink it.
- **Storage path**: `{productId}/{timestamp}-{order}-{sanitized-name}.{ext}` — raw filenames never reach Storage.
- **Rollback**: if the `product_images` insert fails, the just-uploaded Storage file is deleted (no orphans).

### Error handling

Upload/insert failures do **not** silently redirect: the form stays open with a combined error naming each failed file, and the failed files remain selected so the user can retry without re-picking them.

- Submits `POST /api/admin/products` → then uploads images → `router.push('/admin/products')` + refresh (redirect only when every upload succeeded).

## Navigation

- Breadcrumbs: `Dashboard / Produk / Tambah Produk` + **Kembali** → `/admin/products`.
- **Batal** in the form → `/admin/products`.
