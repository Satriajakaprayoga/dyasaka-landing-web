import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name = clean(body.name);
  if (!name) {
    return NextResponse.json({ error: 'Nama staff wajib diisi' }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: 'Nama staff maksimal 100 karakter' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('staff')
    .insert({
      name,
      phone: clean(body.phone),
      role: clean(body.role),
      pay_basis: clean(body.pay_basis),
      notes: clean(body.notes),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data }, { status: 201 });
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
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
  }

  // Allow-list: only these fields are writable.
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = clean(body.name);
    if (!name) {
      return NextResponse.json({ error: 'Nama staff wajib diisi' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Nama staff maksimal 100 karakter' },
        { status: 400 },
      );
    }
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = clean(body.phone);
  if (body.role !== undefined) patch.role = clean(body.role);
  if (body.pay_basis !== undefined) patch.pay_basis = clean(body.pay_basis);
  if (body.notes !== undefined) patch.notes = clean(body.notes);
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('staff')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data });
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
    return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
  }

  const { error } = await supabase.from('staff').delete().eq('id', id);

  if (error) {
    // 23503 = foreign_key_violation: booking_staff restricts the delete
    // so pay history stays intact — steer the admin to deactivation.
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error:
            'Staff ini masih memiliki penugasan — nonaktifkan saja sebagai gantinya',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
