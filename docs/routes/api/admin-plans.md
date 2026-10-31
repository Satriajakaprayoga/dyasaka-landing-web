# `/api/admin/plans` — Purchase plans API (§15)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/plans/route.ts` |

Purchase plans are stored intentions, kept separate from purchase
orders — a plan can change, shrink or be dropped without cluttering the
orders list. Line status is DERIVED (order link / `done_at`); plan
status follows its lines (approved → in_progress → done), while
draft/approved/cancelled are set by hand (that recompute lives in the
plan-lines API).

## POST — create

Body: `{ title, plan_type, reason?, booking_id?, budget_estimate?,
target_date?, lines? }`.

- `title` trimmed non-empty ≤120 chars (400 `'Judul rencana wajib
  diisi'` / `'…maksimal 120 karakter'`); `plan_type` ∈ `buy | create |
  fix | rnd | upgrade` (400 `'Jenis rencana tidak valid'`);
  `budget_estimate` null or finite ≥ 0 (400 `'Estimasi anggaran tidak
  boleh negatif'`); `target_date` ISO date or null.
- Optional starter `lines[]` validated per row (400 naming `'Baris N:
  …'`): `description` required, integer `quantity > 0`,
  `estimated_unit_cost` null or ≥ 0. Optional per line: `item_variant_id`,
  `supplier_id`, `replaces_item_variant_id`; `sort_order = i*10`.

→ `{ plan }` 201.

## PATCH — update

Body: `{ id, title?, plan_type?, reason?, booking_id?,
budget_estimate?, target_date?, status? }` — allow-list patch; `status`
must be `draft | approved | in_progress | done | cancelled` (400
`'Status rencana tidak valid'`). 400 without `id` or with an empty
patch. → `{ plan }`.

## DELETE — drop

Query: `?id=` (400 when missing). Always allowed — a plan is an
intention, not a commitment. Lines cascade; ledger rows survive with
the link cleared (`on delete set null`). → `{ ok: true }`.
