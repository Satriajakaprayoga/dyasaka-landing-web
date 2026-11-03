"use client";

import Link from "next/link";
import type { BookingStatus } from "@/lib/types";
import {
  bookingStatusOptions,
  type BookingRow,
} from "./BookingsTable";
import {
  BookingStatusBadge,
  ProjectStatusBadge,
  Skeleton,
  formatDate,
} from "./ui";
import { EyeIcon, PencilIcon, TrashIcon } from "./icons";

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

// Card view — the phone default (1 column) and the desktop/tablet
// alternative via the view toggle (2–3 columns). Presentation only:
// data, filters and the delete/status flows live in BookingsView. The
// inline status select is preserved here too — status changes are the
// most common phone action on this list.
export default function BookingCardList({
  items,
  deletingId,
  statusBusyId,
  loadingMore = false,
  onStatusChange,
  onDelete,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((b) => (
        <div
          key={b.id}
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/admin/bookings/${b.id}`}
              className="text-sm font-semibold text-gray-900 hover:underline underline-offset-2"
            >
              {formatDate(b.event_date)}
            </Link>
            <BookingStatusBadge status={b.status} />
          </div>

          <div className="mt-2 min-w-0">
            <Link
              href={`/admin/bookings/${b.id}`}
              className="block truncate text-sm font-medium text-gray-900 hover:underline underline-offset-2"
            >
              {b.customer_name}
            </Link>
            <p className="truncate text-xs text-gray-400">{b.phone}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {b.products?.name ?? "Custom"}
            </span>
            {b.theme && (
              <span className="max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {b.theme}
              </span>
            )}
          </div>

          {/* Inline status editing + project stage mirror, same as the
              table row. */}
          <div className="mt-3 flex items-center gap-2">
            <select
              value={b.status}
              disabled={statusBusyId === b.id}
              onChange={(e) =>
                onStatusChange(b, e.target.value as BookingStatus)
              }
              title="Ubah status"
              aria-label={`Ubah status booking ${b.customer_name}`}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            >
              {bookingStatusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ProjectStatusBadge status={b.project_status} />
          </div>

          {/* mt-auto pins actions to the bottom so grid rows stretch
              to equal heights. */}
          <div className="mt-auto pt-3">
            <div className="flex gap-2 border-t border-gray-100 pt-3 md:justify-end">
              <Link
                href={`/admin/bookings/${b.id}`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 md:min-h-0 md:flex-none md:border-0 md:px-2.5 md:py-1.5"
              >
                <EyeIcon className="h-3.5 w-3.5" />
                Detail
              </Link>
              <Link
                href={`/admin/bookings/${b.id}/edit`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 md:min-h-0 md:flex-none md:border-0 md:px-2.5 md:py-1.5"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                Ubah
              </Link>
              <button
                type="button"
                onClick={() => onDelete(b)}
                disabled={deletingId === b.id}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 md:min-h-0 md:flex-none md:border-0 md:px-2.5 md:py-1.5"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {deletingId === b.id ? "…" : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {loadingMore &&
        Array.from({ length: 3 }).map((_, i) => (
          <BookingCardSkeleton key={`loading-${i}`} />
        ))}
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
      <div className="mt-2 flex gap-1.5">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-8 w-32 rounded-lg" />
      <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3 md:justify-end">
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
      </div>
    </div>
  );
}
