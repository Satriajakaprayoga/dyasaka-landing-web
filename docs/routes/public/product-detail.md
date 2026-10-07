# `/product/[id]` — Product detail

| | |
| --- | --- |
| **URL** | `/product/[id]` |
| **Access** | Public |
| **Rendering** | Dynamic Server Component (`ƒ`) + client islands |
| **Source** | `app/(public)/product/[id]/page.tsx` |

## Purpose

Product detail for customers: photo gallery, price, description, package contents ("Paket Termasuk"), WhatsApp inquiry CTA, and an inline availability calendar with month navigation.

## Data

Single cached fetch (`getProductData` wrapped in React `cache`, shared by the page and `generateMetadata` — one DB roundtrip), three parallel queries:

- `products` select `*, categories(name)` where `id = [id]` **and** `is_active = true` — inactive/unknown ids render `notFound()`.
- `product_images` for the product, ordered `sort_order asc` (drives the gallery).
- `product_items` select `id, quantity, item_variants(color, size, items(name))` — the recipe shown as "Paket Termasuk" (public read policies on `product_items`/`item_variants`/`items` were added specifically for this storefront display).

## SEO

- `generateMetadata`: absolute title `{product name} — Dyasaka Decoration`, description from the product (fallback copy when null).
- JSON-LD `Product` schema (`offers` with IDR price, `InStock`; offer `url` only when `NEXT_PUBLIC_SITE_URL` is set).

## Components

- **`ProductGallery`** (client island, same folder) — scroll-snap slider: native swipe on touch, arrow buttons (white circles, fade out at the edges), synced thumbnail strip (active border-pink-600), `1 / N` counter badge, keyboard ←/→ on the focused viewport. A tap (pointer-based, <8px movement — immune to scroll-snap click suppression) or the ⤢ button opens the lightbox. WAI-ARIA carousel pattern (`role="region"` + `aria-roledescription="carousel"`, slides as `group`s). Only the first photo is `priority` (LCP), the rest lazy-load; controls hidden for a single photo; "Belum ada foto" placeholder when empty.
- **`Lightbox`** (client island, same folder) — fullscreen viewer (`fixed inset-0`, `z-[70]`, `role="dialog" aria-modal`) opened from the gallery; opens at the current photo and navigates back into the slider on change. Zoom 1–4×: wheel (at cursor, non-passive listener), double-click/double-tap (at point, toggles to 2.5×), pinch (two pointers), +/− buttons; pan by drag when zoomed (clamped to bounds); swipe/arrows/←→ to change photos (prev & next preloaded, hidden); Escape/X close, `0` resets zoom. History-integrated: `pushState` on open, back button/popstate closes the lightbox instead of leaving the page; body scroll locked; focus moves into the dialog on open and is restored on close; `quality={90}` for zoomed sharpness.
- **`AvailabilityCalendar compact`** (`components/AvailabilityCalendar.tsx`, client island) — single-month view with `‹`/`›` navigation up to 6 months ahead, skeleton while loading, today ring, green = available / red strikethrough = full, legend. Reads only from `date_capacity` (no customer data).

## Layout

"‹ Kembali ke Katalog" back link → two-column grid (`lg:grid-cols-2`): gallery left, buy box right (category eyebrow, h1, price, Deskripsi, WhatsApp card, Paket Termasuk checklist) → full-width availability section below a divider.

## Interactions

- **Tanya via WhatsApp** — full-width green button in a gray card, opens `buildWhatsAppInquiryLink` (`lib/booking-helpers.ts`) with `NEXT_PUBLIC_BUSINESS_WA_NUMBER` and the product name; `target="_blank" rel="noopener noreferrer"`. Microcopy: "Konsultasi tema, tanggal, dan harga langsung dengan admin kami."
- **Paket Termasuk** — green-check list formatted `{quantity}× {item name} · {color}, {size}`; section hidden when the product has no recipe.
- Calendar month navigation is clamped to today..+6 months.

## Navigation

- "Kembali ke Katalog" → `/catalog`; catalog cards link here.
