"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus, InvoiceType, ProjectStatus } from "@/lib/types";
import { btnPrimary, btnSecondary, inputClass } from "./ui";

const projectStatusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "not_started", label: "Belum Mulai" },
  { value: "preparing", label: "Persiapan" },
  { value: "ready", label: "Siap" },
  { value: "in_progress", label: "Berlangsung" },
  { value: "returning", label: "Pengembalian" },
  { value: "completed", label: "Proyek Selesai" },
];

export type InvoiceRef = {
  id: string;
  status: InvoiceStatus;
  invoice_type: InvoiceType;
};

type Props = {
  bookingId: string;
  dpReceivedAt: string | null;
  projectStatus: ProjectStatus;
  invoices: InvoiceRef[];
};

export default function BookingDetailActions({
  bookingId,
  dpReceivedAt,
  projectStatus,
  invoices,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, ...payload }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Gagal menyimpan");
        return;
      }

      router.refresh();
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(invoiceType: InvoiceType) {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, invoice_type: invoiceType }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Gagal membuat invoice");
        return;
      }

      const { invoice } = await res.json();
      router.push(`/admin/bookings/${bookingId}/invoice/${invoice.id}`);
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function markDpReceived() {
    if (
      !confirm(
        "Tandai DP diterima? Checklist 3 fase (stok, pengambilan, pengembalian) akan dibuat otomatis.",
      )
    )
      return;

    void patch({ dp_received_at: new Date().toISOString() });
  }

  // One slot per type: a live (non-void) invoice shows as a link; a
  // voided one frees the slot for a replacement (void + reissue).
  const liveByType: Record<InvoiceType, InvoiceRef | undefined> = {
    dp: invoices.find((i) => i.invoice_type === "dp" && i.status !== "void"),
    final: invoices.find(
      (i) => i.invoice_type === "final" && i.status !== "void",
    ),
  };
  const hasVoided = invoices.some((i) => i.status === "void");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-500">
        Status Proyek
        <select
          value={projectStatus}
          disabled={busy}
          onChange={(e) =>
            patch({ project_status: e.target.value as ProjectStatus })
          }
          className={`${inputClass} w-auto`}
        >
          {projectStatusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {dpReceivedAt ? (
        <span className={btnSecondary + " cursor-default"}>DP Diterima</span>
      ) : (
        <button
          type="button"
          onClick={markDpReceived}
          disabled={busy}
          className={btnPrimary}
        >
          Tandai DP Diterima
        </button>
      )}

      {liveByType.dp ? (
        <a
          href={`/admin/bookings/${bookingId}/invoice/${liveByType.dp.id}`}
          className={btnSecondary}
        >
          Invoice DP
        </a>
      ) : (
        <button
          type="button"
          onClick={() => createInvoice("dp")}
          disabled={busy}
          className={btnSecondary}
          title={
            dpReceivedAt
              ? undefined
              : "Biasanya dibuat saat meminta deposit dari pelanggan"
          }
        >
          + Invoice DP
        </button>
      )}

      {liveByType.final ? (
        <a
          href={`/admin/bookings/${bookingId}/invoice/${liveByType.final.id}`}
          className={btnPrimary}
        >
          Invoice Final
        </a>
      ) : (
        <button
          type="button"
          onClick={() => createInvoice("final")}
          disabled={busy}
          className={btnPrimary}
        >
          {hasVoided ? "Terbitkan Ulang Invoice Final" : "Buat Invoice Final"}
        </button>
      )}
    </div>
  );
}
