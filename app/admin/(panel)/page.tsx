import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Booking, Product } from "@/lib/types";
import {
  BookingStatusBadge,
  Card,
  EmptyState,
  btnPrimary,
  btnSecondary,
  formatDate,
} from "@/components/admin/ui";
import {
  CalendarIcon,
  PackageIcon,
  PlusIcon,
  TagIcon,
} from "@/components/admin/icons";
import {
  DashboardSectionSkeleton,
  StatsGridSkeleton,
  UpcomingBookingsSkeleton,
} from "@/components/admin/skeletons";

export default function AdminHomePage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ringkasan aktivitas Dyasaka Decoration
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products/new" className={btnSecondary}>
            <PlusIcon className="h-4 w-4" />
            Produk
          </Link>
          <Link href="/admin/bookings/new" className={btnPrimary}>
            <PlusIcon className="h-4 w-4" />
            Booking
          </Link>
        </div>
      </div>

      <Suspense fallback={<StatsGridSkeleton />}>
        <StatsGrid />
      </Suspense>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Booking Mendatang
          </h2>
          <Link
            href="/admin/bookings"
            className="text-sm text-gray-500 transition hover:text-gray-900"
          >
            Lihat semua &rarr;
          </Link>
        </div>
        <Suspense fallback={<UpcomingBookingsSkeleton />}>
          <UpcomingBookings />
        </Suspense>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Perlu Persiapan
          </h2>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <PrepNeeded today={today} />
          </Suspense>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Barang Keluar
          </h2>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <CheckedOutItems />
          </Suspense>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Stok Menipis
          </h2>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <LowStock />
          </Suspense>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Perlu Dipesan
          </h2>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <NeedOrder />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

async function StatsGrid() {
  const supabase = await createServerSupabase();

  const [
    { count: productCount },
    { count: pendingCount },
    { count: confirmedCount },
    { count: categoryCount },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
    supabase.from("categories").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    {
      label: "Produk",
      value: productCount ?? 0,
      href: "/admin/products",
      icon: PackageIcon,
      chip: "bg-gray-900 text-white",
    },
    {
      label: "Booking Pending",
      value: pendingCount ?? 0,
      href: "/admin/bookings",
      icon: CalendarIcon,
      chip: "bg-amber-100 text-amber-600",
    },
    {
      label: "Booking Confirmed",
      value: confirmedCount ?? 0,
      href: "/admin/bookings",
      icon: CalendarIcon,
      chip: "bg-green-100 text-green-600",
    },
    {
      label: "Kategori",
      value: categoryCount ?? 0,
      href: "/admin/categories",
      icon: TagIcon,
      chip: "bg-blue-100 text-blue-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <Link key={s.label} href={s.href}>
          <Card className="p-5 transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.chip}`}
              >
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold text-gray-900">
              {s.value}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">{s.label}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

async function UpcomingBookings() {
  const supabase = await createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: upcoming } = await supabase
    .from("bookings")
    .select("*, products(name)")
    .gte("event_date", today)
    .order("event_date")
    .limit(5)
    .returns<(Booking & { products: Pick<Product, "name"> | null })[]>();

  return (
    <Card>
      {upcoming && upcoming.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {upcoming.map((b) => {
            const date = new Date(`${b.event_date}T00:00:00`);
            const day = date.getDate();
            const month = date
              .toLocaleDateString("id-ID", { month: "short" })
              .toUpperCase();
            return (
              <li key={b.id} className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-900 text-white">
                  <span className="text-sm font-semibold leading-none">
                    {day}
                  </span>
                  <span className="text-[10px] leading-none tracking-wide">
                    {month}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {b.products?.name ?? "Booking custom"}
                    {b.theme ? ` — ${b.theme}` : ""}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {b.customer_name} · {b.event_address}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <BookingStatusBadge status={b.status} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Tidak ada booking mendatang"
          subtitle="Booking dengan tanggal hari ini atau setelahnya akan tampil di sini."
        >
          <Link href="/admin/bookings/new" className={btnPrimary}>
            <PlusIcon className="h-4 w-4" />
            Tambah Booking
          </Link>
        </EmptyState>
      )}
    </Card>
  );
}

// ---------- Operational sections (§5) ----------

/** DP-paid upcoming bookings whose pickup phase isn't finished yet. */
async function PrepNeeded({ today }: { today: string }) {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("bookings")
    .select("id, customer_name, event_date, checklist_items(phase, status)")
    .gte("event_date", today)
    .neq("status", "cancelled")
    .not("dp_received_at", "is", null)
    .order("event_date")
    .returns<{
      id: string;
      customer_name: string;
      event_date: string;
      checklist_items: { phase: string; status: string }[] | null;
    }[]>();

  const pending = (data ?? []).filter((b) =>
    (b.checklist_items ?? []).some(
      (c) => c.phase === "pickup" && c.status !== "done",
    ),
  );

  return (
    <Card>
      {pending.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {pending.map((b) => {
            const pickup = (b.checklist_items ?? []).filter(
              (c) => c.phase === "pickup",
            );
            const done = pickup.filter((c) => c.status === "done").length;
            return (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {b.customer_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(b.event_date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Pengambilan {done}/{pickup.length}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Tidak ada persiapan tertunda"
          subtitle="Semua booking ber-DP sudah lewat fase pengambilan."
        />
      )}
    </Card>
  );
}

/** Rentables currently out of the warehouse (checked_out). */
async function CheckedOutItems() {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("booking_items")
    .select(
      "id, booking_id, quantity, item_variants(color, size, items(name)), bookings(customer_name, event_date)",
    )
    .eq("rental_status", "checked_out")
    .order("checked_out_at")
    .limit(10);

  // Nested parent embeds (item_variants→items, booking_items→bookings)
  // come back as objects, not arrays.
  const rows = (data ?? []) as unknown as {
    id: string;
    booking_id: string;
    quantity: number;
    item_variants: {
      color: string | null;
      size: string | null;
      items: { name: string } | null;
    } | null;
    bookings: { customer_name: string; event_date: string } | null;
  }[];

  return (
    <Card>
      {rows.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => {
            const details = [row.item_variants?.color, row.item_variants?.size]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/bookings/${row.booking_id}`}
                  className="flex items-center justify-between gap-3 p-4 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {row.quantity}× {row.item_variants?.items?.name ?? "Item"}
                      {details && (
                        <span className="text-gray-400"> · {details}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {row.bookings?.customer_name} ·{" "}
                      {row.bookings && formatDate(row.bookings.event_date)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Di Luar
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Tidak ada barang di luar"
          subtitle="Barang sewa yang sedang keluar akan tampil di sini."
        />
      )}
    </Card>
  );
}

/** Variants at or below their reorder point. */
async function LowStock() {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("item_variants")
    .select("id, color, size, stock_quantity, reorder_point, items(id, name)")
    .order("stock_quantity");

  const rows = (data ?? []) as unknown as {
    id: string;
    color: string | null;
    size: string | null;
    stock_quantity: number;
    reorder_point: number | null;
    items: { id: string; name: string } | null;
  }[];

  // Same rule as the ItemsTable low-stock badge.
  const low = rows.filter(
    (v) => v.reorder_point != null && v.stock_quantity <= v.reorder_point,
  );

  return (
    <Card>
      {low.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {low.slice(0, 10).map((v) => {
            const details = [v.color, v.size].filter(Boolean).join(", ");
            return (
              <li key={v.id}>
                <Link
                  href={v.items ? `/admin/items/${v.items.id}` : "/admin/items"}
                  className="flex items-center justify-between gap-3 p-4 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {v.items?.name ?? "Item"}
                      {details && (
                        <span className="text-gray-400"> · {details}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Reorder point: {v.reorder_point}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-red-600">
                    {v.stock_quantity}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Stok aman"
          subtitle="Tidak ada varian di bawah reorder point."
        />
      )}
    </Card>
  );
}

/** stock_check rows marked "need_order" for DP-paid bookings. */
async function NeedOrder() {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("checklist_items")
    .select("id, label, bookings!inner(id, customer_name, event_date, dp_received_at)")
    .eq("phase", "stock_check")
    .eq("status", "need_order")
    .neq("bookings.status", "cancelled");

  const rows = (data ?? []) as unknown as {
    id: string;
    label: string;
    bookings: {
      id: string;
      customer_name: string;
      event_date: string;
      dp_received_at: string | null;
    };
  }[];

  const pending = rows.filter((r) => r.bookings.dp_received_at != null);

  return (
    <Card>
      {pending.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {pending.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/bookings/${r.bookings.id}`}
                className="flex items-center justify-between gap-3 p-4 transition hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {r.label}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {r.bookings.customer_name} ·{" "}
                    {formatDate(r.bookings.event_date)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                  Perlu Pesan
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Tidak ada pesanan tertunda"
          subtitle="Item bertanda &ldquo;Perlu Pesan&rdquo; akan tampil di sini."
        />
      )}
    </Card>
  );
}
