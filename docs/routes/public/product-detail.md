# `/product/[id]` — Product detail

| | |
| --- | --- |
| **URL** | `/product/[id]` |
| **Access** | Public |
| **Rendering** | Dynamic Server Component (`ƒ`) |
| **Source** | `app/(public)/product/[id]/page.tsx` |

## Purpose

Product detail for customers: photo gallery, price, description, WhatsApp inquiry button, and an inline availability calendar.

## Data

- `products` where `id = [id]` **and** `is_active = true` — inactive/unknown ids render `notFound()`.
- `product_images` for the product, ordered `sort_order asc`.

## Interactions

- **Tanya via WhatsApp** — opens `buildWhatsAppInquiryLink` (`lib/booking-helpers.ts`) with `NEXT_PUBLIC_BUSINESS_WA_NUMBER` and the product name; `target="_blank"`.
- `AvailabilityCalendar compact` (client component) shows booked/available dates so customers pick realistic event dates before contacting.

## Navigation

- Back via header links; cards in `/catalog` link here.
