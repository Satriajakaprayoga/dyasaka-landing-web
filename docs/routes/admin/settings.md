# `/admin/settings` — Company settings (Pengaturan)

| | |
| --- | --- |
| **URL** | `/admin/settings` |
| **Access** | Admin (session required) |
| **Rendering** | Dynamic Server Component (`ƒ`) + client forms |
| **Source** | `app/admin/(panel)/settings/page.tsx`, `components/admin/CompanyProfileForm.tsx`, `components/admin/BankAccountsPanel.tsx` |

## Purpose

One screen for the company profile (§8) — name, logo, contact, social
links — and the bank accounts offered on invoices. Edits the single
seeded `company_profile` row; it can never create a second one (no
INSERT policy exists for anyone).

## Data

Parallel server fetch:

- `company_profile` `.limit(1).maybeSingle()` — missing row (migration
  not applied) renders an inline error card instead of the form.
- `company_bank_accounts` ordered by `sort_order`.

## Profile form (`CompanyProfileForm`)

- Controlled inputs: company name (required), address, phone, email,
  Instagram/Facebook/TikTok URLs — one **Simpan** PATCHes the
  allow-listed fields (`''` clears nullables) → `router.refresh()`.
- **Logo** — preview (or dashed placeholder), file input filtered to
  JPG/PNG/WebP ≤10MB, `compressImage(file, 800)` from
  `lib/compress-image.ts`, upload to the public `company-assets` bucket
  at `logo/{timestamp}-logo.{ext}` → `getPublicUrl()` → PATCH
  `logo_url`. The previous bucket object is removed best-effort
  (`deleteOldLogo`, ProductForm pattern). **Hapus logo** PATCHes `""`
  then removes the object.

## Bank accounts (`BankAccountsPanel`)

- Rows ordered by `sort_order`: three inline inputs (bank, holder,
  number) with an explicit per-row **Simpan** (enabled only when
  dirty) → `PATCH`, an **Aktif** checkbox (instant PATCH — only active
  accounts are selectable when issuing an invoice), up/down arrows
  (swap `sort_order`, PATCH both rows), and delete via `ConfirmModal`
  (issued invoices keep their `bank_account_snapshot`, so deletion is
  never blocked) → `DELETE ?id=`.
- **Add form** — three required inputs → `POST` (server assigns
  `sort_order = max + 1`).
- After every mutation the panel re-queries the table (canonical
  order) and `router.refresh()`s.

## Navigation

- Breadcrumbs: `Dashboard / Pengaturan`.
- Sidebar entry **Pengaturan** (`SettingsIcon`) — on phones/tablets it
  lives in the drawer behind **Lainnya**.
