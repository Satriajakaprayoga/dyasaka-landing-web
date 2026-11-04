# `/invoice/[token]` — Public invoice view

| | |
| --- | --- |
| **URL** | `/invoice/[token]` (app root — standalone, like `/offline`) |
| **Access** | Public, unguessable `access_token` (64-hex, DB default `gen_random_bytes(32)` hex); no login |
| **Rendering** | On-demand ISR (`●` — cached per token, no TTL) + `PrintButton` client component |
| **Source** | `app/invoice/[token]/page.tsx`, `app/invoice/[token]/PrintButton.tsx` |

## Access rules

- The token is the **only** credential, unique per invoice. Links are
  handed to the customer over WhatsApp from the invoice manager.
- The public path is **only** the security-definer RPC
  `get_invoice_by_token(p_token)` — anon has no SELECT on
  `invoices`/`invoice_items` at all. The RPC answers three ways
  (20261101100000_invoice_multi.sql):
  - `issued` / `paid` → `{ replaced: false, invoice, items, booking }`
    with `access_token` stripped and `amount_paid`/`balance_due`
    **computed from the ledger** (`in` rows carrying `invoice_id`).
  - `void` → `{ replaced: true, invoice_number, current_token }` —
    slim payload, no amounts; `current_token` is the booking's current
    non-void invoice of the same type, when one exists.
  - `draft` / unknown → null, indistinguishable → `notFound()` (plain
    404, reveals nothing about other invoices).
- On-demand ISR, not per-request SSR: the data path needs no login
  (the RPC is security-definer, `company_profile` is public), so the
  page reads through the plain anon client and caches per token with
  no TTL. A customer can never see totals from before a correction
  because every write that changes the page purges it via
  `revalidateInvoices()` (lib/revalidate-public.ts): issue (404 →
  live page), `record-payment` and ledger `in` rows carrying
  `invoice_id` (amount_paid/balance_due/status), void (replaced
  notice), and company-profile edits (address/phone/email/logo render
  live). `generateStaticParams` returns `[]` — tokens are minted at
  runtime, so each renders on first request and caches.
- `company_profile` is read directly (public SELECT by design) so the
  logo/contact header stays live — the invoice's company name and
  bill-to fields are snapshotted at issue.
- `metadata`: title `Invoice`, `robots: { index: false, follow: false }`.

## Rendering (issued/paid)

Print-friendly centered `max-w-2xl` document on a gray page background
(print: white, no shadow):

- **Header** — live logo + `company_name_snapshot` (falls back to the
  live profile name), profile address/phone/email; "INVOICE" or
  "INVOICE DP" (`invoice_type`) + `invoice_number` on the right.
- **Meta** — issue date, due date, `InvoiceStatusBadge` (Terbit/Lunas).
- **Bill-to** — customer name, phone, event address, theme, event date
  (the RPC prefers the issue-time snapshots, falling back to the
  booking for invoices issued before snapshots existed).
- **Lines table** — description, qty, `line_total` (`formatRupiah`).
- **Totals** — subtotal, total, Dibayar (ledger-computed), bold
  **Sisa Tagihan** (ledger-computed, floor 0).
- **Bank box** — `bank_account_snapshot` ("{bank} a/n {holder} •
  {number}") snapshotted at issue.
- **Notes** — free text, when present.

**Unduh PDF / Cetak** (`PrintButton`) — `window.print()`; the PDF is
produced by the browser's print dialog ("Save as PDF"), no PDF library,
and the button itself is `print:hidden`.

## Rendering (void — replaced notice)

A voided invoice's old link never 404s (customers bookmark and print
these). Instead: a small centered card — "Invoice telah digantikan",
naming the voided number, with a **Lihat Invoice Terbaru** button to
`/invoice/{current_token}` when a replacement exists. No amounts, so a
stale printed total can't be confused with a live one.
