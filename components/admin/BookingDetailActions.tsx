"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/lib/types";
import { btnPrimary, btnSecondary, inputClass } from "./ui";

const projectStatusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "not_started", label: "Belum Mulai" },
  { value: "preparing", label: "Persiapan" },
  { value: "ready", label: "Siap" },
  { value: "in_progress", label: "Berlangsung" },
  { value: "returning", label: "Pengembalian" },
  { value: "completed", label: "Proyek Selesai" },
];

type Props = {
  bookingId: string;
  dpReceivedAt: string | null;
  projectStatus: ProjectStatus;
};

export default function BookingDetailActions({
  bookingId,
  dpReceivedAt,
  projectStatus,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, ...payload }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menyimpan");
      return;
    }

    router.refresh();
  }

  function markDpReceived() {
    if (
      !confirm(
        "Tandai DP diterima? Checklist 3 fase (stok, pengambilan, pengembalian) akan dibuat otomatis.",
      )
    )
      return;

    patch({ dp_received_at: new Date().toISOString() });
  }

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
        <span className={btnSecondary + " cursor-default"}>
          DP Diterima
        </span>
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
    </div>
  );
}
