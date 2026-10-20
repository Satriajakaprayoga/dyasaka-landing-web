"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistItem, ChecklistPhase, ChecklistStatus } from "@/lib/types";
import {
  Card,
  RentalStatusBadge,
  btnPrimary,
  btnSecondary,
  formatDateTime,
  inputClass,
} from "./ui";
import { PlusIcon, XIcon } from "./icons";
import ConfirmModal from "./ConfirmModal";
import type { BookingItemRow } from "./BookingItemsPanel";

type StatusOption = { value: ChecklistStatus; label: string };

const stockStatusOptions: StatusOption[] = [
  { value: "pending", label: "Menunggu" },
  { value: "in_stock", label: "Stok Ada" },
  { value: "need_order", label: "Perlu Pesan" },
  { value: "done", label: "Selesai" },
];

const simpleStatusOptions: StatusOption[] = [
  { value: "pending", label: "Menunggu" },
  { value: "done", label: "Selesai" },
];

const phases: {
  key: ChecklistPhase;
  title: string;
  description: string;
}[] = [
  {
    key: "stock_check",
    title: "Persiapan Stok",
    description: "Pastikan semua item tersedia atau dipesan.",
  },
  {
    key: "pickup",
    title: "Pengambilan",
    description: "Barang keluar gudang menuju lokasi acara.",
  },
  {
    key: "return",
    title: "Pengembalian",
    description: "Barang sewa kembali dan diperiksa.",
  },
];

type Props = {
  bookingId: string;
  items: ChecklistItem[];
  bookingItems: BookingItemRow[];
  dpReceivedAt: string | null;
};

function PhaseSection({
  bookingId,
  phase,
  title,
  description,
  rows,
  rentalByBookingItem,
  busy,
  setBusy,
  onError,
}: {
  bookingId: string;
  phase: ChecklistPhase;
  title: string;
  description: string;
  rows: ChecklistItem[];
  rentalByBookingItem: Map<string, BookingItemRow>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [confirmRow, setConfirmRow] = useState<ChecklistItem | null>(null);

  const statusOptions =
    phase === "stock_check" ? stockStatusOptions : simpleStatusOptions;

  async function handleStatusChange(id: string, status: ChecklistStatus) {
    setBusy(true);
    onError(null);

    const res = await fetch("/api/admin/checklist-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      onError(body.error ?? "Gagal mengubah status");
      return;
    }

    router.refresh();
  }

  async function handleNoteBlur(row: ChecklistItem) {
    const draft = noteDrafts[row.id];
    if (draft === undefined) return;

    setNoteDrafts((d) => {
      const next = { ...d };
      delete next[row.id];
      return next;
    });

    const note = draft.trim();
    if (note === (row.note ?? "")) return;

    setBusy(true);
    onError(null);

    const res = await fetch("/api/admin/checklist-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, note }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      onError(body.error ?? "Gagal menyimpan catatan");
      return;
    }

    router.refresh();
  }

  async function handleAddRow(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    setBusy(true);
    onError(null);

    const res = await fetch("/api/admin/checklist-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, phase, label: newLabel }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      onError(body.error ?? "Gagal menambah baris");
      return;
    }

    setNewLabel("");
    setAdding(false);
    router.refresh();
  }

  // checklist_items has no children — plain confirm, no impact query.
  function handleDeleteRow(row: ChecklistItem) {
    setConfirmRow(row);
  }

  async function performDelete() {
    if (!confirmRow) return;

    setBusy(true);
    onError(null);

    const res = await fetch(`/api/admin/checklist-items?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      setConfirmRow(null);
      setBusy(false);
      onError(body.error ?? "Gagal menghapus baris");
      return;
    }

    setConfirmRow(null);
    setBusy(false);
    router.refresh();
  }

  function optionsFor(row: ChecklistItem): StatusOption[] {
    if (statusOptions.some((o) => o.value === row.status)) {
      return statusOptions;
    }
    // Keep unexpected stored statuses selectable instead of rendering blank.
    return [{ value: row.status, label: row.status }, ...statusOptions];
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Baris bebas
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleAddRow}
          className="mb-3 flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <input
            type="text"
            required
            maxLength={200}
            placeholder="mis. Cek kiriman ice box tambahan"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className={btnPrimary + " shrink-0"}
          >
            Tambah
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewLabel("");
            }}
            className={btnSecondary + " shrink-0"}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          Tidak ada baris pada fase ini.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => {
            const rental = row.booking_item_id
              ? rentalByBookingItem.get(row.booking_item_id)
              : undefined;
            const noteDraft = noteDrafts[row.id];

            return (
              <li key={row.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={
                      "min-w-0 flex-1 text-sm " +
                      (row.status === "done"
                        ? "text-gray-400 line-through"
                        : "font-medium text-gray-900")
                    }
                  >
                    {row.label}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {rental?.rental_status && (
                      <RentalStatusBadge status={rental.rental_status} />
                    )}
                    <select
                      value={row.status}
                      disabled={busy}
                      onChange={(e) =>
                        handleStatusChange(
                          row.id,
                          e.target.value as ChecklistStatus,
                        )
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
                    >
                      {optionsFor(row).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row)}
                      disabled={busy}
                      title="Hapus baris"
                      className="rounded-lg px-1.5 py-1 text-gray-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <input
                    type="text"
                    placeholder="Catatan…"
                    value={noteDraft ?? row.note ?? ""}
                    onChange={(e) =>
                      setNoteDrafts((d) => ({ ...d, [row.id]: e.target.value }))
                    }
                    onBlur={() => handleNoteBlur(row)}
                    className="flex-1 rounded-lg border border-transparent bg-gray-50 px-2 py-1 text-xs text-gray-600 transition hover:border-gray-200 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {row.completed_at && (
                    <span className="shrink-0">
                      Selesai {formatDateTime(row.completed_at)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus baris "${confirmRow.label}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={busy}
        onConfirm={performDelete}
        onClose={() => setConfirmRow(null)}
      />
    </Card>
  );
}

export default function ChecklistPanel({
  bookingId,
  items,
  bookingItems,
  dpReceivedAt,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rentalByBookingItem = new Map(
    bookingItems.map((bi) => [bi.id, bi]),
  );

  if (items.length === 0 && !dpReceivedAt) {
    return (
      <Card className="p-6">
        <div className="text-center text-sm text-gray-500">
          Checklist dibuat otomatis saat DP ditandai diterima.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {items.length === 0 && (
        <Card className="p-4">
          <p className="text-center text-sm text-gray-500">
            Belum ada baris checklist.
          </p>
        </Card>
      )}
      {phases.map((p) => (
        <PhaseSection
          key={p.key}
          bookingId={bookingId}
          phase={p.key}
          title={p.title}
          description={p.description}
          rows={items
            .filter((i) => i.phase === p.key)
            .sort((a, b) => a.sort_order - b.sort_order)}
          rentalByBookingItem={rentalByBookingItem}
          busy={busy}
          setBusy={setBusy}
          onError={setError}
        />
      ))}
    </div>
  );
}
