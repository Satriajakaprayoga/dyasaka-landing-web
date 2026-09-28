import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category_id, name, description, price } = await req.json();

  if (!category_id || !name || !price) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('products')
    .insert({ category_id, name, description: description ?? null, price })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data }, { status: 201 });
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
  const { id, category_id, name, description, price, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (category_id !== undefined) updates.category_id = category_id;
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
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
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
  }

  // Grab image rows first so we can clean up storage after the delete.
  // product_images rows are removed automatically (ON DELETE CASCADE),
  // but the storage objects are not.
  const { data: images } = await supabase
    .from('product_images')
    .select('image_url')
    .eq('product_id', id);

  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) {
    // e.g. product still referenced by bookings (ON DELETE RESTRICT)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort storage cleanup — DB is already consistent at this point.
  const paths = (images ?? [])
    .map((i) => i.image_url.split('/product-images/')[1])
    .filter(Boolean) as string[];

  if (paths.length > 0) {
    await supabase.storage.from('product-images').remove(paths);
  }

  return NextResponse.json({ ok: true });
}
