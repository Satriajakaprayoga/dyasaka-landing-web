import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { ChecklistPhase } from '@/lib/types';

type VariantInfo = {
  current_price: number;
  color: string | null;
  size: string | null;
  items: { name: string; type: string } | null;
};

/** Same label shape the DP checklist trigger generates. */
function buildLabel(v: VariantInfo, quantity: number) {
  const parts = [v.items?.name];
  if (v.color || v.size) {
    parts.push(`(${[v.color, v.size].filter(Boolean).join(', ')})`);
  }
  parts.push(`x${quantity}`);
  return parts.filter(Boolean).join(' ');
}

/**
 * Admin-only CRUD for booking_items — the per-booking snapshot that can
 * diverge from the product recipe (custom bookings, extra items,
 * negotiated prices).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { booking_id, item_variant_id, quantity, unit_price } = await req.json();

  if (!booking_id || !item_variant_id) {
    return NextResponse.json(
      { error: 'Booking and variant are required' },
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

  const { data: variant } = await supabase
    .from('item_variants')
    .select('current_price, color, size, items(name, type)')
    .eq('id', item_variant_id)
    .single();

  // Child→parent embeds come back as objects, not arrays.
  const v = variant as unknown as VariantInfo | null;
  if (!v) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 400 });
  }

  const isRentable = v.items?.type === 'rentable';

  const { data: inserted, error } = await supabase
    .from('booking_items')
    .insert({
      booking_id,
      item_variant_id,
      quantity: qty,
      unit_price:
        unit_price != null && unit_price !== '' ? Number(unit_price) : v.current_price,
      rental_status: isRentable ? 'reserved' : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Checklist catch-up: if the DP checklist was already generated,
  // append matching rows for this item so it isn't missing from the
  // workflow. (Before DP the trigger will include it when it runs.)
  const { data: existing } = await supabase
    .from('checklist_items')
    .select('id')
    .eq('booking_id', booking_id)
    .limit(1);

  if (existing && existing.length > 0) {
    const { data: phaseRows } = await supabase
      .from('checklist_items')
      .select('phase, sort_order')
      .eq('booking_id', booking_id);

    const maxByPhase: Record<ChecklistPhase, number> = {
      stock_check: 0,
      pickup: 0,
      return: 0,
    };
    for (const row of phaseRows ?? []) {
      maxByPhase[row.phase as ChecklistPhase] = Math.max(
        maxByPhase[row.phase as ChecklistPhase],
        row.sort_order,
      );
    }

    const label = buildLabel(v, qty);
    const phases: { phase: ChecklistPhase; include: boolean }[] = [
      { phase: 'stock_check', include: true },
      { phase: 'pickup', include: true },
      { phase: 'return', include: isRentable },
    ];

    const checklistRows = phases
      .filter((p) => p.include)
      .map((p) => ({
        booking_id,
        booking_item_id: inserted.id,
        phase: p.phase,
        label,
        status: 'pending',
        sort_order: maxByPhase[p.phase] + 1,
      }));

    if (checklistRows.length > 0) {
      const { error: catchUpError } = await supabase
        .from('checklist_items')
        .insert(checklistRows);

      if (catchUpError) {
        return NextResponse.json({ error: catchUpError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ booking_item: inserted }, { status: 201 });
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
  const { id, quantity, unit_price } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing booking item id' },
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
  if (unit_price !== undefined) {
    const price = Number(unit_price);
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: 'Invalid unit price' }, { status: 400 });
    }
    patch.unit_price = price;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('booking_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking_item: data });
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
      { error: 'Missing booking item id' },
      { status: 400 },
    );
  }

  // Related checklist rows cascade via the
  // checklist_items.booking_item_id FK.
  const { error } = await supabase.from('booking_items').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
