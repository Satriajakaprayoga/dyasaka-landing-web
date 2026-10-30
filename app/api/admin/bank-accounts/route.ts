import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Admin-only CRUD for the company's bank accounts (§8). Only active
 * accounts are offered when issuing an invoice, but deactivating is
 * a soft flag — issued invoices keep their bank_account_snapshot.
 */

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bank_name, account_holder, account_number } = await req.json();

  if (!bank_name || !account_holder || !account_number) {
    return NextResponse.json(
      { error: 'Nama bank, pemilik rekening, dan nomor rekening wajib diisi' },
      { status: 400 },
    );
  }

  // New accounts go to the bottom of the list.
  const { data: last } = await supabase
    .from('company_bank_accounts')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('company_bank_accounts')
    .insert({
      bank_name,
      account_holder,
      account_number,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing account id' }, { status: 400 });
  }

  // Allow-list instead of a blind spread.
  const allowed = [
    'bank_name',
    'account_holder',
    'account_number',
    'is_active',
    'sort_order',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (rest[key] !== undefined) updates[key] = rest[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('company_bank_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing account id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('company_bank_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
