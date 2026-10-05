'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import BookingForm from '@/components/admin/BookingForm';
import { BackLink, Breadcrumbs } from '@/components/admin/ui';

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
        <div className="flex items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/admin' },
              { label: 'Booking', href: '/admin/bookings' },
              { label: 'Tambah Booking' },
            ]}
          />
          <BackLink href="/admin/bookings" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Tambah Booking
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Catat booking baru dari percakapan WhatsApp
        </p>
      </div>

      <BookingForm products={products} />
    </div>
  );
}
