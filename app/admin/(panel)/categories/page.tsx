"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  Skeleton,
  btnPrimary,
  inputClass,
} from "@/components/admin/ui";
import { PencilIcon, PlusIcon, TagIcon, TrashIcon } from "@/components/admin/icons";

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setCategories((data ?? []) as Category[]);
    setInitialLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menambah kategori");
      return;
    }

    setName("");
    loadCategories();
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    setBusyId(editingId);
    setError(null);

    const res = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, name: editName }),
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal mengubah kategori");
      return;
    }

    cancelEdit();
    loadCategories();
    router.refresh();
  }

  async function handleDelete(c: Category) {
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;

    setBusyId(c.id);
    setError(null);

    const res = await fetch(`/api/admin/categories?id=${c.id}`, {
      method: "DELETE",
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(
        body.error ??
          "Gagal menghapus kategori (pastikan tidak masih dipakai produk)",
      );
      return;
    }

    loadCategories();
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Kategori" },
            ]}
          />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Kategori</h1>
        <p className="mt-1 text-sm text-gray-500">
          {categories.length > 0
            ? `${categories.length} kategori terdaftar`
            : "Kelola kategori produk"}
        </p>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            placeholder="Nama kategori baru"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={submitting}
            className={btnPrimary + " shrink-0"}
          >
            <PlusIcon className="h-4 w-4" />
            Tambah
          </button>
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
        ) : categories.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <TagIcon className="h-4 w-4" />
                  </span>
                  {editingId === c.id ? (
                    <form onSubmit={handleRename} className="flex flex-1 gap-2">
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass + " py-1.5"}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={busyId === c.id}
                        className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                      >
                        {busyId === c.id ? "…" : "Simpan"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                      >
                        Batal
                      </button>
                    </form>
                  ) : (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {c.name}
                      </p>
                      <p className="truncate text-xs text-gray-400">{c.slug}</p>
                    </div>
                  )}
                </div>
                {editingId !== c.id && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      disabled={busyId === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      {busyId === c.id ? "…" : "Hapus"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada kategori"
            subtitle="Tambahkan kategori pertama untuk mengelompokkan produk."
          />
        )}
      </Card>
    </div>
  );
}
