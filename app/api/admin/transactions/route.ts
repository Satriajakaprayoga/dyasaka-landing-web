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
