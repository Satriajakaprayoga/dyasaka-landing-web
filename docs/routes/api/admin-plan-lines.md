# `/api/admin/plan-lines` — Purchase plan lines API (§15)

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/plan-lines/route.ts` |

Line execution status is DERIVED, never stored: no order link and no
`done_at` = not executed; linked to an order line = ordered; the order
line fully received, or `done_at` set = done.

## Plan status recompute

After **every** mutation (POST / PATCH / DELETE) the parent plan's
status is recomputed via `recomputePlanStatus`: skipped entirely for
`draft` (stays draft until the admin approves) and `cancelled` (never
touched); a plan with zero lines is left alone; `allDone` (every line
done) → `done`; else `anyExecuted` while still `approved` →
`in_progress`. Downgrades never happen.

## POST — add line

Body: `{ plan_id, description, quantity, item_variant_id?,
estimated_unit_cost?, supplier_id?, replaces_item_variant_id? }` —
description trimmed non-empty ≤200 chars (400 `'Deskripsi wajib
diisi'` / `'…maksimal 200 karakter'`), integer `quantity > 0` (400
`'Jumlah harus bilangan bulat > 0'`), estimate null or ≥ 0 (400
`'Estimasi biaya tidak boleh negatif'`). `sort_order` = current max +
10. → `{ line }` 201, then recompute.

## PATCH — update

Body: `{ id, description?, quantity?, item_variant_id?,
estimated_unit_cost?, supplier_id?, replaces_item_variant_id?,
done_at?, outcome?, outcome_note?, sort_order? }` — allow-list patch.
`done_at` is set/cleared by hand for in-house execution (no supplier
involved); `outcome` ∈ `testing | adopted | rejected` | null (400
`'Outcome tidak valid'`) — R&D outcomes. 400 without `id` or with an
empty patch. → `{ line }`, then recompute.

## DELETE — remove line

Query: `?id=` (400 when missing; 404 `'Baris tidak ditemukan'`). A plan
can shrink — the line is removed, then the parent recompute runs. →
`{ ok: true }`.
