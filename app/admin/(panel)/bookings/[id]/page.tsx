import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Booking, ChecklistItem, Product } from "@/lib/types";
import BookingItemsPanel, {
  type BookingCatalogItem,
  type BookingItemRow,
} from "@/components/admin/BookingItemsPanel";
import ChecklistPanel from "@/components/admin/ChecklistPanel";
import BookingDetailActions from "@/components/admin/BookingDetailActions";
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

type BookingWithProduct = Booking & { products: Pick<Product, "name"> | null };

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, products(name)")
    .eq("id", params.id)
    .single();

  if (!booking) {
    notFound();
  }

  // One invoice per booking — fetch just enough for the action button.
  const { data: invoiceRef } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("booking_id", params.id)
    .maybeSingle();

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
          invoiceId={invoiceRef?.id ?? null}
          invoiceStatus={invoiceRef?.status ?? null}
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
        />
      </Suspense>
    </div>
  );
}

async function BookingPanelsSection({
  bookingId,
  eventDate,
  dpReceivedAt,
}: {
  bookingId: string;
  eventDate: string;
  dpReceivedAt: string | null;
}) {
  const supabase = createServerSupabase();

  const [itemsRes, checklistRes, sameDayRes, catalogRes] = await Promise.all([
    supabase
      .from("booking_items")
      .select(
        "*, item_variants(color, size, items(name, type, quantity_owned))",
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
  ]);

  // Child→parent embeds come back as objects, not arrays.
  const items = (itemsRes.data ?? []) as unknown as BookingItemRow[];
  const checklist = (checklistRes.data ?? []) as ChecklistItem[];
  const catalog = (catalogRes.data ?? []) as unknown as BookingCatalogItem[];

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
    </div>
  );
}
