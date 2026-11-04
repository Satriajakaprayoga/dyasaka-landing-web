# `/admin/ledger` — Cash book (append-only ledger, §12)

| | |
| --- | --- |
| **URL** | `/admin/ledger` |
| **Access** | Admin (session required) |
| **Rendering** | Server shell + client `LedgerView` |
| **Source** | `app/admin/(panel)/ledger/page.tsx`, `components/admin/LedgerView.tsx`, `components/admin/useInfiniteList.ts`, `app/api/admin/transactions/route.ts` (GET/POST/PATCH) |

## Purpose

Every rupiah in and out, in one append-only book. Mistakes are never
edited or deleted — they are **reversed** with an automatic counter-row,
then the correct entry is recorded. Invoice payments, helper pay and
PO-linked purchases all land here (written by their own flows), so this
page is the one place cash truth lives.

## Data

- `GET /api/admin/transactions?page=&limit=&month=&direction=&category=` — paginated server-side, 15 rows per batch, ordered `transaction_date desc` → `created_at desc` → `id` tiebreaker. Returns `{ items, total, hasMore, totals, reversedIds }`; rows embed `category:transaction_categories(name)`.
- `month` (`YYYY-MM`) → inclusive `transaction_date` range computed server-side (last day via `Date.UTC(year, month, 0)`); `direction` → `in`/`out`; `category` → `category_id` (other values ignored).
- **`totals`** — `{ masuk, keluar, net }` computed server-side over the WHOLE filtered set (the totals respect all active filters, like the previous client-side math). PostgREST cannot SUM, so `direction, amount` rows are fetched in 1000-row chunks and summed in JS.
- **`reversedIds`** — ids of rows reversed by any later row (fetched whole; one row per reversal ever, so tiny). Keeping this global (not per loaded batch) keeps the `Dibalikkan` badges correct even when the reversing row is in another month.
- `transaction_categories` (ordered `sort_order`, `name`) load client-side — they feed the filter select, the create form and the settings card.
- Every page response refreshes `totals`/`reversedIds` through the hook's `onData` observer, so mutations that call `list.reload()` update them in the same pass.

## Search & filters

| Control | Filters on |
| --- | --- |
| Bulan (`type=month`, defaults to current) | `transaction_date` month (server-side range) |
| Arah select | Semua / Masuk / Keluar |
| Kategori select | all transaction categories |
| Totals | Masuk / Keluar / Selisih over the filtered set |

Any filter change resets to batch 1. Empty filter result shows a **Reset Filter** action (back to the current month + all); an empty month shows the plain empty state.

## Infinite scroll

- `useInfiniteList("/api/admin/transactions", { month, direction, category }, 15, { onData })` from the shared hook: appends batches, drops stale responses (request id + `AbortController`), dedupes by id.
- One sentinel element after the transactions card, observed by an `IntersectionObserver` with `rootMargin: 200px`; a post-load visibility re-check covers the "sentinel already on screen" case.
- No pagination controls and no "Load more" button. End of data shows **"Semua transaksi sudah ditampilkan"**; a failed batch shows **"Gagal memuat. Coba lagi"** with a manual retry.

## States

| State | List card |
| --- | --- |
| First load / filter reset | 5 skeleton rows |
| Loading next batch | 3 skeleton rows at the bottom |
| Error (nothing loaded) | EmptyState + retry |
| Error on next batch | inline "Gagal memuat. Coba lagi" + retry |
| End of data | "Semua transaksi sudah ditampilkan" |
| No filter match | "Tidak ada transaksi yang cocok" + Reset Filter |

## Record form

- Arah toggle (**Masuk** green / **Keluar** red), Nominal (> 0),
  Tanggal (default today), Kategori (active categories of the chosen
  direction only — the select re-keys when the direction flips),
  Akun (free text: Cash, BCA…), Keterangan, and an optional
  **Periode gaji** start/end pair for salary rows (sent only when
  filled) → `POST /api/admin/transactions` → `list.reload()` +
  `router.refresh()`. Booking/invoice/PO links are intentionally
  absent here — those rows are written by their owning flows.

## Rows

- `+`/`−` colored chip, description (falls back to the category name),
  `Dibalikkan` badge on rows that a later row reversed, `Pembalikan`
  badge on reversal rows themselves, subline date · category · account,
  signed colored amount.
- **Balikkan** — offered only while the row is neither reversed nor a
  reversal → `ConfirmModal` explaining the append-only rule →
  `PATCH /api/admin/transactions { action: "reverse" }` → `list.reload()`
  (the reversal row lands today and flips the markers) + `router.refresh()`.

## Kategori Transaksi (settings card)

- Add form: name + direction (Keluar/Masuk) → `POST
  /api/admin/transaction-categories` (`sort_order` = next multiple of
  10) → categories refetch (updates the filter select too).
- Rows: name + direction badge + **Nonaktif** badge; toggle button →
  `PATCH { is_active }`. No delete — categories with history must stay
  resolvable; deactivate instead.

## Navigation

- Breadcrumbs: `Dashboard / Kas`.
- Sidebar: **Kas** (mobile via the Lainnya drawer).
