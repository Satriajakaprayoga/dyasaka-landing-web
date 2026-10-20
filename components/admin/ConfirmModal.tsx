"use client";

import { useEffect } from "react";
import Link from "next/link";
import { btnSecondary, formatDate } from "./ui";
import { XIcon } from "./icons";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  /** Impact list — blocker/cascade lines, rendered in a bordered box. */
  children?: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  /** Disables the confirm button (e.g. RESTRICT blockers found). */
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// Shared delete-confirmation dialog. Every admin delete opens this with a
// per-row impact check (see docs/routes/README.md "Delete confirmation").
export default function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel = "Hapus",
  busy = false,
  disabled = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={() => !busy && onClose()}
      />

      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Tutup"
            className="-m-1.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {description && (
          <p className="mt-1.5 text-sm text-gray-500">{description}</p>
        )}

        {children && (
          <div className="mt-4 max-h-60 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            {children}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={btnSecondary}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || disabled}
            title={disabled ? "Tidak dapat dihapus" : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Menghapus…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Impact link rows (shared by the per-feature modals) ----------

export type ImpactBookingRef = {
  id: string;
  customer_name: string;
  event_date: string;
  status?: string;
};

export type ImpactProductRef = { id: string; name: string };

const bookingStatusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

export function ModalLinkRow({
  href,
  main,
  sub,
  aside,
}: {
  href: string;
  main: React.ReactNode;
  sub?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mx-1.5 flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition hover:bg-white"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-gray-900">
          {main}
        </span>
        {sub != null && (
          <span className="block truncate text-xs text-gray-500">{sub}</span>
        )}
      </span>
      {aside != null && (
        <span className="shrink-0 text-right text-xs">{aside}</span>
      )}
    </Link>
  );
}

/** Bookings rendered as links into the booking detail pages. Active
 * bookings (pending/confirmed) get a "akan dibatalkan" marker — used by
 * the product modal where the trigger cancels them. */
export function ImpactBookingList({
  bookings,
  max = 5,
}: {
  bookings: ImpactBookingRef[];
  max?: number;
}) {
  return (
    <>
      {bookings.slice(0, max).map((b) => {
        const active = b.status === "pending" || b.status === "confirmed";
        return (
          <ModalLinkRow
            key={b.id}
            href={`/admin/bookings/${b.id}`}
            main={b.customer_name}
            sub={formatDate(b.event_date)}
            aside={
              b.status ? (
                <span
                  className={
                    active
                      ? "font-medium text-red-600"
                      : "text-gray-400"
                  }
                >
                  {active
                    ? "akan dibatalkan"
                    : bookingStatusLabels[b.status] ?? b.status}
                </span>
              ) : undefined
            }
          />
        );
      })}
      {bookings.length > max && (
        <p className="text-xs text-gray-400">
          +{bookings.length - max} booking lainnya
        </p>
      )}
    </>
  );
}

/** Products rendered as links into the recipe editor. */
export function ImpactProductList({
  products,
  max = 5,
}: {
  products: ImpactProductRef[];
  max?: number;
}) {
  return (
    <>
      {products.slice(0, max).map((p) => (
        <ModalLinkRow
          key={p.id}
          href={`/admin/products/${p.id}/edit`}
          main={p.name}
        />
      ))}
      {products.length > max && (
        <p className="text-xs text-gray-400">
          +{products.length - max} produk lainnya
        </p>
      )}
    </>
  );
}
