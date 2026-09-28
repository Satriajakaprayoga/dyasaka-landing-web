'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Booking, BookingStatus, Product } from '@/lib/types';
import {
  Card,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from './ui';
import { PlusIcon } from './icons';

type Props = {
  products: Product[];
  booking?: Booking;
};

export default function BookingForm({ products, booking }: Props) {
  const router = useRouter();
  const isEdit = Boolean(booking);

  const [form, setForm] = useState({
    product_id: booking?.product_id ?? '',
    customer_name: booking?.customer_name ?? '',
    phone: booking?.phone ?? '',
    event_date: booking?.event_date ?? '',
    event_address: booking?.event_address ?? '',
    theme: booking?.theme ?? '',
    message: booking?.message ?? '',
    status: booking?.status ?? 'confirmed',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/admin/bookings', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isEdit ? { id: booking!.id, ...form } : form,
      ),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to save booking');
      return;
    }

    router.push('/admin/bookings');
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass}>Produk</label>
          <select
            required
            value={form.product_id}
            onChange={(e) => update('product_id', e.target.value)}
            className={inputClass}
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
          <label className={labelClass}>Tema</label>
          <input
            type="text"
            placeholder="mis. Superhero, Princess, Balon Emas"
            value={form.theme}
            onChange={(e) => update('theme', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Tanggal Acara</label>
            <input
              type="date"
              required
              value={form.event_date}
              onChange={(e) => update('event_date', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                update('status', e.target.value as BookingStatus)
              }
              className={inputClass}
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="done">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
        <p className="-mt-3 text-xs text-gray-400">
          Hanya booking berstatus &quot;confirmed&quot; yang mengurangi
          kapasitas tanggal.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nama Customer</label>
            <input
              type="text"
              required
              value={form.customer_name}
              onChange={(e) => update('customer_name', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>No. HP</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Alamat Acara</label>
          <textarea
            required
            value={form.event_address}
            onChange={(e) => update('event_address', e.target.value)}
            className={inputClass}
            rows={2}
          />
        </div>

        <div>
          <label className={labelClass}>Pesan / Catatan</label>
          <textarea
            placeholder="Catatan tambahan dari percakapan WhatsApp"
            value={form.message}
            onChange={(e) => update('message', e.target.value)}
            className={inputClass}
            rows={3}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={() => router.push('/admin/bookings')}
            className={btnSecondary}
          >
            Batal
          </button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            <PlusIcon className="h-4 w-4" />
            {submitting
              ? 'Menyimpan…'
              : isEdit
                ? 'Simpan Perubahan'
                : 'Simpan Booking'}
          </button>
        </div>
      </form>
    </Card>
  );
}
