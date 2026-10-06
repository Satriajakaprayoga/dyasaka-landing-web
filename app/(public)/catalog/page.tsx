import { supabase } from '@/lib/supabase';
import type { Category, Product, ProductImage } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import SortSelect from './SortSelect';
import { SORT_OPTIONS } from './sort-options';
import { BalloonIcon } from '@/components/BalloonIcon';

export const metadata: Metadata = {
  title: { absolute: 'Katalog — Dyasaka Decoration' },
  description:
    'Jelajahi koleksi dekorasi balon Dyasaka Decoration untuk ulang tahun, wedding, dan acara spesial lainnya.',
};

type SearchParams = {
  category?: string;
  min_price?: string;
  max_price?: string;
  q?: string;
  sort?: string;
  page?: string;
};

type FilterKey = 'q' | 'category' | 'min_price' | 'max_price' | 'sort' | 'page';

type ProductRow = Product & {
  product_images: Pick<ProductImage, 'image_url' | 'sort_order'>[];
  categories: Pick<Category, 'name'>;
};

const PAGE_SIZE = 12;

/** Build a /catalog URL, keeping current filters and applying overrides (null = remove). */
function buildHref(
  params: SearchParams,
  overrides: Partial<Record<FilterKey, string | null>> = {},
): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  if (merged.q) sp.set('q', merged.q);
  if (merged.category) sp.set('category', merged.category);
  if (merged.min_price) sp.set('min_price', merged.min_price);
  if (merged.max_price) sp.set('max_price', merged.max_price);
  if (merged.sort) sp.set('sort', merged.sort);
  const page = Number(merged.page) || 1;
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return `/catalog${qs ? `?${qs}` : ''}`;
}

async function getCategories() {
  const { data } = await supabase.from('categories').select('*').returns<Category[]>();
  return data ?? [];
}

async function getProducts(params: SearchParams) {
  let query = supabase
    .from('products')
    .select('*, product_images(image_url, sort_order), categories(name)')
    .eq('is_active', true);

  if (params.category) {
    query = query.eq('category_id', params.category);
  }

  const minPrice = Number(params.min_price);
  if (params.min_price && Number.isFinite(minPrice)) {
    query = query.gte('price', minPrice);
  }
  const maxPrice = Number(params.max_price);
  if (params.max_price && Number.isFinite(maxPrice)) {
    query = query.lte('price', maxPrice);
  }

  // Keep only letters/numbers/spaces so the or() filter syntax can't be broken
  const q = params.q?.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
  if (q) {
    const conditions = q
      .split(/\s+/)
      .flatMap((term) => [`name.ilike.%${term}%`, `description.ilike.%${term}%`])
      .join(',');
    query = query.or(conditions);
  }

  switch (params.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true }).order('created_at', { ascending: false });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'name':
      query = query.order('name', { ascending: true }).order('created_at', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data } = await query;
  return (data ?? []) as ProductRow[];
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4-4" />
    </svg>
  );
}

const pillActive =
  'whitespace-nowrap rounded-full bg-pink-600 px-4 py-1.5 text-sm font-medium text-white';
const pillIdle =
  'whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 transition hover:border-pink-300 hover:text-pink-600';
const chip =
  'inline-flex items-center gap-1 rounded-full bg-pink-50 px-3 py-1.5 text-xs font-medium text-pink-700 transition hover:bg-pink-100';

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const [categories, products] = await Promise.all([getCategories(), getProducts(searchParams)]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageItems = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCategory = categories.find((c) => c.id === searchParams.category);
  const sortLabel = SORT_OPTIONS.find((o) => o.value === searchParams.sort)?.label;
  const hasFilters = Boolean(
    searchParams.q ||
      searchParams.category ||
      searchParams.min_price ||
      searchParams.max_price ||
      searchParams.sort,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Katalog</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dekorasi balon untuk setiap momen spesial Anda
          </p>
        </div>
        <p className="text-sm text-gray-500" aria-live="polite">
          {products.length} produk ditemukan
        </p>
      </div>

      {/* Search, sort, price */}
      <form method="get" className="mb-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Cari dekorasi balon…"
              aria-label="Cari produk"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-700 active:scale-95"
          >
            <SearchIcon className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SortSelect defaultValue={searchParams.sort ?? ''} />
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none select-none items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition hover:border-pink-300 hover:text-pink-600 [&::-webkit-details-marker]:hidden">
              Harga
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 text-gray-400"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="absolute left-0 z-10 mt-2 w-64 rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="min_price"
                  min={0}
                  placeholder="Min"
                  defaultValue={searchParams.min_price}
                  aria-label="Harga minimum"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                />
                <span className="text-gray-400">&ndash;</span>
                <input
                  type="number"
                  name="max_price"
                  min={0}
                  placeholder="Maks"
                  defaultValue={searchParams.max_price}
                  aria-label="Harga maksimum"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                />
              </div>
              <button
                type="submit"
                className="mt-3 w-full rounded-lg bg-pink-600 py-2 text-sm font-medium text-white transition hover:bg-pink-700"
              >
                Terapkan
              </button>
            </div>
          </details>
        </div>
      </form>

      {/* Category pills */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={buildHref(searchParams, { category: null, page: null })}
          className={searchParams.category ? pillIdle : pillActive}
          aria-current={searchParams.category ? undefined : 'true'}
        >
          Semua
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={buildHref(searchParams, { category: c.id, page: null })}
            aria-current={searchParams.category === c.id ? 'true' : undefined}
            className={searchParams.category === c.id ? pillActive : pillIdle}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {searchParams.q && (
            <Link href={buildHref(searchParams, { q: null, page: null })} className={chip} title="Hapus filter pencarian">
              &ldquo;{searchParams.q}&rdquo; <span aria-hidden="true">&times;</span>
            </Link>
          )}
          {activeCategory && (
            <Link href={buildHref(searchParams, { category: null, page: null })} className={chip} title="Hapus filter kategori">
              {activeCategory.name} <span aria-hidden="true">&times;</span>
            </Link>
          )}
          {searchParams.min_price && Number.isFinite(Number(searchParams.min_price)) && (
            <Link href={buildHref(searchParams, { min_price: null, page: null })} className={chip} title="Hapus harga minimum">
              Min Rp {Number(searchParams.min_price).toLocaleString('id-ID')} <span aria-hidden="true">&times;</span>
            </Link>
          )}
          {searchParams.max_price && Number.isFinite(Number(searchParams.max_price)) && (
            <Link href={buildHref(searchParams, { max_price: null, page: null })} className={chip} title="Hapus harga maksimum">
              Maks Rp {Number(searchParams.max_price).toLocaleString('id-ID')} <span aria-hidden="true">&times;</span>
            </Link>
          )}
          {searchParams.sort && sortLabel && (
            <Link href={buildHref(searchParams, { sort: null, page: null })} className={chip} title="Hapus urutan">
              {sortLabel} <span aria-hidden="true">&times;</span>
            </Link>
          )}
          <Link href="/catalog" className="ml-1 text-sm font-medium text-pink-600 hover:underline">
            Reset semua
          </Link>
        </div>
      )}

      {/* Results */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <BalloonIcon className="h-12 w-12 text-pink-200" />
          <p className="mt-4 font-medium text-gray-900">Tidak ada produk yang cocok</p>
          <p className="mt-1 max-w-xs text-sm text-gray-500">
            Coba ubah kata kunci atau harga, atau lihat semua produk katalog.
          </p>
          {hasFilters && (
            <Link
              href="/catalog"
              className="mt-5 rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700"
            >
              Reset semua filter
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {pageItems.map((product, index) => {
              const cover = [...product.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-pink-50">
                    {cover ? (
                      <Image
                        src={cover.image_url}
                        alt={product.name}
                        fill
                        priority={index < 3}
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-pink-300">
                        <BalloonIcon className="h-10 w-10" />
                        <span className="text-xs">Tanpa foto</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    {product.categories?.name && (
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        {product.categories.name}
                      </p>
                    )}
                    <h2 className="line-clamp-2 font-semibold leading-snug text-gray-900 transition group-hover:text-pink-600">
                      {product.name}
                    </h2>
                    <p className="pt-1 font-bold text-pink-600">
                      Rp {product.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Navigasi halaman">
              {page > 1 ? (
                <Link
                  href={buildHref(searchParams, { page: String(page - 1) })}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-pink-300 hover:text-pink-600"
                >
                  &lsaquo; Sebelumnya
                </Link>
              ) : (
                <span className="rounded-xl border border-gray-100 px-4 py-2 text-sm text-gray-300">
                  &lsaquo; Sebelumnya
                </span>
              )}
              <span className="text-sm text-gray-500">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildHref(searchParams, { page: String(page + 1) })}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-pink-300 hover:text-pink-600"
                >
                  Selanjutnya &rsaquo;
                </Link>
              ) : (
                <span className="rounded-xl border border-gray-100 px-4 py-2 text-sm text-gray-300">
                  Selanjutnya &rsaquo;
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
