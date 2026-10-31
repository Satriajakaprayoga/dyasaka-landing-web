"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingStaff, StaffMember, TransactionCategory } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyState,
  btnPrimary,
  formatRupiah,
  inputClass,
} from "@/components/admin/ui";
import { PlusIcon, TrashIcon, UserIcon, WalletIcon } from "@/components/admin/icons";
import ConfirmModal from "@/components/admin/ConfirmModal";

export type StaffAssignmentRow = BookingStaff & {
  staff: { name: string } | null;
};

const statusBadge: Record<BookingStaff["status"], { label: string; tone: "amber" | "green" | "gray" }> = {
  planned: { label: "Rencana", tone: "amber" },
  confirmed: { label: "Dikonfirmasi", tone: "green" },
  cancelled: { label: "Dibatalkan", tone: "gray" },
};

export default function BookingStaffPanel({
  bookingId,
  bookingLabel,
  staff,
  assignments,
  paidByAssignment,
  doubleBooked,
  categories,
}: {
  bookingId: string;
  bookingLabel: string;
  staff: StaffMember[];
  assignments: StaffAssignmentRow[];
  paidByAssignment: Record<string, number>;
  doubleBooked: Record<string, string[]>;
  categories: TransactionCategory[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payFormFor, setPayFormFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffAssignmentRow | null>(null);

  const activeStaff = staff.filter((s) => s.is_active);
  const expectedTotal = assignments
    .filter((a) => a.status !== "cancelled")
    .reduce((sum, a) => sum + Number(a.planned_pay), 0);

  async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let message = `Gagal (HTTP ${res.status})`;
      try {
        const b = await res.json();
        if (b.error) message = b.error;
      } catch {
        // HTML error page — keep the generic message.
      }
      throw new Error(message);
    }
    return res.json();
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = form.elements;
    await run(async () => {
      await api("/api/admin/booking-staff", "POST", {
        booking_id: bookingId,
        staff_id: (f.namedItem("staff_id") as HTMLSelectElement).value,
        role: (f.namedItem("role") as HTMLInputElement).value,
        planned_pay: (f.namedItem("planned_pay") as HTMLInputElement).value || 0,
      });
      form.reset();
    });
  }

  async function handlePay(e: React.FormEvent<HTMLFormElement>, a: StaffAssignmentRow) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const categoryId = (f.namedItem("category_id") as HTMLSelectElement).value;
    if (!categoryId) {
      setError("Kategori pengeluaran tidak tersedia");
      return;
    }
    await run(async () => {
      await api("/api/admin/transactions", "POST", {
        direction: "out",
        amount: (f.namedItem("amount") as HTMLInputElement).value,
        transaction_date: (f.namedItem("transaction_date") as HTMLInputElement).value,
        category_id: categoryId,
        description: (f.namedItem("description") as HTMLInputElement).value,
        booking_id: bookingId,
        booking_staff_id: a.id,
        staff_id: a.staff_id,
      });
      setPayFormFor(null);
    });
  }

  const defaultCategory =
    categories.find((c) => c.name === "Helper pay") ?? categories[0] ?? null;

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Staff & Helper</p>
          <p className="text-xs text-gray-400">
            Rencana bayar {formatRupiah(expectedTotal)} ·{" "}
            {assignments.filter((a) => a.status !== "cancelled").length} orang
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="border-b border-gray-100 px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto]">
          <select
            name="staff_id"
            required
            className={inputClass}
            defaultValue=""
          >
            <option value="" disabled>
              Pilih staff…
            </option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            name="role"
            type="text"
            placeholder="Tugas di acara ini"
            className={inputClass}
          />
          <input
            name="planned_pay"
            type="number"
            min="0"
            step="1000"
            placeholder="Bayar"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className={btnPrimary + " px-3"}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="sr-only">Tambah penugasan</span>
          </button>
        </div>
      </form>

      {error && (
        <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {assignments.length === 0 ? (
        <EmptyState
          title="Belum ada staff yang ditugaskan"
          subtitle="Tugaskan helper dan rencanakan bayarannya di sini."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {assignments.map((a) => {
            const paid = paidByAssignment[a.id] ?? 0;
            const remaining = Math.max(Number(a.planned_pay) - paid, 0);
            const warnings = doubleBooked[a.staff_id] ?? [];
            const badge = statusBadge[a.status];
            return (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {a.staff?.name ?? "Staff terhapus"}
                        </p>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                      <p className="truncate text-xs text-gray-400">
                        {[
                          a.role,
                          `Rencana ${formatRupiah(Number(a.planned_pay))}`,
                          paid > 0
                            ? `Terbayar ${formatRupiah(paid)}`
                            : "Belum dibayar",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {warnings.length > 0 && a.status !== "cancelled" && (
                        <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          Juga ditugaskan di: {warnings.join(", ")} pada tanggal
                          yang sama
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {a.status !== "cancelled" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              api("/api/admin/booking-staff", "PATCH", {
                                id: a.id,
                                status: "cancelled",
                              }).then(() => undefined),
                            )
                          }
                          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setPayFormFor(payFormFor === a.id ? null : a.id)
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <WalletIcon className="h-3.5 w-3.5" />
                          Bayar
                        </button>
                      </>
                    )}
                    {a.status === "planned" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            api("/api/admin/booking-staff", "PATCH", {
                              id: a.id,
                              status: "confirmed",
                            }).then(() => undefined),
                          )
                        }
                        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-green-600 transition hover:bg-green-50"
                      >
                        Konfirmasi
                      </button>
                    )}
                    {paid === 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDelete(a)}
                        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {payFormFor === a.id && a.status !== "cancelled" && (
                  <form
                    onSubmit={(e) => handlePay(e, a)}
                    className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[130px_130px_1fr]">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Jumlah
                        </label>
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          step="1000"
                          required
                          defaultValue={remaining > 0 ? remaining : a.planned_pay}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Tanggal
                        </label>
                        <input
                          name="transaction_date"
                          type="date"
                          defaultValue={new Date().toISOString().slice(0, 10)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Kategori
                        </label>
                        <select
                          name="category_id"
                          defaultValue={defaultCategory?.id ?? ""}
                          className={inputClass}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <input
                      name="description"
                      type="text"
                      defaultValue={`Bayar helper ${a.staff?.name ?? ""} — ${bookingLabel}`}
                      className={inputClass}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPayFormFor(null)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                      >
                        Tutup
                      </button>
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                      >
                        {busy ? "…" : "Catat Pembayaran"}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        title={
          confirmDelete
            ? `Hapus penugasan ${confirmDelete.staff?.name ?? ""}?`
            : ""
        }
        description="Tindakan ini tidak dapat dibatalkan."
        busy={busy}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) {
            return run(async () => {
              await api(`/api/admin/booking-staff?id=${target.id}`, "DELETE");
            });
          }
        }}
        onClose={() => setConfirmDelete(null)}
      >
        <p className="text-gray-600">
          Untuk membatalkan tanpa menghapus, gunakan tombol Batal. Tindakan ini
          tidak dapat dibatalkan.
        </p>
      </ConfirmModal>
    </Card>
  );
}
