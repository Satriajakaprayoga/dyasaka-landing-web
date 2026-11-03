import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const BOOKING_STATUSES = ['pending', 'confirmed', 'done', 'cancelled'] as const;

// Paginated + filtered list for the admin bookings screen (infinite
// scroll). Query params: page, limit, search, status, period
// (upcoming | past).
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 12));
  const search = (sp.get('search') ?? '').trim();
  const status = sp.get('status') ?? '';
  const period = sp.get('period') ?? '';

  // Search spans bookings columns AND the embedded product name, but
  // PostgREST's or= logic tree cannot mix embedded filters with plain
  // ones (verified live: PGRST100 "failed to parse logic tree"), so
  // matching booking ids are resolved in parallel sub-queries and the
  // main query narrows with .in().
  let candidateIds: Set<string> | null = null;
  if (search) {
    // Strip commas/parens/backslashes — or= patterns treat them as
    // filter syntax, so user input could otherwise break the expression.
    const safe = search.replace(/[,()%\\]/g, ' ');

    const [direct, viaProducts] = await Promise.all([
      supabase
        .from('bookings')
        .select('id')
        .or(
          `customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,theme.ilike.%${safe}%`,
        ),
      supabase.from('products').select('id').ilike('name', `%${safe}%`),
    ]);

    if (direct.error) {
      return NextResponse.json({ error: direct.error.message }, { status: 500 });
    }
    if (viaProducts.error) {
      return NextResponse.json(
        { error: viaProducts.error.message },
        { status: 500 },
      );
    }

    let bookingIds = (direct.data ?? []).map((r) => r.id);
    const productIds = (viaProducts.data ?? []).map((r) => r.id);
    if (productIds.length > 0) {
      const viaBooking = await supabase
        .from('bookings')
        .select('id')
        .in('product_id', productIds);
      if (viaBooking.error) {
        return NextResponse.json(
          { error: viaBooking.error.message },
          { status: 500 },
        );
      }
      bookingIds = [...bookingIds, ...(viaBooking.data ?? []).map((r) => r.id)];
    }

    candidateIds = new Set(bookingIds);
    // .in([]) is not a valid PostgREST filter — short-circuit instead.
    if (candidateIds.size === 0) {
      return NextResponse.json({ items: [], total: 0, hasMore: false });
    }
  }

  let query = supabase
    .from('bookings')
    .select('*, products(name)', { count: 'exact' })
    // id tiebreaker keeps pagination deterministic — many bookings
    // share an event_date.
    .order('event_date', { ascending: true })
    .order('id');

  if (candidateIds !== null) {
    query = query.in('id', [...candidateIds]);
  }
  if ((BOOKING_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }
  if (period === 'upcoming' || period === 'past') {
    // Admin audience works in Asia/Jakarta — matches the previous
    // client-side filter, which compared against the local date.
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jakarta',
    });
    query =
      period === 'upcoming'
        ? query.gte('event_date', today)
        : query.lt('event_date', today);
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    items: data ?? [],
    total,
    hasMore: from + (data?.length ?? 0) < total,
  });
}

/**
 * Admin-only. Creates a booking directly (product, theme, message,
 * event_date, customer info). Bookings created here should be
 * inserted with status 'confirmed' since there's no separate
 * customer-facing pending step anymore — the admin is recording an
 * already-agreed booking. The DB trigger on `bookings` recalculates
 * date_capacity.booked_count automatically, so the public calendar
 * reflects this immediately.
 *
 * `product_id` is optional: omit it (or null) for a custom booking
 * assembled per-item on the detail page. When a product is given, its
 * recipe is snapshotted into `booking_items` at the current variant
 * prices.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

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
    transport_fee,
  } = body;

  if (!customer_name || !phone || !event_date || !event_address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      product_id: product_id ?? null,
      customer_name,
      phone,
      event_date,
      event_address,
      theme: theme ?? null,
      message: message ?? null,
      status: status ?? 'confirmed',
      transport_fee: transport_fee ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed booking_items from the product recipe — unit_price is a frozen
  // snapshot of the variant's current price; rentables start as
  // 'reserved'. Custom bookings (no product) start empty.
  if (data.product_id) {
    const { data: recipe, error: recipeError } = await supabase
      .from('product_items')
      .select('item_variant_id, quantity, item_variants(current_price, items(type))')
      .eq('product_id', data.product_id);

    if (recipeError) {
      return NextResponse.json({ error: recipeError.message }, { status: 500 });
    }

    // Untyped client infers embeds as arrays; PostgREST returns objects
    // for child→parent embeds (product_items → item_variants → items).
    const rows = (recipe ?? []) as unknown as {
      item_variant_id: string;
      quantity: number;
      item_variants: {
        current_price: number;
        items: { type: string } | null;
      } | null;
    }[];

    if (rows.length > 0) {
      const { error: seedError } = await supabase.from('booking_items').insert(
        rows.map((r) => ({
          booking_id: data.id,
          item_variant_id: r.item_variant_id,
          quantity: r.quantity,
          unit_price: r.item_variants?.current_price ?? 0,
          rental_status:
            r.item_variants?.items?.type === 'rentable' ? 'reserved' : null,
        })),
      );

      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ booking: data }, { status: 201 });
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
  const { id, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  // Allow-list instead of a blind spread so clients can never touch
  // created_at/updated_at or force unexpected columns.
  const allowed = [
    'customer_name',
    'phone',
    'event_date',
    'event_address',
    'theme',
    'message',
    'status',
    'project_status',
    'product_id',
    'transport_fee',
    'dp_received_at',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (rest[key] !== undefined) updates[key] = rest[key];
  }

  // Empty string means "clear" for the nullable FK / fee fields.
  if (updates.product_id === '') updates.product_id = null;
  if (updates.transport_fee === '') updates.transport_fee = null;

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
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const { error } = await supabase.from('bookings').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // DB trigger recalculates date_capacity.booked_count on delete.
  return NextResponse.json({ ok: true });
}
