"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Booking, BookingStatus, Product } from "@/lib/types";
import {
  BookingStatusBadge,
  Card,
  EmptyState,
  formatDate,
  inputClass,
} from "./ui";
import { PencilIcon, TrashIcon } from "./icons";

type Row = Booking & { products: Pick<Product, "name"> };

const statusOptions: { value: BookingStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "done", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

type PeriodFilter = "all" | "upcoming" | "past";

export default function BookingsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  const today = new Date().toISOString().slice(0, 10);

  const filtered = rows.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (periodFilter === "upcoming" && b.event_date < today) return false;
    if (periodFilter === "past" && b.event_date >= today) return false;

    const q = query.trim().toLowerCase();
    if (q) {
      const haystack = [
        b.customer_name,
        b.phone,
        b.theme ?? "",
        b.products?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  async function handleStatusChange(b: Row, status: BookingStatus) {
    setBusyId(b.id);
    setError(null);

    const res = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, status }),
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal mengubah status");
      return;
    }

    router.refresh();
  }

  async function handleDelete(b: Row) {
    if (
      !confirm(
        `Hapus booking ${b.customer_name} (${formatDate(b.event_date)})?`,
      )
    )
      return;

    setBusyId(b.id);
    setError(null);

    const res = await fetch(`/api/admin/bookings?id=${b.id}`, {
      method: "DELETE",
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menghapus booking");
      return;
    }

    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <Card className="overflow-hidden">
        <EmptyState
          title="Belum ada booking"
          subtitle="Catat booking pertama Anda untuk mulai mengelola jadwal."
        >
          <Link href="/admin/bookings/new" className="text-sm font-medium text-gray-900 underline underline-offset-4">
            Tambah Booking
          </Link>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Cari customer, telepon, tema…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="w-full sm:w-40">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | BookingStatus)
            }
            className={inputClass}
            aria-label="Filter status booking"
          >
            <option value="all">Semua Status</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className={inputClass}
            aria-label="Filter periode acara"
          >
            <option value="all">Semua Periode</option>
            <option value="upcoming">Akan Datang</option>
            <option value="past">Sudah Lewat</option>
          </select>
        </div>
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} dari {rows.length} booking
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            title="Tidak ada booking yang cocok"
            subtitle="Coba ubah kata kunci atau reset filter."
          >
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setPeriodFilter("all");
              }}
              className="text-sm font-medium text-gray-900 underline underline-offset-4"
            >
              Reset Filter
            </button>
          </EmptyState>
        </Card>
      ) : (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">Tema</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((b) => (
                <tr key={b.id} className="transition hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {formatDate(b.event_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.products?.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.theme ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      {b.customer_name}
                    </span>
                    <div className="text-xs text-gray-400">{b.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={b.status}
                      disabled={busyId === b.id}
                      onChange={(e) =>
                        handleStatusChange(b, e.target.value as BookingStatus)
                      }
                      title="Ubah status"
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
                    >
                      {statusOptions.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1.5">
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/bookings/${b.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                        Ubah
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        disabled={busyId === b.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        {busyId === b.id ? "…" : "Hapus"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}
