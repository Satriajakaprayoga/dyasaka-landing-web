import { supabase } from '@/lib/supabase';
import { buildWhatsAppInquiryLink } from '@/lib/booking-helpers';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';
import type { Product, ProductImage } from '@/lib/types';
import Image from 'next/image';
import { notFound } from 'next/navigation';

const BUSINESS_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_BUSINESS_WA_NUMBER ?? '';

async function getProduct(id: string) {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle<Product>();

  if (!product) return null;

  const { data: images } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('sort_order', { ascending: true })
    .returns<ProductImage[]>();

  return { product, images: images ?? [] };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const result = await getProduct(params.id);
  if (!result) return notFound();

  const { product, images } = result;
  const waLink = buildWhatsAppInquiryLink({
    phoneNumber: BUSINESS_WHATSAPP_NUMBER,
    productName: product.name,
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
      <div>
        <div className="grid grid-cols-2 gap-2">
          {images.length > 0 ? (
            images.map((img) => (
              <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <Image src={img.image_url} alt={product.name} fill className="object-cover" />
              </div>
            ))
          ) : (
            <div className="col-span-2 aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              No photos yet
            </div>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="text-lg text-pink-600 font-medium mt-1">
          Rp {product.price.toLocaleString('id-ID')}
        </p>
        {product.description && (
          <p className="text-gray-600 mt-4 whitespace-pre-line">{product.description}</p>
        )}

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-6 bg-green-600 text-white font-medium px-5 py-3 rounded-lg hover:bg-green-700 transition"
        >
          Tanya via WhatsApp
        </a>

        <div className="mt-8">
          <h2 className="font-medium mb-3">Cek Ketersediaan Tanggal</h2>
          <AvailabilityCalendar compact />
        </div>
      </div>
    </main>
  );
}
