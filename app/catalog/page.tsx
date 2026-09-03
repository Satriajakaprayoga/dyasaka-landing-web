import { supabase } from '@/lib/supabase';
import type { Category, Product, ProductImage } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';

type SearchParams = {
  category?: string;
  min_price?: string;
  max_price?: string;
  q?: string;
};

async function getCategories() {
  const { data } = await supabase.from('categories').select('*').returns<Category[]>();
  return data ?? [];
}

async function getProducts(params: SearchParams) {
  let query = supabase
    .from('products')
    .select('*, product_images(image_url, sort_order)')
    .eq('is_active', true);

  if (params.category) {
    query = query.eq('category_id', params.category);
  }
  if (params.min_price) {
    query = query.gte('price', Number(params.min_price));
  }
  if (params.max_price) {
    query = query.lte('price', Number(params.max_price));
  }
  if (params.q) {
    query = query.ilike('name', `%${params.q}%`);
  }

  const { data } = await query.order('created_at', { ascending: false });
  return (data ?? []) as (Product & { product_images: Pick<ProductImage, 'image_url' | 'sort_order'>[] })[];
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const [categories, products] = await Promise.all([getCategories(), getProducts(searchParams)]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Katalog</h1>

      <form className="grid sm:grid-cols-4 gap-3 mb-8 bg-gray-50 p-4 rounded-lg" method="get">
        <input
          type="text"
          name="q"
          placeholder="Cari produk..."
          defaultValue={searchParams.q}
          className="border rounded px-3 py-2 sm:col-span-1"
        />
        <select name="category" defaultValue={searchParams.category ?? ''} className="border rounded px-3 py-2">
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="min_price"
          placeholder="Harga min"
          defaultValue={searchParams.min_price}
          className="border rounded px-3 py-2"
        />
        <input
          type="number"
          name="max_price"
          placeholder="Harga max"
          defaultValue={searchParams.max_price}
          className="border rounded px-3 py-2"
        />
        <button
          type="submit"
          className="sm:col-span-4 bg-pink-600 text-white rounded px-4 py-2 font-medium hover:bg-pink-700 transition"
        >
          Terapkan Filter
        </button>
      </form>

      {products.length === 0 ? (
        <p className="text-gray-500">Tidak ada produk yang cocok dengan filter ini.</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => {
            const cover = [...product.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="border rounded-lg overflow-hidden hover:shadow-md transition block"
              >
                <div className="relative aspect-square bg-gray-100">
                  {cover ? (
                    <Image src={cover.image_url} alt={product.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No photo
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-pink-600 font-medium mt-1">
                    Rp {product.price.toLocaleString('id-ID')}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
