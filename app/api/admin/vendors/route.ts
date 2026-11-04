import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// Paginated list for the admin vendors screen (infinite scroll). Query
// params: page, limit, search (name, phone, note).
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 12));
  const search = (sp.get('search') ?? '').trim();

  // id tiebreaker keeps pagination deterministic — same-name rows
  // would otherwise shuffle between batches.
  let query = supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .order('name')
    .order('id');

  if (search) {
    // Strip commas/parens/backslashes — or= patterns treat them as
    // filter syntax, so user input could otherwise break the expression.
    const safe = search.replace(/[,()%\\]/g, ' ');
    query = query.or(
      `name.ilike.%${safe}%,phone.ilike.%${safe}%,note.ilike.%${safe}%`,
    );
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    items: data ?? [],
    total,
    hasMore: from + (data?.length ?? 0) < total,
  });
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
