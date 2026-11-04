import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

/**
 * Append-only money ledger (§12). No DELETE export — a mistake is
 * fixed by reversing (PATCH action "reverse"), never by editing or
 * deleting. Editing is also refused: only reversals exist.
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Paginated + filtered list for the admin ledger screen (infinite
// scroll). Query params: page, limit, month (YYYY-MM), direction
// (in | out), category (uuid).
//
// Besides the page rows, the response carries totals computed over the
// WHOLE filtered set (PostgREST cannot SUM — direction/amount rows are
// fetched in chunks and summed in JS) and the ids of rows reversed by
// any later row, so badges stay correct across month boundaries.
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
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 15));
  const month = sp.get('month') ?? '';
  const direction = sp.get('direction') ?? '';
  const category = (sp.get('category') ?? '').trim();

  const monthValid = /^\d{4}-\d{2}$/.test(month);
  const directionValid = direction === 'in' || direction === 'out';

  // "YYYY-MM" → inclusive date range; the last day comes from
  // Date.UTC(year, month, 0) — day 0 of the next month.
  let monthStart: string | null = null;
  let monthEnd: string | null = null;
  if (monthValid) {
    const [y, m] = month.split('-').map(Number);
    monthStart = `${month}-01`;
    monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }

  type Totals = { masuk: number; keluar: number; net: number };
  async function computeTotals(): Promise<Totals> {
    const totals: Totals = { masuk: 0, keluar: 0, net: 0 };
    const CHUNK = 1000; // PostgREST default max rows
    let from = 0;
    for (;;) {
      let q = supabase.from('transactions').select('direction, amount').order('id');
      if (monthStart && monthEnd) {
        q = q.gte('transaction_date', monthStart).lte('transaction_date', monthEnd);
      }
      if (directionValid) q = q.eq('direction', direction);
      if (category) q = q.eq('category_id', category);
      const { data, error } = await q.range(from, from + CHUNK - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.direction === 'in') totals.masuk += Number(row.amount);
        else totals.keluar += Number(row.amount);
      }
      if ((data?.length ?? 0) < CHUNK) break;
      from += CHUNK;
    }
    totals.net = totals.masuk - totals.keluar;
    return totals;
  }

  async function computeTotalsSafe(): Promise<Totals | { error: { message: string } }> {
    try {
      return await computeTotals();
    } catch (err) {
      return { error: err as { message: string } };
    }
  }

  let mainQuery = supabase
    .from('transactions')
    .select('*, category:transaction_categories(name)', { count: 'exact' })
    // id tiebreaker keeps pagination deterministic — same-second rows
    // would otherwise shuffle between batches.
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id');
  if (monthStart && monthEnd) {
    mainQuery = mainQuery
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd);
  }
  if (directionValid) mainQuery = mainQuery.eq('direction', direction);
  if (category) mainQuery = mainQuery.eq('category_id', category);

  const from = (page - 1) * limit;

  const [main, totalsRes, reversed] = await Promise.all([
    mainQuery.range(from, from + limit - 1),
    computeTotalsSafe(),
    // Reversal markers: tiny set (one row per mistake ever made), so
    // fetch the whole thing to keep badges correct on every filter.
    supabase
      .from('transactions')
      .select('reverses_transaction_id')
      .not('reverses_transaction_id', 'is', null),
  ]);

  if (main.error) {
    return NextResponse.json({ error: main.error.message }, { status: 500 });
  }
  if ('error' in totalsRes) {
    return NextResponse.json({ error: totalsRes.error.message }, { status: 500 });
  }
  if (reversed.error) {
    return NextResponse.json({ error: reversed.error.message }, { status: 500 });
  }

  const data = main.data ?? [];
  const total = main.count ?? 0;

  return NextResponse.json({
    items: data,
    total,
    hasMore: from + data.length < total,
    totals: totalsRes,
    reversedIds: (reversed.data ?? [])
      .map((r) => r.reverses_transaction_id)
      .filter((id): id is string => id != null),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const direction = body.direction === 'out' ? 'out' : body.direction === 'in' ? 'in' : null;
  if (!direction) {
    return NextResponse.json(
      { error: 'Arah transaksi harus masuk atau keluar' },
      { status: 400 },
    );
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'Nominal harus lebih besar dari 0' },
      { status: 400 },
    );
  }

  const category_id = clean(body.category_id);
  if (!category_id) {
    return NextResponse.json(
      { error: 'Kategori wajib dipilih' },
      { status: 400 },
    );
  }

  const { data: category } = await supabase
    .from('transaction_categories')
    .select('id, direction, is_active')
    .eq('id', category_id)
    .maybeSingle();

  if (!category) {
    return NextResponse.json(
      { error: 'Kategori tidak ditemukan' },
      { status: 400 },
    );
  }
  if (!category.is_active) {
    return NextResponse.json(
      { error: 'Kategori sudah tidak aktif' },
      { status: 400 },
    );
  }
  if (category.direction !== direction) {
    return NextResponse.json(
      {
        error:
          direction === 'in'
            ? 'Kategori ini khusus transaksi keluar'
            : 'Kategori ini khusus transaksi masuk',
      },
      { status: 400 },
    );
  }

  const transaction_date =
    typeof body.transaction_date === 'string' && ISO_DATE.test(body.transaction_date)
      ? body.transaction_date
      : new Date().toISOString().slice(0, 10);

  const period_start = dateOrNull(body.period_start);
  const period_end = dateOrNull(body.period_end);
  if ((period_start && !period_end) || (!period_start && period_end)) {
    return NextResponse.json(
      { error: 'Periode gaji harus diisi lengkap (mulai dan akhir)' },
      { status: 400 },
    );
  }

  // Optional links — at most the relevant ones arrive per row.
  const row: Record<string, unknown> = {
    direction,
    amount,
    transaction_date,
    category_id,
    account: clean(body.account),
    description: clean(body.description),
    booking_id: clean(body.booking_id),
    invoice_id: clean(body.invoice_id),
    purchase_order_id: clean(body.purchase_order_id),
    plan_line_id: clean(body.plan_line_id),
    staff_id: clean(body.staff_id),
    booking_staff_id: clean(body.booking_staff_id),
    vendor_id: clean(body.vendor_id),
    period_start,
    period_end,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(row)
    .select()
    .single();

  if (error) {
    // Invalid uuid in one of the optional links lands here (23503).
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
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
  const { id, action } = body;
  if (!id || action !== 'reverse') {
    return NextResponse.json(
      { error: 'Hanya aksi pembalikan (reverse) yang tersedia' },
      { status: 400 },
    );
  }

  const { data: original } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!original) {
    return NextResponse.json(
      { error: 'Transaksi tidak ditemukan' },
      { status: 404 },
    );
  }

  const { data: alreadyReversed } = await supabase
    .from('transactions')
    .select('id')
    .eq('reverses_transaction_id', id)
    .maybeSingle();

  if (alreadyReversed) {
    return NextResponse.json(
      { error: 'Transaksi ini sudah pernah dibalikkan' },
      { status: 409 },
    );
  }

  // The reversing row flips the direction and must land in a category
  // of that direction — same name, mirrored. Created on the fly when
  // the admin never recorded one (e.g. first reversal of a payment).
  const flipped = original.direction === 'in' ? 'out' : 'in';

  const { data: originalCategory } = await supabase
    .from('transaction_categories')
    .select('name, sort_order')
    .eq('id', original.category_id)
    .maybeSingle();

  const categoryName = originalCategory?.name ?? 'Lain-lain';

  let { data: mirror } = await supabase
    .from('transaction_categories')
    .select('id')
    .eq('name', categoryName)
    .eq('direction', flipped)
    .maybeSingle();

  if (!mirror) {
    const { data: created, error: catError } = await supabase
      .from('transaction_categories')
      .insert({
        name: categoryName,
        direction: flipped,
        is_active: true,
        sort_order: originalCategory?.sort_order ?? 0,
      })
      .select('id')
      .single();

    if (catError) {
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }
    mirror = created;
  }

  // The reversal carries the same links as the original so margin and
  // cashflow reports neutralize the mistake everywhere at once.
  const { data: created, error } = await supabase
    .from('transactions')
    .insert({
      direction: flipped,
      amount: original.amount,
      // The money moved back today, not on the original date.
      transaction_date: new Date().toISOString().slice(0, 10),
      category_id: mirror.id,
      account: original.account,
      description: original.description
        ? `Pembalikan: ${original.description}`
        : 'Pembalikan transaksi',
      booking_id: original.booking_id,
      invoice_id: original.invoice_id,
      purchase_order_id: original.purchase_order_id,
      plan_line_id: original.plan_line_id,
      staff_id: original.staff_id,
      booking_staff_id: original.booking_staff_id,
      vendor_id: original.vendor_id,
      period_start: original.period_start,
      period_end: original.period_end,
      reverses_transaction_id: original.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: created }, { status: 201 });
}
