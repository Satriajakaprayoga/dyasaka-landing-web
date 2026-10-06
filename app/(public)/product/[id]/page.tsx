import { supabase } from '@/lib/supabase';
import { buildWhatsAppInquiryLink } from '@/lib/booking-helpers';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';
import ProductGallery from './ProductGallery';
import type { Product, ProductImage } from '@/lib/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

const BUSINESS_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_BUSINESS_WA_NUMBER ?? '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

type ProductWithCategory = Product & { categories: { name: string } | null };

type RecipeRow = {
  id: string;
  quantity: number;
  item_variants: {
    color: string | null;
    size: string | null;
    items: { name: string } | null;
  } | null;
};

type RecipeItem = { id: string; quantity: number; name: string; details: string };

/**
 * Single fetch shared by the page and generateMetadata (React cache
 * dedupes both calls into one DB roundtrip).
 */
const getProductData = cache(async (id: string) => {
  const [productRes, imagesRes, recipeRes] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('product_items')
      .select('id, quantity, item_variants(color, size, items(name))')
      .eq('product_id', id),
  ]);

  const product = (productRes.data ?? null) as ProductWithCategory | null;
  if (!product) return null;

  const images = (imagesRes.data ?? []) as ProductImage[];
  // Untyped client infers embeds as arrays; PostgREST returns objects for
  // child→parent embeds (product_items → item_variants → items).
  const recipe = (recipeRes.data ?? []) as unknown as RecipeRow[];

  return { product, images, recipe };
});

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getProductData(params.id);
  if (!result) {
    return { title: { absolute: 'Produk tidak ditemukan — Dyasaka Decoration' } };
  }
  return {
    title: { absolute: `${result.product.name} — Dyasaka Decoration` },
    description:
      result.product.description ??
      `Sewa dekorasi balon ${result.product.name} dari Dyasaka Decoration untuk ulang tahun, wedding, dan acara spesial lainnya.`,
  };
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function toRecipeItems(recipe: RecipeRow[]): RecipeItem[] {
  return recipe
    .map((row) => {
      const variant = row.item_variants;
      const name = variant?.items?.name;
      if (!name) return null;
      const details = [variant?.color, variant?.size].filter(Boolean).join(', ');
      return { id: row.id, quantity: row.quantity, name, details };
    })
    .filter((item): item is RecipeItem => item !== null);
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const result = await getProductData(params.id);
  if (!result) return notFound();

  const { product, images, recipe } = result;
  const recipeItems = toRecipeItems(recipe);
  const categoryName = product.categories?.name ?? null;

  const waLink = buildWhatsAppInquiryLink({
    phoneNumber: BUSINESS_WHATSAPP_NUMBER,
    productName: product.name,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length > 0 ? { image: images.map((img) => img.image_url) } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: product.price,
      availability: 'https://schema.org/InStock',
      ...(SITE_URL ? { url: `${SITE_URL}/product/${product.id}` } : {}),
    },
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-pink-600"
      >
        &lsaquo; Kembali ke Katalog
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery name={product.name} images={images} />

        {/* Buy box */}
        <div>
          {categoryName && (
            <p className="text-[11px] font-medium uppercase tracking-wider text-pink-600">
              {categoryName}
            </p>
          )}
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-gray-900">
            {product.name}
          </h1>
          <p className="mt-3 text-3xl font-bold text-pink-600">
            Rp {product.price.toLocaleString('id-ID')}
          </p>

          {product.description && (
            <div className="mt-8">
              <h2 className="font-semibold text-gray-900">Deskripsi</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {product.description}
              </p>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <h2 className="font-semibold text-gray-900">Tertarik dengan paket ini?</h2>
            <p className="mt-1 text-sm text-gray-500">
              Konsultasi tema, tanggal, dan harga langsung dengan admin kami.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.98]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Tanya via WhatsApp
            </a>
          </div>

          {recipeItems.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold text-gray-900">Paket Termasuk</h2>
              <ul className="mt-3 space-y-2">
                {recipeItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>
                      <span className="font-semibold text-gray-900">{item.quantity}&times;</span>{' '}
                      {item.name}
                      {item.details && <span className="text-gray-400"> &middot; {item.details}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Availability */}
      <section
        className="mt-12 border-t border-gray-100 pt-8"
        aria-labelledby="availability-heading"
      >
        <h2 id="availability-heading" className="text-lg font-semibold text-gray-900">
          Cek Ketersediaan Tanggal
        </h2>
        <p className="mt-1 max-w-lg text-sm text-gray-500">
          Hijau berarti tanggal masih tersedia, merah berarti sudah penuh. Pilih tanggal
          yang diinginkan, lalu konfirmasi lewat WhatsApp.
        </p>
        <div className="mt-5">
          <AvailabilityCalendar compact />
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
