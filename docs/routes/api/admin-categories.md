# `/api/admin/categories` — Product categories API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/categories/route.ts` |

## POST — create

Body: `{ name }` (400 when empty). Slug generated locally by `slugify()` (lowercase, non-alphanumerics → `-`, trimmed).
→ `{ category }` 201.

## PATCH — rename

Body: `{ id, name }` (400 when either missing). Regenerates `slug` from the new name.
→ `{ category }`.

## DELETE — delete

Query: `?id=` (400 when missing). 500 while products still reference the category (RESTRICT).
→ `{ ok: true }`.
