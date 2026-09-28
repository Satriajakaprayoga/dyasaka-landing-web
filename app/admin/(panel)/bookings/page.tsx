import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Booking, Product } from "@/lib/types";
import {
  BookingStatusBadge,
  Card,
  EmptyState,
  PageHeader,
  btnPrimary,
  formatDate,
} from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";

export default async function BookingsListPage() {
  const supabase = createServerSupabase();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, products(name)")
    .order("event_date", { ascending: true })
    .returns<(Booking & { products: Pick<Product, "name"> })[]>();

  const rows = bookings ?? [];

  return (
    <div>
      <PageHeader title="Daftar Booking" subtitle="Kelola semua booking acara">
        <Link href="/admin/bookings/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Booking
        </Link>
      </PageHeader>

      <Card className="overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">Tema</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((b) => (
                  <tr key={b.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {formatDate(b.event_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.products?.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.theme ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {b.customer_name}
                      </span>
                      <div className="text-xs text-gray-400">{b.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada booking"
            subtitle="Catat booking pertama Anda untuk mulai mengelola jadwal."
          >
            <Link href="/admin/bookings/new" className={btnPrimary}>
              <PlusIcon className="h-4 w-4" />
              Tambah Booking
            </Link>
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
