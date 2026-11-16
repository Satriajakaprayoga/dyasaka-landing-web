"use client";

import { useEffect, useState } from "react";
import { getDateCapacityRange, isDateAvailable } from "@/lib/booking-helpers";
import { addMonths, formatDateID, toDateKey, todayKey } from "@/lib/date";
import { useMediaQuery } from "@/components/useMediaQuery";
import type { DateCapacity } from "@/lib/types";

type Props = {
  /** Number of months to show ahead of today (non-compact mode). Default 2. */
  monthsAhead?: number;
  /** Compact single-month view with month navigation (for product pages). */
  compact?: boolean;
};

/** Compact mode: how far ahead visitors may browse. */
const MAX_MONTH_NAV = 6;

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
  // On phones the multi-month view is a very long page, so it collapses
  // to one navigable month. Desktop keeps the full horizon.
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const singleMonth = compact || isNarrow;
  const months = singleMonth
    ? [addMonths(today, monthOffset)]
    : Array.from({ length: monthsAhead }, (_, i) => addMonths(today, i));

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const rangeStart = singleMonth
    ? toDateKey(
        new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1),
      )
    : toDateKey(today);
  const rangeEnd = singleMonth
    ? toDateKey(
        new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
      )
    : toDateKey(addMonths(today, monthsAhead));

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

  const todayISO = todayKey();
  const weekdays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

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
              {singleMonth ? (
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
              <div
                className="grid grid-cols-7 gap-1"
                aria-busy="true"
                aria-label="Memuat ketersediaan"
              >
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-7 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            ) : (
              <div
                role="grid"
                aria-label={`Ketersediaan ${label}`}
                className="grid grid-cols-7 gap-1 text-xs"
              >
                <div role="row" className="contents">
                  {weekdays.map((d) => (
                    <div
                      key={d}
                      role="columnheader"
                      className="pb-1 text-center text-[11px] font-medium text-gray-500"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {Array.from(
                  { length: Math.ceil(cells.length / 7) },
                  (_, weekIndex) => (
                    <div
                      key={weekIndex}
                      role="row"
                      className="contents"
                    >
                      {cells
                        .slice(weekIndex * 7, weekIndex * 7 + 7)
                        .map((date, dayIndex) => {
                          const key = weekIndex * 7 + dayIndex;
                          if (!date) {
                            return (
                              <div
                                key={key}
                                role="gridcell"
                                aria-hidden="true"
                              />
                            );
                          }
                          const iso = toDateKey(date);
                          const isPast = iso < todayISO;
                          const isToday = iso === todayISO;
                          const available = isDateAvailable(
                            iso,
                            capacityMap,
                            2,
                          );
                          const statusLabel = isPast
                            ? "sudah lewat"
                            : available
                              ? "tersedia"
                              : "penuh";

                          return (
                            <div
                              key={key}
                              role="gridcell"
                              aria-label={`${formatDateID(iso)}: ${statusLabel}${isToday ? ", hari ini" : ""}`}
                              title={
                                isPast
                                  ? undefined
                                  : available
                                    ? "Tersedia"
                                    : "Penuh"
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
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="col-span-full mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded border border-green-200 bg-green-50"
          />
          Tersedia
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded border border-red-200 bg-red-50"
          />
          Penuh
        </span>
        {singleMonth && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded border border-pink-400"
            />
            Hari ini
          </span>
        )}
      </div>
    </div>
  );
}
