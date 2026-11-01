# `/admin/plans/[id]` — Purchase plan detail (§15)

| | |
| --- | --- |
| **URL** | `/admin/plans/[id]` |
| **Access** | Admin (session required) |
| **Rendering** | Client Component (`ƒ`, `useParams`) |
| **Source** | `app/admin/(panel)/plans/[id]/page.tsx` |

## Purpose

One plan's lifecycle: edit it, approve/cancel it, and manage its lines —
each line independently derived `open → ordered → done` from its order
link and `done_at`, with R&D outcome pills for `rnd` plans.

## Data

Parallel loads (unknown id → `EmptyState` fallback):

- The plan (`purchase_plans` + `booking:bookings(customer_name)`).
- Lines: `purchase_plan_lines` + `supplier:suppliers(name)` +
  `po_item:purchase_order_items(id, quantity_ordered, quantity_received,
  unit_cost)`
  (cast `as unknown as` — to-one embeds return objects at runtime).
- Ledger rows for the plan's lines: `transactions` where
  `plan_line_id in (line ids)` — actual spend = Σ `out` rows.
- Suppliers + variant catalog (`items` + `item_variants`) for the
  add-line picker (`VariantOption` cast likewise).

## Derived line status (client mirror of the API's `isLineDone`)

`done_at` set, or the linked PO line fully received → **Selesai**
(green); PO link without full receipt → **Dipesan** (blue); else
**Terbuka** (gray).

## Header & status

Title + `PlanTypeBadge` + `PlanStatusBadge`; **Ubah** expands an inline
edit form (title, type, budget, target date, booking, reason) →
`PATCH /api/admin/plans`. Status buttons: **Setujui** (`approved`,
drafts only) and **Batalkan** (`ConfirmModal`, `confirmLabel="Ya,
Batalkan"` / `busyLabel="Membatalkan…"`). `in_progress`/`done` are set
automatically by the plan-lines API's recompute, not by hand here.

## Money cards

Estimasi (Σ qty × `estimated_unit_cost`), Realisasi (Σ ledger `out`
rows across the plan's lines **+** goods received via purchase orders:
Σ `quantity_received × unit_cost` over the lines' DISTINCT PO items —
PO payments carry `purchase_order_id`, not `plan_line_id`, so their
cost is added here instead; the card subline splits "N pengeluaran kas
· barang diterima Rp…"), Selisih (estimasi − realisasi). Per-line meta
shows that line's PO share (`PO Rp…`) when linked.

## Lines

- **Tambah Baris** form — description (or variant select for
  `upgrade`), qty, estimate, supplier, replaces-variant → `POST
  /api/admin/plan-lines` → refresh all.
- Each row: `lineStatusBadge`, description + supplier / PO / outcome
  meta, `Realisasi {…}` from that line's ledger, **Selesai / Batal
  Selesai** toggle (`PATCH { done_at }` — in-house execution without a
  supplier), **Ubah** inline edit, **Hapus** (`ConfirmModal` →
  `DELETE ?id=`).
- `rnd` rows show outcome pills `testing / adopted / rejected`
  (`PATCH { outcome }`).

Every mutation goes through a shared `run()` wrapper (busy/error
handling) and ends in `refreshAll()` (plan + lines + ledger), so the
status badges and money cards follow the API's recompute immediately.

## Navigation

- Breadcrumbs: `Dashboard / Rencana / {title}`; reached from the plans
  list and after creating a plan.
