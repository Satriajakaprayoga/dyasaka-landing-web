# `/availability` — Public availability calendar

| | |
| --- | --- |
| **URL** | `/availability` |
| **Access** | Public |
| **Rendering** | Static Server Component (`○`) + client calendar |
| **Source** | `app/(public)/availability/page.tsx`, `components/AvailabilityCalendar.tsx` |

## Purpose

Let customers check which event dates are still free before contacting via WhatsApp.

## Data

- Fetched client-side by `AvailabilityCalendar` from `date_capacity` / `bookings` (via the browser Supabase client, RLS public read). `monthsAhead={7}`.

## Interactions

- Month navigation inside the calendar; booked dates rendered as unavailable.

## Navigation

- Back via header links.
