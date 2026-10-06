# `/catalog` — Public catalog

| | |
| --- | --- |
| **URL** | `/catalog` |
| **Access** | Public |
| **Rendering** | Dynamic Server Component (`ƒ`), filters via URL search params + one client island (`SortSelect`) |
| **Source** | `app/(public)/catalog/page.tsx`, `app/(public)/catalog/SortSelect.tsx` |

## Purpose

Customer-facing product catalog. Only active products (`is_active = true`) are shown.

## Layout (top to bottom)

1. **Header** — title + tagline, live result count ("X produk ditemukan", `aria-live`).
2. **Filter form** (single GET form): search input with icon + **Cari** button; below it a sort select and a **Harga** popover (`<details>`, works without JS) with min/max inputs + Terapkan.
3. **Category pills** — horizontal-scrollable links (one GET-free navigation per pill), active pill filled pink. "Semua" clears the category.
4. **Active filter chips** — one removable chip (`×`) per active filter (search, category, min/max price, sort) + **Reset semua**.
5. **Product grid** (3 columns on desktop) or the **empty state** with a "Reset semua filter" CTA.
6. **Pagination.**

## Search / filters (server-side, all in the URL)

Submitted as a plain GET form; state lives in the URL (`?q=&category=&min_price=&max_price=&sort=&page=`):

| Param | Effect | Query |
| --- | --- | --- |
| `q` | Word-OR match on name **and** description | `or(name.ilike.%term%,description.ilike.%term%…)`; input sanitized to letters/numbers/spaces so the `or()` syntax can't be broken |
| `category` | Category UUID (from pills) | `eq('category_id', …)` |
| `min_price` / `max_price` | Price range (Rp), ignored when not a finite number | `gte` / `lte` on `price` |
| `sort` | `''` Terbaru (default), `price_asc`, `price_desc`, `name` | `.order(...)` with `created_at desc` as tiebreaker |

Changing any form filter naturally drops `page` (fresh GET submission), so a new search always starts at page 1.

## Data

- `categories` — all rows for the pills.
- `products` + `product_images(image_url, sort_order)` + `categories(name)` — filtered as above. Cover image = lowest `sort_order`; category name shown as a small label on each card.

## Card & UX details

- Card: rounded-2xl, hover lift + shadow, image zoom on hover, `line-clamp-2` name, pink bold price.
- `next/image` with `sizes` for responsive loading; first 3 images `priority` (LCP).
- No-photo placeholder: branded balloon icon on a pink-50 tile ("Tanpa foto").
- Sort select auto-submits the form on change (`requestSubmit` — progressive enhancement; the Cari button still applies it without JS).

## Pagination

Server-side slicing, 12 cards per page. `?page=` is part of the URL; **Sebelumnya / Selanjutnya** links preserve all active filter params and render a disabled state at the edges. Hidden when everything fits on one page.

## SEO / a11y

- Page metadata: `Katalog — Dyasaka Decoration` + description.
- Labeled inputs, `aria-current` on active pill, `aria-live` result count, `aria-label` pagination nav.

## Interactions

- Product card → `/product/[id]`.
- **Cari / Terapkan** submit the GET form; pills and chips are plain links (no JS required for any filtering).

## Navigation

- Back via header links (`/`, `/availability`).
