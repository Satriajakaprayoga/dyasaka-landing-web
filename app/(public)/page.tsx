import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import type { Category, ProductImage } from '@/lib/types';
import { Hero } from '@/components/landing/Hero';
import { PackagesSection } from '@/components/landing/PackagesSection';
import { CategoryShowcase } from '@/components/landing/CategoryShowcase';
import {
  GallerySection,
  type GalleryImage,
} from '@/components/landing/GallerySection';
import { HowToOrder } from '@/components/landing/HowToOrder';
import { Testimonials } from '@/components/landing/Testimonials';
import { FaqSection } from '@/components/landing/FaqSection';
import { CtaBand } from '@/components/landing/CtaBand';
import type { LandingProduct } from '@/components/landing/ProductCard';

const FEATURED_LIMIT = 6;

// Unlike /catalog (dynamic via searchParams), nothing here opts out of
// prerendering by default — force dynamic so new/changed products appear
// without a rebuild (and the footer year stays current).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    absolute: 'Dyasaka Decoration — Dekorasi Balon untuk Momen Spesial',
  },
  description:
    'Jasa dekorasi balon untuk ulang tahun, pernikahan, baby shower, dan acara kantor. Lihat katalog paket dan cek ketersediaan tanggal acara Anda.',
  openGraph: {
    title: 'Dyasaka Decoration — Dekorasi Balon untuk Momen Spesial',
    description:
      'Jasa dekorasi balon untuk ulang tahun, pernikahan, baby shower, dan acara kantor. Lihat katalog paket dan cek ketersediaan tanggal acara Anda.',
    type: 'website',
    locale: 'id_ID',
  },
};

type GallerySource = Pick<ProductImage, 'image_url' | 'sort_order'>;

export default async function HomePage() {
  const [featured, categoryRows] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_images(image_url, sort_order), categories(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(FEATURED_LIMIT),
    supabase.from('categories').select('*'),
  ]);

  const products = (featured.data ?? []) as LandingProduct[];
  const categories = (categoryRows.data ?? []) as Category[];

  const galleryImages: GalleryImage[] = products
    .flatMap((p) =>
      [...p.product_images]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img: GallerySource) => ({
          url: img.image_url,
          productId: p.id,
          productName: p.name,
        })),
    )
    .slice(0, 9);

  return (
    <main>
      <Hero />
      {products.length > 0 && <PackagesSection products={products} />}
      {categories.length > 0 && <CategoryShowcase categories={categories} />}
      {galleryImages.length > 0 && <GallerySection images={galleryImages} />}
      <HowToOrder />
      <Testimonials />
      <FaqSection />
      <CtaBand />
    </main>
  );
}
