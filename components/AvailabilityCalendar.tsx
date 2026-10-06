"use client";

import { useEffect, useState } from "react";
import { getDateCapacityRange, isDateAvailable } from "@/lib/booking-helpers";
import type { DateCapacity } from "@/lib/types";

type Props = {
  /** Number of months to show ahead of today (non-compact mode). Default 2. */
  monthsAhead?: number;
  /** Compact single-month view with month navigation (for product pages). */
  compact?: boolean;
};

/** Compact mode: how far ahead visitors may browse. */
const MAX_MONTH_NAV = 6;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

/**
 * Read-only availability calendar. Shows which dates are already at
 * capacity (business fully booked) vs. still open. Never displays
 * customer or booking details — only reads from `date_capacity`.
 */
export function AvailabilityCalendar({
  monthsAhead = 2,
  compact = false,
}: Props) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [capacityMap, setCapacityMap] = useState<Record<string, DateCapacity>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const months = compact
    ? [addMonths(today, monthOffset)]
    : Array.from({ length: monthsAhead }, (_, i) => addMonths(today, i));

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const rangeStart = compact
    ? toISODate(
        new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1),
      )
    : toISODate(today);
  const rangeEnd = compact
    ? toISODate(
        new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
      )
    : toISODate(addMonths(today, monthsAhead));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDateCapacityRange(rangeStart, rangeEnd)
      .then((map) => {
        if (!cancelled) setCapacityMap(map);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Gagal memuat ketersediaan");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd]);

  if (error) return <div className="text-sm text-red-500">{error}</div>;

  const todayISO = toISODate(today);

  return (
    <div
      className={
        compact ? "max-w-sm" : "grid grid-cols-1 gap-6 sm:grid-cols-2"
      }
    >
      {months.map((monthDate) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const cells = getMonthGrid(year, month);
        const label = monthDate.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });

        return (
          <div
            key={`${year}-${month}`}
            className="rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="mb-3 flex min-h-9 items-center justify-between">
              {compact ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
                    disabled={monthOffset === 0}
                    aria-label="Bulan sebelumnya"
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-600 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30"
                  >
                    &lsaquo;
                  </button>
                  <div className="font-semibold text-gray-900">{label}</div>
                  <button
                    type="button"
                    onClick={() =>
                      setMonthOffset((o) => Math.min(MAX_MONTH_NAV, o + 1))
                    }
                    disabled={monthOffset >= MAX_MONTH_NAV}
                    aria-label="Bulan berikutnya"
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-600 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-30"
                  >
                    &rsaquo;
                  </button>
                </>
              ) : (
                <div className="w-full text-center font-semibold text-gray-900">
                  {label}
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-7 gap-1" aria-busy="true">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-7 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 text-xs">
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
                  <div
                    key={d}
                    className="pb-1 text-center text-[11px] font-medium text-gray-400"
                  >
                    {d}
                  </div>
                ))}
                {cells.map((date, i) => {
                  if (!date) return <div key={i} />;
                  const iso = toISODate(date);
                  const isPast = iso < todayISO;
                  const isToday = iso === todayISO;
                  const available = isDateAvailable(iso, capacityMap, 2);

                  return (
                    <div
                      key={i}
                      title={
                        isPast ? undefined : available ? "Tersedia" : "Penuh"
                      }
                      className={[
                        "flex h-7 items-center justify-center rounded-lg text-center",
                        isPast
                          ? "text-gray-300"
                          : available
                            ? "bg-green-50 font-medium text-green-700"
                            : "bg-red-50 text-red-400 line-through",
                        isToday ? "ring-1 ring-pink-400" : "",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="col-span-full mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-green-200 bg-green-50" />
          Tersedia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-red-200 bg-red-50" />
          Penuh
        </span>
        {compact && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-pink-400" />
            Hari ini
          </span>
        )}
      </div>
    </div>
  );
}
