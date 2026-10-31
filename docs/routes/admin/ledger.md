# `/admin/ledger` — Cash book (append-only ledger, §12)

| | |
| --- | --- |
| **URL** | `/admin/ledger` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`○`) |
| **Source** | `app/admin/(panel)/ledger/page.tsx` |

## Purpose

Every rupiah in and out, in one append-only book. Mistakes are never
edited or deleted — they are **reversed** with an automatic counter-row,
then the correct entry is recorded. Invoice payments, helper pay and
PO-linked purchases all land here (written by their own flows), so this
page is the one place cash truth lives.

## Data

- `transactions` + `category:transaction_categories(name)` (browser
  client, newest first by `transaction_date` then `created_at`).
- `transaction_categories` (ordered by `sort_order`, `name`).

## Filters & totals

- Bulan (`type=month`, defaults to the current month), Arah
  (Semua/Masuk/Keluar), Kategori (all categories). Client-side
  filtering (`transaction_date.startsWith(month)`), reset to page 1 on
  change.
- Masuk / Keluar / Selisih totals recomputed over the filtered set.

## Record form

- Arah toggle (**Masuk** green / **Keluar** red), Nominal (> 0),
  Tanggal (default today), Kategori (active categories of the chosen
  direction only — the select re-keys when the direction flips),
  Akun (free text: Cash, BCA…), Keterangan, and an optional
  **Periode gaji** start/end pair for salary rows (sent only when
  filled) → `POST /api/admin/transactions`. Booking/invoice/PO links
  are intentionally absent here — those rows are written by their
  owning flows.

## Rows

- `+`/`−` colored chip, description (falls back to the category name),
  `Dibalikkan` badge on rows that a later row reversed, `Pembalikan`
  badge on reversal rows themselves, subline date · category · account,
  signed colored amount.
- **Balikkan** — offered only while the row is neither reversed nor a
  reversal → `ConfirmModal` explaining the append-only rule →
  `PATCH /api/admin/transactions { action: "reverse" }` → refresh.
- Pagination (15/page), skeleton loading, error banner.

## Kategori Transaksi (settings card)

- Add form: name + direction (Keluar/Masuk) → `POST
  /api/admin/transaction-categories` (`sort_order` = next multiple of
  10).
- Rows: name + direction badge + **Nonaktif** badge; toggle button →
  `PATCH { is_active }`. No delete — categories with history must stay
  resolvable; deactivate instead.

## Navigation

- Breadcrumbs: `Dashboard / Kas`.
- Sidebar: **Kas** (mobile via the Lainnya drawer).
