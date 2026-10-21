import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import type { InvoiceLineSource } from '@/lib/types';

/**
 * Admin-only invoice state machine (§9). One invoice per booking
 * (booking_id UNIQUE): the DP is recorded as a payment against it.
 *
 * POST   { booking_id }                    → create draft (prefilled)
 * PATCH  { id, action, … }                 → action dispatch:
 *          save-lines | issue | record-payment | void
 * DELETE ?id=                              → delete draft
 */

function pad(n: number, len: number) {
  return String(n).padStart(len, '0');
}

/** "Name (Color, Size)" — mirrors the checklist label format. */
function describeVariant(v: {
  color: string | null;
  size: string | null;
  items: { name: string } | null;
} | null): string {
  if (!v) return 'Item';
  const detail =
    v.color || v.size ? ` (${[v.color, v.size].filter(Boolean).join(', ')})` : '';
  return `${v.items?.name ?? 'Item'}${detail}`;
}

type LineInput = {
  description?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  source_type?: unknown;
};

function parseLines(raw: unknown): { lines: {
  description: string;
  quantity: number;
  unit_price: number;
  source_type: InvoiceLineSource;
  sort_order: number;
}[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Lines harus berupa array' };

  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as LineInput;
    const description = typeof row.description === 'string' ? row.description.trim() : '';
    if (!description) return { error: `Baris ${i + 1}: deskripsi wajib diisi` };
    if (description.length > 200) {
      return { error: `Baris ${i + 1}: deskripsi maksimal 200 karakter` };
    }

    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: `Baris ${i + 1}: jumlah harus bilangan bulat > 0` };
    }

    const unit_price = Number(row.unit_price);
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return { error: `Baris ${i + 1}: harga tidak boleh negatif` };
    }

    const rawSource = typeof row.source_type === 'string' ? row.source_type : '';
    const source_type: InvoiceLineSource =
      rawSource === 'item' || rawSource === 'vendor' || rawSource === 'transport'
        ? rawSource
        : 'custom';

    lines.push({ description, quantity, unit_price, source_type, sort_order: i * 10 });
  }
  return { lines };
}

async function recomputeTotals(
  supabase: ReturnType<typeof createServerSupabase>,
  invoiceId: string,
) {
  const { data: items } = await supabase
    .from('invoice_items')
    .select('line_total')
    .eq('invoice_id', invoiceId);

  const subtotal = (items ?? []).reduce(
    (sum, r) => sum + Number(r.line_total),
    0,
  );
  return subtotal;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { booking_id } = await req.json();
  if (!booking_id) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, transport_fee')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Booking yang dibatalkan tidak bisa dibuatkan invoice' },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('booking_id', booking_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Booking ini sudah memiliki invoice' },
      { status: 409 },
    );
  }

  // Prefill lines from the booking's item snapshot — copies, so later
  // product/variant changes never touch an existing invoice.
  const { data: bookingItems } = await supabase
    .from('booking_items')
    .select('quantity, unit_price, item_variants(color, size, items(name))')
    .eq('booking_id', booking_id)
    .order('id');

  const rows = (bookingItems ?? []) as unknown as {
    quantity: number;
    unit_price: number;
    item_variants: {
      color: string | null;
      size: string | null;
      items: { name: string } | null;
    } | null;
  }[];

  const lines: {
    description: string;
    quantity: number;
    unit_price: number;
    source_type: InvoiceLineSource;
    sort_order: number;
  }[] = rows.map((r, i) => ({
    description: describeVariant(r.item_variants),
    quantity: r.quantity,
    unit_price: Number(r.unit_price),
    source_type: 'item',
    sort_order: i * 10,
  }));

  if (booking.transport_fee != null && Number(booking.transport_fee) > 0) {
    lines.push({
      description: 'Biaya Transport',
      quantity: 1,
      unit_price: Number(booking.transport_fee),
      source_type: 'transport',
      sort_order: lines.length * 10,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const { data: invoice, error } = await supabase
    .from('invoices')
    // access_token is generated by the DB default.
    .insert({ booking_id, subtotal, total: subtotal, balance_due: subtotal })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (lines.length > 0) {
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(lines.map((l) => ({ ...l, invoice_id: invoice.id })));

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ invoice }, { status: 201 });
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
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
  }

  // ---------- save-lines (draft only) ----------
  if (action === 'save-lines') {
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Hanya draft yang dapat diubah' },
        { status: 409 },
      );
    }

    const parsed = parseLines(body.lines);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // '' means "clear" for the nullable fields.
    const due_date = body.due_date ? body.due_date : null;
    const notes = body.notes ? body.notes : null;
    const bank_account_id = body.bank_account_id ? body.bank_account_id : null;

    // Replace-all: drafts are editable scratch space, so rewriting the
    // whole line set is simpler than diffing.
    const { error: delError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoice.id);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    if (parsed.lines.length > 0) {
      const { error: insError } = await supabase.from('invoice_items').insert(
        parsed.lines.map((l) => ({ ...l, invoice_id: invoice.id })),
      );

      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 });
      }
    }

    const subtotal = await recomputeTotals(supabase, invoice.id);

    const { data: updated, error: updError } = await supabase
      .from('invoices')
      .update({
        due_date,
        notes,
        bank_account_id,
        subtotal,
        total: subtotal,
        balance_due: subtotal - Number(invoice.amount_paid),
      })
      .eq('id', invoice.id)
      .select()
      .single();

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order');

    return NextResponse.json({ invoice: updated, items: items ?? [] });
  }

  // ---------- issue (draft only) ----------
  if (action === 'issue') {
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Invoice sudah diterbitkan' },
        { status: 409 },
      );
    }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('id, line_total')
      .eq('invoice_id', invoice.id)
      .order('sort_order');

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Invoice minimal harus memiliki satu baris' },
        { status: 400 },
      );
    }

    if (!invoice.bank_account_id) {
      return NextResponse.json(
        { error: 'Pilih rekening bank terlebih dahulu' },
        { status: 400 },
      );
    }

    const { data: bank } = await supabase
      .from('company_bank_accounts')
      .select('bank_name, account_holder, account_number, is_active')
      .eq('id', invoice.bank_account_id)
      .maybeSingle();

    if (!bank || !bank.is_active) {
      return NextResponse.json(
        { error: 'Pilih rekening bank yang aktif' },
        { status: 400 },
      );
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', invoice.booking_id)
      .maybeSingle();

    if (!booking || !['confirmed', 'done'].includes(booking.status)) {
      return NextResponse.json(
        { error: 'Booking belum dikonfirmasi' },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from('company_profile')
      .select('company_name')
      .limit(1)
      .maybeSingle();

    const subtotal = items.reduce((s, r) => s + Number(r.line_total), 0);
    const issueDate = new Date().toISOString().slice(0, 10);
    const [year, month] = issueDate.split('-');
    const lastDay = new Date(
      Date.UTC(Number(year), Number(month), 0),
    ).getUTCDate();
    const monthEnd = `${year}-${month}-${pad(lastDay, 2)}`;

    // Per-month sequence: every invoice issued that month counts,
    // including voided ones — numbers are never reused.
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .gte('issue_date', `${year}-${month}-01`)
      .lte('issue_date', monthEnd);

    const bankSnapshot = `${bank.bank_name} a/n ${bank.account_holder} • ${bank.account_number}`;

    // Concurrent issues can race for the same sequence — the unique
    // constraint on invoice_number is the referee; retry with the next
    // number up to 5 times.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const invoiceNumber = `INV/${year}/${month}/${pad((count ?? 0) + attempt, 4)}`;

      const { data: updated, error: issueError } = await supabase
        .from('invoices')
        .update({
          status: 'issued',
          issue_date: issueDate,
          invoice_number: invoiceNumber,
          company_name_snapshot: profile?.company_name ?? null,
          bank_account_snapshot: bankSnapshot,
          subtotal,
          total: subtotal,
          balance_due: subtotal - Number(invoice.amount_paid),
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (!issueError) {
        return NextResponse.json({ invoice: updated, items });
      }
      if (issueError.code !== '23505' || attempt === 5) {
        return NextResponse.json({ error: issueError.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      { error: 'Gagal mengambil nomor invoice, coba lagi' },
      { status: 500 },
    );
  }

  // ---------- record-payment (issued only) ----------
  if (action === 'record-payment') {
    if (invoice.status !== 'issued') {
      return NextResponse.json(
        { error: 'Pembayaran hanya dicatat pada invoice yang terbit' },
        { status: 409 },
      );
    }

    const amount = Number(body.amount);
    const balanceDue = Number(invoice.balance_due);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balanceDue) {
      return NextResponse.json(
        { error: `Nominal pembayaran harus di antara 0 dan sisa tagihan (${balanceDue})` },
        { status: 400 },
      );
    }

    const amountPaid = Number(invoice.amount_paid) + amount;
    const newBalance = Number(invoice.total) - amountPaid;

    const { data: updated, error } = await supabase
      .from('invoices')
      .update({
        amount_paid: amountPaid,
        balance_due: newBalance,
        status: newBalance <= 0 ? 'paid' : 'issued',
      })
      .eq('id', invoice.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invoice: updated });
  }

  // ---------- void (issued only) ----------
  if (action === 'void') {
    if (invoice.status !== 'issued') {
      return NextResponse.json(
        { error: 'Hanya invoice berstatus terbit yang dapat dibatalkan' },
        { status: 409 },
      );
    }

    const { data: updated, error } = await supabase
      .from('invoices')
      .update({ status: 'void' })
      .eq('id', invoice.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invoice: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
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
    return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 });
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
  }
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Hanya draft yang dapat dihapus' },
      { status: 409 },
    );
  }

  const { error } = await supabase.from('invoices').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
