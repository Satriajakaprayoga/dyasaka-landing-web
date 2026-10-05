# `/catalog` — Public catalog

| | |
| --- | --- |
| **URL** | `/catalog` |
| **Access** | Public |
| **Rendering** | Dynamic Server Component (`ƒ`), filters via URL search params |
| **Source** | `app/(public)/catalog/page.tsx` |

## Purpose

Customer-facing product catalog. Only active products (`is_active = true`) are shown.

## Search / filters (server-side)

Submitted as a plain GET form; state lives in the URL (`?q=&category=&min_price=&max_price=`):

| Param | Effect | Query |
| --- | --- | --- |
| `q` | Name contains (case-insensitive) | `ilike('%q%')` on `products.name` |
| `category` | Category UUID | `eq('category_id', …)` |
| `min_price` / `max_price` | Price range (Rp) | `gte` / `lte` on `price` |

## Data

- `categories` — all rows for the filter dropdown.
- `products` + `product_images(image_url, sort_order)` — filtered as above, ordered `created_at desc`. Cover image = lowest `sort_order`.

## Interactions

- Product card → `/product/[id]`.
- **Terapkan Filter** submits the GET form (no JS involved).

## Navigation

- Back via header links (`/`, `/availability`).
