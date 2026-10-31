import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Booking, ChecklistItem, Product } from "@/lib/types";
import BookingItemsPanel, {
  type BookingCatalogItem,
  type BookingItemRow,
} from "@/components/admin/BookingItemsPanel";
import ChecklistPanel from "@/components/admin/ChecklistPanel";
import BookingDetailActions, {
  type InvoiceRef,
} from "@/components/admin/BookingDetailActions";
import BookingStaffPanel, {
  type StaffAssignmentRow,
} from "@/components/admin/BookingStaffPanel";
import {
  BackLink,
  Badge,
  BookingStatusBadge,
  Breadcrumbs,
  Card,
  ProjectStatusBadge,
  formatDate,
  formatDateTime,
  formatRupiah,
} from "@/components/admin/ui";
import { BookingPanelsSkeleton } from "@/components/admin/skeletons";

type BookingWithProduct = Booking & {
  products: Pick<Product, "name" | "vendor_price"> | null;
};

export default async function BookingDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const supabase = await createServerSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, products(name, vendor_price)")
    .eq("id", params.id)
    .single();

  if (!booking) {
    notFound();
  }

  // Several invoices per booking (dp + final) — the action buttons show
  // one slot per type, so fetch every invoice's type and status.
  const { data: invoiceRefs } = await supabase
    .from("invoices")
    .select("id, status, invoice_type")
    .eq("booking_id", params.id)
    .order("created_at");

  const b = booking as BookingWithProduct;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Booking", href: "/admin/bookings" },
            { label: b.customer_name },
          ]}
        />
        <BackLink href="/admin/bookings" />
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              {b.customer_name}
            </h1>
            <BookingStatusBadge status={b.status} />
            <ProjectStatusBadge status={b.project_status} />
            {b.dp_received_at ? (
              <Badge tone="green">
                DP {formatDateTime(b.dp_received_at)}
              </Badge>
            ) : (
              <Badge tone="amber">DP Belum</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {b.products?.name ?? "Booking custom"} ·{" "}
            {formatDate(b.event_date)}
          </p>
        </div>
        <BookingDetailActions
          bookingId={b.id}
          dpReceivedAt={b.dp_received_at}
          projectStatus={b.project_status}
          invoices={(invoiceRefs ?? []) as InvoiceRef[]}
        />
      </div>

      <Card className="mb-6 p-5">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Telepon
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">{b.phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Tanggal Acara
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {formatDate(b.event_date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Produk
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {b.products?.name ?? "— Custom / tanpa paket —"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Biaya Transport
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {b.transport_fee != null ? formatRupiah(b.transport_fee) : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Alamat Acara
            </dt>
            <dd className="mt-0.5 whitespace-pre-line text-sm text-gray-900">
              {b.event_address}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Tema
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">{b.theme ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              DP Diterima
            </dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {b.dp_received_at ? formatDateTime(b.dp_received_at) : "—"}
            </dd>
          </div>
          {b.message && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Pesan / Catatan
              </dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-gray-900">
                {b.message}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <Suspense fallback={<BookingPanelsSkeleton />}>
        <BookingPanelsSection
          bookingId={b.id}
          eventDate={b.event_date}
          dpReceivedAt={b.dp_received_at}
          transportFee={b.transport_fee}
          productVendorPrice={b.products?.vendor_price ?? null}
          customerName={b.customer_name}
        />
      </Suspense>
    </div>
  );
}

async function BookingPanelsSection({
  bookingId,
  eventDate,
  dpReceivedAt,
  transportFee,
  productVendorPrice,
  customerName,
}: {
  bookingId: string;
  eventDate: string;
  dpReceivedAt: string | null;
  transportFee: number | null;
  productVendorPrice: number | null;
  customerName: string;
}) {
  const supabase = await createServerSupabase();

  const [
    itemsRes,
    checklistRes,
    sameDayRes,
    catalogRes,
    staffRes,
    assignmentsRes,
    categoriesRes,
    txRes,
    finalInvoiceRes,
  ] = await Promise.all([
    supabase
      .from("booking_items")
      .select(
        "*, item_variants(color, size, cost_price, items(name, type, quantity_owned))",
      )
      .eq("booking_id", bookingId)
      .order("id"),
    supabase
      .from("checklist_items")
      .select("*")
      .eq("booking_id", bookingId)
      .order("sort_order"),
    supabase
      .from("bookings")
      .select("id")
      .eq("event_date", eventDate)
      .eq("status", "confirmed")
      .neq("id", bookingId),
    supabase
      .from("items")
      .select(
        "id, name, item_category, type, quantity_owned, item_variants(id, color, size, current_price)",
      )
      .order("name"),
    supabase.from("staff").select("*").eq("is_active", true).order("name"),
    supabase
      .from("booking_staff")
      .select("*, staff:staff(name)")
      .eq("booking_id", bookingId)
      .order("created_at"),
    supabase
      .from("transaction_categories")
      .select("*")
      .eq("is_active", true)
      .eq("direction", "out")
      .order("sort_order"),
    supabase
      .from("transactions")
      .select("direction, amount, purchase_order_id, booking_staff_id")
      .eq("booking_id", bookingId),
    // Expected revenue prefers the live final invoice's frozen total.
    supabase
      .from("invoices")
      .select("total")
      .eq("booking_id", bookingId)
      .eq("invoice_type", "final")
      .in("status", ["issued", "paid"])
      .maybeSingle(),
  ]);

  // Child→parent embeds come back as objects, not arrays.
  const items = (itemsRes.data ?? []) as unknown as BookingItemRow[];
  const checklist = (checklistRes.data ?? []) as ChecklistItem[];
  const catalog = (catalogRes.data ?? []) as unknown as BookingCatalogItem[];
  const assignments = (assignmentsRes.data ?? []) as unknown as StaffAssignmentRow[];
  const txRows = txRes.data ?? [];

  // Confirmed same-date demand per variant (other bookings only), so the
  // panel can warn when rentables are over-demanded.
  const sameDayIds = (sameDayRes.data ?? []).map((r) => r.id);
  const demand: Record<string, number> = {};
  if (sameDayIds.length > 0) {
    const { data: demandRows } = await supabase
      .from("booking_items")
      .select("item_variant_id, quantity")
      .in("booking_id", sameDayIds);

    for (const row of demandRows ?? []) {
      demand[row.item_variant_id] =
        (demand[row.item_variant_id] ?? 0) + row.quantity;
    }
  }

  // Actual helper pay, read from the ledger — never typed by hand.
  const paidByAssignment: Record<string, number> = {};
  let helpersActual = 0;
  for (const t of txRows) {
    if (t.direction === "out" && t.booking_staff_id) {
      paidByAssignment[t.booking_staff_id] =
        (paidByAssignment[t.booking_staff_id] ?? 0) + Number(t.amount);
      helpersActual += Number(t.amount);
    }
  }

  // Double-booking warning: the same person, same date, another
  // non-cancelled booking. Warning only — never blocks (doc §13).
  const doubleBooked: Record<string, string[]> = {};
  const staffIds = [...new Set(assignments.map((a) => a.staff_id))];
  if (staffIds.length > 0) {
    const { data: sameDateBookings } = await supabase
      .from("bookings")
      .select("id, customer_name")
      .eq("event_date", eventDate)
      .neq("id", bookingId)
      .neq("status", "cancelled");

    const otherIds = (sameDateBookings ?? []).map((b) => b.id);
    if (otherIds.length > 0) {
      const { data: otherAssignments } = await supabase
        .from("booking_staff")
        .select("staff_id, booking_id")
        .in("booking_id", otherIds)
        .in("staff_id", staffIds)
        .neq("status", "cancelled");

      const nameByBooking = new Map(
        (sameDateBookings ?? []).map((b) => [b.id, b.customer_name]),
      );
      for (const oa of otherAssignments ?? []) {
        const name = nameByBooking.get(oa.booking_id);
        if (!name) continue;
        (doubleBooked[oa.staff_id] ??= []).push(name);
      }
    }
  }

  // ---------- Margin per event (doc §14) ----------
  // Goods-purchase payments tied to a purchase order are cashflow-only:
  // material cost already enters here through the cost snapshot.
  const bookingTotal =
    items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0) +
    (transportFee ?? 0);
  const expectedRevenue =
    finalInvoiceRes.data?.total != null
      ? Number(finalInvoiceRes.data.total)
      : bookingTotal;

  const materialsExpected = items
    .filter((it) => it.item_variants?.items?.type === "consumable")
    .reduce(
      (s, it) =>
        s +
        it.quantity *
          Number(it.unit_cost ?? it.item_variants?.cost_price ?? 0),
      0,
    );
  const vendorExpected = productVendorPrice ?? 0;
  const helpersExpected = assignments
    .filter((a) => a.status !== "cancelled")
    .reduce((s, a) => s + Number(a.planned_pay), 0);
  const expectedCosts = materialsExpected + vendorExpected + helpersExpected;

  const actualRevenue = txRows
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + Number(t.amount), 0);
  const otherActual = txRows
    .filter((t) => t.direction === "out" && t.purchase_order_id == null && !t.booking_staff_id)
    .reduce((s, t) => s + Number(t.amount), 0);
  const actualCosts = helpersActual + otherActual;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BookingItemsPanel
        bookingId={bookingId}
        items={items}
        catalog={catalog}
        demand={demand}
      />
      <ChecklistPanel
        bookingId={bookingId}
        items={checklist}
        bookingItems={items}
        dpReceivedAt={dpReceivedAt}
      />
      <BookingStaffPanel
        bookingId={bookingId}
        bookingLabel={customerName}
        staff={staffRes.data ?? []}
        assignments={assignments}
        paidByAssignment={paidByAssignment}
        doubleBooked={doubleBooked}
        categories={categoriesRes.data ?? []}
      />
      <BookingMarginPanel
        expectedRevenue={expectedRevenue}
        actualRevenue={actualRevenue}
        materialsExpected={materialsExpected}
        vendorExpected={vendorExpected}
        helpersExpected={helpersExpected}
        helpersActual={helpersActual}
        otherActual={otherActual}
        expectedCosts={expectedCosts}
        actualCosts={actualCosts}
        hasFinalInvoice={finalInvoiceRes.data != null}
      />
    </div>
  );
}

function BookingMarginPanel({
  expectedRevenue,
  actualRevenue,
  materialsExpected,
  vendorExpected,
  helpersExpected,
  helpersActual,
  otherActual,
  expectedCosts,
  actualCosts,
  hasFinalInvoice,
}: {
  expectedRevenue: number;
  actualRevenue: number;
  materialsExpected: number;
  vendorExpected: number;
  helpersExpected: number;
  helpersActual: number;
  otherActual: number;
  expectedCosts: number;
  actualCosts: number;
  hasFinalInvoice: boolean;
}) {
  const expectedMargin = expectedRevenue - expectedCosts;
  const actualMargin = actualRevenue - actualCosts;

  const money = (n: number) => (
    <span className={n < 0 ? "text-red-600" : undefined}>{formatRupiah(n)}</span>
  );

  return (
    <Card>
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Margin Acara</p>
        <p className="text-xs text-gray-400">
          Estimasi sebelum acara vs kenyataan dari buku kas
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 font-medium">Pos</th>
            <th className="px-4 py-2 text-right font-medium">Diperkirakan</th>
            <th className="px-4 py-2 text-right font-medium">Aktual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          <tr>
            <td className="px-4 py-2 text-gray-700">
              Pendapatan
              {!hasFinalInvoice && (
                <span className="block text-xs text-gray-400">
                  dari total booking
                </span>
              )}
            </td>
            <td className="px-4 py-2 text-right">{money(expectedRevenue)}</td>
            <td className="px-4 py-2 text-right">{money(actualRevenue)}</td>
          </tr>
          <tr>
            <td className="px-4 py-2 text-gray-700">Bahan (consumable)</td>
            <td className="px-4 py-2 text-right">{money(materialsExpected)}</td>
            <td className="px-4 py-2 text-right text-gray-300">—</td>
          </tr>
          <tr>
            <td className="px-4 py-2 text-gray-700">Vendor</td>
            <td className="px-4 py-2 text-right">{money(vendorExpected)}</td>
            <td className="px-4 py-2 text-right text-gray-300">—</td>
          </tr>
          <tr>
            <td className="px-4 py-2 text-gray-700">Helper / staff</td>
            <td className="px-4 py-2 text-right">{money(helpersExpected)}</td>
            <td className="px-4 py-2 text-right">{money(helpersActual)}</td>
          </tr>
          <tr>
            <td className="px-4 py-2 text-gray-700">Biaya lain terkait</td>
            <td className="px-4 py-2 text-right text-gray-300">—</td>
            <td className="px-4 py-2 text-right">{money(otherActual)}</td>
          </tr>
          <tr>
            <td className="px-4 py-2 font-medium text-gray-900">Total biaya</td>
            <td className="px-4 py-2 text-right font-medium">
              {money(expectedCosts)}
            </td>
            <td className="px-4 py-2 text-right font-medium">
              {money(actualCosts)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <td className="px-4 py-3 font-semibold text-gray-900">Margin</td>
            <td className="px-4 py-3 text-right font-semibold">
              {money(expectedMargin)}
            </td>
            <td
              className={`px-4 py-3 text-right font-semibold ${
                actualMargin < 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              {money(actualMargin)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
        Pembelian barang via PO hanya dihitung di arus kas, tidak di margin —
        biaya bahan sudah masuk lewat harga pokok. Gaji tetap tidak dihitung
        kecuali ditautkan ke booking ini.
      </p>
    </Card>
  );
}
