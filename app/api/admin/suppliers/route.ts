import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// Paginated list for the admin suppliers screen (infinite scroll).
// Query params: page, limit, search (name, phone, address, notes).
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
    .from('suppliers')
    .select('*', { count: 'exact' })
    .order('name')
    .order('id');

  if (search) {
    // Strip commas/parens/backslashes — or= patterns treat them as
    // filter syntax, so user input could otherwise break the expression.
    const safe = search.replace(/[,()%\\]/g, ' ');
    query = query.or(
      `name.ilike.%${safe}%,phone.ilike.%${safe}%,address.ilike.%${safe}%,notes.ilike.%${safe}%`,
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
      { error: 'Nama supplier wajib diisi' },
      { status: 400 },
    );
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: 'Nama supplier maksimal 100 karakter' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name,
      phone: clean(body.phone),
      address: clean(body.address),
      notes: clean(body.notes),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplier: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing supplier id' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = clean(body.name);
    if (!name) {
      return NextResponse.json(
        { error: 'Nama supplier wajib diisi' },
        { status: 400 },
      );
    }
    patch.name = name;
  }
  if (body.phone !== undefined) patch.phone = clean(body.phone);
  if (body.address !== undefined) patch.address = clean(body.address);
  if (body.notes !== undefined) patch.notes = clean(body.notes);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ supplier: data });
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
    return NextResponse.json({ error: 'Missing supplier id' }, { status: 400 });
  }

  const { error } = await supabase.from('suppliers').delete().eq('id', id);

  if (error) {
    // 23503 = foreign_key_violation: purchase orders / plan lines
    // still reference this supplier.
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error:
            'Supplier masih dipakai oleh pesanan atau rencana pembelian',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
