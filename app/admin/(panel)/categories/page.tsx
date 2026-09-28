"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import {
  Card,
  EmptyState,
  btnPrimary,
  inputClass,
} from "@/components/admin/ui";
import { PlusIcon, TagIcon } from "@/components/admin/icons";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRemoveCategory(id: string) {
    const category = categories.find((c) => c.id === id);
    if (!confirm(`Hapus kategori "${category?.name}"?`)) return;

    setLoadingId(id);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setLoadingId(null);

    if (error) {
      setError(error.message ?? "Failed to remove category");
      return;
    }

    loadCategories();
  }

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setCategories((data ?? []) as Category[]);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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
      setError(body.error ?? "Failed to create category");
      return;
    }

    setName("");
    loadCategories();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Kategori</h1>
        <p className="mt-1 text-sm text-gray-500">
          {categories.length > 0
            ? `${categories.length} kategori terdaftar`
            : "Kelola kategori produk"}
        </p>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
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
        {categories.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <TagIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">{c.slug}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(c.id)}
                  disabled={loadingId === c.id}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {loadingId === c.id ? "Menghapus…" : "Hapus"}
                </button>
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
