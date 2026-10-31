import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Purchase plans (§15) — stored intentions, kept separate from
 * purchase orders. A plan can change, shrink or be dropped without
 * cluttering the orders list. Line status is DERIVED (order link /
 * done_at); plan status follows its lines (approved → in_progress →
 * done), while draft/approved/cancelled are set by hand.
 */

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function dateOrNull(value: unknown): string | null {
  const s = clean(value);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const PLAN_TYPES = ['buy', 'create', 'fix', 'rnd', 'upgrade'];
const PLAN_STATUSES = ['draft', 'approved', 'in_progress', 'done', 'cancelled'];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const title = clean(body.title);
  if (!title) {
    return NextResponse.json({ error: 'Judul rencana wajib diisi' }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json(
      { error: 'Judul rencana maksimal 120 karakter' },
      { status: 400 },
    );
  }

  const plan_type = PLAN_TYPES.includes(body.plan_type) ? body.plan_type : null;
  if (!plan_type) {
    return NextResponse.json(
      { error: 'Jenis rencana tidak valid' },
      { status: 400 },
    );
  }

  const budget = body.budget_estimate == null ? null : Number(body.budget_estimate);
  if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
    return NextResponse.json(
      { error: 'Estimasi anggaran tidak boleh negatif' },
      { status: 400 },
    );
  }

  const { data: plan, error } = await supabase
    .from('purchase_plans')
    .insert({
      title,
      plan_type,
      reason: clean(body.reason),
      booking_id: clean(body.booking_id),
      budget_estimate: budget,
      target_date: dateOrNull(body.target_date),
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Optional starter lines.
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < body.lines.length; i++) {
      const line = body.lines[i];
      const description = clean(line.description);
      if (!description) {
        return NextResponse.json(
          { error: `Baris ${i + 1}: deskripsi wajib diisi` },
          { status: 400 },
        );
      }
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Baris ${i + 1}: jumlah harus bilangan bulat > 0` },
          { status: 400 },
        );
      }
      const estimated = line.estimated_unit_cost == null
        ? null
        : Number(line.estimated_unit_cost);
      if (estimated != null && (!Number.isFinite(estimated) || estimated < 0)) {
        return NextResponse.json(
          { error: `Baris ${i + 1}: estimasi biaya tidak boleh negatif` },
          { status: 400 },
        );
      }
      rows.push({
        plan_id: plan.id,
        description,
        quantity,
        item_variant_id: clean(line.item_variant_id),
        estimated_unit_cost: estimated,
        supplier_id: clean(line.supplier_id),
        replaces_item_variant_id: clean(line.replaces_item_variant_id),
        sort_order: i * 10,
      });
    }

    const { error: linesError } = await supabase
      .from('purchase_plan_lines')
      .insert(rows);

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ plan }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing plan id' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = clean(body.title);
    if (!title) {
      return NextResponse.json(
        { error: 'Judul rencana wajib diisi' },
        { status: 400 },
      );
    }
    patch.title = title;
  }
  if (body.plan_type !== undefined) {
    if (!PLAN_TYPES.includes(body.plan_type)) {
      return NextResponse.json(
        { error: 'Jenis rencana tidak valid' },
        { status: 400 },
      );
    }
    patch.plan_type = body.plan_type;
  }
  if (body.reason !== undefined) patch.reason = clean(body.reason);
  if (body.booking_id !== undefined) patch.booking_id = clean(body.booking_id);
  if (body.budget_estimate !== undefined) {
    const budget = body.budget_estimate == null ? null : Number(body.budget_estimate);
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
      return NextResponse.json(
        { error: 'Estimasi anggaran tidak boleh negatif' },
        { status: 400 },
      );
    }
    patch.budget_estimate = budget;
  }
  if (body.target_date !== undefined) patch.target_date = dateOrNull(body.target_date);
  if (body.status !== undefined) {
    if (!PLAN_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: 'Status rencana tidak valid' },
        { status: 400 },
      );
    }
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('purchase_plans')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan: data });
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
    return NextResponse.json({ error: 'Missing plan id' }, { status: 400 });
  }

  // Dropping a plan is always allowed — it is an intention, not a
  // commitment. Cascade removes its lines; ledger rows survive with
  // the link cleared (on delete set null).
  const { error } = await supabase.from('purchase_plans').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
