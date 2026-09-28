import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Booking, Product } from "@/lib/types";
import BookingsTable from "@/components/admin/BookingsTable";
import { PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";

export default async function BookingsListPage() {
  const supabase = createServerSupabase();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, products(name)")
    .order("event_date", { ascending: true })
    .returns<(Booking & { products: Pick<Product, "name"> })[]>();

  return (
    <div>
      <PageHeader title="Daftar Booking" subtitle="Kelola semua booking acara">
        <Link href="/admin/bookings/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Booking
        </Link>
      </PageHeader>

      <BookingsTable rows={bookings ?? []} />
    </div>
  );
}
