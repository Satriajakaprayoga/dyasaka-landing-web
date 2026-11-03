import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { ItemType } from '@/lib/types';

const itemTypes: ItemType[] = ['consumable', 'rentable'];

// Paginated + filtered list for the admin items screen (infinite
// scroll). Query params: page, limit, search, type, low (=1 → only
// items with at least one variant at/below its reorder point).
//
// Search and the low-stock filter can't be expressed as a single
// PostgREST filter (search spans items + item_variants; low compares
// two variant columns), so they resolve to item-id sets in parallel
// sub-queries and the main query narrows with .in().
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
  const type = sp.get('type') ?? '';
  const low = sp.get('low') === '1' || sp.get('low') === 'true';

  const safe = search.replace(/[,()%\\]/g, ' ');
  const noStep = Promise.resolve({ data: null, error: null });

  const [nameRes, variantRes, lowRes] = await Promise.all([
    search
      ? supabase
          .from('items')
          .select('id')
          .or(`name.ilike.%${safe}%,item_category.ilike.%${safe}%`)
      : noStep,
    search
      ? supabase
          .from('item_variants')
          .select('item_id')
          .or(`color.ilike.%${safe}%,size.ilike.%${safe}%,sku.ilike.%${safe}%`)
      : noStep,
    low
      ? supabase
          .from('item_variants')
          .select('item_id, stock_quantity, reorder_point')
          .not('reorder_point', 'is', null)
      : noStep,
  ]);

  const firstError = nameRes.error ?? variantRes.error ?? lowRes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  // Intersect the candidate lists; null = no constraint from filters.
  const candidateLists: string[][] = [];

  if (search) {
    candidateLists.push((nameRes.data ?? []).map((r) => r.id));
    candidateLists.push((variantRes.data ?? []).map((r) => r.item_id));
  }
  if (low) {
    candidateLists.push(
      (lowRes.data ?? [])
        .filter(
          (v) => v.reorder_point != null && v.stock_quantity <= v.reorder_point,
        )
        .map((v) => v.item_id),
    );
  }

  let candidateIds: string[] | null = null;
  for (const ids of candidateLists) {
    const keep: Set<string> | null =
      candidateIds === null ? null : new Set<string>(candidateIds);
    candidateIds = keep === null ? ids : ids.filter((id) => keep.has(id));
  }

  // .in([]) is not a valid PostgREST filter — short-circuit instead.
  if (candidateIds !== null && candidateIds.length === 0) {
    return NextResponse.json({ items: [], total: 0, hasMore: false });
  }

  let query = supabase
    .from('items')
    .select('*, item_variants(*)', { count: 'exact' })
    // id tiebreaker — names are not unique.
    .order('name', { ascending: true })
    .order('id');

  if (candidateIds !== null) {
    query = query.in('id', candidateIds);
  }
  if ((itemTypes as string[]).includes(type)) {
    query = query.eq('type', type);
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

  const { item_category, name, type, pieces_per_unit, quantity_owned } =
    await req.json();

  if (!item_category || !name || !itemTypes.includes(type)) {
    return NextResponse.json(
      { error: 'Item category, name, and a valid type are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      item_category,
      name,
      type,
      pieces_per_unit: pieces_per_unit ?? null,
      quantity_owned: type === 'rentable' ? (quantity_owned ?? 0) : 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) patch.name = body.name;
  if (body.item_category !== undefined) patch.item_category = body.item_category;
  if (body.type !== undefined) {
    if (!itemTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    patch.type = body.type;
  }
  if (body.pieces_per_unit !== undefined)
    patch.pieces_per_unit = body.pieces_per_unit;
  if (body.quantity_owned !== undefined)
    patch.quantity_owned = body.quantity_owned;

  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
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
    return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  }

  const { error } = await supabase.from('items').delete().eq('id', id);

  if (error) {
    // 23503 = foreign key violation: a variant is still referenced by
    // price history, stock movements, product_items, or booking_items
    // (all ON DELETE RESTRICT deeper in the cascade chain).
    if (error.code === '23503') {
      return NextResponse.json(
        {
          error:
            'Item tidak dapat dihapus karena variannya masih dipakai (riwayat stok/harga, resep produk, atau booking).',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
