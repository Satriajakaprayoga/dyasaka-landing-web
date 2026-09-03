import { createServerSupabase } from '@/lib/supabase-server';
import Link from 'next/link';
import type { Booking, Product } from '@/lib/types';

export default async function BookingsListPage() {
  const supabase = createServerSupabase();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, products(name)')
    .order('event_date', { ascending: true })
    .returns<(Booking & { products: Pick<Product, 'name'> })[]>();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Daftar Booking</h1>
        <Link
          href="/admin/bookings/new"
          className="bg-pink-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-pink-700 transition"
        >
          + Tambah Booking
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Produk</th>
              <th className="p-3">Tema</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">{b.event_date}</td>
                <td className="p-3">{b.products?.name}</td>
                <td className="p-3">{b.theme ?? '—'}</td>
                <td className="p-3">
                  {b.customer_name}
                  <div className="text-gray-400">{b.phone}</div>
                </td>
                <td className="p-3">
                  <span
                    className={
                      'px-2 py-1 rounded text-xs font-medium ' +
                      (b.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : b.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : b.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600')
                    }
                  >
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
            {(bookings ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Belum ada booking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
