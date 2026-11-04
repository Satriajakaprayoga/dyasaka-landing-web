"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import {
  useDebouncedValue,
  useInfiniteList,
  useInfiniteSentinel,
} from "./useInfiniteList";
import {
  Card,
  EmptyState,
  Skeleton,
  btnPrimary,
  inputClass,
} from "./ui";
import { PencilIcon, PlusIcon, TagIcon, TrashIcon } from "./icons";
import ConfirmModal from "./ConfirmModal";

type Impact = { blocked: boolean; lines: { text: string; danger: boolean }[] };

/**
 * Categories screen: search + infinite-scroll list with the create
 * form, inline rename and the impact-checked delete. Creates and
 * renames refetch (name-sorted); deletes patch the list locally.
 */
export default function CategoriesView() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);

  const list = useInfiniteList<Category>("/api/admin/categories", { search: debouncedQ }, 12);

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

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmRow, setConfirmRow] = useState<Category | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Gagal menambah kategori");
      return;
    }

    setName("");
    list.reload();
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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Gagal mengubah kategori");
      return;
    }

    cancelEdit();
    list.reload();
    router.refresh();
  }

  // categories is RESTRICT-referenced by products AND items — either
  // one blocks the delete.
  async function computeImpact(c: Category): Promise<Impact> {
    const [products, items] = await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", c.id),
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("category_id", c.id),
    ]);

    const lines: Impact["lines"] = [];
    const blocked = (products.count ?? 0) > 0 || (items.count ?? 0) > 0;

    if ((products.count ?? 0) > 0) {
      lines.push({
        text: `Masih dipakai ${products.count} produk — pindahkan produk ke kategori lain terlebih dahulu.`,
        danger: true,
      });
    }
    if ((items.count ?? 0) > 0) {
      lines.push({
        text: `Masih dipakai ${items.count} item inventori — pindahkan item ke kategori lain terlebih dahulu.`,
        danger: true,
      });
    }
    if (lines.length === 0) {
      lines.push({ text: "Tidak ada data terkait — aman untuk dihapus.", danger: false });
    }
    return { blocked, lines };
  }

  function closeConfirm() {
    setConfirmRow(null);
    setImpact(null);
  }

  async function handleDeleteClick(c: Category) {
    setConfirmRow(c);
    setImpact(null);
    setImpact(await computeImpact(c));
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/admin/categories?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      closeConfirm();
      setDeleting(false);
      setError(body.error ?? "Gagal menghapus kategori");
      return;
    }

    closeConfirm();
    setDeleting(false);
    list.removeLocal(confirmRow.id);
    router.refresh();
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
    : `${list.items.length} dari ${list.total} kategori`;

  return (
    <>
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

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="w-full md:w-64">
          <input
            type="search"
            placeholder="Cari nama kategori…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
            aria-label="Cari kategori"
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
            title={hasFilters ? "Tidak ada kategori yang cocok" : "Belum ada kategori"}
            subtitle={
              hasFilters
                ? "Coba ubah kata kunci."
                : "Tambahkan kategori pertama untuk mengelompokkan produk."
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
              {list.items.map((c) => (
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
                        onClick={() => handleDeleteClick(c)}
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
                  Semua kategori sudah ditampilkan
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
        title={confirmRow ? `Hapus kategori "${confirmRow.name}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        disabled={impact?.blocked ?? false}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        {!impact ? (
          <p className="text-gray-500">Memeriksa relasi data…</p>
        ) : (
          impact.lines.map((line, i) => (
            <p
              key={i}
              className={
                line.danger
                  ? "font-medium text-red-600"
                  : "text-gray-600"
              }
            >
              {line.text}
            </p>
          ))
        )}
      </ConfirmModal>
    </>
  );
}
