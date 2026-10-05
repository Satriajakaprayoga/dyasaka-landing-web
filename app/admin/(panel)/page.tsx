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
} from "@/components/admin/ui";
import {
  CalendarIcon,
  PackageIcon,
  PlusIcon,
  TagIcon,
} from "@/components/admin/icons";
import {
  StatsGridSkeleton,
  UpcomingBookingsSkeleton,
} from "@/components/admin/skeletons";

export default function AdminHomePage() {
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
    </div>
  );
}

async function StatsGrid() {
  const supabase = createServerSupabase();

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
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: upcoming } = await supabase
    .from("bookings")
    .select("*, products(name)")
    .gte("event_date", today)
    .order("event_date")
    .limit(5)
    .returns<(Booking & { products: Pick<Product, "name"> })[]>();

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
                    {b.products?.name}
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
