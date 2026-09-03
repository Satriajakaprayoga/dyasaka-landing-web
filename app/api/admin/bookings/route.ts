import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Admin-only. Creates a booking directly (product, theme, message,
 * event_date, customer info). Bookings created here should be
 * inserted with status 'confirmed' since there's no separate
 * customer-facing pending step anymore — the admin is recording an
 * already-agreed booking. The DB trigger on `bookings` recalculates
 * date_capacity.booked_count automatically, so the public calendar
 * reflects this immediately.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    product_id,
    customer_name,
    phone,
    event_date,
    event_address,
    theme,
    message,
    status, // 'pending' | 'confirmed' | 'done' | 'cancelled'
  } = body;

  if (!product_id || !customer_name || !phone || !event_date || !event_address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      product_id,
      customer_name,
      phone,
      event_date,
      event_address,
      theme: theme ?? null,
      message: message ?? null,
      status: status ?? 'confirmed',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data }, { status: 201 });
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
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data });
}
