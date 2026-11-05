import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { revalidatePublicCatalog } from '@/lib/revalidate-public';

/**
 * Admin-only CRUD for product recipes ("Isi Paket").
 * POST upserts on (product_id, item_variant_id) — adding the same
 * variant twice updates the quantity instead of duplicating the row
 * (unique index uniq_product_items_product_variant).
 * GET ?product_id= lists one product's recipe for the lazy-fetch
 * expansion on the products list cards.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = new URL(req.url).searchParams.get('product_id');
  if (!productId) {
    return NextResponse.json(
      { error: 'Missing product id' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('product_items')
    .select('id, item_variant_id, quantity, is_included, is_show_public, item_variants(color, size, items(name))')
    .eq('product_id', productId)
    .order('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { product_id, item_variant_id, quantity, is_included, is_show_public } =
    await req.json();

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
      {
        product_id,
        item_variant_id,
        quantity: qty,
        // Defaults true — absent flags keep the add-form defaults.
        is_included: is_included !== false,
        is_show_public: is_show_public !== false,
      },
      { onConflict: 'product_id,item_variant_id' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recipe rows render in "Paket Termasuk" on the product page.
  await revalidatePublicCatalog();
  return NextResponse.json({ product_item: data }, { status: 201 });
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
  const { id, quantity, is_included, is_show_public } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing product item id' },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};

  if (quantity !== undefined) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer' },
        { status: 400 },
      );
    }
    patch.quantity = qty;
  }
  if (typeof is_included === 'boolean') {
    patch.is_included = is_included;
  }
  if (typeof is_show_public === 'boolean') {
    patch.is_show_public = is_show_public;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('product_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await revalidatePublicCatalog();
  return NextResponse.json({ product_item: data });
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

  await revalidatePublicCatalog();
  return NextResponse.json({ ok: true });
}
