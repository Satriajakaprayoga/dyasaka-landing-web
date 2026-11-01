import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { recomputePlanStatus } from '@/lib/plan-status';

/**
 * Purchase orders (§11) — the bridge between plans, ledger and
 * inventory. A PO is a COMMITMENT to a supplier; plans stay editable
 * intentions. Receiving a line writes a stock movement (`restock` for
 * consumables, `purchased` for rentables) so stock never drifts from
 * the purchase; paying writes ONE ledger `out` row carrying
 * purchase_order_id — cashflow only, never event margin (the material
 * cost enters margin through the cost snapshot).
 *
 * POST   { supplier_id, lines[], booking_id?, expected_date?, note? }
 *          → draft; lines may carry plan_line_id (link that plan line
 *          to its new order line)
 * PATCH  { id, action, … } → dispatch:
 *          save (draft|ordered) | order | receive | cancel | pay
 * DELETE ?id= → delete draft
 */

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type LineInput = {
  item_variant_id?: unknown;
  quantity_ordered?: unknown;
  unit_cost?: unknown;
  plan_line_id?: unknown;
};

function parseLines(raw: unknown):
  | { lines: { item_variant_id: string; quantity_ordered: number; unit_cost: number; plan_line_id: string | null }[] }
  | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Lines harus berupa array' };
  if (raw.length === 0) return { error: 'Minimal satu baris pesanan' };

  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as LineInput;
    const item_variant_id = clean(row.item_variant_id);
    if (!item_variant_id) {
      return { error: `Baris ${i + 1}: varian wajib dipilih` };
    }

    const quantity_ordered = Number(row.quantity_ordered);
    if (!Number.isInteger(quantity_ordered) || quantity_ordered <= 0) {
      return { error: `Baris ${i + 1}: jumlah harus bilangan bulat > 0` };
    }

    const unit_cost = Number(row.unit_cost);
    if (!Number.isFinite(unit_cost) || unit_cost < 0) {
      return { error: `Baris ${i + 1}: harga pokok tidak boleh negatif` };
    }

    lines.push({
      item_variant_id,
      quantity_ordered,
      unit_cost,
      plan_line_id: clean(row.plan_line_id),
    });
  }
  return { lines };
}

/** Paid so far = Σ ledger `out` rows linked to this order. */
async function paidAmount(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  orderId: string,
): Promise<number> {
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('purchase_order_id', orderId)
    .eq('direction', 'out');

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

  const supplier_id = clean(body.supplier_id);
  if (!supplier_id) {
    return NextResponse.json(
      { error: 'Supplier wajib dipilih' },
      { status: 400 },
    );
  }

  const parsed = parseLines(body.lines);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', supplier_id)
    .maybeSingle();

  if (!supplier) {
    return NextResponse.json({ error: 'Supplier tidak ditemukan' }, { status: 400 });
  }

  const expected_date = clean(body.expected_date);
  if (expected_date && !ISO_DATE.test(expected_date)) {
    return NextResponse.json({ error: 'Tanggal target tidak valid' }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id,
      booking_id: clean(body.booking_id),
      status: 'draft',
      expected_date,
      note: clean(body.note),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Booking tidak ditemukan' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(
      parsed.lines.map((l) => ({
        purchase_order_id: order.id,
        item_variant_id: l.item_variant_id,
        quantity_ordered: l.quantity_ordered,
        unit_cost: l.unit_cost,
      })),
    )
    .select();

  if (itemsError || !items) {
    return NextResponse.json(
      { error: itemsError?.message ?? 'Gagal menyimpan baris' },
      { status: 500 },
    );
  }

  // Link plan lines to their new order lines (insertion order is
  // preserved by PostgREST), then recompute each affected plan.
  const planLineIds = parsed.lines
    .map((l) => l.plan_line_id)
    .filter((id): id is string => id != null);

  if (planLineIds.length > 0) {
    await Promise.all(
      planLineIds.map((planLineId, i) =>
        supabase
          .from('purchase_plan_lines')
          .update({ purchase_order_item_id: items[i].id })
          .eq('id', planLineId),
      ),
    );

    const { data: planLines } = await supabase
      .from('purchase_plan_lines')
      .select('plan_id')
      .in('id', planLineIds);

    const planIds = [...new Set((planLines ?? []).map((l) => l.plan_id))];
    await Promise.all(planIds.map((id) => recomputePlanStatus(supabase, id)));
  }

  return NextResponse.json({ order, items }, { status: 201 });
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

  const { data: order } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }

  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', order.id)
    .order('id');

  const orderItems = items ?? [];

  // ---------- save (draft|ordered — expected date / note) ----------
  if (action === 'save') {
    if (order.status !== 'draft' && order.status !== 'ordered') {
      return NextResponse.json(
        { error: 'Pesanan yang sudah mulai diterima tidak bisa diubah' },
        { status: 409 },
      );
    }

    const patch: Record<string, unknown> = {};
    if (body.expected_date !== undefined) {
      const expected = clean(body.expected_date);
      if (expected && !ISO_DATE.test(expected)) {
        return NextResponse.json(
          { error: 'Tanggal target tidak valid' },
          { status: 400 },
        );
      }
      patch.expected_date = expected;
    }
    if (body.note !== undefined) patch.note = clean(body.note);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('purchase_orders')
      .update(patch)
      .eq('id', order.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: updated });
  }

  // ---------- order (draft → ordered, the commitment) ----------
  if (action === 'order') {
    if (order.status !== 'draft') {
      return NextResponse.json(
        { error: 'Pesanan sudah dikirim ke supplier' },
        { status: 409 },
      );
    }

    const { data: updated, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'ordered', order_date: new Date().toISOString().slice(0, 10) })
      .eq('id', order.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: updated });
  }

  // ---------- receive (per-line, partial deliveries) ----------
  if (action === 'receive') {
    if (order.status !== 'ordered' && order.status !== 'partially_received') {
      return NextResponse.json(
        { error: 'Hanya pesanan terkirim yang bisa menerima barang' },
        { status: 409 },
      );
    }

    const raw = body.lines;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: 'Tentukan baris dan jumlah yang diterima' },
        { status: 400 },
      );
    }

    const byId = new Map(orderItems.map((it) => [it.id, it]));
    const updates: { itemId: string; variantId: string; qty: number }[] = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i] as { id?: unknown; quantity?: unknown };
      const item = byId.get(typeof row.id === 'string' ? row.id : '');
      if (!item) {
        return NextResponse.json(
          { error: `Baris ${i + 1}: tidak ditemukan di pesanan ini` },
          { status: 400 },
        );
      }

      const qty = Number(row.quantity);
      const remaining = item.quantity_ordered - item.quantity_received;
      if (!Number.isInteger(qty) || qty <= 0) {
        return NextResponse.json(
          { error: `Baris ${i + 1}: jumlah harus bilangan bulat > 0` },
          { status: 400 },
        );
      }
      if (qty > remaining) {
        return NextResponse.json(
          { error: `Baris ${i + 1}: melebihi sisa (${remaining})` },
          { status: 400 },
        );
      }

      updates.push({ itemId: item.id, variantId: item.item_variant_id, qty });
    }

    // Movement type follows the item: consumables restock, rentables
    // were purchased (real ownership change).
    const variantIds = [...new Set(updates.map((u) => u.variantId))];
    const { data: variants } = await supabase
      .from('item_variants')
      .select('id, stock_quantity, items(type)')
      .in('id', variantIds);

    const variantById = new Map(
      ((variants ?? []) as unknown as {
        id: string;
        stock_quantity: number;
        items: { type: string } | null;
      }[]).map((v) => [v.id, v]),
    );

    const poLabel = `PO ${order.order_date ?? order.created_at.slice(0, 10)}`;

    for (const u of updates) {
      const variant = variantById.get(u.variantId);
      const type = variant?.items?.type === 'consumable' ? 'restock' : 'purchased';

      const { error: mvError } = await supabase.from('stock_movements').insert({
        item_variant_id: u.variantId,
        type,
        quantity: u.qty,
        booking_id: order.booking_id,
        note: poLabel,
      });
      if (mvError) {
        return NextResponse.json({ error: mvError.message }, { status: 500 });
      }

      if (variant) {
        const { error: stockError } = await supabase
          .from('item_variants')
          .update({ stock_quantity: Number(variant.stock_quantity) + u.qty })
          .eq('id', u.variantId);
        if (stockError) {
          return NextResponse.json({ error: stockError.message }, { status: 500 });
        }
      }
    }

    // Booking-linked order: the matching stock-check rows the admin
    // marked need_order flip to in_stock automatically.
    if (order.booking_id) {
      const { data: bookingItems } = await supabase
        .from('booking_items')
        .select('id')
        .eq('booking_id', order.booking_id)
        .in('item_variant_id', variantIds);

      const bookingItemIds = (bookingItems ?? []).map((r) => r.id);
      if (bookingItemIds.length > 0) {
        await supabase
          .from('checklist_items')
          .update({ status: 'in_stock' })
          .eq('booking_id', order.booking_id)
          .eq('status', 'need_order')
          .in('booking_item_id', bookingItemIds);
      }
    }

    for (const u of updates) {
      const item = byId.get(u.itemId)!;
      const { error: updError } = await supabase
        .from('purchase_order_items')
        .update({ quantity_received: item.quantity_received + u.qty })
        .eq('id', u.itemId);
      if (updError) {
        return NextResponse.json({ error: updError.message }, { status: 500 });
      }
    }

    // Recompute the order status from the fresh line state.
    const { data: freshItems } = await supabase
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', order.id);

    const rows = freshItems ?? [];
    const allReceived =
      rows.length > 0 && rows.every((r) => r.quantity_received >= r.quantity_ordered);
    const anyReceived = rows.some((r) => r.quantity_received > 0);

    const nextStatus = allReceived
      ? 'received'
      : anyReceived
        ? 'partially_received'
        : order.status;

    const { data: updated, error: orderError } = await supabase
      .from('purchase_orders')
      .update({ status: nextStatus })
      .eq('id', order.id)
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // Plan lines fulfilled through this order may now be done.
    const { data: linkedPlanLines } = await supabase
      .from('purchase_plan_lines')
      .select('plan_id')
      .in(
        'purchase_order_item_id',
        orderItems.map((it) => it.id),
      );

    const planIds = [...new Set((linkedPlanLines ?? []).map((l) => l.plan_id))];
    await Promise.all(planIds.map((planId) => recomputePlanStatus(supabase, planId)));

    const { data: freshFull } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', order.id)
      .order('id');

    return NextResponse.json({ order: updated, items: freshFull ?? [] });
  }

  // ---------- cancel (nothing received yet) ----------
  if (action === 'cancel') {
    if (order.status !== 'draft' && order.status !== 'ordered') {
      return NextResponse.json(
        { error: 'Pesanan yang sudah mulai diterima tidak bisa dibatalkan' },
        { status: 409 },
      );
    }

    const { data: updated, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Unlink plan lines — a cancelled order is not "ordered".
    const { data: linked } = await supabase
      .from('purchase_plan_lines')
      .select('id, plan_id')
      .in(
        'purchase_order_item_id',
        orderItems.map((it) => it.id),
      );

    if (linked && linked.length > 0) {
      await supabase
        .from('purchase_plan_lines')
        .update({ purchase_order_item_id: null })
        .in(
          'id',
          linked.map((l) => l.id),
        );

      const planIds = [...new Set(linked.map((l) => l.plan_id))];
      await Promise.all(planIds.map((planId) => recomputePlanStatus(supabase, planId)));
    }

    return NextResponse.json({ order: updated });
  }

  // ---------- pay (one ledger row, cashflow only) ----------
  if (action === 'pay') {
    if (order.status === 'draft' || order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Hanya pesanan terkirim yang bisa dibayar' },
        { status: 409 },
      );
    }

    const amount = Number(body.amount);
    const total = orderItems.reduce(
      (s, it) => s + it.quantity_ordered * Number(it.unit_cost),
      0,
    );
    const paid = await paidAmount(supabase, order.id);
    const remaining = total - paid;

    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      return NextResponse.json(
        { error: `Nominal pembayaran harus di antara 0 dan sisa tagihan (${remaining})` },
        { status: 400 },
      );
    }

    const transaction_date = clean(body.transaction_date);
    if (transaction_date && !ISO_DATE.test(transaction_date)) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
    }

    const category_id = clean(body.category_id);
    let categoryId = category_id;
    if (!categoryId) {
      const { data: category } = await supabase
        .from('transaction_categories')
        .select('id')
        .eq('name', 'Goods purchase')
        .eq('direction', 'out')
        .limit(1)
        .maybeSingle();

      if (!category) {
        return NextResponse.json(
          { error: 'Kategori "Goods purchase" tidak ditemukan — tambahkan di pengaturan Kas' },
          { status: 400 },
        );
      }
      categoryId = category.id;
    }

    const { data: supplier } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', order.supplier_id)
      .maybeSingle();

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        direction: 'out',
        amount,
        transaction_date: transaction_date ?? new Date().toISOString().slice(0, 10),
        category_id: categoryId,
        account: clean(body.account),
        description: `Bayar pesanan ${supplier?.name ?? 'supplier'}`,
        // Informational — PO payments are excluded from event margin
        // regardless; the material cost enters through the snapshot.
        booking_id: order.booking_id,
        purchase_order_id: order.id,
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    const newPaid = paid + amount;

    return NextResponse.json({
      order,
      transaction,
      paid: newPaid,
      remaining: Math.max(total - newPaid, 0),
    });
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
    return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
  }

  const { data: order } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }
  if (order.status !== 'draft') {
    return NextResponse.json(
      { error: 'Hanya draft yang dapat dihapus — batalkan (cancel) yang sudah dikirim' },
      { status: 409 },
    );
  }

  // Plan-line links die with the order items (FK on delete set null);
  // statuses never regress, so no plan recompute is needed.
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
