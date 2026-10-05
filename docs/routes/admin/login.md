# `/admin/login` — Admin login

| | |
| --- | --- |
| **URL** | `/admin/login` |
| **Access** | Public (only route under `/admin` outside the `(panel)` group) |
| **Rendering** | Client Component (`○`, prerendered shell) |
| **Source** | `app/admin/login/page.tsx` |

## Purpose

Email/password sign-in for the administrator. Standalone layout — no sidebar.

## Data

- None fetched; calls `supabase.auth.signInWithPassword` (browser client). Cookies are set by `@supabase/ssr` so server components/API routes see the session.

## Interactions

- Submit → on success `router.push('/admin')` + `router.refresh()`.
- Error shown inline (red box).

## Navigation

- Redirects to `/admin` after login. `middleware.ts` sends unauthenticated `/admin/*` visitors here.
