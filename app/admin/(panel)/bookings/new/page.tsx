'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import BookingForm from '@/components/admin/BookingForm';

export default function NewBookingPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tambah Booking</h1>
        <p className="mt-1 text-sm text-gray-500">
          Catat booking baru dari percakapan WhatsApp
        </p>
      </div>

      <BookingForm products={products} />
    </div>
  );
}
