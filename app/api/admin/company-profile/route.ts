import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Admin-only. Edits the single company profile row (§8). There is no
 * POST: the row is seeded by migration and no INSERT policy exists,
 * so the one-row invariant holds at the database level.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // Allow-list so clients can never touch id/updated_at.
  const allowed = [
    'company_name',
    'logo_url',
    'address',
    'phone',
    'email',
    'instagram_url',
    'facebook_url',
    'tiktok_url',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  // Empty string means "clear" for the nullable fields.
  for (const key of allowed) {
    if (key !== 'company_name' && updates[key] === '') updates[key] = null;
  }

  if (
    updates.company_name !== undefined &&
    String(updates.company_name).trim() === ''
  ) {
    return NextResponse.json(
      { error: 'Nama perusahaan wajib diisi' },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from('company_profile')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: 'Profil perusahaan belum di-seed — jalankan migrasi §8' },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from('company_profile')
    .update(updates)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
