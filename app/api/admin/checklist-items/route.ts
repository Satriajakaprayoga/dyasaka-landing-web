import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { ChecklistPhase, ChecklistStatus } from '@/lib/types';

const validStatuses: ChecklistStatus[] = [
  'pending',
  'in_stock',
  'need_order',
  'done',
];

const validPhases: ChecklistPhase[] = ['stock_check', 'pickup', 'return'];

/**
 * Admin-only CRUD for the 3-phase booking checklist.
 *
 * PATCHing status to 'done' also stamps completed_at (here) and flips
 * the linked booking_item's rental_status via the DB trigger
 * trg_checklist_items_done — that side effect is not duplicated in
 * application code.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, status, note } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing checklist item id' },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    patch.status = status;
    patch.completed_at =
      status === 'done' ? new Date().toISOString() : null;
  }
  if (note !== undefined) {
    patch.note = note === '' ? null : note;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('checklist_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checklist_item: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { booking_id, label, phase } = await req.json();

  if (!booking_id || !phase || !validPhases.includes(phase)) {
    return NextResponse.json(
      { error: 'Booking and a valid phase are required' },
      { status: 400 },
    );
  }

  const trimmed = typeof label === 'string' ? label.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  }
  if (trimmed.length > 200) {
    return NextResponse.json(
      { error: 'Label must be 200 characters or less' },
      { status: 400 },
    );
  }

  // Free-text rows go last within their phase (booking_item_id stays
  // null so the rental-sync trigger skips them).
  const { data: lastRow } = await supabase
    .from('checklist_items')
    .select('sort_order')
    .eq('booking_id', booking_id)
    .eq('phase', phase)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('checklist_items')
    .insert({
      booking_id,
      booking_item_id: null,
      phase,
      label: trimmed,
      status: 'pending',
      sort_order: (lastRow?.sort_order ?? 0) + 10,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checklist_item: data }, { status: 201 });
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
      { error: 'Missing checklist item id' },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
