# `/admin/report` — Monthly cashflow report (§17)

| | |
| --- | --- |
| **URL** | `/admin/report` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/report/page.tsx` |

## Purpose

Read-only per-month view of the ledger: totals and a per-category
breakdown. No forms, no writes — recording happens in `/admin/ledger`
and the flows that write there (invoices, helper pay, POs).

## Data

- `transactions` + `category:transaction_categories(name)` (browser
  client, newest first).
- Account options derived client-side from the distinct `r.account`
  values of loaded rows (free-text column — no account table).

## Filters

- **Bulan** — `type=month` input plus `‹` / `›` shift buttons (UTC-safe
  `Date.UTC` math); defaults to the current month.
- **Akun** — Semua + one option per distinct account.

Rows are filtered by `transaction_date.startsWith(month)` + account,
then reduced per category into `{ name, masuk, keluar }` (keyed by
`category_id`, sorted by activity desc).

## Rendering

- Three summary cards — Masuk (green), Keluar (red), Selisih (red when
  negative) for the filtered month.
- Per-category table: Kategori / Masuk / Keluar with a totals `tfoot`;
  `formatRupiah` everywhere.
- `EmptyState` for a month with no rows.

## Navigation

- Breadcrumbs: `Dashboard / Laporan`.
- Sidebar: **Laporan** (mobile via the Lainnya drawer).
