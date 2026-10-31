"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Supplier } from "@/lib/types";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  Skeleton,
  btnPrimary,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { PencilIcon, PlusIcon, TruckIcon, TrashIcon } from "@/components/admin/icons";
import Pagination from "@/components/admin/Pagination";
import ConfirmModal from "@/components/admin/ConfirmModal";

type EditState = {
  name: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyEdit: EditState = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form, setForm] = useState<EditState>(emptyEdit);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [page, setPage] = useState(1);
  const [confirmRow, setConfirmRow] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = suppliers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function loadSuppliers() {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw new Error(error.message);
      setSuppliers((data ?? []) as Supplier[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat supplier");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function payloadFrom(elements: HTMLFormControlsCollection, withName: boolean) {
    const payload: Record<string, string> = {
      phone: (elements.namedItem("phone") as HTMLInputElement).value,
      address: (elements.namedItem("address") as HTMLInputElement).value,
      notes: (elements.namedItem("notes") as HTMLInputElement).value,
    };
    if (withName) {
      payload.name = (elements.namedItem("name") as HTMLInputElement).value;
    }
    return payload;
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = payloadFrom(e.currentTarget.elements, true);
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = `Gagal menambah supplier (HTTP ${res.status})`;
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
      loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah supplier");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEdit({
      name: s.name,
      phone: s.phone ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
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
    const payload = payloadFrom(e.currentTarget.elements, true);

    setBusyId(editingId);
    setError(null);

    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });

      if (!res.ok) {
        let message = `Gagal mengubah supplier (HTTP ${res.status})`;
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
      loadSuppliers();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah supplier");
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
      const res = await fetch(`/api/admin/suppliers?id=${confirmRow.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Gagal menghapus supplier (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      loadSuppliers();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus supplier");
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
              { label: "Supplier" },
            ]}
          />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Supplier</h1>
        <p className="mt-1 text-sm text-gray-500">
          {suppliers.length > 0
            ? `${suppliers.length} supplier terdaftar`
            : "Tempat membeli barang dan bahan — terpisah dari vendor acara"}
        </p>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
          <div>
            <label htmlFor="supplier-name" className={labelClass}>
              Nama
            </label>
            <input
              id="supplier-name"
              name="name"
              type="text"
              required
              placeholder="mis. Toko Balon Jaya"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="supplier-phone" className={labelClass}>
              Telepon
            </label>
            <input
              id="supplier-phone"
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
            name="address"
            type="text"
            placeholder="Alamat (opsional)"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={inputClass + " sm:col-span-3"}
          />
          <input
            name="notes"
            type="text"
            placeholder="Catatan (opsional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
        ) : suppliers.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100">
              {pageItems.map((s) => (
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
                      <input
                        name="address"
                        type="text"
                        placeholder="Alamat"
                        value={edit.address}
                        onChange={(e) =>
                          setEdit({ ...edit, address: e.target.value })
                        }
                        className={inputClass}
                      />
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
                      <div className="flex justify-end gap-2">
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
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <TruckIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {s.name}
                          </p>
                          <p className="truncate text-xs text-gray-400">
                            {[s.phone, s.address]
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
            </ul>
            <div className="border-t border-gray-100 px-4 py-3">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={suppliers.length}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Belum ada supplier"
            subtitle="Tambahkan toko atau distributor pertama untuk kebutuhan dekorasi."
          />
        )}
      </Card>

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus supplier "${confirmRow.name}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        <p className="text-gray-600">
          Supplier yang masih dipakai pesanan pembelian atau rencana tidak bisa
          dihapus. Tindakan ini tidak dapat dibatalkan.
        </p>
      </ConfirmModal>
    </div>
  );
}
