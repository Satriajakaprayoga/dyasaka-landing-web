# `/invoice/[token]` — Public invoice view

| | |
| --- | --- |
| **URL** | `/invoice/[token]` (app root — standalone, like `/offline`) |
| **Access** | Public, unguessable 64-hex `access_token`; no login |
| **Rendering** | Dynamic Server Component (`ƒ`) + `PrintButton` client component |
| **Source** | `app/invoice/[token]/page.tsx`, `app/invoice/[token]/PrintButton.tsx` |

## Access rules

- The token is the **only** credential: `access_token` is a 64-char
  hex string (two built-in `gen_random_uuid()` calls), unique per
  invoice. Links are handed to the customer over WhatsApp from the
  invoice manager.
- The public path is **only** the security-definer RPC
  `get_invoice_by_token(p_token)` — anon has no SELECT policy on
  `invoices`/`invoice_items` at all. The RPC returns
  `{ invoice, items, booking }` for `status ∈ ('issued','paid')` only,
  with `access_token` stripped from the invoice object; draft, void and
  unknown tokens are indistinguishable → `notFound()` (plain 404,
  reveals nothing about other invoices).
- `company_profile` is read directly (public SELECT by design) so the
  logo/contact header stays live — the invoice itself is snapshotted at
  issue time.
- `metadata`: title `Invoice`, `robots: { index: false, follow: false }`.

## Rendering

Print-friendly centered `max-w-2xl` document on a gray page background
(print: white, no shadow):

- **Header** — live logo + `company_name_snapshot` (falls back to the
  live profile name), profile address/phone/email; "INVOICE" +
  `invoice_number` on the right.
- **Meta** — issue date, due date, `InvoiceStatusBadge` (Terbit/Lunas).
- **Bill-to** — customer name, phone, event address, theme, event date
  (from the RPC's booking fields only — no other booking data).
- **Lines table** — description, qty, `line_total` (`formatRupiah`).
- **Totals** — subtotal, total, amount paid, bold **Sisa Tagihan**.
- **Bank box** — `bank_account_snapshot` ("{bank} a/n {holder} •
  {number}") snapshotted at issue.
- **Notes** — free text, when present.

**Unduh PDF / Cetak** (`PrintButton`) — `window.print()`; the PDF is
produced by the browser's print dialog ("Save as PDF"), no PDF library,
and the button itself is `print:hidden`.
