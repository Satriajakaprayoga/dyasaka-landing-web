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
    return NextResponse.json(
      { error: 'Nama vendor wajib diisi' },
      { status: 400 },
    );
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: 'Nama vendor maksimal 100 karakter' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name,
      phone: clean(body.phone),
      note: clean(body.note),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendor: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });
  }

  // Allow-list: only these fields are writable.
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = clean(body.name);
    if (!name) {
      return NextResponse.json(
        { error: 'Nama vendor wajib diisi' },
        { status: 400 },
      );
    }
    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Nama vendor maksimal 100 karakter' },
        { status: 400 },
      );
    }
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = clean(body.phone);
  if (body.note !== undefined) patch.note = clean(body.note);
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vendors')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendor: data });
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
    return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });
  }

  // products.vendor_id is ON DELETE SET NULL — deletion always succeeds,
  // linked products just lose their vendor.
  const { error } = await supabase.from('vendors').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
