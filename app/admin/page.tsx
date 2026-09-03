import { createServerSupabase } from '@/lib/supabase-server';
import Link from 'next/link';

export default async function AdminHomePage() {
  const supabase = createServerSupabase();

  const [{ count: productCount }, { count: pendingBookings }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const cards = [
    { href: '/admin/products', label: 'Produk', sub: `${productCount ?? 0} produk` },
    { href: '/admin/bookings/new', label: 'Tambah Booking', sub: 'Catat booking baru' },
    { href: '/admin/bookings', label: 'Daftar Booking', sub: `${pendingBookings ?? 0} pending` },
    { href: '/admin/categories', label: 'Kategori', sub: 'Kelola kategori produk' },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Dashboard Admin</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="border rounded-lg p-5 hover:shadow-md transition block"
          >
            <div className="font-medium">{c.label}</div>
            <div className="text-gray-500 text-sm mt-1">{c.sub}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
