import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Booking, Product } from "@/lib/types";
import BookingsTable from "@/components/admin/BookingsTable";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";
import { TableSkeleton } from "@/components/admin/skeletons";

export default function BookingsListPage() {
  return (
    <div>
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Booking" }]}
        />
      </div>
      <PageHeader title="Daftar Booking" subtitle="Kelola semua booking acara">
        <Link href="/admin/bookings/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Booking
        </Link>
      </PageHeader>

      <Suspense fallback={<TableSkeleton />}>
        <BookingsList />
      </Suspense>
    </div>
  );
}

async function BookingsList() {
  const supabase = createServerSupabase();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, products(name)")
    .order("event_date", { ascending: true })
    .returns<(Booking & { products: Pick<Product, "name"> })[]>();

  return <BookingsTable rows={bookings ?? []} />;
}
