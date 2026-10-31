import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A category's direction is structural — reports group by it — so it
 * is set once at creation and never edited. */
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
      { error: 'Nama kategori wajib diisi' },
      { status: 400 },
    );
  }
  if (name.length > 60) {
    return NextResponse.json(
      { error: 'Nama kategori maksimal 60 karakter' },
      { status: 400 },
    );
  }
  const direction = body.direction === 'out' ? 'out' : 'in';
  const sort_order = Number.isInteger(Number(body.sort_order))
    ? Number(body.sort_order)
    : 0;

  const { data, error } = await supabase
    .from('transaction_categories')
    .insert({ name, direction, sort_order })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = clean(body.name);
    if (!name) {
      return NextResponse.json(
        { error: 'Nama kategori wajib diisi' },
        { status: 400 },
      );
    }
    if (name.length > 60) {
      return NextResponse.json(
        { error: 'Nama kategori maksimal 60 karakter' },
        { status: 400 },
      );
    }
    patch.name = name;
  }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  if (body.sort_order !== undefined) {
    patch.sort_order = Number.isInteger(Number(body.sort_order))
      ? Number(body.sort_order)
      : 0;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('transaction_categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}
