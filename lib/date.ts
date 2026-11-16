/**
 * Date-only helpers.
 *
 * Business dates (event dates, invoice dates, ledger dates) are calendar
 * days in the business's timezone, not instants in UTC. Converting a local
 * `Date` with `toISOString()` shifts it backwards for UTC+ timezones —
 * e.g. 16 Nov 00:00 in Jakarta becomes "2026-11-15" — so every date-only
 * value here is built from local getters instead.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** Local month as YYYY-MM. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Formats a date-only string (YYYY-MM-DD) in Indonesian, without timezone drift. */
export function formatDateID(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
