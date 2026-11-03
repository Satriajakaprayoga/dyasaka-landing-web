"use client";

import Link from "next/link";
import type { Booking, BookingStatus, Product } from "@/lib/types";
import {
  BookingStatusBadge,
  Card,
  ProjectStatusBadge,
  Skeleton,
  formatDate,
} from "./ui";
import { EyeIcon, PencilIcon, TrashIcon } from "./icons";

export type BookingRow = Booking & { products: Pick<Product, "name"> | null };

export const bookingStatusOptions: { value: BookingStatus; label: string }[] =
  [
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "done", label: "Selesai" },
    { value: "cancelled", label: "Dibatalkan" },
  ];

type Props = {
  items: BookingRow[];
  deletingId: string | null;
  /** Id whose inline status select is mid-update. */
  statusBusyId: string | null;
  /** True while the next infinite-scroll batch is being fetched. */
  loadingMore?: boolean;
  onStatusChange: (b: BookingRow, status: BookingStatus) => void;
  onDelete: (b: BookingRow) => void;
};

// Desktop/tablet table view — presentation only. Data, filters and the
// delete/status flows live in BookingsView.
export default function BookingsTable({
  items,
  deletingId,
  statusBusyId,
  loadingMore = false,
  onStatusChange,
  onDelete,
}: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Tanggal
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Produk
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Tema
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Customer
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Status
              </th>
              {/* Fixed min-width so Detail/Ubah/Hapus never clip. */}
              <th className="sticky top-0 z-10 min-w-[13rem] bg-gray-50 px-4 py-3 text-right font-medium">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((b) => (
              <tr key={b.id} className="transition hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="hover:underline underline-offset-2"
                  >
                    {formatDate(b.event_date)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {b.products?.name ?? "Custom"}
                </td>
                <td className="px-4 py-3 text-gray-600">{b.theme ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="font-medium text-gray-900 hover:underline underline-offset-2"
                  >
                    {b.customer_name}
                  </Link>
                  <div className="text-xs text-gray-400">{b.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={b.status}
                    disabled={statusBusyId === b.id}
                    onChange={(e) =>
                      onStatusChange(b, e.target.value as BookingStatus)
                    }
                    title="Ubah status"
                    aria-label={`Ubah status booking ${b.customer_name}`}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
                  >
                    {bookingStatusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5 flex flex-col items-start gap-1">
                    <BookingStatusBadge status={b.status} />
                    <ProjectStatusBadge status={b.project_status} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Detail
                    </Link>
                    <Link
                      href={`/admin/bookings/${b.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      Ubah
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(b)}
                      disabled={deletingId === b.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      {deletingId === b.id ? "…" : "Hapus"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {loadingMore &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`loading-${i}`} aria-hidden="true">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="hidden h-4 w-24 sm:block" />
                      <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
