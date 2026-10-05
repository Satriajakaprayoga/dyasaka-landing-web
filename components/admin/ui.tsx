import type { BookingStatus } from "@/lib/types";
import Link from "next/link";
import { ArrowLeftIcon, InboxIcon } from "./icons";

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition";

export const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:cursor-not-allowed disabled:opacity-50";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <span className="text-gray-300" aria-hidden="true">
                /
              </span>
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate text-gray-400 transition hover:text-gray-900"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? "truncate font-medium text-gray-900"
                    : "truncate text-gray-400"
                }
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function BackLink({
  href,
  label = "Kembali",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

const badgeTones = {
  green: "bg-green-100 text-green-700 ring-green-600/20",
  amber: "bg-amber-100 text-amber-700 ring-amber-600/20",
  red: "bg-red-100 text-red-700 ring-red-600/20",
  blue: "bg-blue-100 text-blue-700 ring-blue-600/20",
  gray: "bg-gray-100 text-gray-600 ring-gray-500/20",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

const bookingStatusMap: Record<BookingStatus, { label: string; tone: BadgeTone }> =
  {
    pending: { label: "Pending", tone: "amber" },
    confirmed: { label: "Confirmed", tone: "green" },
    done: { label: "Selesai", tone: "blue" },
    cancelled: { label: "Dibatalkan", tone: "red" },
  };

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = bookingStatusMap[status] ?? { label: status, tone: "gray" as BadgeTone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function EmptyState({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 rounded-full bg-gray-100 p-3 text-gray-400">
        <InboxIcon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
