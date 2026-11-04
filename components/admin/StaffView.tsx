"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffMember } from "@/lib/types";
import {
  useDebouncedValue,
  useInfiniteList,
  useInfiniteSentinel,
} from "./useInfiniteList";
import {
  Badge,
  Card,
  EmptyState,
  Skeleton,
  btnPrimary,
  inputClass,
  labelClass,
} from "./ui";
import { PencilIcon, PlusIcon, UserIcon, TrashIcon } from "./icons";
import ConfirmModal from "./ConfirmModal";

type EditState = {
  name: string;
  phone: string;
  role: string;
  pay_basis: string;
  notes: string;
  is_active: boolean;
};

const emptyEdit: EditState = {
  name: "",
  phone: "",
  role: "",
  pay_basis: "",
  notes: "",
  is_active: true,
};

/**
 * Staff screen: search + infinite-scroll list with the create form,
 * inline edit (incl. is_active) and delete. Creates and edits refetch
 * (name-sorted); deletes patch the list locally.
 */
export default function StaffView() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);

  const list = useInfiniteList<StaffMember>("/api/admin/staff", { search: debouncedQ }, 12);

  // Filter changes restart from batch 1 — scroll back to the top
  // (skipped on the initial mount).
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [debouncedQ]);

  const [form, setForm] = useState<EditState>(emptyEdit);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [confirmRow, setConfirmRow] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const payload = {
      name: (f.namedItem("name") as HTMLInputElement).value,
      phone: (f.namedItem("phone") as HTMLInputElement).value,
      role: (f.namedItem("role") as HTMLInputElement).value,
      pay_basis: (f.namedItem("pay_basis") as HTMLInputElement).value,
      notes: (f.namedItem("notes") as HTMLInputElement).value,
    };
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Routes return JSON errors; a crashed server returns an HTML page
        // that .json() cannot parse — fall back to the status code.
        let message = `Gagal menambah staff (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      setForm(emptyEdit);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah staff");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(s: StaffMember) {
    setEditingId(s.id);
    setEdit({
      name: s.name,
      phone: s.phone ?? "",
      role: s.role ?? "",
      pay_basis: s.pay_basis ?? "",
      notes: s.notes ?? "",
      is_active: s.is_active,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEdit(emptyEdit);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    const f = e.currentTarget.elements;
    const payload = {
      name: (f.namedItem("name") as HTMLInputElement).value,
      phone: (f.namedItem("phone") as HTMLInputElement).value,
      role: (f.namedItem("role") as HTMLInputElement).value,
      pay_basis: (f.namedItem("pay_basis") as HTMLInputElement).value,
      notes: (f.namedItem("notes") as HTMLInputElement).value,
      is_active: (f.namedItem("is_active") as HTMLInputElement).checked,
    };

    setBusyId(editingId);
    setError(null);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });

      if (!res.ok) {
        let message = `Gagal mengubah staff (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      cancelEdit();
      list.reload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah staff");
    } finally {
      setBusyId(null);
    }
  }

  function closeConfirm() {
    setConfirmRow(null);
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/staff?id=${confirmRow.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Gagal menghapus staff (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      list.removeLocal(confirmRow.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus staff");
    } finally {
      closeConfirm();
      setDeleting(false);
    }
  }

  // ---------- infinite scroll sentinel ----------
  const sentinelRef = useInfiniteSentinel({
    items: list.items,
    loading: list.loading,
    loadingMore: list.loadingMore,
    error: list.error,
    hasMore: list.hasMore,
    loadMore: list.loadMore,
  });

  // ---------- render ----------
  const hasFilters = q.trim() !== "";

  const counter = list.loading
    ? "Memuat…"
    : `${list.items.length} dari ${list.total} staff`;

  return (
    <>
      <Card className="mb-4 p-4">
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
          <div>
            <label htmlFor="staff-name" className={labelClass}>
              Nama
            </label>
            <input
              id="staff-name"
              name="name"
              type="text"
              required
              placeholder="mis. Budi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="staff-phone" className={labelClass}>
              Telepon
            </label>
            <input
              id="staff-phone"
              name="phone"
              type="text"
              placeholder="08…"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className={btnPrimary + " w-full sm:w-auto"}
            >
              <PlusIcon className="h-4 w-4" />
              Tambah
            </button>
          </div>
          <input
            name="role"
            type="text"
            placeholder="Peran (opsional) — mis. Helper, Sopir, Dekorator"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={inputClass + " sm:col-span-3"}
          />
          <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
            <input
              name="pay_basis"
              type="text"
              placeholder="Dasar gaji (opsional) — mis. bulanan, per acara"
              value={form.pay_basis}
              onChange={(e) => setForm({ ...form, pay_basis: e.target.value })}
              className={inputClass}
            />
            <input
              name="notes"
              type="text"
              placeholder="Catatan (opsional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
            />
          </div>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Card>

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="w-full md:w-64">
          <input
            type="search"
            placeholder="Cari nama, telepon, peran…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
            aria-label="Cari staff"
          />
        </div>
        <span className="ml-auto text-xs text-gray-400">{counter}</span>
      </div>

      <Card>
        {list.loading ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : list.error && list.items.length === 0 ? (
          <EmptyState
            title="Gagal memuat"
            subtitle="Periksa koneksi internet Anda lalu coba lagi."
          >
            <button type="button" onClick={list.retry} className={btnPrimary}>
              Coba Lagi
            </button>
          </EmptyState>
        ) : list.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Tidak ada staff yang cocok" : "Belum ada staff"}
            subtitle={
              hasFilters
                ? "Coba ubah kata kunci."
                : "Tambahkan orang pertama — helper acara atau staff tetap."
            }
          >
            {hasFilters && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-sm font-medium text-gray-900 underline underline-offset-4"
              >
                Reset Filter
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {list.items.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  {editingId === s.id ? (
                    <form onSubmit={handleUpdate} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          name="name"
                          type="text"
                          required
                          value={edit.name}
                          onChange={(e) =>
                            setEdit({ ...edit, name: e.target.value })
                          }
                          className={inputClass}
                          autoFocus
                        />
                        <input
                          name="phone"
                          type="text"
                          placeholder="Telepon"
                          value={edit.phone}
                          onChange={(e) =>
                            setEdit({ ...edit, phone: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          name="role"
                          type="text"
                          placeholder="Peran"
                          value={edit.role}
                          onChange={(e) =>
                            setEdit({ ...edit, role: e.target.value })
                          }
                          className={inputClass}
                        />
                        <input
                          name="pay_basis"
                          type="text"
                          placeholder="Dasar gaji"
                          value={edit.pay_basis}
                          onChange={(e) =>
                            setEdit({ ...edit, pay_basis: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <input
                        name="notes"
                        type="text"
                        placeholder="Catatan"
                        value={edit.notes}
                        onChange={(e) =>
                          setEdit({ ...edit, notes: e.target.value })
                        }
                        className={inputClass}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            name="is_active"
                            type="checkbox"
                            checked={edit.is_active}
                            onChange={(e) =>
                              setEdit({ ...edit, is_active: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          Aktif
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={busyId === s.id}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                          >
                            {busyId === s.id ? "…" : "Simpan"}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <UserIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {s.name}
                            </p>
                            {!s.is_active && <Badge tone="gray">Nonaktif</Badge>}
                          </div>
                          <p className="truncate text-xs text-gray-400">
                            {[s.role, s.phone, s.pay_basis]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRow(s)}
                          disabled={busyId === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {list.loadingMore &&
                Array.from({ length: 3 }).map((_, i) => (
                  <li
                    key={`loading-${i}`}
                    aria-hidden="true"
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </li>
                ))}
            </ul>
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              {list.error ? (
                <div className="flex items-center justify-center gap-3">
                  <p className="text-sm text-red-600">Gagal memuat. Coba lagi</p>
                  <button
                    type="button"
                    onClick={list.retry}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : !list.hasMore ? (
                <p className="text-xs text-gray-400">
                  Semua staff sudah ditampilkan
                </p>
              ) : (
                <p className="text-xs text-gray-400">{counter}</p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Single sentinel after the list card */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus staff "${confirmRow.name}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        <p className="text-gray-600">
          Staff yang masih memiliki penugasan tidak bisa dihapus —
          nonaktifkan saja. Tindakan ini tidak dapat dibatalkan.
        </p>
      </ConfirmModal>
    </>
  );
}
