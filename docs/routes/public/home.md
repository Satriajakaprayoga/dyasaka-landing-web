# `/` — Home

| | |
| --- | --- |
| **URL** | `/` |
| **Access** | Public |
| **Rendering** | Dynamic Server Component (`ƒ`) — uncached supabase-js queries, same pattern as `/catalog` |
| **Source** | `app/(public)/page.tsx` + `components/landing/*` |

## Purpose

Festive landing page for Dyasaka Decoration. Hero with floating-balloon decor, featured packages, category showcase, gallery, how-to-order steps, testimonials, FAQ, WhatsApp CTA band, and the shared public footer.

## Data

Single parallel `Promise.all` (anon-readable via existing RLS, `is_active = true` only):

- `products` (`limit 6`, newest first) with `product_images(image_url, sort_order)` and `categories(name)` → featured packages + gallery.
- `categories(*)` → category showcase.

Gallery images are flattened client-side (no extra query): every product's images sorted by `sort_order`, mapped to `{ url, productId, productName }`, sliced to 9.

No featured/testimonial/settings tables exist — testimonials, FAQ, and how-to-order copy are hardcoded Indonesian text in the components (owner-editable later).

## Sections

Composed in `app/(public)/page.tsx` (`components/landing/`):

1. **Hero** — `rounded-b-[3rem]` pink gradient, decorative `BalloonIcon`s (`animate-balloon-drift`) and confetti dots (`animate-confetti-fall`) with fixed literal delays/positions (hydration-safe, disabled by `prefers-reduced-motion`); CTAs to `/catalog` and `/availability`.
2. **PackagesSection** (`#paket`) — grid of `ProductCard` (markup mirrors the catalog card; catalog itself doesn't use the component yet); "Lihat semua paket" → `/catalog`.
3. **CategoryShowcase** — tinted cards cycling `pink-50/rose-50/amber-50/sky-50` → `/catalog?category=<id>` (catalog filters by `category_id`).
4. **GallerySection** — CSS-columns masonry (`columns-2 sm:columns-3`, aspect cycle 4/3–square–3/4) → `/product/<id>`. No lightbox (the product page has one).
5. **HowToOrder** — 4 static steps (Pilih paket → Konsultasi WhatsApp → Booking & DP → Kami pasang di lokasi) with dashed desktop connectors.
6. **Testimonials** — 3 hardcoded Indonesian quotes.
7. **FaqSection** — 5 hardcoded Q/A in native `<details>/<summary>` accordions (same chevron pattern as the catalog price dropdown).
8. **CtaBand** — pink gradient band; `Chat via WhatsApp` uses `buildGeneralWhatsAppLink` (`lib/booking-helpers.ts`, plain wa.me link — the product-specific `buildWhatsAppInquiryLink` is wrong here); hidden when `NEXT_PUBLIC_BUSINESS_WA_NUMBER` is unset.

Sections 2–4 are skipped when their data is empty (e.g. fresh DB); the static sections always render.

## Shared footer

`app/(public)/layout.tsx` renders `SiteFooter` (logo/tagline, Jelajahi links, Kontak WhatsApp) after the page content on every public route: `/`, `/catalog`, `/product/[id]`, `/availability`.

## Typography

Plus Jakarta Sans via `next/font/google` in `app/layout.tsx` (site-wide) + Tailwind `fontFamily.sans` default in `tailwind.config.js`.

## Interactions

None requiring client JS — all sections are server components. FAQ accordion is native `<details>`; card hover lift and image zoom are CSS-only.

## Navigation

- **Lihat Katalog** (hero + packages) → `/catalog`
- **Cek Ketersediaan** (hero + CTA band) → `/availability`
- **Chat via WhatsApp** (CtaBand + footer) → `wa.me` deep link (omitted if env unset)
- Category tiles → `/catalog?category=<id>`; package/gallery tiles → `/product/<id>`
- Public header (from `app/(public)/layout.tsx`) links to `/`, `/catalog`, `/availability`.
