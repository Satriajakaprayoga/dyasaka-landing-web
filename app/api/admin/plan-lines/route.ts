import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { recomputePlanStatus } from '@/lib/plan-status';

/**
 * Purchase plan lines (§15). Line execution status is DERIVED, never
 * stored: no order link and no done_at = not executed; linked to an
 * order line = ordered; the order line fully received, or done_at set
 * = done. After every mutation the parent plan's status is
 * recomputed: approved → in_progress when the first line is linked or
 * done, done when every line is done (cancelled is left alone) —
 * see lib/plan-status.ts.
 */

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const OUTCOMES = ['testing', 'adopted', 'rejected'];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const plan_id = clean(body.plan_id);
  if (!plan_id) {
    return NextResponse.json({ error: 'Missing plan id' }, { status: 400 });
  }

  const description = clean(body.description);
  if (!description) {
    return NextResponse.json(
      { error: 'Deskripsi wajib diisi' },
      { status: 400 },
    );
  }
  if (description.length > 200) {
    return NextResponse.json(
      { error: 'Deskripsi maksimal 200 karakter' },
      { status: 400 },
    );
  }

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json(
      { error: 'Jumlah harus bilangan bulat > 0' },
      { status: 400 },
    );
  }

  const estimated = body.estimated_unit_cost == null
    ? null
    : Number(body.estimated_unit_cost);
  if (estimated != null && (!Number.isFinite(estimated) || estimated < 0)) {
    return NextResponse.json(
      { error: 'Estimasi biaya tidak boleh negatif' },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from('purchase_plan_lines')
    .select('sort_order')
    .eq('plan_id', plan_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const { data, error } = await supabase
    .from('purchase_plan_lines')
    .insert({
      plan_id,
      description,
      quantity,
      item_variant_id: clean(body.item_variant_id),
      estimated_unit_cost: estimated,
      supplier_id: clean(body.supplier_id),
      replaces_item_variant_id: clean(body.replaces_item_variant_id),
      sort_order: ((existing?.[0]?.sort_order ?? 0) as number) + 10,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recomputePlanStatus(supabase, plan_id);

  return NextResponse.json({ line: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing line id' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.description !== undefined) {
    const description = clean(body.description);
    if (!description) {
      return NextResponse.json(
        { error: 'Deskripsi wajib diisi' },
        { status: 400 },
      );
    }
    patch.description = description;
  }
  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'Jumlah harus bilangan bulat > 0' },
        { status: 400 },
      );
    }
    patch.quantity = quantity;
  }
  if (body.item_variant_id !== undefined) {
    patch.item_variant_id = clean(body.item_variant_id);
  }
  if (body.estimated_unit_cost !== undefined) {
    const estimated = body.estimated_unit_cost == null
      ? null
      : Number(body.estimated_unit_cost);
    if (estimated != null && (!Number.isFinite(estimated) || estimated < 0)) {
      return NextResponse.json(
        { error: 'Estimasi biaya tidak boleh negatif' },
        { status: 400 },
      );
    }
    patch.estimated_unit_cost = estimated;
  }
  if (body.supplier_id !== undefined) patch.supplier_id = clean(body.supplier_id);
  if (body.replaces_item_variant_id !== undefined) {
    patch.replaces_item_variant_id = clean(body.replaces_item_variant_id);
  }
  // In-house execution: no supplier involved — set/cleared by hand.
  if (body.done_at !== undefined) {
    patch.done_at = clean(body.done_at);
  }
  if (body.outcome !== undefined) {
    if (body.outcome != null && !OUTCOMES.includes(body.outcome)) {
      return NextResponse.json(
        { error: 'Outcome tidak valid' },
        { status: 400 },
      );
    }
    patch.outcome = clean(body.outcome);
  }
  if (body.outcome_note !== undefined) {
    patch.outcome_note = clean(body.outcome_note);
  }
  if (body.sort_order !== undefined) {
    patch.sort_order = Number.isInteger(Number(body.sort_order))
      ? Number(body.sort_order)
      : 0;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('purchase_plan_lines')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recomputePlanStatus(supabase, data.plan_id);

  return NextResponse.json({ line: data });
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
    return NextResponse.json({ error: 'Missing line id' }, { status: 400 });
  }

  // A plan can shrink: remove the line, then recompute the parent.
  const { data: line } = await supabase
    .from('purchase_plan_lines')
    .select('plan_id')
    .eq('id', id)
    .maybeSingle();

  if (!line) {
    return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 });
  }

  const { error } = await supabase
    .from('purchase_plan_lines')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recomputePlanStatus(supabase, line.plan_id);

  return NextResponse.json({ ok: true });
}
