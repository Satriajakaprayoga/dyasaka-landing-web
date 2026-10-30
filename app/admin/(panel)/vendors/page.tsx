"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Vendor } from "@/lib/types";
import {
  Badge,
  Breadcrumbs,
  Card,
  EmptyState,
  Skeleton,
  btnPrimary,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { PencilIcon, PlusIcon, UsersIcon, TrashIcon } from "@/components/admin/icons";
import Pagination from "@/components/admin/Pagination";
import ConfirmModal from "@/components/admin/ConfirmModal";

type EditState = {
  name: string;
  phone: string;
  note: string;
  is_active: boolean;
};

const emptyEdit: EditState = { name: "", phone: "", note: "", is_active: true };

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form, setForm] = useState<EditState>(emptyEdit);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [page, setPage] = useState(1);
  const [confirmRow, setConfirmRow] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(vendors.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = vendors.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function loadVendors() {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("name");
      if (error) throw new Error(error.message);
      setVendors((data ?? []) as Vendor[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat vendor");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, []);

  function readEdit(form: HTMLFormElement): EditState {
    return {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      note: (form.elements.namedItem("note") as HTMLInputElement).value,
      is_active: (form.elements.namedItem("is_active") as HTMLInputElement)
        .checked,
    };
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // New vendors start active — the create form has no is_active input.
    const f = e.currentTarget.elements;
    const payload = {
      name: (f.namedItem("name") as HTMLInputElement).value,
      phone: (f.namedItem("phone") as HTMLInputElement).value,
      note: (f.namedItem("note") as HTMLInputElement).value,
    };
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Routes return JSON errors; a crashed server returns an HTML page
        // that .json() cannot parse — fall back to the status code.
        let message = `Gagal menambah vendor (HTTP ${res.status})`;
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
      loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah vendor");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(v: Vendor) {
    setEditingId(v.id);
    setEdit({
      name: v.name,
      phone: v.phone ?? "",
      note: v.note ?? "",
      is_active: v.is_active,
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
    const payload = readEdit(e.currentTarget);

    setBusyId(editingId);
    setError(null);

    try {
      const res = await fetch("/api/admin/vendors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });

      if (!res.ok) {
        let message = `Gagal mengubah vendor (HTTP ${res.status})`;
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
      loadVendors();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah vendor");
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
      const res = await fetch(`/api/admin/vendors?id=${confirmRow.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Gagal menghapus vendor (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      loadVendors();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus vendor");
    } finally {
      closeConfirm();
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Vendor" },
            ]}
          />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Vendor</h1>
        <p className="mt-1 text-sm text-gray-500">
          {vendors.length > 0
            ? `${vendors.length} vendor terdaftar`
            : "Mitra eksternal — jasa (fotografer, badut) dan properti sewa"}
        </p>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <div>
            <label htmlFor="vendor-name" className={labelClass}>
              Nama Vendor
            </label>
            <input
              id="vendor-name"
              name="name"
              type="text"
              required
              placeholder="mis. RW Photograph"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="vendor-phone" className={labelClass}>
              Telepon
            </label>
            <input
              id="vendor-phone"
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
            name="note"
            type="text"
            placeholder="Catatan (opsional) — mis. DP 50%, hafal lokasi Tangerang"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputClass + " sm:col-span-3"}
          />
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Card>

      <Card>
        {initialLoading ? (
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
        ) : vendors.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100">
              {pageItems.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  {editingId === v.id ? (
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
                      <input
                        name="note"
                        type="text"
                        placeholder="Catatan"
                        value={edit.note}
                        onChange={(e) =>
                          setEdit({ ...edit, note: e.target.value })
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
                            disabled={busyId === v.id}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                          >
                            {busyId === v.id ? "…" : "Simpan"}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <UsersIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {v.name}
                            </p>
                            {!v.is_active && <Badge tone="gray">Nonaktif</Badge>}
                          </div>
                          <p className="truncate text-xs text-gray-400">
                            {[v.phone, v.note].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRow(v)}
                          disabled={busyId === v.id}
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
            </ul>
            <div className="border-t border-gray-100 px-4 py-3">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={vendors.length}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Belum ada vendor"
            subtitle="Tambahkan mitra eksternal pertama — jasa atau properti sewa."
          />
        )}
      </Card>

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus vendor "${confirmRow.name}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        <p className="text-gray-600">
          Produk yang terhubung akan lepas dari vendor ini (tidak ikut
          terhapus). Tindakan ini tidak dapat dibatalkan.
        </p>
      </ConfirmModal>
    </div>
  );
}
