import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { StockMovementType } from '@/lib/types';

const movementTypes: StockMovementType[] = [
  'restock',
  'usage',
  'damaged',
  'lost',
  'adjustment',
  'purchased',
];

const positiveTypes = new Set(['restock', 'purchased']);
const negativeTypes = new Set(['usage', 'damaged', 'lost']);

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { item_variant_id, type, quantity, note, booking_id } =
    await req.json();

  if (!item_variant_id || !movementTypes.includes(type)) {
    return NextResponse.json(
      { error: 'Valid variant and movement type are required' },
      { status: 400 },
    );
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty === 0) {
    return NextResponse.json(
      { error: 'Quantity must be a non-zero integer' },
      { status: 400 },
    );
  }

  if (positiveTypes.has(type) && qty < 0) {
    return NextResponse.json(
      { error: `${type} requires a positive quantity` },
      { status: 400 },
    );
  }
  if (negativeTypes.has(type) && qty > 0) {
    return NextResponse.json(
      { error: `${type} requires a negative quantity` },
      { status: 400 },
    );
  }

  const { data: variant, error: fetchError } = await supabase
    .from('item_variants')
    .select('stock_quantity')
    .eq('id', item_variant_id)
    .single();

  if (fetchError || !variant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
  }

  const newStock = Number(variant.stock_quantity) + qty;
  if (newStock < 0) {
    return NextResponse.json(
      { error: `Stok tidak cukup (tersedia ${variant.stock_quantity})` },
      { status: 400 },
    );
  }

  // Ledger first (append-only), then the cached total.
  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      item_variant_id,
      type,
      quantity: qty,
      booking_id: booking_id ?? null,
      note: note || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('item_variants')
    .update({ stock_quantity: newStock })
    .eq('id', item_variant_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ movement: data }, { status: 201 });
}
