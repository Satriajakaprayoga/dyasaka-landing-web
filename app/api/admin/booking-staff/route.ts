import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Staff assignments per booking (§13). Works like booking vendors:
 * choose the person, the role on this event and the planned pay.
 * Cancelling keeps the row (pay history / ledger links survive);
 * deleting is only for mistakes before any payment exists.
 */

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const ASSIGNMENT_STATUSES = ['planned', 'confirmed', 'cancelled'];

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const booking_id = clean(body.booking_id);
  const staff_id = clean(body.staff_id);
  if (!booking_id || !staff_id) {
    return NextResponse.json(
      { error: 'Booking dan staff wajib dipilih' },
      { status: 400 },
    );
  }

  // planned_pay defaults to 0 — the admin plans pay later if needed.
  let planned_pay = 0;
  if (body.planned_pay != null && body.planned_pay !== '') {
    planned_pay = Number(body.planned_pay);
    if (!Number.isFinite(planned_pay) || planned_pay < 0) {
      return NextResponse.json(
        { error: 'Rencana bayar tidak boleh negatif' },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from('booking_staff')
    .insert({
      booking_id,
      staff_id,
      role: clean(body.role),
      planned_pay,
      status: 'planned',
      note: clean(body.note),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Staff atau booking tidak ditemukan' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignment: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Missing assignment id' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.role !== undefined) patch.role = clean(body.role);
  if (body.planned_pay !== undefined) {
    const pay = Number(body.planned_pay);
    if (!Number.isFinite(pay) || pay < 0) {
      return NextResponse.json(
        { error: 'Rencana bayar tidak boleh negatif' },
        { status: 400 },
      );
    }
    patch.planned_pay = pay;
  }
  if (body.status !== undefined) {
    if (!ASSIGNMENT_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: 'Status penugasan tidak valid' },
        { status: 400 },
      );
    }
    patch.status = body.status;
  }
  if (body.note !== undefined) patch.note = clean(body.note);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('booking_staff')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignment: data });
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
    return NextResponse.json({ error: 'Missing assignment id' }, { status: 400 });
  }

  const { error } = await supabase.from('booking_staff').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
