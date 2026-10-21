# `/api/admin/bank-accounts` — Bank accounts API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/bank-accounts/route.ts` |

## POST — create

Body: `{ bank_name, account_holder, account_number }` (all required →
400 otherwise). `sort_order` is assigned server-side as `max + 1` so
new accounts land at the bottom.
→ `{ account }` 201.

## PATCH — update

Body: `{ id, …fields }` — allow-list: `bank_name, account_holder,
account_number, is_active, sort_order`. 400 without `id` or with no
recognized fields. → `{ account }`.

Reordering PATCHes two rows with swapped `sort_order` values (see the
panel, not this route).

## DELETE — delete

Query: `?id=` (400 when missing). Never blocked: issued invoices keep
their `bank_account_snapshot` text and drafts only hold the nullable
`bank_account_id` (SET NULL on delete).
→ `{ ok: true }`.
