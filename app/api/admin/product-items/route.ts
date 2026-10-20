import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Admin-only CRUD for product recipes ("Isi Paket").
 * POST upserts on (product_id, item_variant_id) — adding the same
 * variant twice updates the quantity instead of duplicating the row
 * (unique index uniq_product_items_product_variant).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { product_id, item_variant_id, quantity } = await req.json();

  if (!product_id || !item_variant_id) {
    return NextResponse.json(
      { error: 'Product and variant are required' },
      { status: 400 },
    );
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return NextResponse.json(
      { error: 'Quantity must be a positive integer' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('product_items')
    .upsert(
      { product_id, item_variant_id, quantity: qty },
      { onConflict: 'product_id,item_variant_id' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product_item: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, quantity } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing product item id' },
      { status: 400 },
    );
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return NextResponse.json(
      { error: 'Quantity must be a positive integer' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('product_items')
    .update({ quantity: qty })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product_item: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Missing product item id' },
      { status: 400 },
    );
  }

  const { error } = await supabase.from('product_items').delete().eq('id', id);

  if (error) {
    // Surfaces RESTRICT violations, e.g. the underlying variant is
    // protected by its own RESTRICT chain.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
