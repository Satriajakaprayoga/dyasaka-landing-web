# `/admin/categories` — Product categories

| | |
| --- | --- |
| **URL** | `/admin/categories` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `CategoriesView` |
| **Source** | `app/admin/(panel)/categories/page.tsx`, `components/admin/CategoriesView.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/categories/route.ts` (GET) |

## Purpose

CRUD for **product** categories (used by the public catalog filter). Distinct from free-text item categories used by inventory.

## Data

- `GET /api/admin/categories?page=&limit=&search=` — paginated server-side, 12 categories per batch, ordered `name asc` with `id` as the deterministic tiebreaker. Returns `{ items, total, hasMore }`.
- `search` → case-insensitive `ilike` on name.

## Search

| Control | Filters on |
| --- | --- |
| Search box (debounced 350 ms) | category name (via API `search`) |
| Counter | "X dari Y kategori" (X = items loaded, Y = API `total`) |

Search changes reset to batch 1 and scroll to top. Empty search result shows a **Reset Filter** action. Filters are plain component state (not persisted) — the list resets when navigating away.

## Infinite scroll

- `useInfiniteList("/api/admin/categories", { search }, 12)` from the shared hook: appends batches, drops stale responses (request id + `AbortController`), dedupes by id.
- One sentinel element after the list card, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case.
- No pagination controls and no "Load more" button. End of data shows **"Semua kategori sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | List card |
| --- | --- |
| First load / filter reset | 4 skeleton rows |
| Loading next batch | 3 skeleton rows at the bottom |
| Error (nothing loaded) | EmptyState + retry |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry |
| End of data | "Semua kategori sudah ditampilkan" |
| No filter match | "Tidak ada kategori yang cocok" + Reset Filter |

## Interactions

- Create form on top → `POST /api/admin/categories` (server slugifies the name) → `list.reload()` (name-sorted).
- **Ubah** → inline rename row (auto-focus input, Simpan/Batal) → `PATCH /api/admin/categories` `{ id, name }` (slug regenerated) → `list.reload()` + `router.refresh()`.
- **Hapus** → `ConfirmModal` with impact check: counts `products` and `items` (both RESTRICT blockers — confirm disabled with counts shown) → confirm → `DELETE /api/admin/categories?id=` → the row is removed **locally** (`removeLocal`) and `total` decremented — no refetch, scroll position kept + `router.refresh()`. The API returns a friendly 409 for FK races.

## Navigation

- Breadcrumbs: `Dashboard / Kategori`.
