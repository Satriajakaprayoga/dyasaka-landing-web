# `/api/admin/company-profile` — Company profile API

| | |
| --- | --- |
| **Access** | Admin — `auth.getUser()` check; 401 when absent |
| **Source** | `app/api/admin/company-profile/route.ts` |

## PATCH — update the single profile row

Body: any of the allow-listed fields `company_name, logo_url, address,
phone, email, instagram_url, facebook_url, tiktok_url` (everything else
is ignored). `''` means "clear" for every nullable field;
`company_name` trimmed-empty → 400 `'Nama perusahaan wajib diisi'`.

Loads the single row first (`limit(1).maybeSingle()`) — 404
`'Profil perusahaan belum di-seed — jalankan migrasi §8'` when absent.
→ `{ profile }`.

There is deliberately **no POST**: the row is seeded by migration
20261021090000 and no INSERT policy exists, so the one-row invariant
holds at the database level.
