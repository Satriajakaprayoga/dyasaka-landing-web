import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { ItemType } from '@/lib/types';

const itemTypes: ItemType[] = ['consumable', 'rentable'];

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

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
  const supabase = createServerSupabase();

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
  const supabase = createServerSupabase();

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
    // e.g. variants with stock/price history or recipe/booking references
    // block the cascade (ON DELETE RESTRICT deeper in the chain)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
