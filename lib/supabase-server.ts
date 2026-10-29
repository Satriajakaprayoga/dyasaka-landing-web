import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client bound to the request's auth cookies.
 * Use this in API routes / server components that need to know
 * whether the current user is the logged-in admin, so RLS policies
 * allow admin-only writes.
 *
 * Async since Next.js 16: `cookies()` is a promise-only API.
 * Uses the getAll/setAll cookie adapter (get/set/remove was removed
 * in @supabase/ssr 0.8).
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component render — cookie writes are not allowed
            // there; the middleware refreshes sessions instead.
          }
        },
      },
    }
  );
}
