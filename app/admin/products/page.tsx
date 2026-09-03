import { createServerSupabase } from '@/lib/supabase-server';
import Link from 'next/link';
import type { Product, Category } from '@/lib/types';

export default async function ProductsListPage() {
  const supabase = createServerSupabase();

  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name)')
    .order('created_at', { ascending: false })
    .returns<(Product & { categories: Pick<Category, 'name'> })[]>();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Produk</h1>
        <Link
          href="/admin/products/new"
          className="bg-pink-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-pink-700 transition"
        >
          + Tambah Produk
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Harga</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.categories?.name}</td>
                <td className="p-3">Rp {p.price.toLocaleString('id-ID')}</td>
                <td className="p-3">
                  <span
                    className={
                      'px-2 py-1 rounded text-xs font-medium ' +
                      (p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')
                    }
                  >
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
              </tr>
            ))}
            {(products ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">
                  Belum ada produk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
