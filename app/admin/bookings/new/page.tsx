'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

export default function NewBookingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    product_id: '',
    customer_name: '',
    phone: '',
    event_date: '',
    event_address: '',
    theme: '',
    message: '',
    status: 'confirmed',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/admin/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to create booking');
      return;
    }

    router.push('/admin/bookings');
    router.refresh();
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">Tambah Booking</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Produk</label>
          <select
            required
            value={form.product_id}
            onChange={(e) => update('product_id', e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Pilih produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tema</label>
          <input
            type="text"
            placeholder="mis. Superhero, Princess, Balon Emas"
            value={form.theme}
            onChange={(e) => update('theme', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tanggal Acara</label>
          <input
            type="date"
            required
            value={form.event_date}
            onChange={(e) => update('event_date', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nama Customer</label>
          <input
            type="text"
            required
            value={form.customer_name}
            onChange={(e) => update('customer_name', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">No. HP</label>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Alamat Acara</label>
          <textarea
            required
            value={form.event_address}
            onChange={(e) => update('event_address', e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pesan / Catatan</label>
          <textarea
            placeholder="Catatan tambahan dari percakapan WhatsApp"
            value={form.message}
            onChange={(e) => update('message', e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Hanya booking berstatus "confirmed" yang mengurangi kapasitas tanggal.
          </p>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-pink-600 text-white rounded px-4 py-2 font-medium hover:bg-pink-700 transition disabled:opacity-50"
        >
          {submitting ? 'Menyimpan…' : 'Simpan Booking'}
        </button>
      </form>
    </main>
  );
}
