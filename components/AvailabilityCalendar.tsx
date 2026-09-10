"use client";

import { useEffect, useState } from "react";
import { getDateCapacityRange, isDateAvailable } from "@/lib/booking-helpers";
import type { DateCapacity } from "@/lib/types";

type Props = {
  /** Number of months to show ahead of today. Default 2. */
  monthsAhead?: number;
  /** Optional: render a compact single-month view (for embedding on product pages). */
  compact?: boolean;
};

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
  const [capacityMap, setCapacityMap] = useState<Record<string, DateCapacity>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthCount = compact ? 1 : monthsAhead;
  const today = new Date();
  const rangeStart = toISODate(today);
  const rangeEnd = toISODate(addMonths(today, monthCount));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDateCapacityRange(rangeStart, rangeEnd)
      .then((map) => {
        if (!cancelled) setCapacityMap(map);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load availability");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd]);

  if (loading)
    return <div className="text-sm text-gray-500">Loading availability…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  const months = Array.from({ length: monthCount }, (_, i) =>
    addMonths(today, i),
  );

  return (
    <div
      className={compact ? "max-w-sm" : "grid grid-cols-1 sm:grid-cols-2 gap-6"}
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
          <div key={`${year}-${month}`} className="border rounded-lg p-3">
            <div className="font-medium mb-2 text-center">{label}</div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {["S", "S", "R", "K", "J", "S", "M"].map((d, i) => (
                <div key={i} className="text-center text-gray-400 font-medium">
                  {d}
                </div>
              ))}
              {cells.map((date, i) => {
                if (!date) return <div key={i} />;
                const iso = toISODate(date);
                const isPast = date < new Date(new Date().toDateString());
                const available = isDateAvailable(iso, capacityMap, 2);

                return (
                  <div
                    key={i}
                    title={available ? "Tersedia" : "Penuh"}
                    onClick={() => alert(JSON.stringify(capacityMap))}
                    className={[
                      "text-center rounded py-1",
                      isPast
                        ? "text-gray-300"
                        : available
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-400 line-through",
                    ].join(" ")}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="col-span-full flex gap-4 text-xs text-gray-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />
          Tersedia
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />
          Penuh
        </span>
      </div>
    </div>
  );
}
