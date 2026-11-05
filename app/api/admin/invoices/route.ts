import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { revalidateInvoices } from '@/lib/revalidate-public';
import type { InvoiceLineSource } from '@/lib/types';

/**
 * Admin-only invoice state machine (§9). Several invoices per booking:
 * `dp` (deposit) and `final`, at most one non-void of each type
 * (partial unique index invoices_booking_type_live).
 *
 * Issued invoices are FROZEN — lines, totals and snapshots. The only
 * correction is void + reissue. Paid amount and balance due are NOT
 * stored: they are calculated from ledger `in` rows carrying
 * invoice_id, exactly like stock_quantity from stock_movements.
 *
 * POST   { booking_id, invoice_type, amount? } → create draft
 *          (final = prefilled from booking lines; dp = one typed line)
 * PATCH  { id, action, … }                     → action dispatch:
 *          save-lines (draft only) | issue | record-payment | void
 * DELETE ?id=                                  → delete draft
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

/** Paid = sum of ledger `in` rows linked to this invoice. */
async function paidAmount(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  invoiceId: string,
): Promise<number> {
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('direction', 'in');

  return (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
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
  const { booking_id } = body;
  if (!booking_id) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const invoice_type = body.invoice_type === 'dp' ? 'dp' : 'final';

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, transport_fee, product_id, products(name, price)')
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

  // At most one non-void invoice per (booking, type). The partial
  // unique index is the referee if two requests race.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('booking_id', booking_id)
    .eq('invoice_type', invoice_type)
    .neq('status', 'void')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: `Booking ini sudah memiliki invoice ${invoice_type === 'dp' ? 'DP' : 'final'} — batalkan (void) yang lama untuk membuat yang baru`,
      },
      { status: 409 },
    );
  }

  // Child→parent embed comes back as an object, not an array; null
  // product = custom booking without a package.
  const { product_id, products: pkg } = booking as unknown as {
    product_id: string | null;
    products: { name: string; price: number } | null;
  };

  type PrefillLine = {
    description: string;
    quantity: number;
    unit_price: number;
    source_type: InvoiceLineSource;
    sort_order: number;
  };

  let lines: PrefillLine[] = [];

  if (invoice_type === 'dp') {
    // Deposit invoice: exactly one typed line, optionally prefilled by
    // the UI from a percentage of the booking total.
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Nominal DP harus lebih besar dari 0' },
        { status: 400 },
      );
    }
    lines = [
      {
        description:
          typeof body.description === 'string' && body.description.trim()
            ? body.description.trim().slice(0, 200)
            : 'Deposit (DP)',
        quantity: 1,
        unit_price: amount,
        source_type: 'custom',
        sort_order: 0,
      },
    ];
  } else {
    // Final invoice: prefilled from the booking's item snapshot. Add-on
    // lines reprice at the CURRENT catalog price (falling back to the
    // booking's frozen price when the variant is gone); included lines
    // (part of the package) keep the booking's price — usually Rp 0 —
    // so a free component can never reappear as a chargeable line.
    const { data: bookingItems } = await supabase
      .from('booking_items')
      .select(
        'quantity, unit_price, is_included, item_variants(color, size, current_price, items(name))',
      )
      .eq('booking_id', booking_id)
      .order('id');

    const rows = (bookingItems ?? []) as unknown as {
      quantity: number;
      unit_price: number;
      is_included: boolean;
      item_variants: {
        color: string | null;
        size: string | null;
        current_price: number | null;
        items: { name: string } | null;
      } | null;
    }[];

    // 1) The package itself, first on the bill.
    if (product_id && pkg) {
      lines.push({
        description: pkg.name,
        quantity: 1,
        unit_price: Number(pkg.price),
        source_type: 'custom',
        sort_order: 0,
      });
    }

    // 2) Item lines — add-ons at live catalog prices, included lines
    //    at the frozen booking price.
    rows.forEach((r, i) => {
      const livePrice = r.item_variants?.current_price;
      const unitPrice = r.is_included
        ? Number(r.unit_price)
        : livePrice != null
          ? Number(livePrice)
          : Number(r.unit_price);
      lines.push({
        description: describeVariant(r.item_variants),
        quantity: r.quantity,
        unit_price: unitPrice,
        source_type: 'item',
        sort_order: (i + 1) * 10,
      });
    });

    // 3) Transport last.
    if (booking.transport_fee != null && Number(booking.transport_fee) > 0) {
      lines.push({
        description: 'Biaya Transport',
        quantity: 1,
        unit_price: Number(booking.transport_fee),
        source_type: 'transport',
        sort_order: lines.length * 10,
      });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const { data: invoice, error } = await supabase
    .from('invoices')
    // access_token is generated by the DB default.
    .insert({ booking_id, invoice_type, subtotal, total: subtotal })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        {
          error: `Booking ini sudah memiliki invoice ${invoice_type === 'dp' ? 'DP' : 'final'} yang aktif`,
        },
        { status: 409 },
      );
    }
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
  const supabase = await createServerSupabase();

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

  // ---------- save-lines (draft only — issued is frozen) ----------
  if (action === 'save-lines') {
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Hanya draft yang dapat diubah — invoice terbit tidak bisa diedit' },
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

    const subtotal = parsed.lines.reduce(
      (s, l) => s + l.quantity * l.unit_price,
      0,
    );

    // Replace-all: rewriting the whole line set is simpler than diffing.
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

    const { data: updated, error: updError } = await supabase
      .from('invoices')
      .update({
        due_date,
        notes,
        bank_account_id,
        subtotal,
        total: subtotal,
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

  // ---------- issue (draft only — freezing) ----------
  if (action === 'issue') {
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Invoice sudah diterbitkan' },
        { status: 409 },
      );
    }

    // Full rows — these same items are echoed back in the response,
    // and the client rebuilds its editable lines from them.
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
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
      .select('status, customer_name, phone, event_address, event_date')
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
          customer_name_snapshot: booking.customer_name,
          phone_snapshot: booking.phone,
          event_address_snapshot: booking.event_address,
          event_date_snapshot: booking.event_date,
          subtotal,
          total: subtotal,
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (!issueError) {
        // Issue flips the public page from 404 (drafts are invisible)
        // to a live invoice — purge the cached 404.
        await revalidateInvoices();
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

  // ---------- record-payment (issued only — writes a ledger row) ----------
  if (action === 'record-payment') {
    if (invoice.status !== 'issued') {
      return NextResponse.json(
        { error: 'Pembayaran hanya dicatat pada invoice yang terbit' },
        { status: 409 },
      );
    }

    const amount = Number(body.amount);
    const paid = await paidAmount(supabase, invoice.id);
    const balanceDue = Number(invoice.total) - paid;

    if (!Number.isFinite(amount) || amount <= 0 || amount > balanceDue) {
      return NextResponse.json(
        { error: `Nominal pembayaran harus di antara 0 dan sisa tagihan (${balanceDue})` },
        { status: 400 },
      );
    }

    // Payments land in the ledger as `in` rows under the Customer
    // payment category — seeded with the ledger, so it exists.
    const { data: category } = await supabase
      .from('transaction_categories')
      .select('id')
      .eq('name', 'Customer payment')
      .eq('direction', 'in')
      .limit(1)
      .maybeSingle();

    if (!category) {
      return NextResponse.json(
        { error: 'Kategori "Customer payment" tidak ditemukan — tambahkan di pengaturan Kas' },
        { status: 400 },
      );
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        direction: 'in',
        amount,
        transaction_date:
          typeof body.transaction_date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(body.transaction_date)
            ? body.transaction_date
            : new Date().toISOString().slice(0, 10),
        category_id: category.id,
        account: typeof body.account === 'string' && body.account.trim() !== ''
          ? body.account.trim()
          : null,
        description: `Pembayaran invoice ${invoice.invoice_number ?? ''}`.trim(),
        booking_id: invoice.booking_id,
        invoice_id: invoice.id,
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Settled → paid; otherwise the invoice stays issued. The row is
    // never edited — status follows the ledger, nothing else changes.
    const newPaid = paid + amount;
    const { data: updated, error: updError } = await supabase
      .from('invoices')
      .update({ status: newPaid >= Number(invoice.total) ? 'paid' : 'issued' })
      .eq('id', invoice.id)
      .select()
      .single();

    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    // amount_paid / balance_due / status render live on the public
    // page — purge so it can't keep showing the pre-payment figures.
    await revalidateInvoices();
    return NextResponse.json({
      invoice: updated,
      transaction,
      paid: newPaid,
      balance_due: Math.max(Number(invoice.total) - newPaid, 0),
    });
  }

  // ---------- void (issued | paid — the correction path) ----------
  if (action === 'void') {
    if (invoice.status !== 'issued' && invoice.status !== 'paid') {
      return NextResponse.json(
        { error: 'Hanya invoice terbit atau lunas yang dapat dibatalkan' },
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

    // Void turns the old token's page into the "replaced" notice —
    // purge the cached full invoice.
    await revalidateInvoices();
    return NextResponse.json({ invoice: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
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
